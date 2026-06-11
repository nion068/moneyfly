import { ExpoConfig, ConfigContext } from "@expo/config"

/**
 * Use tsx/cjs here so we can use TypeScript for our Config Plugins
 * and not have to compile them to JavaScript.
 *
 * See https://docs.expo.dev/config-plugins/plugins/#add-typescript-support-and-convert-to-dynamic-app-config
 */
import "tsx/cjs"

/**
 * @param config ExpoConfig coming from the static config app.json if it exists
 *
 * You can read more about Expo's Configuration Resolution Rules here:
 * https://docs.expo.dev/workflow/configuration/#configuration-resolution-rules
 */
module.exports = ({ config }: ConfigContext): Partial<ExpoConfig> => {
  const existingPlugins = config.plugins ?? []
  const isDevelopment = process.env.APP_VARIANT === "development"

  return {
    ...config,
    name: isDevelopment ? "Moneyfly Dev" : config.name,
    scheme: isDevelopment ? "moneyfly-dev" : config.scheme,
    android: {
      ...config.android,
      package: isDevelopment ? "com.moneyfly.dev" : config.android?.package,
    },
    ios: {
      ...config.ios,
      bundleIdentifier: isDevelopment ? "com.moneyfly.dev" : config.ios?.bundleIdentifier,
      // This privacyManifests is to get you started.
      // See Expo's guide on apple privacy manifests here:
      // https://docs.expo.dev/guides/apple-privacy/
      // You may need to add more privacy manifests depending on your app's usage of APIs.
      // More details and a list of "required reason" APIs can be found in the Apple Developer Documentation.
      // https://developer.apple.com/documentation/bundleresources/privacy-manifest-files
      privacyManifests: {
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
            NSPrivacyAccessedAPITypeReasons: ["CA92.1"], // CA92.1 = "Access info from same app, per documentation"
          },
        ],
      },
    },
    plugins: [
      ...existingPlugins,
      "@react-native-community/datetimepicker",
      "expo-secure-store",
      [
        "expo-local-authentication",
        {
          faceIDPermission: "Allow Moneyfly to use Face ID to unlock the app.",
        },
      ],
    ],
  }
}
