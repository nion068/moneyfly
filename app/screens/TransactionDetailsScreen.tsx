import { FC } from "react"
import { Pressable, TextStyle, View, ViewStyle } from "react-native"
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
  const { transactions } = useFirefly()
  const { transaction } = route.params
  const isSplit =
    transactions.data.filter((item) => item.groupId === transaction.groupId).length > 1

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={themed($container)}
      footer={
        !isSplit ? (
          <Button
            text="Edit Transaction"
            onPress={() =>
              navigation.navigate("EditTransaction", {
                groupId: transaction.groupId,
                journalId: transaction.journalId,
              })
            }
            style={themed($editButton)}
            textStyle={themed($editButtonText)}
          />
        ) : undefined
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
