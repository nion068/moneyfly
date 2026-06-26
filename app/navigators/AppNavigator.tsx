import { ComponentProps } from "react"
import { TextStyle, View, ViewStyle } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"

import { MoneyAgentLogo } from "@/components/MoneyAgentLogo"
import { Text } from "@/components/Text"
import Config from "@/config"
import { AccountsScreen } from "@/screens/AccountsScreen"
import { AddTransactionScreen } from "@/screens/AddTransactionScreen"
import { AiAssistantScreen } from "@/screens/AiAssistantScreen"
import { AnalyticsScreen } from "@/screens/AnalyticsScreen"
import { ErrorBoundary } from "@/screens/ErrorScreen/ErrorBoundary"
import { HomeScreen } from "@/screens/HomeScreen"
import { TransactionDetailsScreen } from "@/screens/TransactionDetailsScreen"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

import type { AppStackParamList, MainTabParamList, NavigationProps } from "./navigationTypes"
import { navigationRef, useBackButtonHandler } from "./navigationUtilities"
import { SettingsNavigator } from "./SettingsNavigator"

const exitRoutes = Config.exitRoutes
const Stack = createNativeStackNavigator<AppStackParamList>()
const Tabs = createBottomTabNavigator<MainTabParamList>()

type TabIconProps = {
  focused: boolean
  label: string
  icon?: ComponentProps<typeof MaterialCommunityIcons>["name"]
  isPrimary?: boolean
}

function TabIcon({ focused, label, icon, isPrimary }: TabIconProps) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()

  return (
    <View style={themed([$tabIcon, isPrimary && $primaryTabIcon, focused && $activeTabIcon])}>
      {isPrimary ? (
        <View style={$primaryTabLogo}>
          <MoneyAgentLogo width={38} height={42} opacity={focused ? 1 : 0.72} />
        </View>
      ) : (
        <View style={themed([$tabBadge, focused && $activeTabBadge])}>
          <MaterialCommunityIcons
            name={icon}
            color={focused ? colors.tint : colors.textDim}
            size={22}
          />
        </View>
      )}
      {!isPrimary && <Text text={label} style={themed([$tabLabel, focused && $activeTabText])} />}
    </View>
  )
}

function MainTabs() {
  const {
    theme: { colors },
  } = useAppTheme()

  return (
    <Tabs.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 86,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: colors.palette.stroke,
          backgroundColor: colors.palette.surface,
        },
      }}
    >
      <Tabs.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="Home" icon="home-variant" />
          ),
        }}
      />
      <Tabs.Screen
        name="Accounts"
        component={AccountsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="Accounts" icon="wallet-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="AiAssistant"
        component={AiAssistantScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="AI" isPrimary />,
        }}
      />
      <Tabs.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="Analytics" icon="chart-line-variant" />
          ),
        }}
      />
      <Tabs.Screen
        name="Settings"
        component={SettingsNavigator}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="Settings" icon="cog-outline" />
          ),
        }}
      />
    </Tabs.Navigator>
  )
}

const AppStack = () => {
  const {
    theme: { colors },
  } = useAppTheme()

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        navigationBarColor: colors.background,
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
      initialRouteName="Main"
    >
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen
        name="AddTransaction"
        component={AddTransactionScreen}
        options={{ animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="TransactionDetails"
        component={TransactionDetailsScreen}
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="EditTransaction"
        component={AddTransactionScreen}
        options={{ animation: "slide_from_bottom" }}
      />
    </Stack.Navigator>
  )
}

export const AppNavigator = (props: NavigationProps) => {
  const { navigationTheme } = useAppTheme()

  useBackButtonHandler((routeName) => exitRoutes.includes(routeName))

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme} {...props}>
      <ErrorBoundary catchErrors={Config.catchErrors}>
        <AppStack />
      </ErrorBoundary>
    </NavigationContainer>
  )
}

const $tabIcon: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  justifyContent: "center",
  minWidth: 64,
  gap: spacing.xxxs,
})

const $tabBadge: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderColor: colors.palette.stroke,
  borderRadius: 16,
  borderWidth: 1,
  height: 32,
  justifyContent: "center",
  width: 32,
})

const $activeTabBadge: ThemedStyle<ViewStyle> = () => ({
  backgroundColor: "rgba(62, 165, 118, 0.18)",
  borderColor: "rgba(108, 220, 160, 0.34)",
})

const $primaryTabIcon: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 62,
  height: 62,
  borderRadius: 31,
  backgroundColor: colors.palette.surfaceContainerHigh,
  marginTop: -18,
})

const $primaryTabLogo: ViewStyle = {
  transform: [{ translateY: 3 }],
}

const $activeTabIcon: ThemedStyle<ViewStyle> = () => ({})

const $tabLabel: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.textDim,
  fontFamily: typography.primary.medium,
  fontSize: 12,
  lineHeight: 16,
})

const $activeTabText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.tint,
})
