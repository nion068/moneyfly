import { createNativeStackNavigator } from "@react-navigation/native-stack"

import { SettingsAiAssistantScreen } from "@/screens/SettingsAiAssistantScreen"
import { SettingsClassificationScreen } from "@/screens/SettingsClassificationScreen"
import { SettingsFireflyScreen } from "@/screens/SettingsFireflyScreen"
import { SettingsScreen } from "@/screens/SettingsScreen"
import { SettingsSecurityScreen } from "@/screens/SettingsSecurityScreen"

import type { SettingsStackParamList } from "./navigationTypes"

const Stack = createNativeStackNavigator<SettingsStackParamList>()

export function SettingsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SettingsHome" component={SettingsScreen} />
      <Stack.Screen name="SettingsFirefly" component={SettingsFireflyScreen} />
      <Stack.Screen name="SettingsAiAssistant" component={SettingsAiAssistantScreen} />
      <Stack.Screen name="SettingsClassification" component={SettingsClassificationScreen} />
      <Stack.Screen name="SettingsSecurity" component={SettingsSecurityScreen} />
    </Stack.Navigator>
  )
}
