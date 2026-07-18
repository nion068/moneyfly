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
    account_role?: string | null
    balance?: string
    current_balance?: string
    currency_code?: string
    currency_symbol?: string
    currency_decimal_places?: number
    account_number?: string | null
    opening_balance?: string | null
    opening_balance_date?: string | null
    virtual_balance?: string | null
    include_net_worth?: boolean
    notes?: string | null
    liability_type?: LiabilityType | null
    liability_direction?: LiabilityDirection | null
    interest?: string | null
    interest_period?: InterestPeriod | null
    credit_card_type?: CreditCardType | null
    monthly_payment_date?: string | null
  }
}

export type AccountType = "asset" | "expense" | "revenue" | "liability"
export type AccountRole =
  | "defaultAsset"
  | "sharedAsset"
  | "savingAsset"
  | "ccAsset"
  | "cashWalletAsset"
export type LiabilityType = "loan" | "debt" | "mortgage"
export type LiabilityDirection = "credit" | "debit"
export type InterestPeriod = "daily" | "weekly" | "monthly" | "quarterly" | "half-year" | "yearly"
export type CreditCardType = "monthlyFull"

export type StoreAccountRequest = {
  name: string
  type: AccountType
  currency_code?: string
  active: boolean
  account_number?: string | null
  opening_balance?: string | null
  opening_balance_date?: string | null
  account_role?: AccountRole | null
  virtual_balance?: string | null
  include_net_worth?: boolean
  notes?: string | null
  liability_type?: LiabilityType
  liability_direction?: LiabilityDirection
  interest?: string
  interest_period?: InterestPeriod
  credit_card_type?: CreditCardType | null
  monthly_payment_date?: string | null
}

export type FireflyCurrency = {
  id: string
  attributes: {
    code: string
    name: string
    symbol: string
    decimal_places?: number
    enabled?: boolean
    primary?: boolean
  }
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
    active?: boolean
    notes?: string | null
    currency_code?: string
    currency_symbol?: string
    currency_decimal_places?: number
    auto_budget_type?: AutoBudgetType | null
    auto_budget_period?: AutoBudgetPeriod | null
    auto_budget_amount?: string | null
    spent?: FireflyCurrencySum[]
    pc_spent?: FireflyCurrencySum[]
  }
}

export type FireflyBudgetLimit = {
  id: string
  attributes: {
    start: string
    end: string
    budget_id: string
    currency_code?: string
    currency_symbol?: string
    currency_decimal_places?: number
    amount: string
    pc_amount?: string | null
    period?: AutoBudgetPeriod | null
    spent?: FireflyCurrencySum[]
    pc_spent?: FireflyCurrencySum[]
    notes?: string | null
  }
}

export type FireflyCurrencySum = {
  currency_id?: string
  currency_code?: string
  currency_symbol?: string
  currency_decimal_places?: number
  sum: string
}

export type AutoBudgetType = "reset" | "rollover" | "adjusted" | "none"
export type AutoBudgetPeriod = "daily" | "weekly" | "monthly" | "quarterly" | "half-year" | "yearly"

export type StoreBudgetRequest = {
  name: string
  active: boolean
  notes?: string | null
  fire_webhooks: boolean
  auto_budget_type?: AutoBudgetType | null
  auto_budget_currency_code?: string | null
  auto_budget_amount?: string | null
  auto_budget_period?: AutoBudgetPeriod | null
}

export type UpdateBudgetRequest = StoreBudgetRequest

export type StoreBudgetLimitRequest = {
  budget_id: string
  currency_code?: string
  start: string
  end: string
  amount: string
  notes?: string | null
  fire_webhooks: boolean
}

export type UpdateBudgetLimitRequest = StoreBudgetLimitRequest

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
