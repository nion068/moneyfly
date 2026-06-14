# Contributing

## Before You Start

Search existing issues before opening a new one. Use an issue for substantial features or behavior
changes so the approach can be agreed before implementation.

By contributing, you agree that your contribution is licensed under the repository's MIT License.

## Local Setup

1. Install Node.js 20 or newer and pnpm.
2. Run `pnpm install`.
3. Run `pnpm run start` for an existing development build.
4. Run `pnpm run android` or `pnpm run ios` to create a native development build.

Never include real Firefly tokens, AI credentials, signing files, or private financial data in
issues, tests, screenshots, fixtures, or commits.

## Pull Requests

- Keep changes focused and follow the existing TypeScript and React patterns.
- Add or update tests for behavioral changes.
- Add translation keys to every locale.
- Include screenshots or recordings for visible UI changes.
- Document platform-specific testing.
- Run `pnpm run compile`, `pnpm run lint:check`, and `pnpm test --runInBand`.

Use short imperative commit subjects, for example `Add transaction validation`.
