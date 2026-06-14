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
  const variant = process.env.APP_VARIANT ?? "production"
  const baseIdentifier = process.env.APP_IDENTIFIER ?? "com.moneyfly"
  const easProjectId = process.env.EAS_PROJECT_ID
  const variants = {
    development: {
      name: "Moneyfly Dev",
      scheme: "moneyfly-dev",
      identifier: `${baseIdentifier}.dev`,
    },
    preview: {
      name: "Moneyfly Preview",
      scheme: "moneyfly-preview",
      identifier: `${baseIdentifier}.preview`,
    },
    production: {
      name: config.name,
      scheme: config.scheme,
      identifier: baseIdentifier,
    },
  } as const
  const app = variants[variant as keyof typeof variants]

  if (!app) {
    throw new Error(
      `Unknown APP_VARIANT "${variant}". Expected development, preview, or production.`,
    )
  }

  return {
    ...config,
    name: app.name,
    scheme: app.scheme,
    android: {
      ...config.android,
      package: app.identifier,
    },
    ios: {
      ...config.ios,
      bundleIdentifier: app.identifier,
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
    extra: {
      ...(typeof config.extra === "object" && config.extra !== null ? config.extra : {}),
      ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
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
