export type FireflyEnvelope<T> = {
  data: T[]
  meta?: {
    pagination?: {
      current_page?: number
      total_pages?: number
      per_page?: number
      count?: number
      total?: number
    }
  }
}

export type FireflySingleEnvelope<T> = {
  data: T
}

export type FireflyUser = {
  id: string
  attributes: {
    email?: string
    name?: string
  }
}

export type FireflyAccount = {
  id: string
  attributes: {
    name: string
    type: string
    active?: boolean
    account_role?: string
    balance?: string
    current_balance?: string
    currency_code?: string
    currency_symbol?: string
    currency_decimal_places?: number
  }
}

export type StoreAccountRequest = {
  name: string
  type: string
  currency_code: string
  active: boolean
}

export type StoreCategoryRequest = {
  name: string
}

export type StoreTagRequest = {
  tag: string
}

export type FireflyTransaction = {
  id: string
  attributes: {
    group_title?: string
    transactions: FireflyTransactionSplit[]
  }
}

export type FireflyTransactionSplit = {
  transaction_journal_id?: string
  date: string
  amount: string
  description: string
  type: TransactionType
  source_id?: string
  source_name?: string
  destination_id?: string
  destination_name?: string
  category_id?: string
  category_name?: string
  budget_id?: string
  budget_name?: string
  tags?: string[]
  notes?: string
  currency_code?: string
  currency_symbol?: string
}

export type FireflyCategory = {
  id: string
  attributes: {
    name: string
  }
}

export type FireflyBudget = {
  id: string
  attributes: {
    name: string
  }
}

export type FireflyTag = {
  id: string
  attributes: {
    tag: string
  }
}

export type TransactionType = "withdrawal" | "deposit" | "transfer"

export type ManualTransactionInput = {
  type: TransactionType
  date: Date
  amount: number
  description: string
  sourceAccountId: string
  destinationAccountId: string
  categoryName?: string
  tags: string[]
  notes?: string
}

export type FlatTransaction = {
  groupId: string
  journalId?: string
  date: string
  amount: number
  description: string
  type: TransactionType
  sourceId?: string
  sourceName: string
  destinationId?: string
  destinationName: string
  categoryName?: string
  budgetName?: string
  tags: string[]
  notes?: string
  currencyCode: string
  currencySymbol: string
}

export type MonthlySummary = {
  totalIncome: number
  totalExpense: number
  saved: number
  netBalance: number
  currencySymbol: string
  savingsRate: number
}

export type CurrencySummary = MonthlySummary & {
  currencyCode: string
  transactionCount: number
}

export type CategoryExpense = {
  name: string
  amount: number
  percentage: number
  color: string
  transactions: FlatTransaction[]
}

export type AccountSummary = {
  id: string
  name: string
  type: "bank" | "wallet" | "cash" | "credit"
  detail: string
  balance: number
  movement: number
  currencySymbol: string
  activeLabel: string
  bars: number[]
}

export type TransactionDraft = {
  id: string
  amount: number
  merchant: string
  category: string
  account: string
  dateLabel: string
  notes: string
  confidence: number
  type: TransactionType
}

export type StoreTransactionSplit = {
  transaction_journal_id?: string
  type: TransactionType
  date: string
  amount: string
  description: string
  source_name?: string
  source_id?: string
  destination_name?: string
  destination_id?: string
  category_id?: string
  category_name?: string
  budget_id?: string
  budget_name?: string
  tags?: string[]
  notes?: string
}

export type StoreTransactionRequest = {
  error_if_duplicate_hash: boolean
  apply_rules: boolean
  fire_webhooks: boolean
  transactions: StoreTransactionSplit[]
}

export type UpdateTransactionRequest = {
  apply_rules: boolean
  fire_webhooks: boolean
  transactions: StoreTransactionSplit[]
}
