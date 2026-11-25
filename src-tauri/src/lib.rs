// Native services are compiled and tested independently of WebView IPC.
#[cfg(any(windows, test))]
pub mod oauth;
