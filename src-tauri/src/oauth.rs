//! Native installed-app authorization. This module has no WebView IPC.
//! Its synchronous entrypoints belong on a native blocking worker, not the UI thread.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    io::{self, Read, Write},
    net::{Ipv4Addr, TcpListener, TcpStream},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, MutexGuard,
    },
    thread,
    time::{Duration, Instant},
};
use url::Url;

const SCOPE: &str = "https://www.googleapis.com/auth/drive.file";
const AUTH_ENDPOINT: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT: &str = "https://oauth2.googleapis.com/token";
const ACCOUNT_ENDPOINT: &str =
    "https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,permissionId)";
const CALLBACK_PATH: &str = "/oauth/callback";
const MAX_HEADER: usize = 8192;
const MAX_RESPONSE: u64 = 64 * 1024;
const MAX_CREDENTIAL: usize = 2560;
const AUTH_TIMEOUT: Duration = Duration::from_secs(120);

/// Deliberately contains no provider response text, URL, code or credential.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AuthError {
    Configuration,
    Unavailable,
    Cancelled,
    Timeout,
    Browser,
    Denied,
    Network,
    InvalidResponse,
    InvalidScope,
    WrongAccount,
    MissingRefreshGrant,
    NotAuthorized,
    Revoked,
    CredentialStore,
    CredentialChanged,
}

impl std::fmt::Display for AuthError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::Configuration => "Desktop Google authorization is not configured correctly.",
            Self::Unavailable => "Native Google authorization is unavailable.",
            Self::Cancelled => "Google authorization was cancelled.",
            Self::Timeout => "Google authorization timed out.",
            Self::Browser => "The system browser could not be opened.",
            Self::Denied => "Google authorization was not granted.",
            Self::Network => "Google authorization could not reach the service. Retry when online.",
            Self::InvalidResponse => "Google returned an unverified authorization response.",
            Self::InvalidScope => "Google did not grant exactly the Drive-file permission.",
            Self::WrongAccount => "Google authorization belongs to a different account.",
            Self::MissingRefreshGrant => "Google did not provide offline authorization.",
            Self::NotAuthorized => "Connect Google Drive first.",
            Self::Revoked => "Google authorization was revoked or expired. Connect again.",
            Self::CredentialStore => "The secure Windows credential store could not be verified.",
            Self::CredentialChanged => "Google authorization changed. Start a new operation.",
        })
    }
}

impl std::error::Error for AuthError {}

type Result<T> = std::result::Result<T, AuthError>;

fn lock<T>(mutex: &Mutex<T>) -> Result<MutexGuard<'_, T>> {
    mutex.lock().map_err(|_| AuthError::Unavailable)
}

fn random_secret() -> Result<String> {
    let mut bytes = [0_u8; 32];
    getrandom::fill(&mut bytes).map_err(|_| AuthError::Unavailable)?;
    Ok(URL_SAFE_NO_PAD.encode(bytes))
}

fn visible_ascii(value: &str, max: usize) -> bool {
    !value.is_empty() && value.len() <= max && value.bytes().all(|b| b.is_ascii_graphic())
}

fn valid_profile_scope(value: &str) -> bool {
    if value.is_empty() {
        return true; // The initial profile's stable local namespace.
    }
    if value.len() > 51 {
        return false;
    }
    let parts: Vec<_> = value.split('_').collect();
    let alnum = |s: &str| {
        s.bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
    };
    parts.len() == 4
        && parts[0] == "prof"
        && (1..=24).contains(&parts[1].len())
        && alnum(parts[1])
        && (6..=12).contains(&parts[2].len())
        && alnum(parts[2])
        && parts[3].len() == 8
        && parts[3]
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

fn normalize_email(value: &str) -> Result<String> {
    let email = value.trim().to_ascii_lowercase();
    let (local, domain) = email.split_once('@').ok_or(AuthError::InvalidResponse)?;
    if !visible_ascii(local, 128) || !visible_ascii(domain, 190) || domain.contains('@') {
        return Err(AuthError::InvalidResponse);
    }
    Ok(email)
}

/// Explicit desktop configuration, supplied outside Git. Never serialize to JS.
pub struct DesktopClient {
    id: String,
    secret: String,
}

impl DesktopClient {
    pub fn new(id: String, secret: String) -> Result<Self> {
        let prefix = id
            .strip_suffix(".apps.googleusercontent.com")
            .ok_or(AuthError::Configuration)?;
        if !visible_ascii(prefix, 128)
            || !prefix
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-')
            || !visible_ascii(&secret, 512)
        {
            return Err(AuthError::Configuration);
        }
        Ok(Self { id, secret })
    }
}

fn check_cancel(cancel: &AtomicBool) -> Result<()> {
    if cancel.load(Ordering::Acquire) {
        Err(AuthError::Cancelled)
    } else {
        Ok(())
    }
}

struct Attempt {
    listener: TcpListener,
    host: String,
    redirect: String,
    verifier: String,
    state: String,
    expires: Instant,
}

enum Callback {
    Code(String),
    Denied,
}

impl Attempt {
    fn start(timeout: Duration) -> Result<Self> {
        let listener =
            TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).map_err(|_| AuthError::Unavailable)?;
        listener
            .set_nonblocking(true)
            .map_err(|_| AuthError::Unavailable)?;
        let host = format!(
            "127.0.0.1:{}",
            listener
                .local_addr()
                .map_err(|_| AuthError::Unavailable)?
                .port()
        );
        Ok(Self {
            listener,
            redirect: format!("http://{host}{CALLBACK_PATH}"),
            host,
            verifier: random_secret()?,
            state: random_secret()?,
            expires: Instant::now() + timeout,
        })
    }

    fn authorization_url(&self, config: &DesktopClient, hint: Option<&str>) -> Result<Url> {
        let mut url = Url::parse(AUTH_ENDPOINT).map_err(|_| AuthError::Configuration)?;
        let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(self.verifier.as_bytes()));
        {
            let mut params = url.query_pairs_mut();
            params
                .append_pair("client_id", &config.id)
                .append_pair("response_type", "code")
                .append_pair("redirect_uri", &self.redirect)
                .append_pair("scope", SCOPE)
                .append_pair("access_type", "offline")
                .append_pair("prompt", "consent")
                .append_pair("include_granted_scopes", "false")
                .append_pair("code_challenge_method", "S256")
                .append_pair("code_challenge", &challenge)
                .append_pair("state", &self.state);
            if let Some(hint) = hint {
                params.append_pair("login_hint", hint);
            }
        }
        Ok(url)
    }

    fn parse(&self, request: &[u8]) -> Option<Callback> {
        let text = std::str::from_utf8(request)
            .ok()?
            .strip_suffix("\r\n\r\n")?;
        let mut lines = text.split("\r\n");
        let mut first = lines.next()?.split(' ');
        if first.next()? != "GET" {
            return None;
        }
        let target = first.next()?;
        if first.next()? != "HTTP/1.1" || first.next().is_some() {
            return None;
        }
        let query = target.strip_prefix(CALLBACK_PATH)?.strip_prefix('?')?;
        if query.is_empty() || target.contains('#') || !visible_ascii(target, MAX_HEADER) {
            return None;
        }
        // Reject malformed percent encodings before URL decoding.
        for (i, b) in query.bytes().enumerate() {
            if b == b'%'
                && !query
                    .as_bytes()
                    .get(i + 1..i + 3)
                    .is_some_and(|pair| pair.iter().all(u8::is_ascii_hexdigit))
            {
                return None;
            }
        }
        let mut host = None;
        for line in lines {
            let (name, value) = line.split_once(':')?;
            if name.is_empty()
                || !name.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
                || value.bytes().any(|b| b.is_ascii_control() && b != b'\t')
            {
                return None;
            }
            if name.eq_ignore_ascii_case("host") {
                if host.replace(value.trim()).is_some() {
                    return None;
                }
            } else if name.eq_ignore_ascii_case("transfer-encoding")
                || name.eq_ignore_ascii_case("content-length") && value.trim() != "0"
            {
                return None;
            }
        }
        if host != Some(self.host.as_str()) {
            return None;
        }
        let url = Url::parse(&format!("http://{}{target}", self.host)).ok()?;
        let mut params = std::collections::HashMap::new();
        for (key, value) in url.query_pairs() {
            if params
                .insert(key.into_owned(), value.into_owned())
                .is_some()
            {
                return None;
            }
        }
        if params.get("state").map(String::as_str) != Some(self.state.as_str()) {
            return None;
        }
        match (params.get("code"), params.get("error")) {
            (Some(code), None) if visible_ascii(code, 4096) => Some(Callback::Code(code.clone())),
            (None, Some(error)) if visible_ascii(error, 256) => Some(Callback::Denied),
            _ => None,
        }
    }

    fn receive(&self, stream: &mut TcpStream, cancel: &AtomicBool) -> Option<Callback> {
        stream.set_nonblocking(false).ok()?;
        stream
            .set_read_timeout(Some(Duration::from_millis(200)))
            .ok()?;
        stream
            .set_write_timeout(Some(Duration::from_millis(200)))
            .ok()?;
        let deadline = self.expires.min(Instant::now() + Duration::from_secs(2));
        let mut data = Vec::with_capacity(1024);
        let mut chunk = [0_u8; 1024];
        while Instant::now() < deadline && !cancel.load(Ordering::Acquire) {
            match stream.read(&mut chunk) {
                Ok(0) => return None,
                Ok(count) => {
                    if data.len() + count > MAX_HEADER {
                        return None;
                    }
                    data.extend_from_slice(&chunk[..count]);
                    if data.ends_with(b"\r\n\r\n") {
                        return self.parse(&data);
                    }
                    if data.windows(4).any(|w| w == b"\r\n\r\n") {
                        return None; // No body or pipelined requests.
                    }
                }
                Err(error)
                    if matches!(
                        error.kind(),
                        io::ErrorKind::WouldBlock
                            | io::ErrorKind::TimedOut
                            | io::ErrorKind::Interrupted
                    ) => {}
                Err(_) => return None,
            }
        }
        None
    }

    /// Consumes the listener: one valid callback can never be used twice.
    fn wait(self, cancel: &AtomicBool) -> Result<String> {
        let mut rejected = 0;
        loop {
            check_cancel(cancel)?;
            if Instant::now() >= self.expires {
                return Err(AuthError::Timeout);
            }
            match self.listener.accept() {
                Ok((mut stream, peer)) => {
                    let result = if peer.ip().is_loopback() {
                        self.receive(&mut stream, cancel)
                    } else {
                        None
                    };
                    check_cancel(cancel)?;
                    if Instant::now() >= self.expires {
                        return Err(AuthError::Timeout);
                    }
                    let response = if result.is_some() {
                        "HTTP/1.1 200 OK\r\nContent-Type: text/plain; charset=utf-8\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\nReturn to Study Director."
                    } else {
                        "HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n"
                    };
                    let _ = stream.write_all(response.as_bytes());
                    match result {
                        Some(Callback::Code(code)) => return Ok(code),
                        Some(Callback::Denied) => return Err(AuthError::Denied),
                        None => {
                            rejected += 1;
                            if rejected >= 64 {
                                return Err(AuthError::Denied);
                            }
                        }
                    }
                }
                Err(error) if error.kind() == io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(25));
                }
                Err(error) if error.kind() == io::ErrorKind::Interrupted => {}
                Err(_) => return Err(AuthError::Unavailable),
            }
        }
    }
}

#[derive(Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
struct Account {
    email: String,
    permission_id: String,
}

impl Account {
    fn verified(email: &str, permission_id: &str) -> Result<Self> {
        if !visible_ascii(permission_id, 256) {
            return Err(AuthError::InvalidResponse);
        }
        Ok(Self {
            email: normalize_email(email)?,
            permission_id: permission_id.to_owned(),
        })
    }
}

#[derive(Deserialize)]
struct TokenReply {
    access_token: String,
    token_type: String,
    expires_in: u64,
    scope: Option<String>,
    refresh_token: Option<String>,
}

impl TokenReply {
    fn expiry(&self) -> Instant {
        let safety = (self.expires_in / 10).clamp(5, 60);
        Instant::now() + Duration::from_secs(self.expires_in.saturating_sub(safety))
    }

    fn validate(&self, initial: bool) -> Result<()> {
        if !self.token_type.eq_ignore_ascii_case("bearer")
            || !visible_ascii(&self.access_token, 4096)
            || !(10..=86400).contains(&self.expires_in)
            || self
                .refresh_token
                .as_ref()
                .is_some_and(|t| !visible_ascii(t, 2048))
        {
            return Err(AuthError::InvalidResponse);
        }
        if self.scope.as_deref().is_some_and(|scope| scope != SCOPE)
            || initial && self.scope.as_deref() != Some(SCOPE)
        {
            return Err(AuthError::InvalidScope);
        }
        if initial && self.refresh_token.is_none() {
            return Err(AuthError::MissingRefreshGrant);
        }
        Ok(())
    }
}

trait GoogleProtocol {
    fn authorize(
        &self,
        config: &DesktopClient,
        hint: Option<&str>,
        cancel: &AtomicBool,
    ) -> Result<TokenReply>;
    fn refresh(&self, config: &DesktopClient, token: &str) -> Result<TokenReply>;
    fn account(&self, access: &str) -> Result<Account>;
}

struct Google;

impl Google {
    fn client() -> Result<reqwest::blocking::Client> {
        reqwest::blocking::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .retry(reqwest::retry::never())
            .referer(false)
            .no_proxy()
            .https_only(true)
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|_| AuthError::Unavailable)
    }

    fn bounded_json(response: reqwest::blocking::Response) -> Result<serde_json::Value> {
        let status = response.status();
        if response.content_length().is_some_and(|n| n > MAX_RESPONSE) {
            return Err(AuthError::InvalidResponse);
        }
        let mut bytes = Vec::new();
        response
            .take(MAX_RESPONSE + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| AuthError::Network)?;
        if bytes.len() as u64 > MAX_RESPONSE {
            return Err(AuthError::InvalidResponse);
        }
        let json: serde_json::Value = serde_json::from_slice(&bytes).map_err(|_| {
            if status.is_success() {
                AuthError::InvalidResponse
            } else {
                AuthError::Network
            }
        })?;
        if !status.is_success() {
            return Err(
                if status.as_u16() == 400
                    && json.get("error").and_then(|v| v.as_str()) == Some("invalid_grant")
                {
                    AuthError::Revoked
                } else {
                    AuthError::Network
                },
            );
        }
        if !json.is_object() {
            return Err(AuthError::InvalidResponse);
        }
        Ok(json)
    }

    fn exchange(fields: &[(&str, &str)], initial: bool) -> Result<TokenReply> {
        let response = Self::client()?
            .post(TOKEN_ENDPOINT)
            .form(fields)
            .send()
            .map_err(|_| AuthError::Network)?;
        let grant: TokenReply = serde_json::from_value(Self::bounded_json(response)?)
            .map_err(|_| AuthError::InvalidResponse)?;
        grant.validate(initial)?;
        Ok(grant)
    }
}

impl GoogleProtocol for Google {
    fn authorize(
        &self,
        config: &DesktopClient,
        hint: Option<&str>,
        cancel: &AtomicBool,
    ) -> Result<TokenReply> {
        check_cancel(cancel)?;
        let attempt = Attempt::start(AUTH_TIMEOUT)?;
        let url = attempt.authorization_url(config, hint)?;
        let redirect = attempt.redirect.clone();
        let verifier = attempt.verifier.clone();
        check_cancel(cancel)?;
        open_google_browser(&url)?;
        let code = attempt.wait(cancel)?;
        check_cancel(cancel)?;
        Self::exchange(
            &[
                ("client_id", &config.id),
                ("client_secret", &config.secret),
                ("code", &code),
                ("code_verifier", &verifier),
                ("redirect_uri", &redirect),
                ("grant_type", "authorization_code"),
            ],
            true,
        )
    }

    fn refresh(&self, config: &DesktopClient, token: &str) -> Result<TokenReply> {
        Self::exchange(
            &[
                ("client_id", &config.id),
                ("client_secret", &config.secret),
                ("refresh_token", token),
                ("grant_type", "refresh_token"),
            ],
            false,
        )
    }

    fn account(&self, access: &str) -> Result<Account> {
        let response = Self::client()?
            .get(ACCOUNT_ENDPOINT)
            .bearer_auth(access)
            .send()
            .map_err(|_| AuthError::Network)?;
        let json = Self::bounded_json(response)?;
        let user = json.get("user").ok_or(AuthError::InvalidResponse)?;
        Account::verified(
            user.get("emailAddress")
                .and_then(|v| v.as_str())
                .ok_or(AuthError::InvalidResponse)?,
            user.get("permissionId")
                .and_then(|v| v.as_str())
                .ok_or(AuthError::InvalidResponse)?,
        )
    }
}

#[cfg(windows)]
fn open_google_browser(url: &Url) -> Result<()> {
    use std::ptr::{null, null_mut};
    use windows_sys::Win32::UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOWNORMAL};
    if url.scheme() != "https"
        || url.host_str() != Some("accounts.google.com")
        || url.path() != "/o/oauth2/v2/auth"
        || url.port().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
    {
        return Err(AuthError::Configuration);
    }
    let target: Vec<u16> = url.as_str().encode_utf16().chain(Some(0)).collect();
    let verb: Vec<u16> = "open".encode_utf16().chain(Some(0)).collect();
    // SAFETY: NUL-terminated UTF-16 strings remain alive for this call; no arbitrary shell command.
    let result = unsafe {
        ShellExecuteW(
            null_mut(),
            verb.as_ptr(),
            target.as_ptr(),
            null(),
            null(),
            SW_SHOWNORMAL,
        )
    };
    if result as isize <= 32 {
        Err(AuthError::Browser)
    } else {
        Ok(())
    }
}

#[cfg(not(windows))]
fn open_google_browser(_: &Url) -> Result<()> {
    Err(AuthError::Unavailable)
}

/// Compare-and-replace must be atomic with respect to other native processes.
trait CredentialStore {
    fn read(&self) -> Result<Option<Vec<u8>>>;
    fn replace(&self, expected: Option<&[u8]>, next: Option<&[u8]>) -> Result<()>;
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Credential {
    version: u8,
    client_id: String,
    scope: String,
    enrollment: String,
    permission_scope: String,
    account: Account,
    refresh_token: String,
}

struct Stored {
    bytes: Vec<u8>,
    value: Credential,
}

struct Access {
    token: String,
    account: Account,
    enrollment: String,
    expires: Instant,
}

/// Native account authorization alone is NOT repository admission.
#[derive(Clone, Serialize)]
pub struct AuthorizedAccount {
    pub generation: u64,
    pub access_revision: u64,
    pub email: String,
    pub remaining_seconds: u64,
}

struct State {
    generation: u64,
    access_revision: u64,
    active: Option<Arc<AtomicBool>>,
    access: Option<Access>,
    enrollment: Option<String>,
    observed: bool,
    disabled: bool,
}

struct Operation<'a> {
    state: &'a Mutex<State>,
    generation: u64,
    cancel: Arc<AtomicBool>,
}

impl Operation<'_> {
    fn current(&self) -> Result<MutexGuard<'_, State>> {
        let state = lock(self.state)?;
        if state.generation != self.generation
            || state.disabled
            || !state
                .active
                .as_ref()
                .is_some_and(|flag| Arc::ptr_eq(flag, &self.cancel))
        {
            return Err(AuthError::CredentialChanged);
        }
        check_cancel(&self.cancel)?;
        Ok(state)
    }
}

impl Drop for Operation<'_> {
    fn drop(&mut self) {
        if let Ok(mut state) = self.state.lock() {
            if state
                .active
                .as_ref()
                .is_some_and(|flag| Arc::ptr_eq(flag, &self.cancel))
            {
                state.active = None;
            }
        }
    }
}

struct Host<S, G> {
    config: DesktopClient,
    scope: String,
    expected_email: Option<String>,
    store: S,
    google: G,
    serial: Mutex<()>,
    state: Mutex<State>,
}

impl<S: CredentialStore, G: GoogleProtocol> Host<S, G> {
    fn new(
        config: DesktopClient,
        scope: String,
        email: Option<String>,
        store: S,
        google: G,
    ) -> Result<Self> {
        if !valid_profile_scope(&scope) {
            return Err(AuthError::Configuration);
        }
        let expected_email = email.as_deref().map(normalize_email).transpose()?;
        Ok(Self {
            config,
            scope,
            expected_email,
            store,
            google,
            serial: Mutex::new(()),
            state: Mutex::new(State {
                generation: 1,
                access_revision: 0,
                active: None,
                access: None,
                enrollment: None,
                observed: false,
                disabled: false,
            }),
        })
    }

    fn generation(&self) -> Result<u64> {
        Ok(lock(&self.state)?.generation)
    }

    fn begin(
        &self,
        expected_generation: u64,
        new_identity: bool,
        cancel: Arc<AtomicBool>,
    ) -> Result<Operation<'_>> {
        let mut state = lock(&self.state)?;
        if state.generation != expected_generation {
            return Err(AuthError::CredentialChanged);
        }
        if state.disabled {
            return Err(AuthError::CredentialStore);
        }
        check_cancel(&cancel)?;
        if new_identity {
            state.generation = state
                .generation
                .checked_add(1)
                .ok_or(AuthError::Unavailable)?;
            state.access = None;
        }
        state.active = Some(cancel.clone());
        Ok(Operation {
            state: &self.state,
            generation: state.generation,
            cancel,
        })
    }

    fn read_record(&self) -> Result<Option<Stored>> {
        let Some(bytes) = self.store.read()? else {
            return Ok(None);
        };
        if bytes.is_empty() || bytes.len() > MAX_CREDENTIAL {
            return Err(AuthError::CredentialStore);
        }
        let value: Credential =
            serde_json::from_slice(&bytes).map_err(|_| AuthError::CredentialStore)?;
        if value.version != 1
            || value.scope != self.scope
            || value.client_id != self.config.id
            || value.enrollment.len() != 43
            || !value
                .enrollment
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
            || value.permission_scope != SCOPE
            || !visible_ascii(&value.refresh_token, 2048)
            || Account::verified(&value.account.email, &value.account.permission_id)?
                != value.account
        {
            return Err(AuthError::CredentialStore);
        }
        self.check_account(&value.account, None)?;
        Ok(Some(Stored { bytes, value }))
    }

    fn check_account(&self, account: &Account, previous: Option<&Account>) -> Result<()> {
        if self
            .expected_email
            .as_ref()
            .is_some_and(|expected| expected != &account.email)
            || previous.is_some_and(|old| old != account)
        {
            return Err(AuthError::WrongAccount);
        }
        Ok(())
    }

    fn install(
        &self,
        op: &Operation<'_>,
        prior: Option<&Stored>,
        grant: TokenReply,
        account: Account,
        expires: Instant,
        initial: bool,
    ) -> Result<AuthorizedAccount> {
        grant.validate(initial)?;
        self.check_account(&account, prior.map(|old| &old.value.account))?;
        let refresh_token = grant
            .refresh_token
            .or_else(|| prior.map(|old| old.value.refresh_token.clone()))
            .ok_or(AuthError::MissingRefreshGrant)?;
        let enrollment = if initial {
            random_secret()?
        } else {
            prior
                .ok_or(AuthError::NotAuthorized)?
                .value
                .enrollment
                .clone()
        };
        let credential = Credential {
            version: 1,
            client_id: self.config.id.clone(),
            scope: self.scope.clone(),
            enrollment: enrollment.clone(),
            permission_scope: SCOPE.to_owned(),
            account: account.clone(),
            refresh_token,
        };
        let bytes = serde_json::to_vec(&credential).map_err(|_| AuthError::CredentialStore)?;
        if bytes.len() > MAX_CREDENTIAL {
            return Err(AuthError::CredentialStore);
        }
        let mut state = op.current()?;
        if expires <= Instant::now() {
            return Err(AuthError::Timeout);
        }
        let next_revision = state
            .access_revision
            .checked_add(1)
            .ok_or(AuthError::Unavailable)?;
        self.store
            .replace(prior.map(|old| old.bytes.as_slice()), Some(&bytes))?;
        state.access_revision = next_revision;
        state.access = Some(Access {
            token: grant.access_token,
            account: account.clone(),
            enrollment: enrollment.clone(),
            expires,
        });
        state.enrollment = Some(enrollment);
        state.observed = true;
        state.active = None; // Commit and cancellation share the same linearization point.
        Ok(AuthorizedAccount {
            generation: state.generation,
            access_revision: state.access_revision,
            email: account.email,
            remaining_seconds: expires.saturating_duration_since(Instant::now()).as_secs(),
        })
    }

    fn authorize(&self) -> Result<AuthorizedAccount> {
        self.authorize_for(self.generation()?)
    }

    fn authorize_for(&self, expected_generation: u64) -> Result<AuthorizedAccount> {
        self.authorize_with(expected_generation, Arc::new(AtomicBool::new(false)))
    }

    fn authorize_with(
        &self,
        expected_generation: u64,
        cancel: Arc<AtomicBool>,
    ) -> Result<AuthorizedAccount> {
        let _serial = lock(&self.serial)?;
        let op = self.begin(expected_generation, true, cancel)?;
        let prior = self.read_record()?;
        {
            let mut state = op.current()?;
            state.enrollment = prior.as_ref().map(|old| old.value.enrollment.clone());
            state.observed = true;
        }
        let hint = self
            .expected_email
            .as_deref()
            .or_else(|| prior.as_ref().map(|old| old.value.account.email.as_str()));
        let grant = self.google.authorize(&self.config, hint, &op.cancel)?;
        grant.validate(true)?;
        let expires = grant.expiry();
        drop(op.current()?);
        let account = self.google.account(&grant.access_token)?;
        self.install(&op, prior.as_ref(), grant, account, expires, true)
    }

    fn refresh(&self) -> Result<AuthorizedAccount> {
        self.refresh_for(self.generation()?)
    }

    fn fence_access(state: &mut State) -> Result<()> {
        if state.access.take().is_some() {
            state.generation = state
                .generation
                .checked_add(1)
                .ok_or(AuthError::Unavailable)?;
            state.active = None;
        }
        Ok(())
    }

    fn refresh_for(&self, expected_generation: u64) -> Result<AuthorizedAccount> {
        self.refresh_with(expected_generation, Arc::new(AtomicBool::new(false)))
    }

    fn refresh_with(
        &self,
        expected_generation: u64,
        cancel: Arc<AtomicBool>,
    ) -> Result<AuthorizedAccount> {
        let _serial = lock(&self.serial)?;
        let op = self.begin(expected_generation, false, cancel)?;
        let prior = match self.read_record() {
            Ok(prior) => prior,
            Err(error) => {
                let mut state = op.current()?;
                Self::fence_access(&mut state)?;
                return Err(error);
            }
        };
        let mut state = op.current()?;
        let Some(prior) = prior else {
            Self::fence_access(&mut state)?;
            state.enrollment = None;
            state.observed = true;
            return Err(AuthError::NotAuthorized);
        };
        if state.observed && state.enrollment.as_ref() != Some(&prior.value.enrollment) {
            Self::fence_access(&mut state)?;
            return Err(AuthError::CredentialChanged);
        }
        state.enrollment = Some(prior.value.enrollment.clone());
        state.observed = true;
        if let Some(access) = &state.access {
            if access.enrollment == prior.value.enrollment
                && access.expires > Instant::now()
                && !access.token.is_empty()
            {
                return Ok(AuthorizedAccount {
                    generation: state.generation,
                    access_revision: state.access_revision,
                    email: access.account.email.clone(),
                    remaining_seconds: access
                        .expires
                        .saturating_duration_since(Instant::now())
                        .as_secs(),
                });
            }
        }
        state.access = None;
        drop(state);
        let grant = match self
            .google
            .refresh(&self.config, &prior.value.refresh_token)
        {
            Err(AuthError::Revoked) => {
                let mut state = op.current()?;
                self.store.replace(Some(&prior.bytes), None)?;
                state.enrollment = None;
                state.generation = state
                    .generation
                    .checked_add(1)
                    .ok_or(AuthError::Unavailable)?;
                state.active = None;
                return Err(AuthError::Revoked);
            }
            other => other?,
        };
        grant.validate(false)?;
        let expires = grant.expiry();
        drop(op.current()?);
        let account = self.google.account(&grant.access_token)?;
        self.install(&op, Some(&prior), grant, account, expires, false)
    }

    fn invalidate(&self, generation: u64, access_revision: u64) -> Result<bool> {
        let mut state = lock(&self.state)?;
        if state.generation != generation || state.access_revision != access_revision {
            return Ok(false);
        }
        // Invalidation applies only to the exact issued access revision.
        // If a refresh is in flight, its newly issued revision remains independent.
        Ok(state.access.take().is_some())
    }

    fn cancel(&self) -> Result<bool> {
        let state = lock(&self.state)?;
        if let Some(cancel) = &state.active {
            cancel.store(true, Ordering::Release);
            Ok(true)
        } else {
            Ok(false)
        }
    }

    fn disconnect(&self) -> Result<()> {
        self.disconnect_for(self.generation()?)
    }

    fn disconnect_for(&self, expected_generation: u64) -> Result<()> {
        let mut state = lock(&self.state)?;
        if state.generation != expected_generation {
            return Err(AuthError::CredentialChanged);
        }
        state.generation = state
            .generation
            .checked_add(1)
            .ok_or(AuthError::Unavailable)?;
        if let Some(cancel) = state.active.take() {
            cancel.store(true, Ordering::Release);
        }
        state.access = None;
        state.disabled = true;
        let bytes = self.store.read()?;
        if state.observed {
            if let Some(raw) = &bytes {
                let record: Credential =
                    serde_json::from_slice(raw).map_err(|_| AuthError::CredentialStore)?;
                if state.enrollment.as_ref() != Some(&record.enrollment) {
                    return Err(AuthError::CredentialChanged);
                }
            }
        }
        // Local-only disconnect. Do not revoke Google's grant for other devices.
        self.store.replace(bytes.as_deref(), None)?;
        state.enrollment = None;
        state.observed = true;
        state.disabled = false;
        Ok(())
    }
}

#[cfg(windows)]
mod windows_store;

#[cfg(windows)]
pub use windows_store::NativeOAuthHost;

#[cfg(windows)]
pub mod drive;
#[cfg(test)]
mod tests;
