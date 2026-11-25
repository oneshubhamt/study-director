//! One narrow application IPC command. Config is read only by Rust at launch.

use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use study_director_tauri_spike::oauth::{drive::{DriveRequest,NativeDrive},DesktopClient};
use tauri::{State, WebviewWindow};

type Result<T> = std::result::Result<T,String>;
fn unavailable()->String{"Native Google Drive is not configured in this build.".into()}
fn stale()->String{"Google Drive authorization changed. Reload or reconnect.".into()}
fn opaque()->Result<String>{
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD,Engine as _};
    let mut bytes=[0u8;32];getrandom::fill(&mut bytes).map_err(|_|unavailable())?;
    Ok(URL_SAFE_NO_PAD.encode(bytes))
}
struct Config{client_id:String,client_secret:String}
struct Session{key:String,drive:Arc<NativeDrive>}
#[derive(Default)]
struct Page{epoch:u64,opening:bool,session:Option<Session>}
pub struct DriveManager{config:Option<Config>,page:Mutex<Page>}

impl DriveManager{
    pub fn from_environment()->Self{
        let config=std::env::var("SD_NATIVE_GOOGLE_CLIENT_ID").ok()
            .zip(std::env::var("SD_NATIVE_GOOGLE_CLIENT_SECRET").ok())
            .and_then(|(id,secret)|DesktopClient::new(id.clone(),secret.clone()).ok().map(|_|Config{client_id:id,client_secret:secret}));
        Self{config,page:Mutex::new(Page::default())}
    }
    pub fn configured(&self)->bool{self.config.is_some()}
    pub fn retire(&self){
        let session=if let Ok(mut page)=self.page.lock(){
            page.epoch=page.epoch.saturating_add(1);
            page.opening=false;page.session.take()
        }else{None};
        if let Some(session)=session{session.drive.retire();}
    }
    fn reserve(&self)->Result<(u64,DesktopClient)>{
        let config=self.config.as_ref().ok_or_else(unavailable)?;
        let mut page=self.page.lock().map_err(|_|stale())?;
        if page.opening||page.session.is_some(){return Err(stale());}
        let client=DesktopClient::new(config.client_id.clone(),config.client_secret.clone()).map_err(|_|unavailable())?;
        page.opening=true;Ok((page.epoch,client))
    }
    fn finish_open(&self,epoch:u64,drive:Result<NativeDrive>)->Result<Value>{
        let mut page=self.page.lock().map_err(|_|stale())?;
        if page.epoch!=epoch||!page.opening||page.session.is_some(){return Err(stale());}
        page.opening=false;
        let drive=Arc::new(drive?);let key=opaque()?;let generation=drive.generation()?;
        page.session=Some(Session{key:key.clone(),drive});
        Ok(json!({"session":key,"generation":generation}))
    }
    fn session(&self,key:&str)->Result<Arc<NativeDrive>>{
        if key.len()!=43{return Err(stale());}
        let page=self.page.lock().map_err(|_|stale())?;
        page.session.as_ref().filter(|s|s.key==key).map(|s|s.drive.clone()).ok_or_else(stale)
    }
}

#[derive(Deserialize)]
#[serde(tag="op",rename_all="snake_case",deny_unknown_fields)]
pub enum Command{
    Status,
    Open{scope:String,email:Option<String>},
    Generation{session:String},
    Allocate{session:String,generation:u64},
    Authorize{session:String,generation:u64,id:String,interactive:bool},
    Admit{session:String,generation:u64,folder:String,profile:String},
    Request{session:String,generation:u64,id:String,request:DriveRequest},
    Read{session:String,generation:u64,id:String},
    Cancel{session:String,id:String},
    Invalidate{session:String,generation:u64},
    Disconnect{session:String,generation:u64},
}
fn value<T:serde::Serialize>(value:T)->Result<Value>{serde_json::to_value(value).map_err(|_|unavailable())}
async fn blocking<T:Send+'static>(work:impl FnOnce()->Result<T>+Send+'static)->Result<T>{
    tauri::async_runtime::spawn_blocking(work).await.map_err(|_|unavailable())?
}

#[tauri::command]
pub async fn native_drive(window:WebviewWindow,state:State<'_,Arc<DriveManager>>,command:Command)->Result<Value>{
    // The capability admits only the local main window. Check the actual
    // WebView URL again; never derive authority from a JS platform claim.
    let url=window.url().map_err(|_|unavailable())?;
    if window.label()!="main"||!super::packaged_origin(&url)||url.path()!="/index.html"{
        return Err(unavailable());
    }
    let manager=state.inner().clone();
    match command{
        Command::Status=>Ok(json!({"configured":manager.configured()})),
        Command::Open{scope,email}=>{
            let(epoch,client)=manager.reserve()?;
            let drive=blocking(move||NativeDrive::new(client,scope,email)).await;
            manager.finish_open(epoch,drive)
        }
        Command::Generation{session}=>value(manager.session(&session)?.generation()?),
        Command::Allocate{session,generation}=>value(manager.session(&session)?.allocate(generation)?),
        Command::Cancel{session,id}=>{manager.session(&session)?.cancel(&id)?;Ok(Value::Null)}
        Command::Authorize{session,generation,id,interactive}=>{
            let drive=manager.session(&session)?;
            blocking(move||value(drive.authorize(generation,&id,interactive)?)).await
        }
        Command::Admit{session,generation,folder,profile}=>{
            let drive=manager.session(&session)?;
            blocking(move||{drive.admit(generation,&folder,&profile)?;Ok(Value::Null)}).await
        }
        Command::Request{session,generation,id,request}=>{
            let drive=manager.session(&session)?;
            blocking(move||value(drive.request(generation,&id,request)?)).await
        }
        Command::Read{session,generation,id}=>{
            let drive=manager.session(&session)?;
            blocking(move||value(drive.read(generation,&id)?)).await
        }
        Command::Invalidate{session,generation}=>{
            let drive=manager.session(&session)?;
            blocking(move||value(drive.invalidate(generation)?)).await
        }
        Command::Disconnect{session,generation}=>{
            let drive=manager.session(&session)?;
            blocking(move||{drive.disconnect(generation)?;Ok(Value::Null)}).await
        }
    }
}
