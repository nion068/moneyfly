import { ComponentProps, FC, useEffect, useMemo, useRef, useState } from "react"
import { Alert, Pressable, ScrollView, View, ViewStyle, TextStyle } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { FinanceCard } from "@/components/firefly/FinancePrimitives"
import { SelectionItem, SelectionSheet } from "@/components/firefly/SelectionSheet"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useMoneyAgent } from "@/context/MoneyAgentContext"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"
import {
  compatibleMoneyAgentAccounts,
  formatMoneyAgentDraftAmount,
  getMoneyAgentDraftType,
  moneyAgentDraftTypes,
  reconcileMoneyAgentDraftAccounts,
} from "@/services/ai/drafts"
import type { MoneyAgentEntity, MoneyAgentTransactionDraft } from "@/services/ai/types"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type AiAssistantScreenProps = MainTabScreenProps<"AiAssistant">
type DraftStatusTone = "pending" | "confirming" | "confirmed" | "discarded" | "failed"

function getDraftStatusPresentation(draft: MoneyAgentTransactionDraft): {
  label: string
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"]
  tone: DraftStatusTone
} {
  if (draft.status === "confirming") {
    return { label: "Confirming", icon: "loading", tone: "confirming" }
  }
  if (draft.status === "confirmed") {
    return { label: "Confirmed", icon: "check-circle", tone: "confirmed" }
  }
  if (draft.status === "discarded") {
    return { label: "Discarded", icon: "close-circle", tone: "discarded" }
  }
  if (draft.status === "failed") {
    return { label: "Failed", icon: "alert-circle", tone: "failed" }
  }
  if (draft.missingFields.length > 0) {
    return { label: "Needs details", icon: "alert-circle-outline", tone: "pending" }
  }
  return { label: "Draft", icon: "clock-outline", tone: "pending" }
}

function isResolvedDraft(draft: MoneyAgentTransactionDraft) {
  return draft.status === "confirmed" || draft.status === "discarded"
}

export const AiAssistantScreen: FC<AiAssistantScreenProps> = ({ navigation }) => {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const {
    items,
    drafts,
    input,
    setInput,
    sendMessage,
    sendQuickPrompt,
    clearConversation,
    isSending,
    error,
    providerId,
    hasApiKey,
    isReady,
    snapshot,
  } = useMoneyAgent()
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    const timeout = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 0)
    return () => clearTimeout(timeout)
  }, [drafts.length, items.length])

  const unresolvedDrafts = useMemo(
    () => drafts.filter((draft) => draft.status !== "confirmed" && draft.status !== "discarded"),
    [drafts],
  )

  const onClearChat = () => {
    if (unresolvedDrafts.length > 0) {
      Alert.alert(
        "Clear chat?",
        "There are unresolved drafts. You can keep the drafts and clear only the chat history, or discard everything.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Keep drafts",
            onPress: () => clearConversation(false),
          },
          {
            text: "Discard and clear",
            style: "destructive",
            onPress: () => clearConversation(true),
          },
        ],
      )
      return
    }
    clearConversation(true)
  }

  return (
    <Screen preset="fixed" safeAreaEdges={["top"]} contentContainerStyle={themed($screenContent)}>
      <View style={themed($container)}>
        <View style={themed($header)}>
          <View style={themed($titleBlock)}>
            <View style={themed($avatar)}>
              <MaterialCommunityIcons name="creation" size={24} color={colors.palette.surfaceDim} />
            </View>
            <View style={themed($titleCopy)}>
              <Text text="Money Agent" numberOfLines={1} style={themed($title)} />
              <View style={themed($statusRow)}>
                <View style={themed([isReady ? $onlineDot : $offlineDot])} />
                <Text
                  numberOfLines={1}
                  text={
                    hasApiKey && isReady
                      ? `${providerId.toUpperCase()} · Ready to help`
                      : "Configure Gemini in Settings"
                  }
                  style={themed($subtitle)}
                />
              </View>
            </View>
          </View>

          <View style={themed($headerActions)}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear chat"
              onPress={onClearChat}
              style={themed($iconButton)}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.text} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Money Agent settings"
              onPress={() => navigation.navigate("Settings")}
              style={themed($iconButton)}
            >
              <MaterialCommunityIcons name="dots-horizontal" size={22} color={colors.text} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          testID="money-agent-conversation"
          style={themed($chat)}
          contentContainerStyle={themed($chatContent)}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ScrollView
            horizontal
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={themed($quickPrompts)}
          >
            {[
              {
                label: "Log a meal",
                icon: "silverware-fork-knife" as const,
                prompt: "Paid 450 taka for lunch at KFC from bKash today",
              },
              {
                label: "Add transport",
                icon: "car-outline" as const,
                prompt: "Paid 120 taka for Pathao from bKash today",
              },
              {
                label: "Shopping item",
                icon: "shopping-outline" as const,
                prompt: "Bought a shopping item today",
              },
            ].map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                onPress={() => sendQuickPrompt(item.prompt)}
                style={themed($promptChip)}
              >
                <MaterialCommunityIcons name={item.icon} size={16} color={colors.textDim} />
                <Text text={item.label} numberOfLines={1} style={themed($promptText)} />
              </Pressable>
            ))}
          </ScrollView>

          <View style={themed($dayDivider)}>
            <View style={themed($dividerLine)} />
            <Text text="Today" style={themed($dayLabel)} />
            <View style={themed($dividerLine)} />
          </View>

          {items.map((item) =>
            item.kind === "message" ? (
              <MessageBubble
                key={item.id}
                role={item.message.role}
                text={item.message.text}
                createdAt={item.message.createdAt}
              />
            ) : item.kind === "draft-group" ? (
              <MoneyAgentDraftGroup
                key={item.id}
                draftIds={item.draftIds}
                accounts={snapshot.accounts}
                categories={snapshot.categories}
                budgets={snapshot.budgets}
              />
            ) : (
              <MoneyAgentDraftCard
                key={item.id}
                draftId={item.draftId}
                initiallyExpanded
                accounts={snapshot.accounts}
                categories={snapshot.categories}
                budgets={snapshot.budgets}
              />
            ),
          )}

          {error ? <Text text={error} style={themed($error)} /> : null}
        </ScrollView>

        <View style={themed($composerBar)}>
          <TextField
            value={input}
            onChangeText={setInput}
            placeholder="Describe a transaction..."
            multiline
            autoCapitalize="sentences"
            autoCorrect={false}
            containerStyle={themed($composerField)}
            inputWrapperStyle={themed($composerInput)}
            style={themed($composerText)}
            LeftAccessory={() => (
              <View style={themed($composerIcon)}>
                <MaterialCommunityIcons name="creation" size={20} color={colors.tint} />
              </View>
            )}
            RightAccessory={() => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send message"
                disabled={isSending || input.trim().length === 0}
                onPress={() => void sendMessage()}
                style={themed([
                  $sendIconButton,
                  (isSending || input.trim().length === 0) && $sendIconDisabled,
                ])}
              >
                <MaterialCommunityIcons
                  name={isSending ? "dots-horizontal" : "arrow-up"}
                  size={22}
                  color={colors.palette.surfaceDim}
                />
              </Pressable>
            )}
          />
        </View>
      </View>
    </Screen>
  )
}

function MoneyAgentDraftGroup({
  draftIds,
  accounts,
  categories,
  budgets,
}: {
  draftIds: string[]
  accounts: { id: string; name: string }[]
  categories: { id: string; name: string }[]
  budgets: { id: string; name: string }[]
}) {
  const { themed } = useAppTheme()
  const { drafts } = useMoneyAgent()
  const visibleDraftIds = draftIds.filter((draftId) => drafts.some((draft) => draft.id === draftId))

  if (visibleDraftIds.length === 0) return null

  return (
    <View style={themed($draftGroup)}>
      <Text
        text={`${visibleDraftIds.length} transaction draft${visibleDraftIds.length === 1 ? "" : "s"}`}
        style={themed($draftGroupTitle)}
      />
      {visibleDraftIds.map((draftId, index) => (
        <MoneyAgentDraftCard
          key={draftId}
          draftId={draftId}
          initiallyExpanded={index === 0}
          accounts={accounts}
          categories={categories}
          budgets={budgets}
        />
      ))}
    </View>
  )
}

function MessageBubble({
  role,
  text,
  createdAt,
}: {
  role: "user" | "assistant" | "status"
  text: string
  createdAt: string
}) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const isUser = role === "user"
  const isStatus = role === "status"
  const timestamp = new Date(createdAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })

  return (
    <View style={themed([$messageBlock, isUser && $messageBlockRight])}>
      <View style={themed([$bubbleRow, isUser && $bubbleRowRight])}>
        {!isUser && (
          <View style={themed($bubbleAvatar)}>
            <MaterialCommunityIcons name="creation" size={17} color={colors.palette.surfaceDim} />
          </View>
        )}
        <View style={themed([$bubble, isUser && $bubbleUser, isStatus && $bubbleStatus])}>
          <Text text={text} style={themed([$bubbleText, isUser && $bubbleTextUser])} />
        </View>
      </View>
      <Text text={timestamp} style={themed([$timestamp, isUser && $timestampRight])} />
    </View>
  )
}

function MoneyAgentDraftCard({
  draftId,
  initiallyExpanded,
  accounts,
  categories,
  budgets,
}: {
  draftId: string
  initiallyExpanded: boolean
  accounts: MoneyAgentEntity[]
  categories: { id: string; name: string }[]
  budgets: { id: string; name: string }[]
}) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const { drafts, updateDraft, confirmDraft, discardDraft } = useMoneyAgent()
  const draft = drafts.find((item) => item.id === draftId)
  const [isExpanded, setIsExpanded] = useState(
    initiallyExpanded && !!draft && !isResolvedDraft(draft),
  )
  const [editing, setEditing] = useState(false)
  const [selector, setSelector] = useState<"source" | "destination" | "category" | "budget" | null>(
    null,
  )
  const [localDraft, setLocalDraft] = useState<typeof draft>(undefined)
  const previousStatus = useRef(draft?.status)

  useEffect(() => {
    if (!draft) return
    const enteredResolvedState =
      (draft.status === "confirmed" || draft.status === "discarded") &&
      previousStatus.current !== draft.status

    if (enteredResolvedState) {
      setIsExpanded(false)
      setEditing(false)
      setLocalDraft(undefined)
      setSelector(null)
    }
    previousStatus.current = draft.status
  }, [draft])

  if (!draft) return null
  const currentDraft = localDraft ?? draft
  const statusPresentation = getDraftStatusPresentation(currentDraft)
  const typePresentation = getMoneyAgentDraftType(currentDraft.type)
  const statusColor =
    statusPresentation.tone === "pending"
      ? colors.palette.accent300
      : statusPresentation.tone === "confirming"
        ? colors.palette.secondary300
        : statusPresentation.tone === "confirmed"
          ? colors.palette.primary300
          : statusPresentation.tone === "failed"
            ? colors.palette.angry500
            : colors.palette.neutral400

  const resolveName = (collection: { id: string; name: string }[], id: string | null) =>
    collection.find((item) => item.id === id)?.name ?? "Not selected"

  const selectorItems: SelectionItem[] =
    selector === "source" || selector === "destination"
      ? compatibleMoneyAgentAccounts(accounts, currentDraft, selector).map((item) => ({
          id: item.id,
          title: item.name,
          icon: "wallet-outline",
        }))
      : selector === "category"
        ? categories.map((item) => ({ id: item.id, title: item.name, icon: "shape-outline" }))
        : budgets.map((item) => ({ id: item.id, title: item.name, icon: "wallet-outline" }))

  const applySelection = (ids: string[]) => {
    const id = ids[0] ?? ""
    const selectedDraft =
      selector === "source"
        ? { ...currentDraft, sourceAccountId: id || null }
        : selector === "destination"
          ? { ...currentDraft, destinationAccountId: id || null }
          : selector === "category"
            ? { ...currentDraft, categoryId: id || null }
            : { ...currentDraft, budgetId: id || null }
    const next =
      selector === "source" || selector === "destination"
        ? reconcileMoneyAgentDraftAccounts(selectedDraft, accounts)
        : selectedDraft

    setLocalDraft(next)
    updateDraft(next)
    setSelector(null)
  }

  const toggleExpanded = () => {
    setIsExpanded((expanded) => {
      if (expanded) setSelector(null)
      return !expanded
    })
  }

  return (
    <FinanceCard
      style={themed([
        $draftCard,
        $draftCardTone[statusPresentation.tone],
        isResolvedDraft(currentDraft) && $draftCardResolved,
      ])}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${isExpanded ? "Collapse" : "Expand"} transaction draft`}
        accessibilityState={{ expanded: isExpanded }}
        onPress={toggleExpanded}
        style={({ pressed }) =>
          themed([
            $draftHeader,
            $draftHeaderTone[statusPresentation.tone],
            pressed && $draftHeaderPressed,
          ])
        }
      >
        <View style={themed($draftTitleRow)}>
          <View style={themed([$draftIcon, $draftIconTone[typePresentation.tone]])}>
            <MaterialCommunityIcons
              name={typePresentation.icon}
              size={17}
              color={colors.palette.surfaceDim}
            />
          </View>
          <Text
            text={`${typePresentation.label.toUpperCase()} DRAFT`}
            style={themed([$draftEyebrow, $draftEyebrowTone[typePresentation.tone]])}
          />
        </View>
        <View style={themed($draftHeaderSummary)}>
          <View
            accessibilityLabel={`Transaction status: ${statusPresentation.label}`}
            testID={`draft-status-${currentDraft.id}`}
            style={themed([$draftStatusBadge, $draftStatusBadgeTone[statusPresentation.tone]])}
          >
            <MaterialCommunityIcons name={statusPresentation.icon} size={14} color={statusColor} />
            <Text
              text={statusPresentation.label}
              style={themed([$draftStatus, $draftStatusTextTone[statusPresentation.tone]])}
            />
          </View>
          <MaterialCommunityIcons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={22}
            color={colors.textDim}
          />
        </View>
      </Pressable>

      <View style={themed([$amountRow, !isExpanded && $amountRowCollapsed])}>
        <View style={themed($amountSummary)}>
          <Text text="Amount" style={themed($fieldLabel)} />
          <Text
            text={formatMoneyAgentDraftAmount(currentDraft)}
            style={themed([$draftAmount, $draftAmountTone[typePresentation.tone]])}
          />
          <Text
            text={`${resolveName(accounts, currentDraft.sourceAccountId)} → ${resolveName(
              accounts,
              currentDraft.destinationAccountId,
            )}`}
            style={themed($accountFlow)}
            testID={`draft-account-flow-${currentDraft.id}`}
          />
        </View>
        <View style={themed([$categoryIcon, $categoryIconTone[typePresentation.tone]])}>
          <MaterialCommunityIcons
            name={typePresentation.icon}
            size={29}
            color={colors.palette.surfaceDim}
          />
        </View>
      </View>

      {isExpanded && (
        <>
          {editing ? (
            <View style={themed($draftEditor)}>
              <View style={themed($typeTabs)}>
                {moneyAgentDraftTypes.map((item) => (
                  <Pressable
                    key={item.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: currentDraft.type === item.value }}
                    accessibilityLabel={`${item.label} transaction type`}
                    onPress={() => {
                      const next = reconcileMoneyAgentDraftAccounts(
                        { ...currentDraft, type: item.value },
                        accounts,
                      )
                      setLocalDraft(next)
                      updateDraft(next)
                      setSelector(null)
                    }}
                    style={themed([
                      $typeTab,
                      currentDraft.type === item.value && $activeTypeTabs[item.value],
                    ])}
                  >
                    <Text
                      text={item.label}
                      style={themed([
                        $typeText,
                        currentDraft.type === item.value && $activeTypeText,
                      ])}
                    />
                  </Pressable>
                ))}
              </View>
              <TextField
                label="Amount"
                keyboardType="numeric"
                value={currentDraft.amount}
                onChangeText={(value) => {
                  const next = { ...currentDraft, amount: value }
                  setLocalDraft(next)
                  updateDraft(next)
                }}
              />
              <TextField
                label="Date"
                value={currentDraft.date}
                onChangeText={(value) => {
                  const next = { ...currentDraft, date: value }
                  setLocalDraft(next)
                  updateDraft(next)
                }}
              />
              <TextField
                label="Description"
                value={currentDraft.description}
                onChangeText={(value) => {
                  const next = { ...currentDraft, description: value }
                  setLocalDraft(next)
                  updateDraft(next)
                }}
              />
              <TextField
                label="Notes"
                value={currentDraft.notes ?? ""}
                onChangeText={(value) => {
                  const next = { ...currentDraft, notes: value }
                  setLocalDraft(next)
                  updateDraft(next)
                }}
              />

              <View style={themed($selectorGrid)}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Select source account"
                  onPress={() => setSelector("source")}
                  style={themed($selectorButton)}
                >
                  <Text text="Source" style={themed($selectorLabel)} />
                  <Text
                    text={resolveName(accounts, currentDraft.sourceAccountId)}
                    style={themed($selectorValue)}
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Select destination account"
                  onPress={() => setSelector("destination")}
                  style={themed($selectorButton)}
                >
                  <Text text="Destination" style={themed($selectorLabel)} />
                  <Text
                    text={resolveName(accounts, currentDraft.destinationAccountId)}
                    style={themed($selectorValue)}
                  />
                </Pressable>
                <Pressable onPress={() => setSelector("category")} style={themed($selectorButton)}>
                  <Text text="Category" style={themed($selectorLabel)} />
                  <Text
                    text={resolveName(categories, currentDraft.categoryId)}
                    style={themed($selectorValue)}
                  />
                </Pressable>
                <Pressable onPress={() => setSelector("budget")} style={themed($selectorButton)}>
                  <Text text="Budget" style={themed($selectorLabel)} />
                  <Text
                    text={resolveName(budgets, currentDraft.budgetId)}
                    style={themed($selectorValue)}
                  />
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={themed($draftBody)}>
              <View style={themed($detailsGrid)}>
                <DraftField label="Description" value={currentDraft.description} />
                <DraftField
                  label="Category"
                  value={resolveName(categories, currentDraft.categoryId)}
                />
                <DraftField
                  label="Source account"
                  value={resolveName(accounts, currentDraft.sourceAccountId)}
                />
                <DraftField label="Date" value={currentDraft.date} />
                <DraftField
                  label="Destination"
                  value={resolveName(accounts, currentDraft.destinationAccountId)}
                />
                <DraftField label="Budget" value={resolveName(budgets, currentDraft.budgetId)} />
              </View>
              {!!currentDraft.notes && (
                <View style={themed($notesBlock)}>
                  <Text text="Notes" style={themed($fieldLabel)} />
                  <Text text={currentDraft.notes} style={themed($draftNotes)} />
                </View>
              )}
              {currentDraft.missingFields.length > 0 && (
                <Text
                  text={`Missing: ${currentDraft.missingFields.join(", ")}`}
                  style={themed($draftMissing)}
                />
              )}
              {!!currentDraft.errorMessage && (
                <Text text={currentDraft.errorMessage} style={themed($draftError)} />
              )}
            </View>
          )}

          <View style={themed($draftActions)}>
            <DraftActionButton
              icon={editing ? "content-save-outline" : "pencil-outline"}
              label={editing ? "Save" : "Edit"}
              position="first"
              disabled={
                currentDraft.status === "confirming" ||
                currentDraft.status === "confirmed" ||
                currentDraft.status === "discarded"
              }
              onPress={() => {
                if (editing) {
                  updateDraft(currentDraft)
                  setLocalDraft(undefined)
                  setEditing(false)
                  return
                }
                setIsExpanded(true)
                setLocalDraft(draft)
                setEditing(true)
              }}
            />
            <DraftActionButton
              icon={currentDraft.status === "confirming" ? "loading" : "check"}
              label={currentDraft.status === "confirming" ? "Saving" : "Confirm"}
              tone="confirm"
              disabled={
                currentDraft.missingFields.length > 0 ||
                currentDraft.status === "confirming" ||
                currentDraft.status === "confirmed" ||
                currentDraft.status === "discarded"
              }
              onPress={() => {
                setLocalDraft(undefined)
                setEditing(false)
                void confirmDraft(currentDraft.id)
              }}
            />
            <DraftActionButton
              icon="close"
              label="Discard"
              tone="discard"
              position="last"
              disabled={
                currentDraft.status === "confirming" ||
                currentDraft.status === "confirmed" ||
                currentDraft.status === "discarded"
              }
              onPress={() => {
                setLocalDraft(undefined)
                setEditing(false)
                discardDraft(currentDraft.id)
              }}
            />
          </View>

          <SelectionSheet
            visible={selector !== null}
            title={
              selector === "source"
                ? "Source account"
                : selector === "destination"
                  ? "Destination account"
                  : selector === "category"
                    ? "Category"
                    : "Budget"
            }
            items={selectorItems}
            selectedIds={
              selector === "source"
                ? currentDraft.sourceAccountId
                  ? [currentDraft.sourceAccountId]
                  : []
                : selector === "destination"
                  ? currentDraft.destinationAccountId
                    ? [currentDraft.destinationAccountId]
                    : []
                  : selector === "category"
                    ? currentDraft.categoryId
                      ? [currentDraft.categoryId]
                      : []
                    : currentDraft.budgetId
                      ? [currentDraft.budgetId]
                      : []
            }
            onSelect={applySelection}
            onClose={() => setSelector(null)}
          />
        </>
      )}
    </FinanceCard>
  )
}

function DraftActionButton({
  icon,
  label,
  tone = "neutral",
  position,
  disabled = false,
  onPress,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"]
  label: string
  tone?: "neutral" | "confirm" | "discard"
  position?: "first" | "last"
  disabled?: boolean
  onPress: () => void
}) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) =>
        themed([
          $draftAction,
          tone === "confirm" && $draftActionConfirm,
          tone === "discard" && $draftActionDiscard,
          position === "first" && $draftActionFirst,
          position === "last" && $draftActionLast,
          disabled && $draftActionDisabled,
          pressed && !disabled && $draftActionPressed,
        ])
      }
    >
      <MaterialCommunityIcons
        name={icon}
        size={18}
        color={
          disabled
            ? colors.textDim
            : tone === "confirm"
              ? colors.palette.primary300
              : tone === "discard"
                ? colors.palette.angry500
                : colors.text
        }
      />
      <Text
        text={label}
        style={themed([
          $draftActionText,
          tone === "confirm" && $draftActionTextConfirm,
          tone === "discard" && $draftActionTextDiscard,
          disabled && $draftActionTextDisabled,
        ])}
      />
    </Pressable>
  )
}

function DraftField({ label, value }: { label: string; value: string }) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($draftField)}>
      <Text text={label} style={themed($fieldLabel)} />
      <Text text={value} style={themed($draftDescription)} />
    </View>
  )
}

const $screenContent: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $draftGroup: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $draftGroupTitle: ThemedStyle<TextStyle> = ({ colors, spacing, typography }) => ({
  color: colors.textDim,
  fontFamily: typography.primary.medium,
  fontSize: 14,
  marginTop: spacing.xs,
})

const $container: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.background,
  flex: 1,
  paddingTop: spacing.md,
})

const $header: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  borderBottomColor: colors.palette.stroke,
  borderBottomWidth: 1,
  flexDirection: "row",
  justifyContent: "space-between",
  gap: spacing.md,
  marginHorizontal: spacing.lg,
  paddingBottom: spacing.lg,
})

const $titleBlock: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  flex: 1,
  gap: spacing.md,
  minWidth: 0,
})

const $avatar: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.primary500,
  borderRadius: 20,
  height: 40,
  justifyContent: "center",
  width: 40,
})

const $titleCopy: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  justifyContent: "center",
  minWidth: 0,
})

const $title: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.bold,
  fontSize: 21,
  lineHeight: 27,
})

const $subtitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  flexShrink: 1,
  fontSize: 12,
  lineHeight: 16,
})

const $statusRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.xs,
})

const $onlineDot: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.tint,
  borderRadius: 4,
  height: 7,
  width: 7,
})

const $offlineDot: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.error,
  borderRadius: 4,
  height: 7,
  width: 7,
})

const $headerActions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexShrink: 0,
  flexDirection: "row",
  gap: spacing.sm,
})

const $iconButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainer,
  borderColor: colors.palette.stroke,
  borderRadius: 16,
  borderWidth: 1,
  height: 40,
  justifyContent: "center",
  width: 40,
})

const $chat: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $chatContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.lg,
  padding: spacing.lg,
  paddingBottom: spacing.xl,
})

const $quickPrompts: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
  paddingRight: spacing.lg,
})

const $promptChip: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainer,
  borderColor: colors.palette.stroke,
  borderRadius: 999,
  borderWidth: 1,
  flexDirection: "row",
  gap: spacing.xs,
  justifyContent: "center",
  paddingHorizontal: spacing.md,
  paddingVertical: 10,
})

const $promptText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.medium,
  fontSize: 13,
})

const $dayDivider: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.md,
})

const $dividerLine: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.stroke,
  flex: 1,
  height: 1,
})

const $dayLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 12,
})

const $messageBlock: ThemedStyle<ViewStyle> = () => ({
  alignSelf: "stretch",
})

const $messageBlockRight: ThemedStyle<ViewStyle> = () => ({
  alignItems: "flex-end",
})

const $bubbleRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "flex-start",
  flexDirection: "row",
  gap: spacing.sm,
  width: "100%",
})

const $bubbleRowRight: ThemedStyle<ViewStyle> = () => ({
  justifyContent: "flex-end",
})

const $bubbleAvatar: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.primary500,
  borderRadius: 18,
  height: 36,
  justifyContent: "center",
  width: 36,
})

const $bubble: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.surfaceContainer,
  borderColor: colors.palette.stroke,
  borderRadius: 25,
  borderTopLeftRadius: 8,
  borderWidth: 1,
  maxWidth: "86%",
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.md,
})

const $bubbleUser: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.primary500,
  borderColor: colors.palette.primary500,
  borderBottomRightRadius: 8,
  borderTopLeftRadius: 25,
})

const $bubbleStatus: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainerHigh,
})

const $bubbleText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  fontSize: 15,
  lineHeight: 22,
})

const $bubbleTextUser: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.surfaceDim,
})

const $timestamp: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 11,
  marginLeft: 48,
  marginTop: 5,
})

const $timestampRight: ThemedStyle<TextStyle> = () => ({
  marginLeft: 0,
  marginRight: 2,
})

const $composerBar: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.surface,
  borderTopColor: colors.palette.stroke,
  borderTopWidth: 1,
  padding: spacing.lg,
})

const $composerField: ThemedStyle<ViewStyle> = () => ({
  marginBottom: 0,
})

const $composerInput: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainer,
  borderColor: colors.palette.stroke,
  borderRadius: 30,
  minHeight: 58,
})

const $composerText: ThemedStyle<TextStyle> = () => ({
  maxHeight: 96,
  minHeight: 24,
  paddingVertical: 17,
})

const $composerIcon: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  justifyContent: "center",
  paddingLeft: 16,
})

const $sendIconButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  alignSelf: "center",
  backgroundColor: colors.tint,
  borderRadius: 22,
  height: 44,
  justifyContent: "center",
  marginRight: 7,
  width: 44,
})

const $sendIconDisabled: ThemedStyle<ViewStyle> = () => ({
  opacity: 0.4,
})

const $error: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.error,
  fontSize: 13,
  lineHeight: 18,
})

const $draftCard: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.surfaceContainer,
  borderColor: colors.palette.accent300,
  borderRadius: 28,
  borderWidth: 1.5,
  overflow: "hidden",
  padding: spacing.lg,
})

const $draftCardTone: Record<DraftStatusTone, ThemedStyle<ViewStyle>> = {
  pending: ({ colors }) => ({ borderColor: colors.palette.accent300 }),
  confirming: ({ colors }) => ({ borderColor: colors.palette.secondary300 }),
  confirmed: ({ colors }) => ({ borderColor: colors.palette.primary300 }),
  discarded: ({ colors }) => ({ borderColor: colors.palette.neutral500 }),
  failed: ({ colors }) => ({ borderColor: colors.palette.angry500 }),
}

const $draftCardResolved: ThemedStyle<ViewStyle> = () => ({
  opacity: 0.84,
})

const $draftHeader: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderBottomColor: colors.palette.stroke,
  borderBottomWidth: 1,
  flexDirection: "row",
  justifyContent: "space-between",
  gap: spacing.md,
  marginHorizontal: -spacing.lg,
  marginTop: -spacing.lg,
  padding: spacing.md,
})

const $draftHeaderTone: Record<DraftStatusTone, ThemedStyle<ViewStyle>> = {
  pending: () => ({ backgroundColor: "rgba(246, 207, 98, 0.10)" }),
  confirming: () => ({ backgroundColor: "rgba(99, 181, 214, 0.12)" }),
  confirmed: () => ({ backgroundColor: "rgba(62, 165, 118, 0.13)" }),
  discarded: () => ({ backgroundColor: "rgba(131, 125, 117, 0.10)" }),
  failed: () => ({ backgroundColor: "rgba(216, 113, 98, 0.12)" }),
}

const $draftHeaderPressed: ThemedStyle<ViewStyle> = () => ({
  opacity: 0.78,
})

const $draftTitleRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.sm,
})

const $draftHeaderSummary: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.sm,
})

const $draftIcon: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.tint,
  borderRadius: 15,
  height: 30,
  justifyContent: "center",
  width: 30,
})

const $draftIconTone: Record<"expense" | "income" | "transfer", ThemedStyle<ViewStyle>> = {
  expense: ({ colors }) => ({ backgroundColor: colors.palette.tertiary300 }),
  income: ({ colors }) => ({ backgroundColor: colors.palette.primary300 }),
  transfer: ({ colors }) => ({ backgroundColor: colors.palette.secondary300 }),
}

const $draftEyebrow: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.tint,
  fontSize: 12,
  letterSpacing: 1,
})

const $draftEyebrowTone: Record<"expense" | "income" | "transfer", ThemedStyle<TextStyle>> = {
  expense: ({ colors }) => ({ color: colors.palette.tertiary300 }),
  income: ({ colors }) => ({ color: colors.palette.primary300 }),
  transfer: ({ colors }) => ({ color: colors.palette.secondary300 }),
}

const $draftAmount: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.error,
  fontFamily: typography.primary.bold,
  fontSize: 34,
  lineHeight: 42,
})

const $draftAmountTone: Record<"expense" | "income" | "transfer", ThemedStyle<TextStyle>> = {
  expense: ({ colors }) => ({ color: colors.palette.tertiary300 }),
  income: ({ colors }) => ({ color: colors.palette.primary300 }),
  transfer: ({ colors }) => ({ color: colors.palette.secondary300 }),
}

const $draftStatus: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.textDim,
  fontFamily: typography.primary.medium,
  fontSize: 12,
})

const $draftStatusBadge: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  borderRadius: 999,
  flexDirection: "row",
  gap: spacing.xs,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xxs,
})

const $draftStatusBadgeTone: Record<DraftStatusTone, ThemedStyle<ViewStyle>> = {
  pending: () => ({ backgroundColor: "rgba(246, 207, 98, 0.14)" }),
  confirming: () => ({ backgroundColor: "rgba(99, 181, 214, 0.16)" }),
  confirmed: () => ({ backgroundColor: "rgba(62, 165, 118, 0.18)" }),
  discarded: () => ({ backgroundColor: "rgba(131, 125, 117, 0.16)" }),
  failed: () => ({ backgroundColor: "rgba(216, 113, 98, 0.16)" }),
}

const $draftStatusTextTone: Record<DraftStatusTone, ThemedStyle<TextStyle>> = {
  pending: ({ colors }) => ({ color: colors.palette.accent300 }),
  confirming: ({ colors }) => ({ color: colors.palette.secondary300 }),
  confirmed: ({ colors }) => ({ color: colors.palette.primary300 }),
  discarded: ({ colors }) => ({ color: colors.palette.neutral400 }),
  failed: ({ colors }) => ({ color: colors.palette.angry500 }),
}

const $amountRow: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  borderBottomColor: colors.palette.stroke,
  borderBottomWidth: 1,
  flexDirection: "row",
  justifyContent: "space-between",
  paddingVertical: spacing.lg,
})

const $amountRowCollapsed: ThemedStyle<ViewStyle> = () => ({
  borderBottomWidth: 0,
  paddingBottom: 0,
})

const $amountSummary: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxs,
  minWidth: 0,
})

const $accountFlow: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 13,
  lineHeight: 18,
})

const $categoryIcon: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.tertiary500,
  borderRadius: 28,
  height: 56,
  justifyContent: "center",
  width: 56,
})

const $categoryIconTone: Record<"expense" | "income" | "transfer", ThemedStyle<ViewStyle>> = {
  expense: ({ colors }) => ({ backgroundColor: colors.palette.tertiary300 }),
  income: ({ colors }) => ({ backgroundColor: colors.palette.primary300 }),
  transfer: ({ colors }) => ({ backgroundColor: colors.palette.secondary300 }),
}

const $draftBody: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.md,
  paddingTop: spacing.md,
})

const $draftEditor: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $typeTabs: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainer,
  borderRadius: 13,
  flexDirection: "row",
  padding: 3,
})

const $typeTab: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  borderRadius: 10,
  flex: 1,
  justifyContent: "center",
  minHeight: 44,
})

const $activeTypeTabs: Record<MoneyAgentTransactionDraft["type"], ThemedStyle<ViewStyle>> = {
  withdrawal: ({ colors }) => ({ backgroundColor: colors.palette.tertiary300 }),
  deposit: ({ colors }) => ({ backgroundColor: colors.palette.primary300 }),
  transfer: ({ colors }) => ({ backgroundColor: colors.palette.secondary300 }),
}

const $typeText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.textDim,
  fontFamily: typography.primary.medium,
  fontSize: 14,
})

const $activeTypeText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.surfaceDim,
})

const $draftDescription: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.medium,
  fontSize: 14,
})

const $fieldLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 12,
  marginBottom: 3,
})

const $detailsGrid: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.md,
})

const $draftField: ThemedStyle<ViewStyle> = () => ({
  minWidth: "45%",
  flex: 1,
})

const $notesBlock: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  borderTopColor: colors.palette.stroke,
  borderTopWidth: 1,
  paddingTop: spacing.md,
})

const $draftNotes: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  fontSize: 14,
  lineHeight: 20,
})

const $draftMissing: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.tint,
  fontSize: 12,
  lineHeight: 18,
})

const $draftError: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.error,
  fontSize: 12,
  lineHeight: 18,
})

const $draftActions: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  borderTopColor: colors.palette.stroke,
  borderTopWidth: 1,
  flexDirection: "row",
  marginBottom: -spacing.lg,
  marginHorizontal: -spacing.lg,
  marginTop: spacing.lg,
  minHeight: 54,
})

const $draftAction: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainer,
  borderRightColor: colors.palette.stroke,
  borderRightWidth: 1,
  flex: 1,
  flexDirection: "row",
  gap: spacing.xs,
  justifyContent: "center",
  minHeight: 54,
  paddingHorizontal: spacing.xs,
})

const $draftActionConfirm: ThemedStyle<ViewStyle> = () => ({
  backgroundColor: "#123a29",
})

const $draftActionDiscard: ThemedStyle<ViewStyle> = () => ({
  borderRightWidth: 0,
})

const $draftActionFirst: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  borderBottomLeftRadius: spacing.lg,
})

const $draftActionLast: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  borderBottomRightRadius: spacing.lg,
})

const $draftActionDisabled: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainer,
  opacity: 0.45,
})

const $draftActionPressed: ThemedStyle<ViewStyle> = () => ({
  opacity: 0.72,
})

const $draftActionText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.medium,
  fontSize: 14,
  lineHeight: 18,
})

const $draftActionTextConfirm: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.primary300,
  fontFamily: typography.primary.semiBold,
})

const $draftActionTextDiscard: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.angry500,
})

const $draftActionTextDisabled: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $selectorGrid: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.sm,
})

const $selectorButton: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderColor: colors.palette.stroke,
  borderRadius: 16,
  borderWidth: 1,
  flexGrow: 1,
  minWidth: "48%",
  padding: spacing.sm,
})

const $selectorLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 11,
  marginBottom: 2,
})

const $selectorValue: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.medium,
  fontSize: 13,
})
