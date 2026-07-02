# Moneyfly

Moneyfly is an early-stage, open-source Expo client for
[Firefly III](https://www.firefly-iii.org/). It provides transaction entry, account and
classification management, analytics, local biometric locking, and an optional Gemini-powered
transaction drafting assistant.

Moneyfly is unofficial and is not affiliated with Firefly III, Google, Expo, or Infinite Red.

## Project Status

Moneyfly is under active development. Back up your Firefly III data and review proposed
transactions before confirming them. The application is not financial advice and has not received
an independent security audit.

Current targets:

- Android
- iOS
- Web, with reduced secret persistence guarantees

## Requirements

- Node.js 20 or newer
- pnpm
- A reachable self-hosted Firefly III server and personal access token
- Android Studio, Xcode, or a compatible physical device for native development

## Development

```bash
pnpm install
pnpm run compile
pnpm run lint:check
pnpm test
```

Create and install a development build:

```bash
pnpm run android
# or
pnpm run ios
```

Then start the Expo/Metro development server:

```bash
pnpm run start
```

For Android devices that need local port forwarding:

```bash
pnpm run adb
```

Reactotron remains available in development builds. Start the Reactotron desktop application
before launching Moneyfly to inspect logs, networking, MMKV state, and navigation commands.

Web development uses:

```bash
pnpm run web
```

The app icon source is `assets/brand/moneyfly-cash-icon.svg`. After editing it, regenerate every
native and web PNG used by Expo:

```bash
pnpm run generate:icons
```

## Configuration

The default application identifier is `com.moneyfly`. Forks should set their own identifier:

```bash
APP_IDENTIFIER=org.example.moneyfly pnpm run android
```

Build variants append `.dev` or `.preview` to that identifier. EAS builds can be connected to a
project without committing the maintainer's project ID:

```bash
EAS_PROJECT_ID=your-project-id pnpm run build:android:preview
```

To kick off both Android and iOS cloud builds in one command:

```bash
EAS_PROJECT_ID=your-project-id pnpm run build:preview:cloud
```

Android-only cloud builds remain available:

```bash
EAS_PROJECT_ID=your-project-id pnpm run build:android:preview:cloud
EAS_PROJECT_ID=your-project-id pnpm run build:android:prod:cloud
```

Do not commit API keys, Firefly tokens, signing credentials, `.env` files containing secrets, or
generated native credentials.

## Privacy And Security

- Firefly requests go directly from the device to the server configured by the user.
- The Firefly URL and token are stored locally using MMKV. Use Moneyfly only on a trusted device.
- Gemini is optional and uses a user-provided API key. Native builds store that key with Expo
  SecureStore; web builds keep it only in memory.
- Money Agent sends recent chat messages plus Firefly account, category, budget, tag, and currency
  names/IDs to Gemini. It does not intentionally send balances, the Firefly token, server URL, or
  full transaction history.
- Every AI-generated transaction requires explicit confirmation before it is written to Firefly.

Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Pull requests should pass:

```bash
pnpm run compile
pnpm run lint:check
pnpm test --runInBand
```

## License

Moneyfly is licensed under the [MIT License](LICENSE). See [NOTICE](NOTICE) for attribution.
