# Study Director — experimental Tauri shell

This is a local-only development target on `tauri-spike`, not a released app. It reuses the JavaScript frontend and current IndexedDB/OPFS data contracts. The web build remains separate. Never use a real study library, production Drive account or a personal backup to qualify this spike.

## Windows packaged-origin build

Install the [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/) (Rust stable MSVC toolchain, Microsoft C++ Build Tools and WebView2), plus the repository's Node version. From the repository root:

```powershell
git switch tauri-spike
node build/stage-tauri.mjs
cargo test --manifest-path src-tauri/Cargo.toml --locked --features custom-protocol
cargo build --manifest-path src-tauri/Cargo.toml --locked --release --features custom-protocol
.\src-tauri\target\release\study-director-tauri-spike.exe
```

The genuine Windows-resolved Cargo.lock is committed verbatim; all builds use `--locked`. The branch-only Tauri spike QA workflow tests Rust, runs Clippy, builds the current commit and exercises the packaged WebView2 application on a disposable Windows runner. A successful smoke test permits upload of the experimental executable as a short-retention artifact, not a release. The disposable runner uses a temporary executable-specific HKLM WebView2 debugger policy because elevated WebView2 150+ ignores environment-based debugger flags. It is removed on exit and never enters the executable or user environment. No installer, updater, remote deployment or OAuth configuration is enabled.

Use the packaged origin for qualification, not `tauri dev` or an HTTP development server. On Windows the configured HTTPS origin, application identifier and app-local WebView directory constitute storage identity. Do not change them after writing test data. The shell deliberately denies remote navigation and popups, does not expose privileged commands and has no native Drive provider. Native browser-opening, notification, filesystem, update and close-settlement adapters are later passes; unimplemented capabilities are not silently treated as supported. The initial shell intentionally admits neither browser Device Folder nor browser system notifications; use portable backup/import for disposable data, and in-app cues. PDF preview uses the inline workspace; actual WebView PDF rendering and downloads still need qualification.

## P1.A acceptance — VERIFIED — TARGETED

The [Windows build job](https://github.com/oneshubhamt/study-director/actions/runs/45559611341/job/139019877923) passed native compilation, the Rust origin test and Clippy with warnings denied. Its initial smoke failed at debugger discovery; the runner-only policy correction resolved that failure. The [complete packaged-runtime witness](https://github.com/oneshubhamt/study-director/actions/runs/45562845547/job/139030549712) exercised that exact executable (`693d2fc5a481f01281a3ec8be349414e7316d1ca`) and passed every assertion. No product source, native configuration or build script changed between the build and the witness; the committed lockfile is the exact resolved lock used by the build. The [PWA regression job](https://github.com/oneshubhamt/study-director/actions/runs/45562845547/job/139030550058) passed core flow, notes management, offline and update browser tests.

- Packaged HTTPS origin, startup, navigation, profile creation, Trusted Types, and no service-worker registration, PWA installation capture, GIS bundle, remote navigation, popup or global Tauri API: verified.
- Canonical Notes, Diary/Review, live and saved Plans, Wordgard keyboard edit, paused timer recovery, and verified attachment bytes: verified across normal close/reopen and forced process termination.
- IndexedDB strict transaction, OPFS and the actual attachment worker's synchronous access path: verified.
- Portable backup creation, inspection, Combine into a separate disposable profile, profile isolation and switch-back: verified.

Fresh-build qualification on `bdfaf9b6e3df4cac873c64a7ea3c5885cdec8462` passed [locked Windows build/Rust/Clippy](https://github.com/oneshubhamt/study-director/actions/runs/45567897383/job/139047078870), [Repository checks](https://github.com/oneshubhamt/study-director/actions/runs/45567897285), [four PWA journeys](https://github.com/oneshubhamt/study-director/actions/runs/45567897383/job/139047078547), and all five independent Windows samples ([1](https://github.com/oneshubhamt/study-director/actions/runs/45567897383/job/139050656453), [2](https://github.com/oneshubhamt/study-director/actions/runs/45567897383/job/139050656471), [3](https://github.com/oneshubhamt/study-director/actions/runs/45567897383/job/139050656406), [4](https://github.com/oneshubhamt/study-director/actions/runs/45567897383/job/139050656430), [5](https://github.com/oneshubhamt/study-director/actions/runs/45567897383/job/139050656476)). All five verified executable SHA-256 `cd77f28b6512f76c6d85d3645508927efc0b116699abaa3f6fd22606daa1f428` and embedded source identity; all reported complete PASS. They covered cache-bypassed packaged offline reload (emulated network offline), bundled Barlow font, real editor and attachment-worker operations offline, actual normal/focus Wordgard keyboard input and canonical readback, every local persistence/import/profile/security assertion. Earlier fresh-build failures came from a fixture assigning the hidden textarea after the editor could already mount; the corrected witness seeds through the actual editor, and all five independently passed. No product source or data-format change was required. This is bounded shell qualification, not actual power-cut/installer/native-service evidence.

Native services, signed packaging/updating, actual OS shutdown/restart, sleep, power loss, picker/download and PDF rendering interoperability remain later gates. Future runs build and verify their own source and executable.

## P1.B native OAuth infrastructure (open)

The Rust OAuth worker library is compiled independently of IPC. It owns installed-app PKCE, loopback callbacks, fixed Google token/account requests and Windows Credential Manager persistence, with conditional credential replacement and stale refresh/disconnect fences. No credentials are bundled. The native executable still does not expose Drive or a token bridge: actual native transport, frontend admission/registration and real two-way interoperability remain open. The worker must be used off the UI thread. P0 exact F33 independent baseline reproduction passed ([independent exact F33 run](https://github.com/oneshubhamt/study-director/actions/runs/45573390871/job/139065261271)).
