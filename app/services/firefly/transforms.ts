import {
  AccountSummary,
  CategoryExpense,
  CurrencySummary,
  FireflyAccount,
  FireflyTransaction,
  FlatTransaction,
  ManualTransactionInput,
  MonthlySummary,
  StoreTransactionRequest,
  TransactionDraft,
  TransactionType,
  UpdateTransactionRequest,
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

export type AccountExpense = {
  name: string
  amount: number
  percentage: number
  color: string
  transactions: FlatTransaction[]
}

export function groupExpensesByAccount(transactions: FlatTransaction[]): AccountExpense[] {
  const expenses = transactions.filter((transaction) => transaction.type === "withdrawal")
  const totalExpense = expenses.reduce((total, transaction) => total + transaction.amount, 0)
  const grouped = expenses.reduce<Record<string, FlatTransaction[]>>((acc, transaction) => {
    const name = transaction.sourceName || "Unknown account"
    acc[name] = [...(acc[name] ?? []), transaction]
    return acc
  }, {})

  return Object.entries(grouped)
    .map(([name, accountTransactions], index) => {
      const amount = accountTransactions.reduce(
        (total, transaction) => total + transaction.amount,
        0,
      )
      return {
        name,
        amount,
        percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
        color: categoryColors[index % categoryColors.length],
        transactions: accountTransactions,
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

export function isOwnedAccount(account: FireflyAccount) {
  const type = account.attributes.type.toLowerCase()
  return (
    account.attributes.active !== false &&
    (type.includes("asset") || type.includes("cash") || type.includes("liabilit"))
  )
}

export function isExpenseAccount(account: FireflyAccount) {
  return (
    account.attributes.active !== false && account.attributes.type.toLowerCase().includes("expense")
  )
}

export function isRevenueAccount(account: FireflyAccount) {
  return (
    account.attributes.active !== false && account.attributes.type.toLowerCase().includes("revenue")
  )
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

export type AnalyticsPeriod = "week" | "month" | "quarter" | "year"

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

export function getAnalyticsRange(anchor: Date, period: AnalyticsPeriod) {
  const format = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate(),
    ).padStart(2, "0")}`

  const year = anchor.getFullYear()
  const monthIndex = anchor.getMonth()

  if (period === "month") {
    return getMonthRange(anchor)
  }

  if (period === "week") {
    // Use ISO week that contains the 1st of the anchor month
    const firstOfMonth = new Date(year, monthIndex, 1)
    // ISO week: Monday = 0 offset, Sunday = 6 offset
    const dayOfWeek = firstOfMonth.getDay() // 0 = Sun, 1 = Mon … 6 = Sat
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(year, monthIndex, 1 + mondayOffset)
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)
    return { start: format(monday), end: format(sunday) }
  }

  if (period === "quarter") {
    const quarterStart = Math.floor(monthIndex / 3) * 3
    const start = new Date(year, quarterStart, 1)
    const end = new Date(year, quarterStart + 3, 0)
    return { start: format(start), end: format(end) }
  }

  // year
  return { start: format(new Date(year, 0, 1)), end: format(new Date(year, 11, 31)) }
}

export function shiftMonth(month: Date, offset: number) {
  return new Date(month.getFullYear(), month.getMonth() + offset, 1)
}

export function startOfCurrentMonth(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

export function clampMonthToPresent(month: Date, now = new Date()) {
  const normalized = new Date(month.getFullYear(), month.getMonth(), 1)
  const currentMonth = startOfCurrentMonth(now)
  return normalized > currentMonth ? currentMonth : normalized
}

export function formatLocalDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:00`
}

export function formatDateKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function groupTransactionsByDate(transactions: FlatTransaction[]) {
  const grouped = transactions.reduce<Record<string, FlatTransaction[]>>((result, transaction) => {
    const day = transaction.date.slice(0, 10)
    result[day] = [...(result[day] ?? []), transaction]
    return result
  }, {})

  Object.values(grouped).forEach((dayTransactions) => {
    dayTransactions.sort(
      (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime(),
    )
  })

  return grouped
}

export type LocalTransactionFilters = {
  type: "all" | TransactionType
  search: string
  categoryNames: string[]
  accounts: FireflyAccount[]
  startDate?: string
  endDate?: string
}

export function filterTransactions(
  transactions: FlatTransaction[],
  filters: LocalTransactionFilters,
) {
  const query = filters.search.trim().toLowerCase()
  return transactions.filter((transaction) => {
    if (filters.type !== "all" && transaction.type !== filters.type) return false
    if (
      filters.categoryNames.length > 0 &&
      !filters.categoryNames.includes(transaction.categoryName ?? "Uncategorized")
    ) {
      return false
    }
    if (
      filters.accounts.length > 0 &&
      !filters.accounts.some(
        (account) =>
          transaction.sourceId === account.id ||
          transaction.destinationId === account.id ||
          transaction.sourceName === account.attributes.name ||
          transaction.destinationName === account.attributes.name,
      )
    ) {
      return false
    }
    const day = transaction.date.slice(0, 10)
    if (filters.startDate && day < filters.startDate) return false
    if (filters.endDate && day > filters.endDate) return false
    if (!query) return true
    return [
      transaction.description,
      transaction.categoryName,
      transaction.sourceName,
      transaction.destinationName,
      ...transaction.tags,
    ].some((value) => value?.toLowerCase().includes(query))
  })
}

export function getTransactionIconName(
  transaction: Pick<FlatTransaction, "categoryName" | "type">,
) {
  const category = transaction.categoryName?.toLowerCase() ?? ""
  if (transaction.type === "transfer") return "swap-horizontal"
  if (category.match(/food|dining|restaurant|lunch|grocery/)) return "silverware-fork-knife"
  if (category.match(/transport|travel|taxi|ride|car|fuel/)) return "car-outline"
  if (category.match(/shop|clothing|purchase/)) return "shopping-outline"
  if (category.match(/house|rent|mortgage|home/)) return "home-outline"
  if (category.match(/utilit|bill|electric|water|internet/)) return "receipt-text-outline"
  if (category.match(/health|medical|fitness|doctor/)) return "heart-pulse"
  if (category.match(/entertain|movie|game|music/)) return "movie-open-outline"
  if (category.match(/education|school|book|course/)) return "school-outline"
  if (category.match(/gift|donation/)) return "gift-outline"
  if (category.match(/salary|income|revenue/)) return "cash-plus"
  return transaction.type === "deposit" ? "arrow-down-left" : "arrow-up-right"
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

export function manualTransactionToStoreRequest(
  input: ManualTransactionInput,
): StoreTransactionRequest {
  return {
    error_if_duplicate_hash: false,
    apply_rules: true,
    fire_webhooks: true,
    transactions: [
      {
        type: input.type,
        date: formatLocalDateTime(input.date),
        amount: input.amount.toFixed(2),
        description: input.description.trim(),
        source_id: input.sourceAccountId,
        destination_id: input.destinationAccountId,
        category_name: input.categoryName?.trim() || undefined,
        tags: input.tags.length > 0 ? input.tags : undefined,
        notes: input.notes?.trim() || undefined,
      },
    ],
  }
}

export function manualTransactionToUpdateRequest(
  input: ManualTransactionInput,
  journalId: string,
): UpdateTransactionRequest {
  const request = manualTransactionToStoreRequest(input)

  return {
    apply_rules: request.apply_rules,
    fire_webhooks: request.fire_webhooks,
    transactions: request.transactions.map((transaction) => ({
      ...transaction,
      transaction_journal_id: journalId,
    })),
  }
}
