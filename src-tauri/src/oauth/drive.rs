//! The native credential owner only authorizes this repository-specific transport.
//! No token, arbitrary HTTP endpoint, filesystem path or shell operation is exposed.

use super::*;
use reqwest::{blocking::Response, Method};
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap};

const ORIGIN: &str = "https://www.googleapis.com";
const FILES: &str = "/drive/v3/files";
const UPLOAD: &str = "/upload/drive/v3/files";
const FOLDER: &str = "application/vnd.google-apps.folder";
const BINARY: &str = "application/octet-stream";
const FOLDER_FIELDS: &str = "id,name,mimeType,ownedByMe,shared,trashed,appProperties,capabilities(canAddChildren)";
const FILE_FIELDS: &str = "id,name,size,version,modifiedTime,createdTime,mimeType,parents,ownedByMe,shared,trashed,sha256Checksum,appProperties,capabilities(canDownload)";
const ALL_FIELDS: &str = "id,name,size,version,modifiedTime,createdTime,mimeType,parents,ownedByMe,shared,trashed,sha256Checksum,appProperties,capabilities(canDownload,canAddChildren)";
const DELETE_FIELDS: &str = "nextPageToken,incompleteSearch,files(id,mimeType,ownedByMe,shared,trashed,appProperties)";
const MAX_JSON: usize = 8 * 1024 * 1024;
const MAX_CHUNK: usize = 2 * 1024 * 1024;
const READ_CHUNK: usize = 256 * 1024;
const MAX_FILE: u64 = 9_007_199_254_740_991;
const MAX_TRANSFERS: usize = 12;
const MAX_SESSIONS: usize = 16;

type DriveResult<T> = std::result::Result<T, String>;

fn blocked() -> String { "Blocked an unverified Study Director Drive operation.".into() }
fn changed() -> String { "Google Drive authorization changed. Start a new operation.".into() }
fn network() -> String { "Google Drive connection failed. Retry when online.".into() }
fn invalid() -> String { "Google Drive returned unverified repository information.".into() }
fn auth_error(error: AuthError) -> String { error.to_string() }
fn locked<T>(m: &Mutex<T>) -> DriveResult<MutexGuard<'_, T>> { m.lock().map_err(|_| changed()) }

fn remote_id(value: &str) -> bool {
    (1..=256).contains(&value.len()) && value.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}
fn profile_id(value: &str) -> bool { !value.is_empty() && valid_profile_scope(value) }
fn hex(value: &str, len: usize) -> bool {
    value.len() == len && value.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
fn logical_name(kind: &str, id: &str) -> Option<String> {
    let (prefix, len, extension) = match kind {
        "object" => ("obj_",32,"sdobject"),
        "checkpoint" => ("cp_",32,"sdcheckpoint"),
        "commit" => ("cp_",32,"sdcommit"),
        "session-claim" => ("sc_",16,"sdsessionclaim"),
        "publication" => ("pub_",32,"sdpublication"),
        "maintenance" => ("mnt_",32,"sdmaintenance"),
        _ => return None,
    };
    hex(id.strip_prefix(prefix)?,len).then(|| format!("{id}.{extension}"))
}
fn text<'a>(v: &'a Value, k: &str) -> &'a str { v.get(k).and_then(Value::as_str).unwrap_or("") }
fn private(v: &Value) -> bool {
    v.get("ownedByMe").and_then(Value::as_bool)==Some(true)
        && v.get("shared").and_then(Value::as_bool)==Some(false)
        && v.get("trashed").and_then(Value::as_bool)==Some(false)
}
#[derive(Clone, Debug, PartialEq, Eq)]
struct Folder { id: String, profile: String }
fn folder(v: &Value) -> Option<Folder> {
    let id=text(v,"id"); let p=v.get("appProperties")?.as_object()?;
    let profile=p.get("studyDirectorProfile")?.as_str()?;
    if !private(v) || text(v,"mimeType")!=FOLDER || !remote_id(id) || !profile_id(profile)
        || p.len()!=2 || p.get("studyDirectorFolder")?.as_str()? != "true"
        || v.pointer("/capabilities/canAddChildren").and_then(Value::as_bool)!=Some(true) { return None; }
    Some(Folder{id:id.into(),profile:profile.into()})
}

fn repository_kind(v: &Value, parent: &str) -> Option<(String,String)> {
    let p=v.get("appProperties")?.as_object()?;
    let kind=p.get("studyDirectorRepositoryKind")?.as_str()?;
    let id=p.get("studyDirectorRepositoryId")?.as_str()?;
    if text(v,"mimeType")!=BINARY || v.get("parents")?.as_array()?.as_slice()!=[json!(parent)]
        || p.get("studyDirectorRepository")?.as_str()? != "true"
        || p.get("studyDirectorSecurity")?.as_str()? != "1"
        || p.get("studyDirectorRepositoryVersion")?.as_str()? != if kind=="maintenance" {"2"} else {"1"}
        || text(v,"name")!=logical_name(kind,id)?
    { return None; }
    if !matches!(kind,"publication"|"maintenance") && !hex(p.get("studyDirectorSha256")?.as_str()?,64) { return None; }
    Some((kind.into(),id.into()))
}
#[derive(Clone,Debug,PartialEq,Eq)]
struct Media { remote: String, kind: String, id: String, size: u64, digest: String, version: String }
fn media(v: &Value, parent: &str) -> Option<Media> {
    let (kind,id)=repository_kind(v,parent)?;
    let remote=text(v,"id"); let size=text(v,"size").parse::<u64>().ok()?;
    let digest=text(v.get("appProperties")?,"studyDirectorSha256");
    let version=text(v,"version");
    if !private(v) || !remote_id(remote) || !matches!(kind.as_str(),"object"|"checkpoint"|"commit"|"session-claim")
        || !(1..=MAX_FILE).contains(&size) || text(v,"sha256Checksum").to_ascii_lowercase()!=digest
        || version.is_empty() || v.pointer("/capabilities/canDownload").and_then(Value::as_bool)!=Some(true) { return None; }
    Some(Media{remote:remote.into(),kind,id,size,digest:digest.into(),version:version.into()})
}
fn repository_item(v:&Value,parent:&str,id:&str)->bool{
    private(v) && text(v,"id")==id && repository_kind(v,parent).is_some()
}

fn exact_fields(value:&str)->bool{
    value==FILE_FIELDS || value==FOLDER_FIELDS || value=="id" || value=="id,name"
}
fn allowed_list_fields(value:&str)->bool {
    value==format!("nextPageToken,incompleteSearch,files({FOLDER_FIELDS})")
        || value==DELETE_FIELDS
        || value==format!("nextPageToken,incompleteSearch,files({FILE_FIELDS})")
        || value==format!("nextPageToken,files({FILE_FIELDS})")
        || value=="files(id,createdTime,appProperties)"
}
fn prop(key:&str,value:&str)->String { format!("appProperties has {{ key='{key}' and value='{value}' }}") }
fn discovery_query()->String{
    format!("mimeType='{FOLDER}' and {} and trashed=false",prop("studyDirectorFolder","true"))
}
fn deletion_query(profile:&str)->String{
    format!("mimeType='{FOLDER}' and {} and trashed=false",prop("studyDirectorDeletedProfile",profile))
}
fn split_prop<'a>(part:&'a str,key:&str)->Option<&'a str>{
    part.strip_prefix(&format!("appProperties has {{ key='{key}' and value='"))?.strip_suffix("' }")
}
#[derive(Debug,PartialEq,Eq)]
enum Listing { Folders, Deletion(String), Repository }
fn list_query(query:&str,candidate:Option<&Folder>)->Option<Listing>{
    if query==discovery_query(){return Some(Listing::Folders);}
    // Values from profile/remote identifiers cannot contain query syntax.
    if let Some(p)=query.strip_prefix(&format!("mimeType='{FOLDER}' and appProperties has {{ key='studyDirectorDeletedProfile' and value='"))
        .and_then(|s|s.strip_suffix("' } and trashed=false")){
        return profile_id(p).then(||Listing::Deletion(p.into()));
    }
    let candidate=candidate?;
    let prefix=format!("'{}' in parents and ",candidate.id);
    let rest=query.strip_prefix(&prefix)?.strip_suffix(" and trashed=false")?;
    let marker=prop("studyDirectorRepository","true");
    // The existing provider uses this small history-summary query during adoption.
    if rest==format!("{} and {}",prop("studyDirectorRepositoryKind","checkpoint"),prop("sdHistoryRole","normal")){
        return Some(Listing::Repository);
    }
    let rest=rest.strip_prefix(&format!("{marker} and "))?;
    if rest==format!("({} or {})",prop("studyDirectorRepositoryKind","session-claim"),prop("studyDirectorRepositoryKind","commit")){
        return Some(Listing::Repository);
    }
    let (kind_part,id_part)=rest.split_once(" and ").map_or((rest,None),|(k,i)|(k,Some(i)));
    let kind=split_prop(kind_part,"studyDirectorRepositoryKind")?;
    if !matches!(kind,"object"|"checkpoint"|"commit"|"session-claim"|"publication"|"maintenance"){return None;}
    if let Some(part)=id_part {logical_name(kind,split_prop(part,"studyDirectorRepositoryId")?)?;}
    Some(Listing::Repository)
}

fn checked_url(value:&str)->DriveResult<Url>{
    if value.len()>16384 {return Err(blocked());}
    let url=Url::parse(value).map_err(|_|blocked())?;
    if url.scheme()!="https" || url.host_str()!=Some("www.googleapis.com") || url.port().is_some()
        || !url.username().is_empty() || url.password().is_some() || url.fragment().is_some() {return Err(blocked());}
    Ok(url)
}
fn query_params(url:&Url)->DriveResult<BTreeMap<String,String>>{
    let mut params=BTreeMap::new();
    for(k,v)in url.query_pairs(){if params.insert(k.into_owned(),v.into_owned()).is_some(){return Err(blocked());}}
    Ok(params)
}
fn q<'a>(params:&'a BTreeMap<String,String>,key:&str)->&'a str{params.get(key).map(String::as_str).unwrap_or("")}
fn keys(params:&BTreeMap<String,String>,allowed:&[&str])->bool{params.keys().all(|k|allowed.contains(&k.as_str()))}
fn parse_range(value:&str)->Option<(u64,u64)>{
    let (a,b)=value.strip_prefix("bytes=")?.split_once('-')?;
    let a=a.parse::<u64>().ok()?;let b=b.parse::<u64>().ok()?;
    (b>=a && b<MAX_FILE && b-a<1024*1024).then_some((a,b))
}
fn upload_range(value:&str,total:u64,length:usize)->bool{
    if value==format!("bytes */{total}"){return length==0;}
    let Some((bounds,t))=value.strip_prefix("bytes ").and_then(|s|s.split_once('/'))else{return false;};
    let Some((a,b))=bounds.split_once('-')else{return false;};
    let(Ok(a),Ok(b),Ok(t))=(a.parse::<u64>(),b.parse::<u64>(),t.parse::<u64>())else{return false;};
    t==total && a<=b && b<total && b-a+1==length as u64 && length<=MAX_CHUNK
}

#[derive(Debug)]
enum OperationKind{
    About, List(Listing), Metadata(String), Media(String,Option<(u64,u64)>),
    Create, BeginUpload(u64), Upload(String), Rename, Trash, Delete(String),
}
impl OperationKind{
    fn mutates(&self)->bool{matches!(self,Self::Create|Self::BeginUpload(_)|Self::Upload(_)|Self::Rename|Self::Trash|Self::Delete(_))}
}
#[derive(Default)]
struct Gate{
    generation:u64, candidate:Option<Folder>, admitted:bool, refused:bool, witnesses:HashMap<String,Media>, uploads:HashMap<String,UploadSession>,
}
impl Gate{
    fn for_generation(generation:u64)->Self{Self{generation,..Self::default()}}
    fn candidate(&self)->DriveResult<&Folder>{if self.refused{return Err(blocked());}self.candidate.as_ref().ok_or_else(blocked)}
    fn write_folder(&self)->DriveResult<&Folder>{if self.admitted{self.candidate()}else{Err(blocked())}}
    fn observe_folder(&mut self,rows:&Value)->DriveResult<()>{
        let next=complete_list(rows).ok().and_then(|files|if files.len()==1{folder(&files[0])}else{None});
        if self.refused || self.candidate.is_some() && self.candidate!=next{
            self.admitted=false;self.refused=true;self.witnesses.clear();self.uploads.clear();
            return Err(blocked());
        }
        if next.is_none(){return Err(blocked());}
        self.candidate=next;Ok(())
    }
    fn proved(&self)->bool{
        match(self.witnesses.get("commit"),self.witnesses.get("checkpoint"),self.witnesses.get("object")){
            (Some(commit),Some(checkpoint),Some(_))=>commit.id==checkpoint.id,
            _=>false,
        }
    }
}
fn complete_list(value:&Value)->DriveResult<&[Value]>{
    if value.get("incompleteSearch").is_some_and(|v|v.as_bool()!=Some(false))
        || value.get("nextPageToken").is_some_and(|v|v.as_str()!=Some("")){return Err(invalid());}
    value.get("files").and_then(Value::as_array).map(Vec::as_slice).ok_or_else(invalid)
}
fn deletion_present(value:&Value,profile:&str)->DriveResult<bool>{
    let files=complete_list(value)?;
    if files.is_empty(){return Ok(false);}
    if files.len()!=1{return Err(invalid());}
    let v=&files[0];
    if !private(v)||text(v,"mimeType")!=FOLDER||!remote_id(text(v,"id"))
        ||v.get("appProperties")!=Some(&json!({"studyDirectorDeletedProfile":profile})){return Err(invalid());}
    Ok(true)
}
fn valid_create(body:&Value,f:&Folder,upload:bool)->bool{
    let Some(map)=body.as_object()else{return false;};
    if map.keys().any(|k|!["name","mimeType","parents","appProperties"].contains(&k.as_str())){return false;}
    if text(body,"mimeType")==FOLDER{
        return !upload && map.len()==3 && !map.contains_key("parents")
            && body.get("appProperties")==Some(&json!({"studyDirectorDeletedProfile":f.profile}))
            && !text(body,"name").is_empty()&&text(body,"name").len()<=800;
    }
    let Some((kind,_))=repository_kind(body,&f.id)else{return false;};
    let Some(properties)=body.get("appProperties").and_then(Value::as_object)else{return false;};
    if properties.len()>32||properties.values().any(|v|v.as_str().is_none_or(|s|s.len()>512)){return false;}
    if properties.keys().any(|k|![
        "studyDirectorRepository","studyDirectorRepositoryVersion","studyDirectorRepositoryKind","studyDirectorRepositoryId",
        "studyDirectorSecurity","studyDirectorSha256","studyDirectorVersion","exportedAt","sdPublicationRenews",
        "sdPublicationStartedAt","sdPublicationDevice","sdMaintenanceDevice","sdHistoryFingerprint","sdHistoryCounts",
        "sdHistoryEncrypted","sdHistoryRole","sdHistoryProtectedUntil","sdHistoryCalendar","sdHistoryNotes",
        "sdHistoryFormat","sdHistoryAttachmentsMissing","sdHistoryOrigin",
    ].contains(&k.as_str())){return false;}
    if upload { matches!(kind.as_str(),"object"|"checkpoint"|"commit"|"session-claim") }
    else { matches!(kind.as_str(),"publication"|"maintenance") }
}
fn valid_session_url(value:&str)->DriveResult<Url>{
    let url=checked_url(value)?;let params=query_params(&url)?;
    if url.path()!=UPLOAD||q(&params,"uploadType")!="resumable"||!visible_ascii(q(&params,"upload_id"),4096)
        ||!keys(&params,&["uploadType","upload_id","fields","upload_protocol"])
        ||params.get("fields").is_some_and(|s|s!=FILE_FIELDS)
        ||params.get("upload_protocol").is_some_and(|s|s!="resumable"){return Err(blocked());}
    Ok(url)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DriveRequest{
    url:String, method:String, headers:BTreeMap<String,String>, body:String,
}
fn classify(request:&DriveRequest,url:&Url,gate:&Gate,body:&[u8])->DriveResult<OperationKind>{
    let params=query_params(url)?;
    let path=url.path();let method=request.method.as_str();
    let item=path.strip_prefix("/drive/v3/files/").filter(|id|remote_id(id));
    let h=&request.headers;
    let get=|key:&str|h.get(key).map(String::as_str).unwrap_or("");
    let headers=|allowed:&[&str]|h.keys().all(|k|allowed.contains(&k.as_str()))&&h.values().all(|v|v.len()<=512&&v.bytes().all(|b|b==b' '||b.is_ascii_graphic()));
    let json_body=||serde_json::from_slice::<Value>(body).map_err(|_|blocked());
    let json_headers=||headers(&["content-type"])&&matches!(get("content-type"),"application/json"|"application/json; charset=UTF-8");
    if method=="GET"&&body.is_empty(){
        if path=="/drive/v3/about"&&params.len()==1&&q(&params,"fields")=="user(emailAddress)"&&h.is_empty(){return Ok(OperationKind::About);}
        if path==FILES&&h.is_empty()&&keys(&params,&["q","spaces","pageSize","fields","pageToken","orderBy"])
            &&q(&params,"spaces")=="drive"&&q(&params,"pageSize").parse::<u16>().is_ok_and(|n|(1..=1000).contains(&n))
            &&allowed_list_fields(q(&params,"fields"))
            &&params.get("orderBy").is_none_or(|v|v=="createdTime desc")
            &&params.get("pageToken").is_none_or(|v|visible_ascii(v,4096)){
            let listing=list_query(q(&params,"q"),if gate.refused{None}else{gate.candidate.as_ref()}).ok_or_else(blocked)?;
            match &listing{
                Listing::Folders if q(&params,"fields")!=format!("nextPageToken,incompleteSearch,files({FOLDER_FIELDS})")||params.contains_key("pageToken")=>return Err(blocked()),
                Listing::Deletion(_) if q(&params,"fields")!=DELETE_FIELDS||params.contains_key("pageToken")=>return Err(blocked()),
                _=>{}
            }
            return Ok(OperationKind::List(listing));
        }
        if let Some(id)=item{
            gate.candidate()?;
            if params.len()==1&&exact_fields(q(&params,"fields"))&&h.is_empty(){return Ok(OperationKind::Metadata(id.into()));}
            if params.len()==1&&q(&params,"alt")=="media"&&headers(&["range"]){
                let range=if h.contains_key("range"){Some(parse_range(get("range")).ok_or_else(blocked)?)}else{None};
                return Ok(OperationKind::Media(id.into(),range));
            }
        }
    }
    let folder=gate.write_folder()?;
    if method=="POST"&&path==FILES&&params.len()==1&&exact_fields(q(&params,"fields"))&&json_headers()&&body.len()<=65536
        &&valid_create(&json_body()?,folder,false){return Ok(OperationKind::Create);}
    if method=="POST"&&path==UPLOAD&&params.len()==2&&q(&params,"uploadType")=="resumable"&&q(&params,"fields")==FILE_FIELDS
        &&headers(&["content-type","x-upload-content-type","x-upload-content-length"])
        &&get("content-type")=="application/json; charset=UTF-8"&&get("x-upload-content-type")==BINARY&&body.len()<=65536
        &&valid_create(&json_body()?,folder,true){
        let total=get("x-upload-content-length").parse::<u64>().map_err(|_|blocked())?;
        if (1..=MAX_FILE).contains(&total){return Ok(OperationKind::BeginUpload(total));}
    }
    if method=="PUT"&&path==UPLOAD&&valid_session_url(url.as_str()).is_ok()&&headers(&["content-type","content-range"]){
        let session=gate.uploads.get(url.as_str()).ok_or_else(blocked)?;
        if upload_range(get("content-range"),session.total,body.len())&&(body.is_empty()&&h.len()==1||!body.is_empty()&&get("content-type")==BINARY){
            return Ok(OperationKind::Upload(url.to_string()));
        }
    }
    if method=="PATCH"&&item==Some(folder.id.as_str())&&params.len()==1&&json_headers()&&body.len()<=4096{
        let value=json_body()?;
        if q(&params,"fields")=="id,name"&&value.as_object().is_some_and(|m|m.len()==1)
            &&!text(&value,"name").trim().is_empty()&&text(&value,"name").len()<=800{return Ok(OperationKind::Rename);}
        if q(&params,"fields")=="id"&&value==json!({"trashed":true}){return Ok(OperationKind::Trash);}
    }
    if method=="DELETE"&&params.is_empty()&&h.is_empty()&&body.is_empty(){
        if let Some(id)=item.filter(|id|*id!=folder.id){return Ok(OperationKind::Delete(id.into()));}
    }
    Err(blocked())
}

#[derive(Serialize)]
pub struct DriveResponse{
    status:u16,headers:BTreeMap<String,String>,body:String,stream:bool,
}
#[derive(Serialize)]
pub struct DriveChunk{body:String,done:bool}
struct Stream{
    response:Response,media:Media,remaining:u64,full:bool,hash:Sha256,verified:bool,
}
struct Transfer{
    generation:u64,cancelled:Arc<AtomicBool>,started:AtomicBool,stream:Mutex<Option<Stream>>,touched:Mutex<Instant>,
}
impl Transfer{
    fn new(generation:u64)->Self{Self{generation,cancelled:Arc::new(AtomicBool::new(false)),started:AtomicBool::new(false),stream:Mutex::new(None),touched:Mutex::new(Instant::now())}}
    fn touch(&self)->DriveResult<()>{*locked(&self.touched)?=Instant::now();Ok(())}
}
#[derive(Clone)]
struct UploadSession{url:Url,total:u64,issued:Instant}
type Transfers=HashMap<String,Arc<Transfer>>;
#[derive(Clone)]
struct Token{value:String,generation:u64,revision:u64,email:String}

/// One immutable local-profile session. All its credentials and transfers die
/// on navigation, but the OS refresh grant persists until explicit disconnect.
pub struct NativeDrive {
    host:Host<windows_store::WindowsStore,Google>,
    client:reqwest::blocking::Client,
    live:AtomicBool,
    gate:Mutex<Gate>,
    transfers:Mutex<Transfers>,
}
impl NativeDrive{
    pub fn new(config:DesktopClient,scope:String,email:Option<String>)->DriveResult<Self>{
        let store=windows_store::WindowsStore::new(&config,&scope).map_err(auth_error)?;
        let client=reqwest::blocking::Client::builder().redirect(reqwest::redirect::Policy::none()).retry(reqwest::retry::never()).referer(false).no_proxy().https_only(true).connect_timeout(Duration::from_secs(10)).timeout(Duration::from_secs(120)).build().map_err(|_|network())?;
        Ok(Self{host:Host::new(config,scope,email,store,Google).map_err(auth_error)?,client,
            live:AtomicBool::new(true),gate:Mutex::new(Gate::for_generation(1)),transfers:Mutex::new(Transfers::default())})
    }
    fn alive(&self)->DriveResult<()>{if self.live.load(Ordering::Acquire){Ok(())}else{Err(changed())}}
    fn current(&self,generation:u64,transfer:Option<&Transfer>)->DriveResult<()>{
        self.alive()?;
        if self.host.generation().map_err(auth_error)?!=generation{return Err(changed());}
        if transfer.is_some_and(|t|t.generation!=generation||t.cancelled.load(Ordering::Acquire)){return Err("Google Drive request was cancelled.".into());}
        Ok(())
    }
    pub fn generation(&self)->DriveResult<u64>{self.alive()?;self.host.generation().map_err(auth_error)}
    fn gate_for(&self,generation:u64)->DriveResult<MutexGuard<'_,Gate>>{
        let gate=locked(&self.gate)?;
        self.current(generation,None)?;
        if gate.generation!=generation{return Err(changed());}
        Ok(gate)
    }
    fn rotate_gate(&self,generation:u64)->DriveResult<()>{
        let mut gate=locked(&self.gate)?;
        self.current(generation,None)?;
        if gate.generation!=generation{*gate=Gate::for_generation(generation);}
        Ok(())
    }
    pub fn authorize(&self,expected:u64,id:&str,interactive:bool)->DriveResult<AuthorizedAccount>{
        let transfer=locked(&self.transfers)?.get(id).cloned().ok_or_else(changed)?;
        self.current(expected,Some(&transfer))?;
        if transfer.started.swap(true,Ordering::AcqRel){return Err(blocked());}
        transfer.touch()?;
        let result=(||{
            let result=match self.host.refresh_with(expected,transfer.cancelled.clone()){
                Ok(account)=>Ok(account),
                Err(error @ (AuthError::NotAuthorized|AuthError::Revoked)) if interactive=>{
                    let next=if error==AuthError::Revoked{expected.checked_add(1).ok_or_else(changed)?}else{expected};
                    self.current(next,None)?;
                    check_cancel(&transfer.cancelled).map_err(auth_error)?;
                    self.host.authorize_with(next,transfer.cancelled.clone())
                }
                Err(error)=>Err(error),
            }.map_err(auth_error)?;
            check_cancel(&transfer.cancelled).map_err(auth_error)?;
            self.rotate_gate(result.generation)?;
            Ok(result)
        })();
        self.remove(id,&transfer);
        result
    }
    fn token(&self,generation:u64,transfer:Option<&Transfer>)->DriveResult<Token>{
        self.current(generation,transfer)?;
        self.host.refresh_for(generation).map_err(auth_error)?;
        let state=lock(&self.host.state).map_err(auth_error)?;
        if state.generation!=generation||state.disabled{return Err(changed());}
        let access=state.access.as_ref().filter(|a|a.expires>Instant::now()).ok_or_else(changed)?;
        let token=Token{value:access.token.clone(),generation,revision:state.access_revision,email:access.account.email.clone()};
        drop(state);
        self.current(generation,transfer)?;
        Ok(token)
    }
    pub fn retire(&self){
        self.live.store(false,Ordering::Release);
        if let Ok(mut state)=self.host.state.lock(){
            state.disabled=true;state.access=None;
            if let Some(active)=state.active.take(){active.store(true,Ordering::Release);}
            state.generation=state.generation.saturating_add(1);
        }
        self.stop_transfers(None);
        if let Ok(mut gate)=self.gate.lock(){*gate=Gate::default();}
    }
    fn stop_transfers(&self,generation:Option<u64>){
        if let Ok(mut map)=self.transfers.lock(){
            map.retain(|_,t|{
                let keep=generation.is_some_and(|g|t.generation!=g);
                if !keep{t.cancelled.store(true,Ordering::Release);}keep
            });
        }
    }
    pub fn disconnect(&self,generation:u64)->DriveResult<()>{
        self.current(generation,None)?;
        self.host.disconnect_for(generation).map_err(auth_error)?;
        self.stop_transfers(Some(generation));
        self.rotate_gate(generation.checked_add(1).ok_or_else(changed)?)
    }
    pub fn invalidate(&self,generation:u64)->DriveResult<u64>{
        self.current(generation,None)?;
        let next={
            let mut state=lock(&self.host.state).map_err(auth_error)?;
            if state.generation!=generation{return Err(changed());}
            state.generation=state.generation.checked_add(1).ok_or_else(changed)?;
            if let Some(cancel)=state.active.take(){cancel.store(true,Ordering::Release);}
            state.access=None;state.generation
        };
        self.stop_transfers(Some(generation));self.rotate_gate(next)?;Ok(next)
    }
    fn send(&self,token:&Token,method:Method,url:Url,headers:&BTreeMap<String,String>,body:Vec<u8>,transfer:Option<&Transfer>)->DriveResult<Response>{
        let mut request=self.client.request(method,url).bearer_auth(&token.value);
        for (key,value) in headers{request=request.header(key.as_str(),value.as_str());}
        if !body.is_empty(){request=request.body(body);}
        self.current(token.generation,transfer)?;
        let response=request.send().map_err(|_|network())?;
        self.current(token.generation,transfer)?;
        if response.status().as_u16()==401{
            if !self.host.invalidate(token.generation,token.revision).map_err(auth_error)?{return Err(changed());}
        }
        Ok(response)
    }
    fn internal_get(&self,token:&Token,url:Url,transfer:Option<&Transfer>)->DriveResult<Value>{
        let response=self.send(token,Method::GET,url,&BTreeMap::new(),Vec::new(),transfer)?;
        if !response.status().is_success(){return Err(format!("Google Drive verification failed ({}).",response.status().as_u16()));}
        let bytes=bounded(response,MAX_JSON)?;
        self.current(token.generation,transfer)?;
        serde_json::from_slice(&bytes).map_err(|_|invalid())
    }
    fn metadata_url(id:&str)->DriveResult<Url>{
        let mut url=checked_url(&format!("{ORIGIN}{FILES}/{id}"))?;
        url.query_pairs_mut().append_pair("fields",ALL_FIELDS);Ok(url)
    }
    fn metadata(&self,token:&Token,id:&str,transfer:Option<&Transfer>)->DriveResult<Value>{
        self.internal_get(token,Self::metadata_url(id)?,transfer)
    }
    fn deletion(&self,token:&Token,profile:&str,transfer:Option<&Transfer>)->DriveResult<bool>{
        let mut url=checked_url(&format!("{ORIGIN}{FILES}"))?;
        url.query_pairs_mut().append_pair("q",&deletion_query(profile)).append_pair("spaces","drive").append_pair("pageSize","1").append_pair("fields",DELETE_FIELDS);
        deletion_present(&self.internal_get(token,url,transfer)?,profile)
    }
    fn verify_folder(&self,token:&Token,wanted:&Folder,transfer:Option<&Transfer>)->DriveResult<()>{
        if folder(&self.metadata(token,&wanted.id,transfer)?).as_ref()!=Some(wanted){return Err(blocked());}
        Ok(())
    }
    pub fn admit(&self,generation:u64,id:&str,profile:&str)->DriveResult<()>{
        let token=self.token(generation,None)?;
        let (wanted,witnesses)={let gate=self.gate_for(generation)?;let f=gate.candidate()?.clone();
            if f.id!=id||f.profile!=profile||!gate.proved(){return Err(blocked());}(f,gate.witnesses.values().cloned().collect::<Vec<_>>())};
        self.verify_folder(&token,&wanted,None)?;
        for item in witnesses{if media(&self.metadata(&token,&item.remote,None)?,&wanted.id).as_ref()!=Some(&item){return Err(invalid());}}
        if self.deletion(&token,profile,None)?{return Err(blocked());}
        self.current(generation,None)?;
        let mut gate=self.gate_for(generation)?;
        if gate.candidate()?!=&wanted||!gate.proved(){return Err(blocked());}
        gate.admitted=true;Ok(())
    }
    pub fn allocate(&self,generation:u64)->DriveResult<String>{
        self.current(generation,None)?;
        let mut map=locked(&self.transfers)?;
        self.current(generation,None)?;
        map.retain(|_,t|{
            let keep=t.generation==generation&&t.touched.lock().is_ok_and(|stamp|stamp.elapsed()<Duration::from_secs(180));
            if !keep{t.cancelled.store(true,Ordering::Release);}
            keep
        });
        if map.len()>=MAX_TRANSFERS{return Err(blocked());}
        let id=random_secret().map_err(auth_error)?;
        if map.contains_key(&id){return Err(blocked());}
        map.insert(id.clone(),Arc::new(Transfer::new(generation)));Ok(id)
    }
    fn remove(&self,id:&str,t:&Arc<Transfer>){
        if let Ok(mut map)=self.transfers.lock(){if map.get(id).is_some_and(|old|Arc::ptr_eq(old,t)){map.remove(id);}}
    }
    pub fn cancel(&self,id:&str)->DriveResult<()>{
        if !remote_id(id)||id.len()!=43{return Err(blocked());}
        if let Some(t)=locked(&self.transfers)?.remove(id){t.cancelled.store(true,Ordering::Release);}
        Ok(())
    }
    pub fn request(&self,generation:u64,id:&str,request:DriveRequest)->DriveResult<DriveResponse>{
        let t=locked(&self.transfers)?.get(id).cloned().ok_or_else(changed)?;
        self.current(generation,Some(&t))?;
        if t.started.swap(true,Ordering::AcqRel){return Err(blocked());}
        t.touch()?;
        let result=(||{
            if request.body.len()>(MAX_CHUNK+65536)*2{return Err(blocked());}
            let body=base64::engine::general_purpose::STANDARD.decode(&request.body).map_err(|_|blocked())?;
            if body.len()>MAX_CHUNK{return Err(blocked());}
            let url=checked_url(&request.url)?;
            self.dispatch(generation,&request,url,body,&t)
        })();
        if !result.as_ref().is_ok_and(|r|r.stream){self.remove(id,&t);}
        result
    }
    fn dispatch(&self,generation:u64,request:&DriveRequest,url:Url,body:Vec<u8>,t:&Arc<Transfer>)->DriveResult<DriveResponse>{
        let (kind,candidate)={let gate=self.gate_for(generation)?;(classify(request,&url,&gate,&body)?,gate.candidate.clone())};
        let token=self.token(generation,Some(t))?;
        if matches!(kind,OperationKind::About){
            return Ok(DriveResponse{status:200,headers:BTreeMap::new(),body:base64::engine::general_purpose::STANDARD.encode(json!({"user":{"emailAddress":token.email}}).to_string()),stream:false});
        }
        let mut expected_media=None;
        let mut dispatch_url=url.clone();
        if kind.mutates(){
            let f=candidate.as_ref().ok_or_else(blocked)?;
            self.verify_folder(&token,f,Some(t))?;
            let deleting=matches!(kind,OperationKind::Trash);
            if self.deletion(&token,&f.profile,Some(t))?!=deleting{return Err(blocked());}
            if let OperationKind::Delete(ref id)=kind{
                let metadata=self.send(&token,Method::GET,Self::metadata_url(id)?,&BTreeMap::new(),Vec::new(),Some(t))?;
                let status=metadata.status().as_u16();
                if status==404{return Ok(DriveResponse{status:404,headers:BTreeMap::new(),body:base64::engine::general_purpose::STANDARD.encode(safe_error(&[],404)),stream:false});}
                if !metadata.status().is_success(){return Err(format!("Google Drive verification failed ({status})."));}
                let value:Value=serde_json::from_slice(&bounded(metadata,MAX_JSON)?).map_err(|_|invalid())?;
                if !repository_item(&value,&f.id,id){return Err(blocked());}
            }
            let gate=self.gate_for(generation)?;
            if gate.write_folder()?!=f{return Err(blocked());}
            if let OperationKind::Upload(ref opaque)=kind{
                dispatch_url=gate.uploads.get(opaque).ok_or_else(blocked)?.url.clone();
            }
        }else if let OperationKind::Media(ref id,range)=kind{
            let f=candidate.as_ref().ok_or_else(blocked)?;
            let metadata=self.send(&token,Method::GET,Self::metadata_url(id)?,&BTreeMap::new(),Vec::new(),Some(t))?;
            let status=metadata.status().as_u16();
            if !metadata.status().is_success(){
                let headers=response_headers(&metadata)?;
                let bytes=if status==401{Vec::new()}else{safe_error(&bounded(metadata,MAX_JSON)?,status)};
                return Ok(DriveResponse{status,headers,body:base64::engine::general_purpose::STANDARD.encode(bytes),stream:false});
            }
            let value:Value=serde_json::from_slice(&bounded(metadata,MAX_JSON)?).map_err(|_|invalid())?;
            let record=media(&value,&f.id).ok_or_else(blocked)?;
            if record.remote!=*id||range.is_some_and(|(_,end)|end>=record.size){return Err(blocked());}
            expected_media=Some((record,range));
        }else if let OperationKind::Metadata(ref id)=kind{
            dispatch_url=Self::metadata_url(id)?;
        }
        if let Some(ref expected)=candidate{
            let gate=self.gate_for(generation)?;
            if gate.candidate()?!=expected||kind.mutates()&&!gate.admitted{return Err(blocked());}
        }
        let method=Method::from_bytes(request.method.as_bytes()).map_err(|_|blocked())?;
        let response=self.send(&token,method,dispatch_url,&request.headers,body,Some(t))?;
        let status=response.status().as_u16();
        let mut headers=response_headers(&response)?;
        if let Some((record,range))=expected_media{
            if (200..300).contains(&status){
                let expected=range.map_or(record.size,|(a,b)|b-a+1);
                if range.is_some_and(|(a,b)|status!=206||headers.get("content-range")!=Some(&format!("bytes {a}-{b}/{}",record.size)))
                    ||range.is_none()&&status!=200||headers.get("content-length").is_some_and(|s|s.parse::<u64>()!=Ok(expected)){return Err(invalid());}
                self.current(generation,Some(t))?;
                *locked(&t.stream)?=Some(Stream{response,media:record,remaining:expected,full:range.is_none(),hash:Sha256::new(),verified:false});
                return Ok(DriveResponse{status,headers,body:String::new(),stream:true});
            }
        }
        let bytes=if matches!(status,204|308|401){Vec::new()}else{bounded(response,MAX_JSON)?};
        self.current(generation,Some(t))?;
        if (200..300).contains(&status){
            if let Some(ref expected)=candidate{
                if self.gate_for(generation)?.candidate()?!=expected{return Err(blocked());}
            }
            if let OperationKind::BeginUpload(total)=&kind{
                let location=headers.remove("location").ok_or_else(invalid)?;
                let real_url=valid_session_url(&location)?;
                let opaque=format!("{ORIGIN}{UPLOAD}?uploadType=resumable&upload_id={}",random_secret().map_err(auth_error)?);
                let mut gate=self.gate_for(generation)?;
                if gate.write_folder()?!=candidate.as_ref().ok_or_else(blocked)?{return Err(blocked());}
                if gate.uploads.len()>=MAX_SESSIONS{
                    if let Some(old)=gate.uploads.iter().min_by_key(|(_,s)|s.issued).map(|(key,_)|key.clone()){gate.uploads.remove(&old);}
                }
                if gate.uploads.contains_key(&opaque){return Err(blocked());}
                gate.uploads.insert(opaque.clone(),UploadSession{url:real_url,total:*total,issued:Instant::now()});
                headers.insert("location".into(),opaque);
            }else if matches!(kind,OperationKind::List(_)|OperationKind::Metadata(_)){
                let value:Value=serde_json::from_slice(&bytes).map_err(|_|invalid())?;
                let mut gate=self.gate_for(generation)?;
                match &kind{
                    OperationKind::List(Listing::Folders)=>gate.observe_folder(&value)?,
                    OperationKind::List(Listing::Deletion(profile))=>{deletion_present(&value,profile)?;},
                    OperationKind::Metadata(id)=>{
                        let f=gate.candidate()?;
                        if id==&f.id{if folder(&value).as_ref()!=Some(f){return Err(blocked());}}
                        else if !repository_item(&value,&f.id,id){return Err(blocked());}
                    }
                    _=>{},
                }
            }
        }
        if let OperationKind::Upload(session)=&kind{
            if matches!(status,200|201|404|410){self.gate_for(generation)?.uploads.remove(session);}
        }
        if !matches!(kind,OperationKind::BeginUpload(_)){headers.remove("location");}
        if matches!(kind,OperationKind::Trash)&& (200..300).contains(&status){
            let mut gate=self.gate_for(generation)?;gate.refused=true;gate.admitted=false;gate.witnesses.clear();gate.uploads.clear();
        }
        // Only the narrow protocol's headers are returned. Error bodies are
        // reduced to retry reasons; never forward an arbitrary provider echo.
        let payload=if status>=400 && status!=401{safe_error(&bytes,status)}else{bytes};
        Ok(DriveResponse{status,headers,body:base64::engine::general_purpose::STANDARD.encode(payload),stream:false})
    }
    pub fn read(&self,generation:u64,id:&str)->DriveResult<DriveChunk>{
        let transfer=locked(&self.transfers)?.get(id).cloned().ok_or_else(changed)?;
        transfer.touch()?;
        let result=self.read_chunk(generation,&transfer);
        if !result.as_ref().is_ok_and(|r|!r.done){self.remove(id,&transfer);}
        result
    }
    fn read_chunk(&self,generation:u64,t:&Transfer)->DriveResult<DriveChunk>{
        self.current(generation,Some(t))?;
        let mut slot=t.stream.try_lock().map_err(|_|blocked())?;
        let stream=slot.as_mut().ok_or_else(blocked)?;
        if stream.verified{*slot=None;return Ok(DriveChunk{body:String::new(),done:true});}
        let mut bytes=vec![0;READ_CHUNK.min(usize::try_from(stream.remaining).unwrap_or(READ_CHUNK))];
        let count=stream.response.read(&mut bytes).map_err(|_|network())?;
        self.current(generation,Some(t))?;
        if count==0||count as u64>stream.remaining{return Err(invalid());}
        bytes.truncate(count);stream.remaining-=count as u64;
        if stream.full{stream.hash.update(&bytes);}
        if stream.remaining==0{
            let mut extra=[0u8;1];
            if stream.response.read(&mut extra).map_err(|_|network())?!=0{return Err(invalid());}
            self.current(generation,Some(t))?;
            if stream.full{
                let digest=format!("{:x}",stream.hash.clone().finalize());
                if digest!=stream.media.digest{return Err(invalid());}
                let token=self.token(generation,Some(t))?;
                let f=self.gate_for(generation)?.candidate()?.clone();
                if media(&self.metadata(&token,&stream.media.remote,Some(t))?,&f.id).as_ref()!=Some(&stream.media){return Err(invalid());}
                self.current(generation,Some(t))?;
                let mut gate=self.gate_for(generation)?;
                if gate.candidate()?!=&f{return Err(blocked());}
                if !gate.admitted&&matches!(stream.media.kind.as_str(),"commit"|"checkpoint"|"object"){
                    gate.witnesses.insert(stream.media.kind.clone(),stream.media.clone());
                }
            }
            stream.verified=true;
        }
        Ok(DriveChunk{body:base64::engine::general_purpose::STANDARD.encode(bytes),done:false})
    }
}
fn bounded(response:Response,max:usize)->DriveResult<Vec<u8>>{
    if response.content_length().is_some_and(|n|n>max as u64){return Err(invalid());}
    let mut bytes=Vec::new();response.take(max as u64+1).read_to_end(&mut bytes).map_err(|_|network())?;
    if bytes.len()>max{return Err(invalid());}Ok(bytes)
}
fn response_headers(response:&Response)->DriveResult<BTreeMap<String,String>>{
    let mut out=BTreeMap::new();
    for name in ["content-type","content-length","content-range","range","retry-after","location"]{
        if let Some(value)=response.headers().get(name){
            if name=="location"&&!response.status().is_success(){continue;}
            let value=value.to_str().map_err(|_|invalid())?;
            if value.len()>8192{return Err(invalid());}
            if name=="location"{valid_session_url(value)?;}
            out.insert(name.into(),value.into());
        }
    }
    Ok(out)
}
fn safe_error(bytes:&[u8],status:u16)->Vec<u8>{
    let value:Value=serde_json::from_slice(bytes).unwrap_or(Value::Null);
    let reasons:Vec<_>=value.pointer("/error/errors").and_then(Value::as_array).into_iter().flatten()
        .map(|v|text(v,"reason")).filter(|r|matches!(*r,"rateLimitExceeded"|"userRateLimitExceeded"|"backendError"))
        .map(|r|json!({"reason":r})).collect();
    json!({"error":{"message":format!("Google Drive request failed ({status})."),"errors":reasons}}).to_string().into_bytes()
}

#[cfg(test)]
mod tests;
