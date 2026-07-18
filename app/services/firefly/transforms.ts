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
import { formatDisplayNumber, roundToTwoDecimals } from "@/utils/numbers"

const categoryColors = ["#ff7a1a", "#a548f5", "#86cdea", "#9a958d", "#d87162", "#ded8ce"]

export function parseAmount(value?: string | number) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatMoney(amount: number, symbol = "৳") {
  const sign = amount < 0 ? "-" : ""
  return `${sign}${symbol} ${formatDisplayNumber(Math.abs(amount))}`
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
      budgetId: split.budget_id ?? undefined,
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
  const savingsRate = totalIncome > 0 ? roundToTwoDecimals((saved / totalIncome) * 100) : 0

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
        percentage: totalExpense > 0 ? roundToTwoDecimals((amount / totalExpense) * 100) : 0,
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
        percentage: totalExpense > 0 ? roundToTwoDecimals((amount / totalExpense) * 100) : 0,
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

export function isVisibleAccount(account: FireflyAccount) {
  return account.attributes.name.trim().toLowerCase() !== "cash account"
}

export type AccountGroup = "asset" | "expense" | "revenue" | "liability"

export function accountGroupFor(account: FireflyAccount): AccountGroup | null {
  if (!isVisibleAccount(account)) return null

  const type = account.attributes.type.toLowerCase()
  if (
    type.includes("initial balance") ||
    type.includes("reconciliation") ||
    type.includes("import")
  ) {
    return null
  }
  if (type.includes("expense") || type.includes("beneficiary")) return "expense"
  if (type.includes("revenue")) return "revenue"
  if (
    type.includes("liabil") ||
    type.includes("debt") ||
    type.includes("loan") ||
    type.includes("mortgage")
  ) {
    return "liability"
  }
  if (type.includes("asset") || type.includes("cash") || type.includes("default")) return "asset"
  return null
}

export function accountWritableType(account: FireflyAccount) {
  const type = account.attributes.type.toLowerCase()
  if (type.includes("cash")) return "cash"
  if (type.includes("expense") || type.includes("beneficiary")) return "expense"
  if (type.includes("revenue")) return "revenue"
  if (
    type.includes("liabil") ||
    type.includes("loan") ||
    type.includes("debt") ||
    type.includes("mortgage")
  ) {
    return "liability"
  }
  return "asset"
}

export function isOwnedAccount(account: FireflyAccount) {
  const type = account.attributes.type.toLowerCase()
  return (
    isVisibleAccount(account) &&
    account.attributes.active !== false &&
    (type.includes("asset") || type.includes("cash") || type.includes("liabilit"))
  )
}

export function isExpenseAccount(account: FireflyAccount) {
  return (
    isVisibleAccount(account) &&
    account.attributes.active !== false &&
    account.attributes.type.toLowerCase().includes("expense")
  )
}

export function isRevenueAccount(account: FireflyAccount) {
  return (
    isVisibleAccount(account) &&
    account.attributes.active !== false &&
    account.attributes.type.toLowerCase().includes("revenue")
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
export type BudgetPeriod = "month" | "quarter" | "year"

export type AnalyticsBucket = {
  key: string
  label: string
  start: string
  end: string
}

export type AnalyticsTrendPoint = AnalyticsBucket & {
  income: number
  expense: number
  netSavings: number
}

const formatDateOnly = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`

const parseDateOnly = (value: string) => new Date(`${value}T12:00:00`)

export function getMonthRange(month: Date) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const start = new Date(year, monthIndex, 1)
  const end = new Date(year, monthIndex + 1, 0)

  return { start: formatDateOnly(start), end: formatDateOnly(end) }
}

export function getAnalyticsRange(anchor: Date, period: AnalyticsPeriod) {
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
    return { start: formatDateOnly(monday), end: formatDateOnly(sunday) }
  }

  if (period === "quarter") {
    const quarterStart = Math.floor(monthIndex / 3) * 3
    const start = new Date(year, quarterStart, 1)
    const end = new Date(year, quarterStart + 3, 0)
    return { start: formatDateOnly(start), end: formatDateOnly(end) }
  }

  // year
  return {
    start: formatDateOnly(new Date(year, 0, 1)),
    end: formatDateOnly(new Date(year, 11, 31)),
  }
}

export function getBudgetRange(anchor: Date, period: BudgetPeriod) {
  const year = anchor.getFullYear()
  const monthIndex = anchor.getMonth()

  if (period === "month") return getMonthRange(anchor)

  if (period === "quarter") {
    const quarterStart = Math.floor(monthIndex / 3) * 3
    return {
      start: formatDateOnly(new Date(year, quarterStart, 1)),
      end: formatDateOnly(new Date(year, quarterStart + 3, 0)),
    }
  }

  return {
    start: formatDateOnly(new Date(year, 0, 1)),
    end: formatDateOnly(new Date(year, 11, 31)),
  }
}

export function shiftBudgetPeriod(anchor: Date, period: BudgetPeriod, offset: number) {
  if (period === "month") return new Date(anchor.getFullYear(), anchor.getMonth() + offset, 1)
  if (period === "quarter") {
    const quarterStart = Math.floor(anchor.getMonth() / 3) * 3
    return new Date(anchor.getFullYear(), quarterStart + offset * 3, 1)
  }
  return new Date(anchor.getFullYear() + offset, 0, 1)
}

export function startOfBudgetPeriod(anchor: Date, period: BudgetPeriod) {
  const range = getBudgetRange(anchor, period)
  return parseDateOnly(range.start)
}

export function formatBudgetPeriodLabel(anchor: Date, period: BudgetPeriod) {
  const start = startOfBudgetPeriod(anchor, period)
  if (period === "month") {
    return start.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  }
  if (period === "quarter") {
    return `Q${Math.floor(start.getMonth() / 3) + 1} ${start.getFullYear()}`
  }
  return String(start.getFullYear())
}

export function getAnalyticsBuckets(anchor: Date, period: AnalyticsPeriod): AnalyticsBucket[] {
  const currentRange = getAnalyticsRange(anchor, period)

  return Array.from({ length: 6 }, (_, index) => {
    const offset = index - 5
    let bucketAnchor: Date

    if (period === "week") {
      const currentStart = parseDateOnly(currentRange.start)
      bucketAnchor = new Date(
        currentStart.getFullYear(),
        currentStart.getMonth(),
        currentStart.getDate() + offset * 7,
      )
    } else if (period === "month") {
      bucketAnchor = new Date(anchor.getFullYear(), anchor.getMonth() + offset, 1)
    } else if (period === "quarter") {
      const quarterStart = Math.floor(anchor.getMonth() / 3) * 3
      bucketAnchor = new Date(anchor.getFullYear(), quarterStart + offset * 3, 1)
    } else {
      bucketAnchor = new Date(anchor.getFullYear() + offset, 0, 1)
    }

    const range =
      period === "week"
        ? {
            start: formatDateOnly(bucketAnchor),
            end: formatDateOnly(
              new Date(
                bucketAnchor.getFullYear(),
                bucketAnchor.getMonth(),
                bucketAnchor.getDate() + 6,
              ),
            ),
          }
        : getAnalyticsRange(bucketAnchor, period)
    const startDate = parseDateOnly(range.start)
    const label =
      period === "week"
        ? startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : period === "month"
          ? startDate.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
          : period === "quarter"
            ? `Q${Math.floor(startDate.getMonth() / 3) + 1} ${String(startDate.getFullYear()).slice(
                -2,
              )}`
            : String(startDate.getFullYear())

    return {
      key: `${period}-${range.start}`,
      label,
      ...range,
    }
  })
}

export function getAnalyticsWindow(anchor: Date, period: AnalyticsPeriod) {
  const buckets = getAnalyticsBuckets(anchor, period)
  return {
    start: buckets[0].start,
    end: buckets[buckets.length - 1].end,
  }
}

export function buildAnalyticsTrend(
  transactions: FlatTransaction[],
  buckets: AnalyticsBucket[],
): AnalyticsTrendPoint[] {
  return buckets.map((bucket) => {
    const bucketTransactions = transactions.filter((transaction) => {
      const date = transaction.date.slice(0, 10)
      return date >= bucket.start && date <= bucket.end
    })
    const summary = buildMonthlySummary(bucketTransactions)

    return {
      ...bucket,
      income: summary.totalIncome,
      expense: summary.totalExpense,
      netSavings: summary.saved,
    }
  })
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

export function filterTransactionsByCategoryNames(
  transactions: FlatTransaction[],
  categoryNames: string[],
) {
  if (categoryNames.length === 0) return transactions

  return transactions.filter((transaction) =>
    categoryNames.includes(transaction.categoryName ?? "Uncategorized"),
  )
}

export type LocalTransactionFilters = {
  type: "all" | TransactionType
  search: string
  categoryNames: string[]
  budgetIds?: string[]
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
    if (filters.budgetIds?.length && !transaction.budgetId) return false
    if (
      filters.budgetIds?.length &&
      transaction.budgetId &&
      !filters.budgetIds.includes(transaction.budgetId)
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
        budget_id: input.budgetId || undefined,
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
      budget_id: input.type === "withdrawal" ? input.budgetId || null : undefined,
    })),
  }
}
