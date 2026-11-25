//! Windows user-scoped credentials. No refresh grant is written to a plain file.

use super::*;
use std::ptr::{null, null_mut};
use windows_sys::Win32::{
    Foundation::{CloseHandle, GetLastError, ERROR_NOT_FOUND, HANDLE, WAIT_ABANDONED, WAIT_OBJECT_0},
    Security::Credentials::{
        CredDeleteW, CredFree, CredReadW, CredWriteW, CREDENTIALW, CRED_PERSIST_LOCAL_MACHINE,
        CRED_TYPE_GENERIC,
    },
    System::Threading::{CreateMutexW, ReleaseMutex, WaitForSingleObject},
};

fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(Some(0)).collect()
}

struct MutexLease(HANDLE);

impl Drop for MutexLease {
    fn drop(&mut self) {
        // SAFETY: acquired handle is owned by this thread and is closed exactly once.
        unsafe {
            ReleaseMutex(self.0);
            CloseHandle(self.0);
        }
    }
}

struct CredentialBuffer(*mut CREDENTIALW);

impl Drop for CredentialBuffer {
    fn drop(&mut self) {
        // SAFETY: Windows allocated the successful CredReadW result.
        unsafe { CredFree(self.0.cast()) };
    }
}

pub(super) struct WindowsStore {
    target: Vec<u16>,
    mutex: Vec<u16>,
}

impl WindowsStore {
    pub(super) fn new(config: &DesktopClient, scope: &str) -> Result<Self> {
        if !valid_profile_scope(scope) {
            return Err(AuthError::Configuration);
        }
        let id = URL_SAFE_NO_PAD.encode(Sha256::digest(format!("{}\n{}", config.id, scope)));
        Ok(Self {
            target: wide(&format!("StudyDirector.TauriSpike.Drive.v1/{id}")),
            mutex: wide(&format!("Global\\StudyDirector.TauriSpike.Drive.v1.{id}")),
        })
    }

    fn lease(&self) -> Result<MutexLease> {
        // SAFETY: names are stable NUL-terminated strings; no security descriptor is supplied.
        let handle = unsafe { CreateMutexW(null(), 0, self.mutex.as_ptr()) };
        if handle.is_null() {
            return Err(AuthError::CredentialStore);
        }
        let result = unsafe { WaitForSingleObject(handle, 5000) };
        if result != WAIT_OBJECT_0 && result != WAIT_ABANDONED {
            unsafe { CloseHandle(handle) };
            return Err(AuthError::CredentialStore);
        }
        // After abandoned ownership the credential is read again before any write.
        Ok(MutexLease(handle))
    }

    fn read_locked(&self) -> Result<Option<Vec<u8>>> {
        let mut pointer = null_mut();
        // SAFETY: Windows initializes pointer on success. It is released by CredentialBuffer.
        if unsafe { CredReadW(self.target.as_ptr(), CRED_TYPE_GENERIC, 0, &mut pointer) } == 0 {
            return if unsafe { GetLastError() } == ERROR_NOT_FOUND {
                Ok(None)
            } else {
                Err(AuthError::CredentialStore)
            };
        }
        if pointer.is_null() {
            return Err(AuthError::CredentialStore);
        }
        let buffer = CredentialBuffer(pointer);
        let credential = unsafe { &*buffer.0 };
        let count = credential.CredentialBlobSize as usize;
        if count == 0 || count > MAX_CREDENTIAL || credential.CredentialBlob.is_null() {
            return Err(AuthError::CredentialStore);
        }
        // SAFETY: CredReadW owns count bytes until CredFree.
        Ok(Some(unsafe { std::slice::from_raw_parts(credential.CredentialBlob, count) }.to_vec()))
    }

    fn write_locked(&self, bytes: Option<&[u8]>) -> Result<()> {
        if let Some(bytes) = bytes {
            if bytes.is_empty() || bytes.len() > MAX_CREDENTIAL {
                return Err(AuthError::CredentialStore);
            }
            let mut target = self.target.clone();
            let mut username = wide("Study Director");
            // SAFETY: CREDENTIALW is a C structure with zero-valid fields. All supplied pointers
            // remain alive for CredWriteW, which copies the blob into the OS credential store.
            let credential = CREDENTIALW {
                Type: CRED_TYPE_GENERIC,
                TargetName: target.as_mut_ptr(),
                CredentialBlobSize: bytes.len() as u32,
                CredentialBlob: bytes.as_ptr().cast_mut(),
                Persist: CRED_PERSIST_LOCAL_MACHINE,
                UserName: username.as_mut_ptr(),
                ..unsafe { std::mem::zeroed() }
            };
            if unsafe { CredWriteW(&credential, 0) } == 0 {
                return Err(AuthError::CredentialStore);
            }
        } else if unsafe { CredDeleteW(self.target.as_ptr(), CRED_TYPE_GENERIC, 0) } == 0
            && unsafe { GetLastError() } != ERROR_NOT_FOUND
        {
            return Err(AuthError::CredentialStore);
        }
        Ok(())
    }
}

impl CredentialStore for WindowsStore {
    fn read(&self) -> Result<Option<Vec<u8>>> {
        let _lease = self.lease()?;
        self.read_locked()
    }

    fn replace(&self, expected: Option<&[u8]>, next: Option<&[u8]>) -> Result<()> {
        let _lease = self.lease()?;
        let current = self.read_locked()?;
        if current.as_deref() != expected {
            return Err(AuthError::CredentialChanged);
        }
        if current.as_deref() != next {
            self.write_locked(next)?;
            if self.read_locked()?.as_deref() != next {
                return Err(AuthError::CredentialStore);
            }
        }
        Ok(())
    }
}

/// Native worker-side service, not an IPC handler. Each instance is bound to one
/// immutable local profile scope and desktop client; no token leaves this API.
pub struct NativeOAuthHost(Host<WindowsStore, Google>);

impl NativeOAuthHost {
    pub fn new(config: DesktopClient, scope: String, expected_email: Option<String>) -> Result<Self> {
        let store = WindowsStore::new(&config, &scope)?;
        Ok(Self(Host::new(config, scope, expected_email, store, Google)?))
    }

    pub fn authorize(&self) -> Result<AuthorizedAccount> {
        self.0.authorize()
    }

    pub fn refresh(&self) -> Result<AuthorizedAccount> {
        self.0.refresh()
    }

    pub fn invalidate(&self, generation: u64, access_revision: u64) -> Result<bool> {
        self.0.invalidate(generation, access_revision)
    }

    pub fn cancel(&self) -> Result<bool> {
        self.0.cancel()
    }

    pub fn disconnect(&self) -> Result<()> {
        self.0.disconnect()
    }
}
