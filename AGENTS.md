# Repository Guidelines

## Project Structure & Module Organization
This is an Expo/React Native app. Primary application code lives in `app/`, including screens, components, navigation, theme, services, and utilities. Expo Router entry files live in `src/app/` (`_layout.tsx`, `index.tsx`). Tests live in `test/` and alongside implementation files when practical, such as `app/components/Text.test.tsx`. Keep shared assets in `assets/` if you add them; the current repo also contains `prototype-firefly/` as a separate reference area.

## Build, Test, and Development Commands
- `pnpm install`: install dependencies.
- `pnpm run start`: start the Expo dev client.
- `pnpm run android` / `pnpm run ios` / `pnpm run web`: run the app on the selected platform.
- `pnpm run compile`: type-check the project with `tsc --noEmit`.
- `pnpm run lint`: run ESLint and auto-fix what it can.
- `pnpm run lint:check`: run ESLint without modifying files.
- `pnpm test`: run the Jest suite.
- `pnpm run test:watch`: rerun tests on file changes.

## Coding Style & Naming Conventions
Use TypeScript, functional React components, and named exports where possible. Prettier is configured for 100-character lines, double quotes, no semicolons, and trailing commas. ESLint enforces import ordering and forbids direct use of `react-native` `Text`, `Button`, `TextInput`, and `SafeAreaView` where repo wrappers exist. Use `PascalCase` for components (`LoginScreen.tsx`), `camelCase` for functions and hooks, and suffix tests with `.test.ts` or `.test.tsx`.

## Testing Guidelines
The test stack is Jest with `jest-expo` and React Native Testing Library. Prefer focused unit tests for utilities, API helpers, and UI wrappers. Keep test names descriptive, such as `handles server errors` or `should render the component`. When adding i18n keys, ensure they exist in `app/i18n/en.ts` and related locale files, because `test/i18n.test.ts` checks for missing translations.

## Commit & Pull Request Guidelines
This branch has no Git commit history yet, so there is no established commit format to mirror. Use short, imperative commit subjects such as `Add login screen validation`. Pull requests should include a clear summary, linked issue if available, and screenshots or screen recordings for UI changes. Mention any platform-specific testing you ran, especially for iOS, Android, or web.

## Configuration Notes
Node.js 20+ is required. Keep environment and native configuration changes scoped to the relevant Expo files, and update tests when you touch shared utilities in `app/utils/`, `app/services/`, or `app/i18n/`.
