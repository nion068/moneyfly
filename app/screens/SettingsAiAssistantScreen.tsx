import { FC, useEffect, useState } from "react"
import { ActivityIndicator, Pressable, TextStyle, View, ViewStyle } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Screen } from "@/components/Screen"
import {
  SettingsCard,
  SettingsHeader,
  SettingsIcon,
  SettingsRow,
  SettingsSection,
  StatusText,
} from "@/components/settings/SettingsPrimitives"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { Switch } from "@/components/Toggle/Switch"
import { useMoneyAgent } from "@/context/MoneyAgentContext"
import type { SettingsStackScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type Props = SettingsStackScreenProps<"SettingsAiAssistant">

export const SettingsAiAssistantScreen: FC<Props> = ({ navigation }) => {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const {
    providerId,
    model,
    hasApiKey,
    isSavingSettings,
    error,
    saveSettings,
    removeCredentials,
    testCurrentConnection,
  } = useMoneyAgent()
  const [modelInput, setModelInput] = useState(model)
  const [apiKeyInput, setApiKeyInput] = useState("")
  const [tested, setTested] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)

  useEffect(() => setModelInput(model), [model])

  async function testConnection() {
    if (isTestingConnection || !apiKeyInput.trim()) return
    setIsTestingConnection(true)
    setTested(false)
    try {
      const ok = await testCurrentConnection({
        providerId,
        model: modelInput,
        apiKey: apiKeyInput,
      })
      setTested(ok)
    } finally {
      setIsTestingConnection(false)
    }
  }

  async function save() {
    const ok = await saveSettings({ providerId, model: modelInput, apiKey: apiKeyInput })
    if (ok) {
      setApiKeyInput("")
      setTested(false)
    }
  }

  return (
    <Screen preset="scroll" safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
      <SettingsHeader
        title="AI Assistant"
        subtitle={hasApiKey ? "Gemini active" : "Not configured"}
        onBack={navigation.goBack}
      />

      <SettingsCard style={themed(hasApiKey ? $activeHero : $hero)}>
        <SettingsIcon name="creation" tone="primary" />
        <View style={themed($heroCopy)}>
          <Text text={modelInput || "Gemini"} style={themed($heroTitle)} />
          <Text
            text={hasApiKey ? "Connected · Ready for drafts" : "Add an API key to connect"}
            style={themed($muted)}
          />
        </View>
        <StatusText text={hasApiKey ? "Active" : "Offline"} positive={hasApiKey} />
      </SettingsCard>

      <SettingsSection title="Provider Settings" collapsible>
        <SettingsRow first title="Provider" value="Google Gemini" icon="memory" />
        <View style={themed($form)}>
          <TextField
            label="Model"
            value={modelInput}
            onChangeText={setModelInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextField
            label="Gemini API key"
            value={apiKeyInput}
            onChangeText={setApiKeyInput}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            placeholder={hasApiKey ? "Leave blank to keep saved key" : "Enter Gemini API key"}
          />
          {error ? <Text text={error} style={themed($error)} /> : null}
          {tested ? <Text text="Connection test succeeded." style={themed($success)} /> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              busy: isTestingConnection,
              disabled: isSavingSettings || isTestingConnection || !apiKeyInput.trim(),
            }}
            disabled={isSavingSettings || isTestingConnection || !apiKeyInput.trim()}
            onPress={() => void testConnection()}
            style={themed([
              $secondaryAction,
              (isSavingSettings || isTestingConnection || !apiKeyInput.trim()) && $actionDisabled,
            ])}
          >
            {isTestingConnection ? (
              <ActivityIndicator color={colors.tint} size="small" />
            ) : (
              <MaterialCommunityIcons name="connection" color={colors.tint} size={20} />
            )}
            <Text
              text={isTestingConnection ? "Testing connection..." : "Test Connection"}
              style={themed($secondaryActionText)}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isSavingSettings }}
            disabled={isSavingSettings}
            onPress={() => void save()}
            style={themed([$primaryAction, isSavingSettings && $actionDisabled])}
          >
            {isSavingSettings ? (
              <ActivityIndicator color={colors.palette.surfaceDim} size="small" />
            ) : (
              <MaterialCommunityIcons
                name="content-save-outline"
                color={colors.palette.surfaceDim}
                size={20}
              />
            )}
            <Text
              text={isSavingSettings ? "Saving settings..." : "Save Settings"}
              style={themed($primaryActionText)}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isSavingSettings || !hasApiKey }}
            disabled={isSavingSettings || !hasApiKey}
            onPress={() => void removeCredentials()}
            style={themed([$dangerAction, (isSavingSettings || !hasApiKey) && $actionDisabled])}
          >
            <MaterialCommunityIcons
              name="key-remove"
              color={colors.palette.tertiary300}
              size={20}
            />
            <Text text="Remove Saved Key" style={themed($dangerActionText)} />
          </Pressable>
        </View>
      </SettingsSection>

      <Text text="AVAILABLE PROVIDERS" style={themed($eyebrow)} />
      <SettingsCard style={themed($provider)}>
        <SettingsIcon name="creation" tone="primary" />
        <View style={themed($heroCopy)}>
          <Text text="Google Gemini" style={themed($rowTitle)} />
          <Text text={hasApiKey ? "Connected" : "Not configured"} style={themed($muted)} />
        </View>
        <StatusText text={hasApiKey ? "Ready" : "Set up"} positive={hasApiKey} />
      </SettingsCard>
      <SettingsCard disabled style={themed($provider)}>
        <SettingsIcon name="robot-outline" />
        <View style={themed($heroCopy)}>
          <Text text="OpenAI GPT" style={themed($rowTitle)} />
          <Text text="Future provider" style={themed($muted)} />
        </View>
      </SettingsCard>
      <SettingsCard disabled style={themed($provider)}>
        <SettingsIcon name="server-outline" />
        <View style={themed($heroCopy)}>
          <Text text="Ollama (Local)" style={themed($rowTitle)} />
          <Text text="Future provider" style={themed($muted)} />
        </View>
      </SettingsCard>

      <SettingsSection title="Transaction Draft Settings">
        <SettingsRow
          first
          title="Require Draft Approval"
          subtitle="Required for every Firefly write"
          icon="check-decagram-outline"
          tone="primary"
          trailing={<Switch value onValueChange={() => undefined} disabled />}
        />
        <SettingsRow
          title="Preview Before Submission"
          subtitle="Drafts remain editable before confirmation"
          icon="eye-outline"
          trailing={<Switch value onValueChange={() => undefined} disabled />}
        />
      </SettingsSection>
    </Screen>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.lg,
  padding: spacing.lg,
  paddingBottom: spacing.xxxl,
})
const $hero: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.md,
})
const $activeHero: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  backgroundColor: "rgba(18, 118, 77, 0.24)",
  borderColor: colors.tint,
  flexDirection: "row",
  gap: spacing.md,
})
const $heroCopy: ThemedStyle<ViewStyle> = () => ({ flex: 1 })
const $heroTitle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 21,
})
const $muted: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 15,
  lineHeight: 21,
})
const $form: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.md,
  paddingTop: spacing.lg,
})
const $error: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.error })
const $success: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.tint })
const $actionBase: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  borderRadius: 22,
  flexDirection: "row",
  gap: spacing.xs,
  justifyContent: "center",
  minHeight: 52,
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.sm,
})
const $primaryAction: ThemedStyle<ViewStyle> = (theme) => ({
  ...$actionBase(theme),
  backgroundColor: theme.colors.tint,
})
const $secondaryAction: ThemedStyle<ViewStyle> = (theme) => ({
  ...$actionBase(theme),
  backgroundColor: "rgba(18, 118, 77, 0.1)",
  borderColor: "rgba(62, 165, 118, 0.42)",
  borderWidth: 1,
})
const $dangerAction: ThemedStyle<ViewStyle> = (theme) => ({
  ...$actionBase(theme),
  backgroundColor: "rgba(128, 55, 44, 0.12)",
  borderColor: "rgba(216, 113, 98, 0.38)",
  borderWidth: 1,
})
const $actionDisabled: ThemedStyle<ViewStyle> = () => ({ opacity: 0.42 })
const $primaryActionText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.surfaceDim,
  fontFamily: typography.primary.semiBold,
  fontSize: 16,
})
const $secondaryActionText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.tint,
  fontFamily: typography.primary.semiBold,
  fontSize: 16,
})
const $dangerActionText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.tertiary300,
  fontFamily: typography.primary.semiBold,
  fontSize: 16,
})
const $eyebrow: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.textDim,
  fontFamily: typography.primary.semiBold,
  fontSize: 14,
  letterSpacing: 2.2,
})
const $provider: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.md,
})
const $rowTitle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 18,
})
