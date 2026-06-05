import {
  AccountSummary,
  CategoryExpense,
  CurrencySummary,
  FireflyAccount,
  FireflyTransaction,
  FlatTransaction,
  MonthlySummary,
  StoreTransactionRequest,
  TransactionDraft,
} from "@/models/firefly"

const categoryColors = ["#ff7a1a", "#a548f5", "#86cdea", "#9a958d", "#d87162", "#ded8ce"]

function parseAmount(value?: string | number) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatMoney(amount: number, symbol = "৳") {
  const sign = amount < 0 ? "-" : ""
  return `${sign}${symbol} ${Math.abs(amount).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`
}

export function maskMoney(symbol = "৳") {
  return `${symbol} ••••••`
}

export function flattenFireflyTransactions(transactions: FireflyTransaction[]): FlatTransaction[] {
  return transactions.flatMap((group) =>
    group.attributes.transactions.map((split) => ({
      groupId: group.id,
      journalId: split.transaction_journal_id,
      date: split.date,
      amount: Math.abs(parseAmount(split.amount)),
      description: split.description,
      type: split.type,
      sourceId: split.source_id,
      sourceName: split.source_name ?? "",
      destinationId: split.destination_id,
      destinationName: split.destination_name ?? "",
      categoryName: split.category_name,
      budgetName: split.budget_name,
      tags: split.tags ?? [],
      notes: split.notes,
      currencyCode: split.currency_code ?? "BDT",
      currencySymbol: split.currency_symbol ?? "৳",
    })),
  )
}

export function buildMonthlySummary(transactions: FlatTransaction[]): MonthlySummary {
  const totalIncome = transactions
    .filter((transaction) => transaction.type === "deposit")
    .reduce((total, transaction) => total + transaction.amount, 0)
  const totalExpense = transactions
    .filter((transaction) => transaction.type === "withdrawal")
    .reduce((total, transaction) => total + transaction.amount, 0)
  const saved = totalIncome - totalExpense
  const savingsRate = totalIncome > 0 ? Math.round((saved / totalIncome) * 100) : 0

  return {
    totalIncome,
    totalExpense,
    saved,
    netBalance: totalIncome - totalExpense,
    currencySymbol: transactions[0]?.currencySymbol ?? "৳",
    savingsRate,
  }
}

export function buildSummariesByCurrency(transactions: FlatTransaction[]): CurrencySummary[] {
  const grouped = transactions.reduce<Record<string, FlatTransaction[]>>((result, transaction) => {
    result[transaction.currencyCode] = [...(result[transaction.currencyCode] ?? []), transaction]
    return result
  }, {})

  return Object.entries(grouped)
    .map(([currencyCode, currencyTransactions]) => ({
      ...buildMonthlySummary(currencyTransactions),
      currencyCode,
      transactionCount: currencyTransactions.length,
    }))
    .sort((left, right) => right.transactionCount - left.transactionCount)
}

export function groupExpensesByCategory(transactions: FlatTransaction[]): CategoryExpense[] {
  const expenses = transactions.filter((transaction) => transaction.type === "withdrawal")
  const totalExpense = expenses.reduce((total, transaction) => total + transaction.amount, 0)
  const grouped = expenses.reduce<Record<string, FlatTransaction[]>>((acc, transaction) => {
    const name = transaction.categoryName ?? "Uncategorized"
    acc[name] = [...(acc[name] ?? []), transaction]
    return acc
  }, {})

  return Object.entries(grouped)
    .map(([name, categoryTransactions], index) => {
      const amount = categoryTransactions.reduce(
        (total, transaction) => total + transaction.amount,
        0,
      )

      return {
        name,
        amount,
        percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
        color: categoryColors[index % categoryColors.length],
        transactions: categoryTransactions,
      }
    })
    .sort((left, right) => right.amount - left.amount)
}

export function findCashWallet(accounts: FireflyAccount[]) {
  return (
    accounts.find((account) => account.attributes.account_role?.toLowerCase() === "cashwallet") ??
    accounts.find((account) => account.attributes.account_role?.toLowerCase() === "defaultasset") ??
    accounts.find((account) => account.attributes.name.toLowerCase().includes("cash")) ??
    accounts.find((account) => {
      const name = account.attributes.name.toLowerCase()
      return name.includes("wallet") || name.includes("pocket") || name.includes("hand")
    }) ??
    accounts.find((account) => account.attributes.type.toLowerCase() === "asset")
  )
}

export function findCashWalletName(accounts: FireflyAccount[]) {
  return findCashWallet(accounts)?.attributes.name ?? "Cash wallet"
}

export function accountToSummary(
  account: FireflyAccount,
  transactions: FlatTransaction[] = [],
): AccountSummary {
  const name = account.attributes.name
  const lowerName = name.toLowerCase()
  const apiType = account.attributes.type.toLowerCase()
  const type =
    lowerName.includes("card") || apiType.includes("liabilit")
      ? "credit"
      : lowerName.includes("cash")
        ? "cash"
        : lowerName.includes("wallet") || apiType.includes("cash")
          ? "wallet"
          : "bank"

  const accountCurrency = account.attributes.currency_code
  const accountTransactions = transactions.filter(
    (transaction) =>
      (!accountCurrency || transaction.currencyCode === accountCurrency) &&
      (transaction.sourceId === account.id ||
        transaction.destinationId === account.id ||
        transaction.sourceName === name ||
        transaction.destinationName === name),
  )
  const movement = accountTransactions.reduce((total, transaction) => {
    if (transaction.type === "transfer") {
      if (transaction.destinationId === account.id || transaction.destinationName === name) {
        return total + transaction.amount
      }
      return total - transaction.amount
    }
    if (transaction.type === "deposit") return total + transaction.amount
    return total - transaction.amount
  }, 0)
  const dailyMovement = accountTransactions.reduce<Record<string, number>>(
    (result, transaction) => {
      const day = transaction.date.slice(0, 10)
      const direction =
        transaction.type === "deposit" ||
        (transaction.type === "transfer" &&
          (transaction.destinationId === account.id || transaction.destinationName === name))
          ? 1
          : -1
      result[day] = (result[day] ?? 0) + transaction.amount * direction
      return result
    },
    {},
  )
  const activity = Object.entries(dailyMovement)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => Math.abs(value))
  const maximumActivity = Math.max(...activity, 0)

  return {
    id: account.id,
    name,
    type,
    detail:
      account.attributes.account_role ??
      (type === "cash"
        ? "Cash account"
        : type === "wallet"
          ? "Wallet"
          : type === "credit"
            ? "Liability account"
            : "Asset account"),
    balance: parseAmount(account.attributes.current_balance ?? account.attributes.balance),
    movement,
    currencySymbol: account.attributes.currency_symbol ?? "৳",
    activeLabel: account.attributes.active === false ? "Inactive" : "Active",
    bars:
      maximumActivity > 0 ? activity.map((value) => Math.max(0.08, value / maximumActivity)) : [],
  }
}

export function getMonthRange(month: Date) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const start = new Date(year, monthIndex, 1)
  const end = new Date(year, monthIndex + 1, 0)
  const format = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate(),
    ).padStart(2, "0")}`

  return { start: format(start), end: format(end) }
}

export function shiftMonth(month: Date, offset: number) {
  return new Date(month.getFullYear(), month.getMonth() + offset, 1)
}

export function groupTransactionsByDate(transactions: FlatTransaction[]) {
  return transactions.reduce<Record<string, FlatTransaction[]>>((result, transaction) => {
    const day = transaction.date.slice(0, 10)
    result[day] = [...(result[day] ?? []), transaction]
    return result
  }, {})
}

export function draftToStoreRequest(
  draft: TransactionDraft,
  isoDate: string,
): StoreTransactionRequest {
  return {
    error_if_duplicate_hash: false,
    apply_rules: true,
    fire_webhooks: true,
    transactions: [
      {
        type: draft.type,
        date: isoDate,
        amount: draft.amount.toFixed(2),
        description: draft.merchant,
        source_name: draft.account,
        destination_name: draft.merchant,
        category_name: draft.category,
        notes: draft.notes,
      },
    ],
  }
}
