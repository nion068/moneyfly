import type { ReactNode } from "react"
import { render } from "@testing-library/react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { ThemeProvider } from "@/theme/context"

import { AppNavigator } from "./AppNavigator"

jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: (props: object) => {
    const { View } = require("react-native")
    return <View {...props} />
  },
}))

jest.mock("@/components/MoneyAgentLogo", () => ({
  MoneyAgentLogo: (props: object) => {
    const { View } = require("react-native")
    return <View {...props} />
  },
}))

jest.mock("@/screens/AccountsScreen", () => ({
  AccountsScreen: () => {
    const { View } = require("react-native")
    return <View />
  },
}))

jest.mock("@/screens/AddTransactionScreen", () => ({
  AddTransactionScreen: () => {
    const { View } = require("react-native")
    return <View />
  },
}))

jest.mock("@/screens/AiAssistantScreen", () => ({
  AiAssistantScreen: () => {
    const { View } = require("react-native")
    return <View />
  },
}))

jest.mock("@/screens/AnalyticsScreen", () => ({
  AnalyticsScreen: () => {
    const { View } = require("react-native")
    return <View />
  },
}))

jest.mock("@/screens/BudgetEditorScreen", () => ({
  BudgetEditorScreen: () => {
    const { View } = require("react-native")
    return <View />
  },
}))

jest.mock("@/screens/BudgetsScreen", () => ({
  BudgetsScreen: () => {
    const { View } = require("react-native")
    return <View />
  },
}))

jest.mock("@/screens/ErrorScreen/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => children,
}))

jest.mock("@/screens/HomeScreen", () => ({
  HomeScreen: () => {
    const { View } = require("react-native")
    return <View />
  },
}))

jest.mock("@/screens/TransactionDetailsScreen", () => ({
  TransactionDetailsScreen: () => {
    const { View } = require("react-native")
    return <View />
  },
}))

jest.mock("./SettingsNavigator", () => ({
  SettingsNavigator: () => {
    const { View } = require("react-native")
    return <View />
  },
}))

jest.mock("./navigationUtilities", () => ({
  navigationRef: { current: null },
  useBackButtonHandler: jest.fn(),
}))

jest.mock("@react-navigation/native", () => ({
  NavigationContainer: ({ children }: { children: ReactNode }) => children,
  DarkTheme: {},
  DefaultTheme: {},
}))

jest.mock("@react-navigation/bottom-tabs", () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({ children }: { children: ReactNode }) => {
      const { View } = require("react-native")
      return <View>{children}</View>
    },
    Screen: ({
      options,
    }: {
      options: { tabBarIcon?: (props: { focused: boolean }) => React.ReactNode }
    }) => {
      const { View } = require("react-native")
      return (
        <View>
          {options.tabBarIcon?.({ focused: true })}
          {options.tabBarIcon?.({ focused: false })}
        </View>
      )
    },
  }),
}))

jest.mock("@react-navigation/native-stack", () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: { children: ReactNode }) => {
      const { View } = require("react-native")
      return <View>{children}</View>
    },
    Screen: ({ component: Component, name }: { component: React.ComponentType; name: string }) => {
      const { View } = require("react-native")
      return <View testID={`stack-screen-${name}`}>{Component ? <Component /> : null}</View>
    },
  }),
}))

function renderNavigator() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 375, height: 812 },
        insets: { top: 44, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider initialContext="dark">
        <AppNavigator />
      </ThemeProvider>
    </SafeAreaProvider>,
  )
}

describe("AppNavigator", () => {
  it("renders themed Material icons for the non-primary tabs", () => {
    const screen = renderNavigator()

    expect(screen.UNSAFE_getAllByProps({ name: "home-variant" }).length).toBeGreaterThan(0)
    expect(screen.UNSAFE_getAllByProps({ name: "wallet-outline" }).length).toBeGreaterThan(0)
    expect(screen.UNSAFE_getAllByProps({ name: "chart-line-variant" }).length).toBeGreaterThan(0)
    expect(screen.UNSAFE_getAllByProps({ name: "format-list-bulleted" }).length).toBeGreaterThan(0)
    expect(screen.UNSAFE_getAllByProps({ name: "cog-outline" }).length).toBeGreaterThan(0)
  })

  it("registers the budget editor route without removing transaction routes", () => {
    const screen = renderNavigator()

    expect(screen.getByTestId("stack-screen-BudgetEditor")).toBeTruthy()
    expect(screen.getByTestId("stack-screen-AddTransaction")).toBeTruthy()
    expect(screen.getByTestId("stack-screen-EditTransaction")).toBeTruthy()
  })
})
