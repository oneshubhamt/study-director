# Study Director — experimental Tauri shell

This is a local-only development target on `tauri-spike`, not a released app. It reuses the JavaScript frontend and current IndexedDB/OPFS data contracts. The web build remains separate. Never use a real study library, production Drive account or a personal backup to qualify this spike.

## Windows packaged-origin build

Install the [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/) (Rust stable MSVC toolchain, Microsoft C++ Build Tools and WebView2), plus the repository's Node version. From the repository root:

```powershell
git switch tauri-spike
node build/stage-tauri.mjs
cargo generate-lockfile --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml --features custom-protocol
cargo build --manifest-path src-tauri/Cargo.toml --release --features custom-protocol
.\src-tauri\target\release\study-director-tauri-spike.exe
```

The first successful resolution must be reviewed and its Cargo.lock committed to this branch; subsequent checks/builds use `--locked`. The current environment cannot resolve Cargo dependencies or compile Rust, so neither a lockfile nor a Windows binary is claimed. Do not generate a fake lockfile. No installer, updater, remote deployment or OAuth configuration is enabled.

Use the packaged origin for qualification, not `tauri dev` or an HTTP development server. On Windows the configured HTTPS origin, application identifier and app-local WebView directory constitute storage identity. Do not change them after writing test data. The shell deliberately denies remote navigation and popups, does not expose privileged commands and has no native Drive provider. Native browser-opening, notification, filesystem, update and close-settlement adapters are later passes; unimplemented capabilities are not silently treated as supported. The initial shell intentionally admits neither browser Device Folder nor browser system notifications; use portable backup/import for disposable data, and in-app cues. PDF preview uses the inline workspace; actual WebView PDF rendering and downloads still need qualification.

## P1.A acceptance (open)

- Compile/test Rust and lock dependency resolution; verify CSP and the exact packaged origin in WebView2, including workers and Trusted Types.
- Create a disposable profile; test navigation, Notes, Diary/Review, Plans, timer/session recovery, Wordgard, attachments, exports/imports and profile switching.
- Confirm IndexedDB and OPFS access (including worker synchronous access handles where supported), verified attachment bytes and canonical persistence across normal close/reopen and forced termination.
- Confirm no service-worker registration or GIS authentication, no remote navigation/new privileged webview, and no unintended PWA install prompt.
- Check web/PWA regression, keyboard access and startup behavior. Record failures openly before closing the pass.
