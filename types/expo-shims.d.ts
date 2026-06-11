declare module "@expo/config" {
  export type ExpoConfig = {
    android?: Record<string, unknown>
    ios?: Record<string, unknown>
    plugins?: unknown[]
    [key: string]: unknown
  }
  export type ConfigContext = {
    config: ExpoConfig
  }
}

declare module "expo-router" {
  export const Slot: React.ComponentType
  export const SplashScreen: {
    preventAutoHideAsync: () => Promise<boolean>
    hideAsync: () => Promise<boolean>
  }
}

declare const module: {
  exports: unknown
}
