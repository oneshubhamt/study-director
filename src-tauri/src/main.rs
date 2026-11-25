#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{webview::NewWindowResponse, Manager, Url, WebviewWindowBuilder};

fn packaged_origin(url: &Url) -> bool {
    let (scheme, host) = if cfg!(any(target_os = "windows", target_os = "android")) {
        ("https", "tauri.localhost")
    } else {
        ("tauri", "localhost")
    };
    url.scheme() == scheme
        && url.host_str() == Some(host)
        && url.port().is_none()
        && url.username().is_empty()
        && url.password().is_none()
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let config = app
                .config()
                .app
                .windows
                .iter()
                .find(|window| window.label == "main")
                .ok_or_else(|| {
                    std::io::Error::other("Missing experimental main window configuration")
                })?;
            let builder = WebviewWindowBuilder::from_config(app.handle(), config)?
                .on_navigation(packaged_origin)
                .on_new_window(|_, _| NewWindowResponse::Deny);

            // This is an experimental app-local location, never the browser's
            // profile or a user-selected backup folder. Do not change it after use.
            #[cfg(target_os = "windows")]
            let builder = builder.data_directory(app.path().app_local_data_dir()?.join("webview"));

            builder.build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Study Director experimental native shell failed");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn packaged_navigation_is_origin_bound() {
        let origin = if cfg!(any(target_os = "windows", target_os = "android")) {
            "https://tauri.localhost"
        } else {
            "tauri://localhost"
        };
        assert!(packaged_origin(
            &Url::parse(&format!("{origin}/index.html?tab=library")).unwrap()
        ));
        for url in [
            "https://accounts.google.com/",
            "https://study-director.web.app/",
            "https://tauri.localhost.example.com/",
            "https://tauri.localhost:8443/",
            "http://tauri.localhost/",
            "https://evil@tauri.localhost/",
            "tauri://localhost.example.com/",
            "file:///C:/test.html",
            "about:blank",
        ] {
            assert!(!packaged_origin(&Url::parse(url).unwrap()), "{url}");
        }
    }
}
