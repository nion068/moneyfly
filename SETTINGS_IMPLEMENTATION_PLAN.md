# Settings Implementation Plan

## Product Direction

Settings is implemented as a dashboard with one complete flow delivered at a time. The supplied
settings PNGs define information hierarchy and layout; Moneyfly theme tokens, Space Grotesk,
shared components, and live application data remain the source of truth.

An unfinished card stays visible but disabled. It is enabled only when its complete flow, error
handling, tests, and platform checks are ready. Static mock values must never be presented as real
account or connection state.

## Delivery Order

1. Settings dashboard and nested navigation
2. Firefly III connection and synchronization
3. Gemini AI Assistant configuration
4. Firefly account management
5. Firefly category and tag management
6. Biometric security and application locking

Profile editing, sign out, clear-local-data, classification groups, OpenAI, and Ollama remain
deferred until their product behavior is separately approved.

## Architecture

- The Settings tab owns a nested native stack so detail screens retain the bottom tab bar.
- Reusable settings primitives provide headers, cards, icon badges, rows, statuses, and disabled
  treatment.
- `FireflyContext` owns Firefly identity, collection state, synchronization, and mutation actions.
- `MoneyAgentContext` remains the owner of Gemini model and secure credential settings.
- Secret values are never returned to settings UI. Existing credentials are represented only by
  configured/not-configured state.
- Firefly mutations are implemented in the API service and exposed through typed context actions.

## Acceptance Gates

Each phase must:

- Render loading, empty, success, disabled, and error states without fake data.
- Preserve safe areas, scrolling, keyboard behavior, and bottom-tab navigation.
- Include focused tests for new data and interaction behavior.
- Pass `pnpm run compile`, `pnpm run lint:check`, and `pnpm test`.
- Be manually checked on Android and web; iOS-specific biometric behavior must be checked before
  release on an iOS device or simulator.
