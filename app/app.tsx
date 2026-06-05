/* eslint-disable import/first */
/**
 * Welcome to the main entry point of the app. In this file, we'll
 * be kicking off our app.
 *
 * Most of this file is boilerplate and you shouldn't need to modify
 * it very often. But take some time to look through and understand
 * what is going on here.
 *
 * The app navigation resides in ./app/navigators, so head over there
 * if you're interested in adding screens and navigators.
 */
if (__DEV__) {
  // Load Reactotron in development only.
  // Note that you must be using metro's `inlineRequires` for this to work.
  // If you turn it off in metro.config.js, you'll have to manually import it.
  require("./devtools/ReactotronConfig.ts")
}
import "./utils/gestureHandler"

import { useEffect, useState } from "react"
import { TextStyle, View, ViewStyle } from "react-native"
import { useFonts } from "expo-font"
import * as Linking from "expo-linking"
import { KeyboardProvider } from "react-native-keyboard-controller"
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context"

import { Text } from "./components/Text"
import { FireflyProvider } from "./context/FireflyContext"
import { initI18n } from "./i18n"
import { AppNavigator } from "./navigators/AppNavigator"
import { useNavigationPersistence } from "./navigators/navigationUtilities"
import { ThemeProvider } from "./theme/context"
import { customFontsToLoad } from "./theme/typography"
import { loadDateFnsLocale } from "./utils/formatDate"
import * as storage from "./utils/storage"

export const NAVIGATION_PERSISTENCE_KEY = "NAVIGATION_STATE"

// Web linking configuration
const prefix = Linking.createURL("/")
const config = {
  screens: {
    Setup: {
      path: "",
    },
    Main: {
      screens: {
        Home: "home",
        Accounts: "accounts",
        AiAssistant: "ai",
        Analytics: "analytics",
        Settings: "settings",
      },
    },
  },
}

/**
 * This is the root component of our app.
 * @param {AppProps} props - The props for the `App` component.
 * @returns {JSX.Element} The rendered `App` component.
 */
export function App() {
  const {
    initialNavigationState,
    onNavigationStateChange,
    isRestored: isNavigationStateRestored,
  } = useNavigationPersistence(storage, NAVIGATION_PERSISTENCE_KEY)

  const [areFontsLoaded, fontLoadError] = useFonts(customFontsToLoad)
  const [isI18nInitialized, setIsI18nInitialized] = useState(false)

  useEffect(() => {
    initI18n()
      .then(() => setIsI18nInitialized(true))
      .then(() => loadDateFnsLocale())
  }, [])

  if (!isNavigationStateRestored || !isI18nInitialized || (!areFontsLoaded && !fontLoadError)) {
    return <AppBootstrap />
  }

  const linking = {
    prefixes: [prefix],
    config,
  }

  // otherwise, we're ready to render the app
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <KeyboardProvider>
        <FireflyProvider>
          <ThemeProvider>
            <AppNavigator
              linking={linking}
              initialState={initialNavigationState}
              onStateChange={onNavigationStateChange}
            />
          </ThemeProvider>
        </FireflyProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  )
}

function AppBootstrap() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider>
        <View style={$bootstrapContainer}>
          <Text text="Moneyfly" style={$bootstrapTitle} />
          <Text text="Preparing your Firefly client..." style={$bootstrapSubtitle} />
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}

const $bootstrapContainer: ViewStyle = {
  alignItems: "center",
  backgroundColor: "#0f0e0c",
  flex: 1,
  justifyContent: "center",
  padding: 24,
}

const $bootstrapTitle: TextStyle = {
  color: "#3ea576",
  fontFamily: "spaceGroteskBold",
  fontSize: 42,
  lineHeight: 50,
}

const $bootstrapSubtitle: TextStyle = {
  color: "#9a958d",
  fontFamily: "spaceGroteskRegular",
  fontSize: 16,
  lineHeight: 24,
  marginTop: 8,
}
