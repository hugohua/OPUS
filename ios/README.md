# OPUS iOS

This directory contains the native iOS app scaffold for OPUS.

## Requirements

- Xcode 26+
- iOS 18 simulator runtime
- `xcodegen`

## Bootstrap

```bash
bash ios/Scripts/bootstrap.sh
```

The bootstrap script will:

1. Install `xcodegen` with Homebrew if needed
2. Create `ios/Config/Local.secrets.xcconfig` from the example file if missing
3. Generate `ios/OpusApp.xcodeproj`

## Schemes

- `OpusApp-Local`
- `OpusApp-Staging`
- `OpusApp-Production`

Use `OpusApp-Local` for simulator and device development.

## Local networking

`Local` defaults to `http://localhost:3000`, which works for the simulator.

For physical devices, edit `ios/Config/Local.secrets.xcconfig` and override:

```xcconfig
API_BASE_URL = http://192.168.x.x:3000
```

`Local` is the only environment that relaxes ATS for insecure local HTTP.
