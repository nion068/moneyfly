import { FC, useEffect, useState } from "react"
import { Modal, Pressable, TextStyle, View, ViewStyle } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Button } from "@/components/Button"
import { FinanceCard } from "@/components/firefly/FinancePrimitives"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { useFirefly } from "@/context/FireflyContext"
import type { TransactionType } from "@/models/firefly"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { formatMoney } from "@/services/firefly/transforms"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type TransactionDetailsScreenProps = AppStackScreenProps<"TransactionDetails">

export const TransactionDetailsScreen: FC<TransactionDetailsScreenProps> = ({
  navigation,
  route,
}) => {
  const { themed } = useAppTheme()
  const {
    isConfigured,
    deleteTransaction,
    resetTransactionDeletion,
    transactionDeletion,
    transactions,
  } = useFirefly()
  const { transaction } = route.params
  const isSplit =
    transactions.data.filter((item) => item.groupId === transaction.groupId).length > 1
  const isDeleting = transactionDeletion.status === "loading"
  const [isDeleteDialogVisible, setIsDeleteDialogVisible] = useState(false)

  useEffect(() => {
    resetTransactionDeletion()
    return resetTransactionDeletion
  }, [resetTransactionDeletion])

  useEffect(() => {
    if (!isConfigured) {
      navigation.replace("Main", {
        screen: "Settings",
        params: { screen: "SettingsFirefly" },
      })
    }
  }, [isConfigured, navigation])

  const confirmDelete = async () => {
    const deleted = await deleteTransaction(transaction.groupId)
    if (deleted) {
      setIsDeleteDialogVisible(false)
      navigation.goBack()
    }
  }

  const requestDelete = () => {
    resetTransactionDeletion()
    setIsDeleteDialogVisible(true)
  }

  const closeDeleteDialog = () => {
    if (!isDeleting) setIsDeleteDialogVisible(false)
  }

  if (!isConfigured) return null

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={themed($container)}
      footer={
        <View style={themed($footerActions)}>
          {!isSplit && (
            <Button
              text="Edit Transaction"
              disabled={isDeleting}
              onPress={() =>
                navigation.navigate("EditTransaction", {
                  groupId: transaction.groupId,
                  journalId: transaction.journalId,
                })
              }
              style={themed($editButton)}
              textStyle={themed($editButtonText)}
            />
          )}
          <Button
            text={
              isDeleting ? "Deleting..." : isSplit ? "Delete Split Group" : "Delete Transaction"
            }
            accessibilityLabel={isSplit ? "Delete split transaction group" : "Delete transaction"}
            disabled={isDeleting}
            onPress={requestDelete}
            style={themed($deleteButton)}
            textStyle={themed($deleteButtonText)}
            disabledStyle={themed($disabledButton)}
          />
        </View>
      }
      footerStyle={themed($footer)}
    >
      <View style={themed($header)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={themed($roundButton)}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} style={themed($icon)} />
        </Pressable>
        <Text text="Transaction Details" style={themed($title)} />
        <View style={themed($headerSpacer)} />
      </View>

      <FinanceCard style={themed($amountCard)}>
        <Text
          text={formatMoney(transaction.amount, transaction.currencySymbol)}
          style={themed($amount)}
        />
        <Text text={transaction.description} style={themed($description)} />
        <View style={themed([$typeBadge, typeBadgeStyle(transaction.type)])}>
          <Text text={typeLabel(transaction.type)} style={themed($typeText)} />
        </View>
      </FinanceCard>

      <FinanceCard style={themed($detailsCard)}>
        <DetailRow label="Source" value={transaction.sourceName || "Not available"} />
        <DetailRow label="Destination" value={transaction.destinationName || "Not available"} />
        <DetailRow
          label="Date"
          value={new Date(transaction.date).toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        />
        <DetailRow label="Category" value={transaction.categoryName || "Uncategorized"} />
        <DetailRow label="Budget" value={transaction.budgetName || "None"} />
        <DetailRow label="Tags" value={transaction.tags.join(", ") || "None"} />
        <DetailRow label="Notes" value={transaction.notes || "None"} last />
      </FinanceCard>

      {isSplit && (
        <View style={themed($splitNotice)}>
          <MaterialCommunityIcons name="information-outline" size={20} style={themed($dimIcon)} />
          <Text
            text="Split transactions are read-only here. Edit this group in Firefly III."
            style={themed($noticeText)}
          />
        </View>
      )}

      <Modal
        visible={isDeleteDialogVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeDeleteDialog}
      >
        <View style={themed($dialogOverlay)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close delete confirmation"
            disabled={isDeleting}
            onPress={closeDeleteDialog}
            style={themed($dialogBackdrop)}
          />
          <View accessibilityRole="alert" accessibilityViewIsModal style={themed($dialog)}>
            <View style={themed($dialogIcon)}>
              <MaterialCommunityIcons name="delete-outline" size={28} style={themed($deleteIcon)} />
            </View>
            <Text
              text={isSplit ? "Delete split transaction group?" : "Delete transaction?"}
              style={themed($dialogTitle)}
            />
            <Text
              text={
                isSplit
                  ? "This permanently deletes every transaction in this split group. This action cannot be undone."
                  : `This permanently deletes "${transaction.description}". This action cannot be undone.`
              }
              style={themed($dialogMessage)}
            />
            {transactionDeletion.status === "error" && (
              <Text
                text={transactionDeletion.error?.message ?? "Could not delete this transaction."}
                style={themed($deleteError)}
              />
            )}
            <View style={themed($dialogActions)}>
              <Button
                text="Cancel"
                disabled={isDeleting}
                onPress={closeDeleteDialog}
                style={themed($cancelButton)}
                textStyle={themed($cancelButtonText)}
                disabledStyle={themed($disabledButton)}
              />
              <Button
                text={isDeleting ? "Deleting..." : "Delete"}
                accessibilityLabel="Confirm delete transaction"
                disabled={isDeleting}
                onPress={() => void confirmDelete()}
                style={themed($confirmDeleteButton)}
                textStyle={themed($confirmDeleteButtonText)}
                disabledStyle={themed($disabledButton)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  )
}

function DetailRow({
  label,
  value,
  last = false,
}: {
  label: string
  value: string
  last?: boolean
}) {
  const { themed } = useAppTheme()

  return (
    <View style={themed([$detailRow, !last && $detailDivider])}>
      <Text text={label} style={themed($detailLabel)} />
      <Text text={value} style={themed($detailValue)} />
    </View>
  )
}

function typeLabel(type: TransactionType) {
  if (type === "withdrawal") return "Expense"
  if (type === "deposit") return "Income"
  return "Transfer"
}

function typeBadgeStyle(type: TransactionType): ViewStyle {
  if (type === "withdrawal") return { backgroundColor: "rgba(216, 113, 98, 0.22)" }
  if (type === "deposit") return { backgroundColor: "rgba(62, 165, 118, 0.24)" }
  return { backgroundColor: "rgba(134, 205, 234, 0.22)" }
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.md,
  padding: spacing.md,
  paddingBottom: spacing.lg,
})

const $footer: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.background,
  paddingHorizontal: spacing.md,
  paddingTop: spacing.sm,
})

const $footerActions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $header: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
})

const $roundButton: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  height: 44,
  justifyContent: "center",
  width: 44,
})

const $headerSpacer: ThemedStyle<ViewStyle> = () => ({ width: 44 })
const $icon: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.text })
const $dimIcon: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })

const $title: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.bold,
  fontSize: 20,
})

const $amountCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  gap: spacing.xs,
  paddingVertical: spacing.lg,
})

const $amount: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.bold,
  fontSize: 36,
  lineHeight: 44,
})

const $description: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 17,
})

const $typeBadge: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  borderRadius: 999,
  marginTop: spacing.xs,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xxs,
})

const $typeText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.medium,
  fontSize: 12,
})

const $detailsCard: ThemedStyle<ViewStyle> = () => ({ padding: 0, overflow: "hidden" })

const $detailRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
  padding: spacing.md,
})

const $detailDivider: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderBottomColor: colors.palette.stroke,
  borderBottomWidth: 1,
})

const $detailLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 12,
})

const $detailValue: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.medium,
  fontSize: 15,
})

const $splitNotice: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "flex-start",
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderRadius: 14,
  flexDirection: "row",
  gap: spacing.sm,
  padding: spacing.md,
})

const $noticeText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  flex: 1,
  fontSize: 13,
  lineHeight: 19,
})

const $editButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.primary300,
  borderColor: colors.palette.primary300,
  borderRadius: 14,
  minHeight: 50,
})

const $editButtonText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.surfaceDim,
  fontFamily: typography.primary.bold,
})

const $deleteButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: "rgba(216, 113, 98, 0.12)",
  borderColor: colors.palette.tertiary300,
  borderRadius: 14,
  minHeight: 50,
})

const $deleteButtonText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.tertiary300,
  fontFamily: typography.primary.bold,
})

const $disabledButton: ThemedStyle<ViewStyle> = () => ({
  opacity: 0.55,
})

const $deleteError: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.error,
  fontSize: 13,
  textAlign: "center",
})

const $dialogOverlay: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.overlay50,
  flex: 1,
  justifyContent: "center",
  padding: spacing.lg,
})

const $dialogBackdrop: ThemedStyle<ViewStyle> = () => ({
  bottom: 0,
  left: 0,
  position: "absolute",
  right: 0,
  top: 0,
})

const $dialog: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainer,
  borderColor: colors.palette.stroke,
  borderRadius: 24,
  borderWidth: 1,
  gap: spacing.sm,
  maxWidth: 420,
  padding: spacing.lg,
  width: "100%",
})

const $dialogIcon: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  backgroundColor: "rgba(216, 113, 98, 0.14)",
  borderRadius: 28,
  height: 56,
  justifyContent: "center",
  marginBottom: 4,
  width: 56,
})

const $deleteIcon: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.tertiary300,
})

const $dialogTitle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.bold,
  fontSize: 20,
  textAlign: "center",
})

const $dialogMessage: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 14,
  lineHeight: 20,
  textAlign: "center",
})

const $dialogActions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
  marginTop: spacing.xs,
  width: "100%",
})

const $cancelButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderColor: colors.palette.stroke,
  borderRadius: 14,
  flex: 1,
  minHeight: 48,
})

const $cancelButtonText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
})

const $confirmDeleteButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.tertiary300,
  borderColor: colors.palette.tertiary300,
  borderRadius: 14,
  flex: 1,
  minHeight: 48,
})

const $confirmDeleteButtonText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.surfaceDim,
  fontFamily: typography.primary.bold,
})
