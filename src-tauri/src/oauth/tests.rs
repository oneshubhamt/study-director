use super::*;
use std::sync::atomic::AtomicUsize;

fn config() -> DesktopClient {
    DesktopClient::new(
        "disposable-fixture.apps.googleusercontent.com".into(),
        "fixture-only".into(),
    )
    .unwrap()
}

fn account() -> Account {
    Account::verified("fixture@example.invalid", "fixture-account").unwrap()
}

fn reply(initial: bool) -> TokenReply {
    TokenReply {
        access_token: "fixture-access".into(),
        token_type: "Bearer".into(),
        expires_in: 3600,
        scope: initial.then(|| SCOPE.to_owned()),
        refresh_token: initial.then(|| "fixture-refresh".into()),
    }
}

fn request(attempt: &Attempt, query: &str) -> Vec<u8> {
    format!(
        "GET {CALLBACK_PATH}?{query} HTTP/1.1\r\nHost: {}\r\nConnection: close\r\n\r\n",
        attempt.host
    )
    .into_bytes()
}

#[test]
fn authorization_url_is_fixed_pkce_offline_and_state_bound() {
    let attempt = Attempt::start(Duration::from_secs(3)).unwrap();
    let next = Attempt::start(Duration::from_secs(3)).unwrap();
    assert_ne!(attempt.state, next.state);
    assert_ne!(attempt.verifier, next.verifier);
    let url = attempt
        .authorization_url(&config(), Some("fixture@example.invalid"))
        .unwrap();
    assert_eq!(url.host_str(), Some("accounts.google.com"));
    assert_eq!(url.path(), "/o/oauth2/v2/auth");
    let params: std::collections::HashMap<_, _> = url.query_pairs().collect();
    assert_eq!(params["code_challenge_method"], "S256");
    assert_eq!(params["scope"], SCOPE);
    assert_eq!(params["access_type"], "offline");
    assert_eq!(params["state"], attempt.state);
    assert_eq!(params["redirect_uri"], attempt.redirect);
    assert_eq!(
        params["code_challenge"],
        URL_SAFE_NO_PAD.encode(Sha256::digest(attempt.verifier.as_bytes()))
    );
    assert!(!params.contains_key("client_secret"));
    assert!(!url.as_str().contains(&attempt.verifier));
    assert!(DesktopClient::new("evil.example".into(), "fixture".into()).is_err());
    assert!(DesktopClient::new(config().id, "".into()).is_err());
}

#[test]
fn callback_parser_rejects_wrong_duplicate_and_malformed_inputs() {
    let attempt = Attempt::start(Duration::from_secs(3)).unwrap();
    let state = &attempt.state;
    assert!(
        matches!(attempt.parse(&request(&attempt, &format!("state={state}&code=fixture%2Fcode"))), Some(Callback::Code(code)) if code == "fixture/code")
    );
    assert!(matches!(
        attempt.parse(&request(
            &attempt,
            &format!("state={state}&error=access_denied")
        )),
        Some(Callback::Denied)
    ));
    for query in [
        "state=wrong&code=fixture".to_owned(),
        format!("state={state}&state={state}&code=fixture"),
        format!("state={state}&code=one&code=two"),
        format!("state={state}&error=access_denied&code=fixture"),
        format!("state={state}&code=%0A"),
        format!("state={state}&code=%ZZ"),
        format!("state={state}&code=fixture#fragment"),
        format!("state={state}&code="),
    ] {
        assert!(attempt.parse(&request(&attempt, &query)).is_none());
    }
    let valid =
        String::from_utf8(request(&attempt, &format!("state={state}&code=fixture"))).unwrap();
    for invalid in [
        valid.replace("GET ", "POST "),
        valid.replace(CALLBACK_PATH, "/wrong"),
        valid.replace(&attempt.host, "localhost:1"),
        valid.replace("\r\nConnection:", "\r\nContent-Length: 2\r\nConnection:"),
        valid.replace("\r\nConnection:", "\r\nHost: duplicate\r\nConnection:"),
    ] {
        assert!(attempt.parse(invalid.as_bytes()).is_none());
    }
}

#[test]
fn real_loopback_ignores_wrong_state_and_consumes_valid_callback() {
    let attempt = Attempt::start(Duration::from_secs(5)).unwrap();
    let address = attempt.listener.local_addr().unwrap();
    let invalid = request(&attempt, "state=wrong&code=fixture");
    let valid = request(&attempt, &format!("state={}&code=fixture", attempt.state));
    let worker = thread::spawn(move || attempt.wait(&AtomicBool::new(false)));
    for (bytes, status) in [(invalid, "400 Bad Request"), (valid, "200 OK")] {
        let mut socket = TcpStream::connect(address).unwrap();
        socket
            .set_read_timeout(Some(Duration::from_secs(2)))
            .unwrap();
        socket.write_all(&bytes).unwrap();
        let mut response = String::new();
        socket.read_to_string(&mut response).unwrap();
        assert!(response.starts_with(&format!("HTTP/1.1 {status}")));
        assert!(!response.contains("fixture"));
    }
    assert_eq!(worker.join().unwrap().unwrap(), "fixture");
    assert!(
        TcpStream::connect(address).is_err(),
        "listener is consumed after one callback"
    );
}

#[test]
fn loopback_timeout_and_cancellation_are_bounded() {
    let attempt = Attempt::start(Duration::from_millis(40)).unwrap();
    assert_eq!(
        attempt.wait(&AtomicBool::new(false)).unwrap_err(),
        AuthError::Timeout
    );
    let attempt = Attempt::start(Duration::from_secs(3)).unwrap();
    assert_eq!(
        attempt.wait(&AtomicBool::new(true)).unwrap_err(),
        AuthError::Cancelled
    );
    let attempt = Attempt::start(Duration::from_secs(3)).unwrap();
    let address = attempt.listener.local_addr().unwrap();
    let cancel = Arc::new(AtomicBool::new(false));
    let flag = cancel.clone();
    let worker = thread::spawn(move || attempt.wait(&flag));
    let mut stalled = TcpStream::connect(address).unwrap();
    stalled.write_all(b"GET /oauth/callback?").unwrap();
    cancel.store(true, Ordering::Release);
    assert_eq!(worker.join().unwrap().unwrap_err(), AuthError::Cancelled);
}

#[test]
fn token_reply_scope_type_expiry_and_refresh_grant_are_strict() {
    assert!(reply(true).validate(true).is_ok());
    assert!(reply(false).validate(false).is_ok());
    assert_eq!(reply(false).validate(true), Err(AuthError::InvalidScope));
    let mut token = reply(true);
    token.refresh_token = None;
    assert_eq!(token.validate(true), Err(AuthError::MissingRefreshGrant));
    token.scope = Some(format!("{SCOPE} https://www.googleapis.com/auth/drive"));
    assert_eq!(token.validate(false), Err(AuthError::InvalidScope));
    token.token_type = "MAC".into();
    assert_eq!(token.validate(false), Err(AuthError::InvalidResponse));
    token = reply(true);
    token.expires_in = 0;
    assert_eq!(token.validate(true), Err(AuthError::InvalidResponse));
}

#[derive(Default, Clone)]
struct MemoryStore(Arc<Mutex<Option<Vec<u8>>>>);

impl CredentialStore for MemoryStore {
    fn read(&self) -> Result<Option<Vec<u8>>> {
        Ok(lock(&self.0)?.clone())
    }

    fn replace(&self, expected: Option<&[u8]>, next: Option<&[u8]>) -> Result<()> {
        let mut state = lock(&self.0)?;
        if state.as_deref() != expected {
            return Err(AuthError::CredentialChanged);
        }
        *state = next.map(<[u8]>::to_vec);
        Ok(())
    }
}

#[derive(Default)]
struct FixtureGoogle {
    refreshes: AtomicUsize,
    wrong: AtomicBool,
    offline: AtomicBool,
    revoked: AtomicBool,
    rotate: AtomicBool,
    pause: Mutex<Option<(Arc<std::sync::Barrier>, Arc<std::sync::Barrier>)>>,
}

impl GoogleProtocol for FixtureGoogle {
    fn authorize(
        &self,
        _: &DesktopClient,
        _: Option<&str>,
        cancel: &AtomicBool,
    ) -> Result<TokenReply> {
        check_cancel(cancel)?;
        Ok(reply(true))
    }

    fn refresh(&self, _: &DesktopClient, _: &str) -> Result<TokenReply> {
        self.refreshes.fetch_add(1, Ordering::SeqCst);
        if let Some((entered, release)) = lock(&self.pause)?.take() {
            entered.wait();
            release.wait();
        }
        if self.offline.load(Ordering::SeqCst) {
            return Err(AuthError::Network);
        }
        if self.revoked.load(Ordering::SeqCst) {
            return Err(AuthError::Revoked);
        }
        let mut value = reply(false);
        if self.rotate.load(Ordering::SeqCst) {
            value.refresh_token = Some("fixture-rotated".into());
        }
        Ok(value)
    }

    fn account(&self, _: &str) -> Result<Account> {
        if self.wrong.load(Ordering::SeqCst) {
            Account::verified("other@example.invalid", "other-account")
        } else {
            Ok(account())
        }
    }
}

fn host(store: MemoryStore) -> Host<MemoryStore, FixtureGoogle> {
    Host::new(
        config(),
        "".into(),
        Some("fixture@example.invalid".into()),
        store,
        FixtureGoogle::default(),
    )
    .unwrap()
}

fn expire(host: &Host<MemoryStore, FixtureGoogle>) {
    lock(&host.state).unwrap().access.as_mut().unwrap().expires = Instant::now();
}

#[test]
fn session_restore_refresh_rotation_and_late_401_are_fenced() {
    let store = MemoryStore::default();
    let first = host(store.clone());
    let initial = first.authorize().unwrap();
    assert_eq!(initial.email, "fixture@example.invalid");
    assert_eq!(
        first.refresh().unwrap().access_revision,
        initial.access_revision
    );
    assert_eq!(first.google.refreshes.load(Ordering::SeqCst), 0);
    expire(&first);
    first.google.rotate.store(true, Ordering::SeqCst);
    let next = first.refresh().unwrap();
    assert_eq!(next.generation, initial.generation);
    assert_ne!(next.access_revision, initial.access_revision);
    assert!(!first
        .invalidate(initial.generation, initial.access_revision)
        .unwrap());
    assert!(first
        .invalidate(next.generation, next.access_revision)
        .unwrap());
    assert_eq!(
        first.read_record().unwrap().unwrap().value.refresh_token,
        "fixture-rotated"
    );
    drop(first);
    let reopened = host(store.clone());
    assert_eq!(reopened.refresh().unwrap().email, "fixture@example.invalid");
    assert_eq!(reopened.google.refreshes.load(Ordering::SeqCst), 1);
    reopened.disconnect().unwrap();
    assert!(store.read().unwrap().is_none());
    assert!(matches!(reopened.refresh(), Err(AuthError::NotAuthorized)));
}

#[test]
fn wrong_account_and_offline_preserve_prior_grant_revocation_removes_it() {
    let store = MemoryStore::default();
    let host = host(store.clone());
    host.google.wrong.store(true, Ordering::SeqCst);
    assert!(matches!(host.authorize(), Err(AuthError::WrongAccount)));
    assert!(store.read().unwrap().is_none());
    host.google.wrong.store(false, Ordering::SeqCst);
    host.authorize().unwrap();
    let original = store.read().unwrap();
    expire(&host);
    host.google.offline.store(true, Ordering::SeqCst);
    assert!(matches!(host.refresh(), Err(AuthError::Network)));
    assert_eq!(store.read().unwrap(), original);
    host.google.offline.store(false, Ordering::SeqCst);
    host.google.wrong.store(true, Ordering::SeqCst);
    assert!(matches!(host.refresh(), Err(AuthError::WrongAccount)));
    assert_eq!(store.read().unwrap(), original);
    host.google.wrong.store(false, Ordering::SeqCst);
    host.google.revoked.store(true, Ordering::SeqCst);
    assert!(matches!(host.refresh(), Err(AuthError::Revoked)));
    assert!(store.read().unwrap().is_none());
}

#[test]
fn cancelled_refresh_cannot_resurrect_disconnected_or_successor_credentials() {
    let store = MemoryStore::default();
    let original = Arc::new(host(store.clone()));
    original.authorize().unwrap();
    expire(&original);
    let entered = Arc::new(std::sync::Barrier::new(2));
    let release = Arc::new(std::sync::Barrier::new(2));
    *lock(&original.google.pause).unwrap() = Some((entered.clone(), release.clone()));
    let worker_host = original.clone();
    let worker = thread::spawn(move || worker_host.refresh());
    entered.wait();
    original.disconnect().unwrap();
    assert!(store.read().unwrap().is_none());
    let successor = host(store.clone());
    successor.authorize().unwrap();
    let bytes = store.read().unwrap();
    release.wait();
    assert!(matches!(
        worker.join().unwrap(),
        Err(AuthError::CredentialChanged) | Err(AuthError::Cancelled)
    ));
    assert_eq!(store.read().unwrap(), bytes);
    assert!(matches!(
        original.disconnect(),
        Err(AuthError::CredentialChanged)
    ));
    assert_eq!(store.read().unwrap(), bytes);
}

#[test]
fn unknown_or_changed_credentials_do_not_become_empty_or_overwritten() {
    let store = MemoryStore::default();
    store.replace(None, Some(b"not-json")).unwrap();
    let host = host(store.clone());
    assert!(matches!(host.refresh(), Err(AuthError::CredentialStore)));
    assert!(matches!(host.authorize(), Err(AuthError::CredentialStore)));
    assert_eq!(
        store.read().unwrap().as_deref(),
        Some(b"not-json".as_slice())
    );
    host.disconnect().unwrap();
    assert!(store.read().unwrap().is_none());
}

#[cfg(windows)]
#[test]
fn windows_credential_manager_exact_readback_isolation_and_compare_exchange() {
    use super::windows_store::WindowsStore;
    let mut seed = [0_u8; 4];
    getrandom::fill(&mut seed).unwrap();
    let scope = format!("prof_qa_fixture_{:08x}", u32::from_le_bytes(seed));
    let store = WindowsStore::new(&config(), &scope).unwrap();
    let other = WindowsStore::new(&config(), &scope).unwrap();
    let separate = WindowsStore::new(
        &config(),
        &format!("prof_qb_fixture_{:08x}", u32::from_le_bytes(seed)),
    )
    .unwrap();
    // Unique, synthetic key; no access to the actual application's credential.
    struct Cleanup<'a>(&'a WindowsStore);
    impl Drop for Cleanup<'_> {
        fn drop(&mut self) {
            if let Ok(Some(bytes)) = self.0.read() {
                let _ = self.0.replace(Some(&bytes), None);
            }
        }
    }
    assert!(store.read().unwrap().is_none());
    let _cleanup = Cleanup(&store);
    store.replace(None, Some(b"synthetic-credential")).unwrap();
    assert_eq!(
        other.read().unwrap().as_deref(),
        Some(b"synthetic-credential".as_slice())
    );
    assert!(separate.read().unwrap().is_none());
    assert_eq!(
        other.replace(None, Some(b"stale")),
        Err(AuthError::CredentialChanged)
    );
    other
        .replace(Some(b"synthetic-credential"), Some(b"rotated"))
        .unwrap();
    assert_eq!(
        store.replace(Some(b"synthetic-credential"), None),
        Err(AuthError::CredentialChanged)
    );
    assert_eq!(
        store.read().unwrap().as_deref(),
        Some(b"rotated".as_slice())
    );
    other.replace(Some(b"rotated"), None).unwrap();
    assert!(store.read().unwrap().is_none());
}

#[test]
fn google_client_can_construct_locked_tls_transport_without_live_credentials() {
    assert!(Google::client().is_ok());
}

#[test]
fn queued_calls_cannot_acquire_a_successor_generation() {
    let store = MemoryStore::default();
    let host = host(store.clone());
    let old = host.authorize().unwrap();
    host.disconnect().unwrap();
    assert!(matches!(host.authorize_for(old.generation), Err(AuthError::CredentialChanged)));
    assert!(matches!(host.refresh_for(old.generation), Err(AuthError::CredentialChanged)));
    assert!(store.read().unwrap().is_none());
    assert!(host.authorize().is_ok());
}

#[test]
fn concurrent_refreshes_coalesce_and_external_removal_fences_access() {
    let store = MemoryStore::default();
    let host = Arc::new(host(store.clone()));
    let old = host.authorize().unwrap();
    expire(&host);
    let entered = Arc::new(std::sync::Barrier::new(2));
    let release = Arc::new(std::sync::Barrier::new(2));
    *lock(&host.google.pause).unwrap() = Some((entered.clone(), release.clone()));
    let first = host.clone();
    let a = thread::spawn(move || first.refresh_for(old.generation));
    entered.wait();
    let second = host.clone();
    let b = thread::spawn(move || second.refresh_for(old.generation));
    release.wait();
    let a = a.join().unwrap().unwrap();
    let b = b.join().unwrap().unwrap();
    assert_eq!(a.access_revision, b.access_revision);
    assert_eq!(host.google.refreshes.load(Ordering::SeqCst), 1);
    let bytes = store.read().unwrap().unwrap();
    store.replace(Some(&bytes), None).unwrap();
    assert!(matches!(host.refresh(), Err(AuthError::NotAuthorized)));
    assert_ne!(host.generation().unwrap(), a.generation);
    assert!(!host.invalidate(a.generation, a.access_revision).unwrap());
}
