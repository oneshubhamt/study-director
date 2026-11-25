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

## P1.A acceptance — historical pass; fresh qualification reopened

The [Windows build job](https://github.com/oneshubhamt/study-director/actions/runs/45559611341/job/139019877923) passed native compilation, the Rust origin test and Clippy with warnings denied. Its initial smoke failed at debugger discovery; the runner-only policy correction resolved that failure. The [complete packaged-runtime witness](https://github.com/oneshubhamt/study-director/actions/runs/45562845547/job/139030549712) exercised that exact executable (`693d2fc5a481f01281a3ec8be349414e7316d1ca`) and passed every assertion. No product source, native configuration or build script changed between the build and the witness; the committed lockfile is the exact resolved lock used by the build. The [PWA regression job](https://github.com/oneshubhamt/study-director/actions/runs/45562845547/job/139030550058) passed core flow, notes management, offline and update browser tests.

- Packaged HTTPS origin, startup, navigation, profile creation, Trusted Types, and no service-worker registration, PWA installation capture, GIS bundle, remote navigation, popup or global Tauri API: verified.
- Canonical Notes, Diary/Review, live and saved Plans, Wordgard keyboard edit, paused timer recovery, and verified attachment bytes: verified across normal close/reopen and forced process termination.
- IndexedDB strict transaction, OPFS and the actual attachment worker's synchronous access path: verified.
- Portable backup creation, inspection, Combine into a separate disposable profile, profile isolation and switch-back: verified.

Two subsequent fresh Windows builds passed Rust/Clippy/build, but failed Wordgard insertion ([run 45562845547](https://github.com/oneshubhamt/study-director/actions/runs/45562845547/job/139030934097), [run 45563150217](https://github.com/oneshubhamt/study-director/actions/runs/45563150217/job/139034143083)). P1.A is reopened pending repeatable fresh-build qualification. Earlier passes are evidence, not a substitute for correcting the failure. See [execution register](../TAURI-EXECUTION.md) and [roadmap](../docs/native/PROGRAMME.md). Native services, signed packaging/updating, actual OS shutdown/restart, sleep, power loss, picker/download and PDF rendering interoperability remain later gates. Every subsequent workflow run must build and test its own commit.
