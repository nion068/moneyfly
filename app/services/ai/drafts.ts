import type { TransactionType } from "@/models/firefly"
import { formatDisplayNumber } from "@/utils/numbers"

import type { MoneyAgentDraftField, MoneyAgentEntity, MoneyAgentTransactionDraft } from "./types"

export const moneyAgentDraftTypes: {
  label: string
  value: TransactionType
  icon: "cash-minus" | "cash-plus" | "bank-transfer"
  tone: "expense" | "income" | "transfer"
  amountSign: "-" | "+" | ""
}[] = [
  {
    label: "Expense",
    value: "withdrawal",
    icon: "cash-minus",
    tone: "expense",
    amountSign: "-",
  },
  {
    label: "Income",
    value: "deposit",
    icon: "cash-plus",
    tone: "income",
    amountSign: "+",
  },
  {
    label: "Transfer",
    value: "transfer",
    icon: "bank-transfer",
    tone: "transfer",
    amountSign: "",
  },
]

export function getMoneyAgentDraftType(type: TransactionType) {
  return moneyAgentDraftTypes.find((item) => item.value === type) ?? moneyAgentDraftTypes[0]
}

export function formatMoneyAgentDraftAmount(draft: MoneyAgentTransactionDraft) {
  const presentation = getMoneyAgentDraftType(draft.type)
  return `${presentation.amountSign}${draft.currencyCode} ${formatDisplayNumber(
    Number(draft.amount || 0),
  )}`
}

function normalizedAccountType(account: MoneyAgentEntity) {
  return account.type?.toLowerCase() ?? ""
}

export function isMoneyAgentOwnedAccount(account: MoneyAgentEntity) {
  const type = normalizedAccountType(account)
  return type.includes("asset") || type.includes("cash") || type.includes("liabilit")
}

export function isMoneyAgentExpenseAccount(account: MoneyAgentEntity) {
  return normalizedAccountType(account).includes("expense")
}

export function isMoneyAgentRevenueAccount(account: MoneyAgentEntity) {
  return normalizedAccountType(account).includes("revenue")
}

export function isMoneyAgentAccountCompatible(
  account: MoneyAgentEntity,
  type: TransactionType,
  endpoint: "source" | "destination",
) {
  if (type === "withdrawal") {
    return endpoint === "source"
      ? isMoneyAgentOwnedAccount(account)
      : isMoneyAgentExpenseAccount(account)
  }
  if (type === "deposit") {
    return endpoint === "source"
      ? isMoneyAgentRevenueAccount(account)
      : isMoneyAgentOwnedAccount(account)
  }
  return isMoneyAgentOwnedAccount(account)
}

export function compatibleMoneyAgentAccounts(
  accounts: MoneyAgentEntity[],
  draft: MoneyAgentTransactionDraft,
  endpoint: "source" | "destination",
) {
  const oppositeId = endpoint === "source" ? draft.destinationAccountId : draft.sourceAccountId

  return accounts.filter(
    (account) =>
      isMoneyAgentAccountCompatible(account, draft.type, endpoint) &&
      (draft.type !== "transfer" || account.id !== oppositeId),
  )
}

export function reconcileMoneyAgentDraftAccounts(
  draft: MoneyAgentTransactionDraft,
  accounts: MoneyAgentEntity[],
): MoneyAgentTransactionDraft {
  const source = accounts.find((account) => account.id === draft.sourceAccountId)
  const destination = accounts.find((account) => account.id === draft.destinationAccountId)
  const sourceAccountId =
    source && isMoneyAgentAccountCompatible(source, draft.type, "source") ? source.id : null
  const destinationAccountId =
    destination &&
    isMoneyAgentAccountCompatible(destination, draft.type, "destination") &&
    (draft.type !== "transfer" || destination.id !== sourceAccountId)
      ? destination.id
      : null
  const missingFields = new Set<MoneyAgentDraftField>(draft.missingFields)

  if (sourceAccountId) missingFields.delete("sourceAccountId")
  else missingFields.add("sourceAccountId")
  if (destinationAccountId) missingFields.delete("destinationAccountId")
  else missingFields.add("destinationAccountId")

  return {
    ...draft,
    sourceAccountId,
    destinationAccountId,
    missingFields: Array.from(missingFields),
  }
}
