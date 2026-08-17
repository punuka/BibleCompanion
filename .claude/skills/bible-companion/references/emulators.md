# Running on emulators and devices

## The networking rule (this is what breaks first)

The mobile app reads `EXPO_PUBLIC_API_URL`. `localhost` means "this device", so on anything other than the web preview it points at the phone, not your machine.

| Target | `EXPO_PUBLIC_API_URL` |
|---|---|
| Web preview (`w`) | `http://localhost:8787` |
| Android emulator (AVD) | `http://10.0.2.2:8787` |
| Genymotion | `http://10.0.3.2:8787` |
| iOS simulator (macOS) | `http://localhost:8787` |
| Physical device, Expo Go | `http://<your-LAN-IP>:8787` |

Find the LAN IP on Windows with `ipconfig` (IPv4 Address on your active adapter). The API must bind `HOST=0.0.0.0`, not `127.0.0.1`, or nothing outside the machine can reach it. Windows Firewall will prompt on first bind — allow private networks.

Changing an `EXPO_PUBLIC_*` variable requires restarting the Expo dev server; it is inlined at bundle time, not read at runtime.

## Android emulator

Not installed on this machine as of writing. To set it up:

1. Install **Android Studio** (includes the SDK, platform-tools, and the emulator).
2. During setup, tick *Android SDK*, *Android SDK Platform*, *Android Virtual Device*.
3. Set environment variables (PowerShell, permanent):
   ```powershell
   [Environment]::SetEnvironmentVariable('ANDROID_HOME', "$env:LOCALAPPDATA\Android\Sdk", 'User')
   [Environment]::SetEnvironmentVariable('Path', "$env:Path;$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:LOCALAPPDATA\Android\Sdk\emulator", 'User')
   ```
   Open a new terminal, then `adb version` and `emulator -version` should both answer.
4. Create an AVD: Android Studio → *Device Manager* → *Create Device* → Pixel 7 → a recent system image with Google Play.
5. Boot it: `emulator -avd Pixel_7_API_34` (list names with `emulator -list-avds`).
6. With the emulator running, `npm run dev -w apps/mobile` then press `a`.

Hardware acceleration matters. On Windows, either WHPX (Hyper-V/Windows Hypervisor Platform, enable in *Turn Windows features on or off*) or Intel HAXM. Without it the emulator boots but is unusably slow.

## iOS simulator

iOS simulators require Xcode and **only run on macOS**. There is no Windows path — not via Expo, not via any emulator. Options from Windows:

- **Expo Go on a physical iPhone** — install Expo Go from the App Store, scan the QR from the dev server. Covers everything short of native modules.
- **EAS Build** (`eas build -p ios`) — Expo's hosted macOS builders produce a real `.ipa`. Needs an Apple Developer account for device installs; simulator builds (`--profile preview`) do not.
- A macOS machine or CI runner for the final pre-release pass.

Test on iOS before shipping regardless of how good it looks on Android — safe-area insets, keyboard avoidance, and RTL layout all differ.

## Expo Go vs a development build

Everything in this app runs in **Expo Go** today: no custom native modules, no config plugins. `npx expo start` then `a` / `i` / `w`.

If you later add a native dependency (push notifications with a custom provider, in-app purchases, a native audio player for spoken scripture), Expo Go will stop being sufficient and you move to a development build:

```bash
npx expo prebuild            # generates android/ and ios/
npx expo run:android         # needs the Android SDK + a JDK
```

Do that only when a native module forces it — Expo Go's reload loop is much faster.

## Cloud device farms (NativeBridge.io and similar)

The NativeBridge VS Code extension does not run an emulator on this machine — it uploads an **APK** to nativebridge.io and streams a cloud-hosted device into a webview panel. Same for BrowserStack, Sauce Labs, and Firebase Test Lab. Two consequences:

**You need a real APK**, not the Expo Go dev bundle. Either `expo prebuild && npx expo run:android` locally (needs the Android SDK and a JDK), or the cloud path:

```bash
npm install -g eas-cli
eas login
eas build:configure          # writes extra.eas.projectId into app.json
eas build -p android --profile preview
```

The `preview` profile in `apps/mobile/eas.json` is set to `buildType: "apk"` deliberately — the default `app-bundle` produces an `.aab`, which device farms cannot install.

**`EXPO_PUBLIC_API_URL` must be a public HTTPS URL.** This is the failure people hit and misdiagnose as a broken build. The device is in someone else's cloud, so `localhost`, `10.0.2.2`, and your LAN IP are all unreachable — the app will bundle fine, install fine, and then every request fails. Expose the API first:

```bash
npx localtunnel --port 8787     # or: cloudflared tunnel --url http://localhost:8787
```

Put that URL in the `preview` profile's `env` block, add it to `CORS_ORIGINS` in `apps/api/.env`, and rebuild. `EXPO_PUBLIC_*` is inlined at bundle time, so a URL change always means a new APK.

Also worth knowing before you upload: the APK goes to a third party, and it contains your bundled JS. It does **not** contain `GEMINI_API_KEY` — that lives only in `apps/api/.env` and never ships to the client, which is the main reason the API sits between the app and Gemini.

## Physical device over USB (Android)

```bash
adb devices                        # confirm it is listed and authorised
adb reverse tcp:8787 tcp:8787      # now the device can use http://localhost:8787
```
`adb reverse` is the tidiest option on a locked-down network where the phone cannot reach your LAN IP.

## Verifying the stack end to end

1. `npm run dev -w apps/api` — expect `listening on 0.0.0.0:8787`.
2. `curl http://localhost:8787/v1/health` → `{"ok":true,...}`.
3. `curl http://localhost:8787/v1/languages` → the language registry (public, no auth — a good check that routing works before you involve the app).
4. Start the mobile app, register an account, send one chat message. Tokens should appear progressively; if the whole reply lands at once, SSE is being buffered — check for a proxy between device and API.
5. `npm test -w apps/api` for the safety and approval invariants.

## Troubleshooting

| Symptom | Cause |
|---|---|
| "Network request failed" on Android, works on web | `localhost` in `EXPO_PUBLIC_API_URL`; use `10.0.2.2` |
| Works on emulator, fails on physical device | API bound to `127.0.0.1`, or firewall blocking the LAN |
| Reply arrives all at once, not streamed | A buffering proxy, or the client fell back to non-streaming fetch |
| `EXPO_PUBLIC_API_URL` change had no effect | Dev server not restarted |
| Emulator extremely slow | Hardware acceleration off (WHPX/HAXM) |
| 401 on every call after a restart | `JWT_SECRET` changed; old tokens are invalid — log in again |
