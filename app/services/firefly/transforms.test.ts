import type { FireflyAccount, FireflyTransaction, TransactionDraft } from "@/models/firefly"
import { normalizeBaseUrl as normalizeApiBaseUrl } from "@/services/firefly/api"
import {
  accountToSummary,
  buildMonthlySummary,
  buildSummariesByCurrency,
  clampMonthToPresent,
  draftToStoreRequest,
  filterTransactions,
  findCashWalletName,
  flattenFireflyTransactions,
  formatDateKey,
  getTransactionIconName,
  getMonthRange,
  groupTransactionsByDate,
  isExpenseAccount,
  isOwnedAccount,
  isRevenueAccount,
  manualTransactionToStoreRequest,
  manualTransactionToUpdateRequest,
  shiftMonth,
} from "@/services/firefly/transforms"

const groupedTransactions: FireflyTransaction[] = [
  {
    id: "group-1",
    attributes: {
      transactions: [
        {
          transaction_journal_id: "journal-1",
          date: "2026-06-04T10:00:00+06:00",
          amount: "450.00",
          description: "KFC",
          type: "withdrawal",
          source_name: "bKash",
          destination_name: "KFC",
          category_name: "Food & Dining",
          tags: ["lunch"],
          currency_code: "BDT",
          currency_symbol: "৳",
        },
        {
          transaction_journal_id: "journal-2",
          date: "2026-06-04T09:00:00+06:00",
          amount: "5000.00",
          description: "Salary",
          type: "deposit",
          source_name: "Company",
          destination_name: "Bank",
          category_name: "Income",
          currency_code: "BDT",
          currency_symbol: "৳",
        },
      ],
    },
  },
]

describe("Firefly transforms", () => {
  it("flattens grouped Firefly transactions", () => {
    const transactions = flattenFireflyTransactions(groupedTransactions)

    expect(transactions).toHaveLength(2)
    expect(transactions[0]).toMatchObject({
      groupId: "group-1",
      journalId: "journal-1",
      amount: 450,
      categoryName: "Food & Dining",
      tags: ["lunch"],
    })
  })

  it("builds monthly summary from flat transactions", () => {
    const summary = buildMonthlySummary(flattenFireflyTransactions(groupedTransactions))

    expect(summary.totalIncome).toBe(5000)
    expect(summary.totalExpense).toBe(450)
    expect(summary.saved).toBe(4550)
    expect(summary.savingsRate).toBe(91)
  })

  it("keeps summaries separated by currency", () => {
    const transactions = flattenFireflyTransactions(groupedTransactions)
    transactions.push({
      ...transactions[0],
      groupId: "usd-group",
      journalId: "usd-journal",
      amount: 100,
      currencyCode: "USD",
      currencySymbol: "$",
    })

    expect(buildSummariesByCurrency(transactions)).toEqual([
      expect.objectContaining({
        currencyCode: "BDT",
        totalIncome: 5000,
        totalExpense: 450,
        transactionCount: 2,
      }),
      expect.objectContaining({
        currencyCode: "USD",
        totalIncome: 0,
        totalExpense: 100,
        transactionCount: 1,
      }),
    ])
  })

  it("derives account movement and activity from transaction account ids", () => {
    const transactions = flattenFireflyTransactions(groupedTransactions)
    transactions[0].sourceId = "account-1"
    transactions[1].destinationId = "account-1"
    const account: FireflyAccount = {
      id: "account-1",
      attributes: {
        name: "Bank",
        type: "asset",
        current_balance: "10000",
        currency_symbol: "৳",
        active: true,
      },
    }

    expect(accountToSummary(account, transactions)).toMatchObject({
      balance: 10000,
      movement: 4550,
      activeLabel: "Active",
    })
    expect(accountToSummary(account, transactions).bars).toHaveLength(1)
  })

  it("generates exact month ranges and shifts across years", () => {
    expect(getMonthRange(new Date(2024, 1, 1))).toEqual({
      start: "2024-02-01",
      end: "2024-02-29",
    })
    expect(shiftMonth(new Date(2025, 11, 1), 1)).toEqual(new Date(2026, 0, 1))
  })

  it("groups flattened transactions by calendar date", () => {
    expect(
      Object.keys(groupTransactionsByDate(flattenFireflyTransactions(groupedTransactions))),
    ).toEqual(["2026-06-04"])
  })

  it("resolves cash wallet by role before name fallback", () => {
    const accounts: FireflyAccount[] = [
      { id: "1", attributes: { name: "Main Bank", type: "asset" } },
      { id: "2", attributes: { name: "Pocket", type: "asset" } },
      { id: "3", attributes: { name: "Cash", type: "cash", account_role: "cashWallet" } },
    ]

    expect(findCashWalletName(accounts)).toBe("Cash")
  })

  it("maps AI draft into Firefly store transaction request", () => {
    const draft: TransactionDraft = {
      id: "draft-1",
      amount: 450,
      merchant: "KFC",
      category: "Food & Dining",
      account: "bKash",
      dateLabel: "Today",
      notes: "Lunch",
      confidence: 98,
      type: "withdrawal",
    }

    expect(draftToStoreRequest(draft, "2026-06-04T10:00:00+06:00")).toEqual({
      error_if_duplicate_hash: false,
      apply_rules: true,
      fire_webhooks: true,
      transactions: [
        {
          type: "withdrawal",
          date: "2026-06-04T10:00:00+06:00",
          amount: "450.00",
          description: "KFC",
          source_name: "bKash",
          destination_name: "KFC",
          category_name: "Food & Dining",
          notes: "Lunch",
        },
      ],
    })
  })

  it("normalizes Firefly base URL", () => {
    expect(normalizeApiBaseUrl("firefly.example.com")).toBe("https://firefly.example.com/")
    expect(normalizeApiBaseUrl("http://localhost:8080/")).toBe("http://localhost:8080/")
  })

  it("clamps future months and formats dates in local time", () => {
    const now = new Date(2026, 5, 6, 1, 30)

    expect(clampMonthToPresent(new Date(2027, 0, 1), now)).toEqual(new Date(2026, 5, 1))
    expect(clampMonthToPresent(new Date(2026, 3, 1), now)).toEqual(new Date(2026, 3, 1))
    expect(formatDateKey(now)).toBe("2026-06-06")
  })

  it("classifies active owned and counterparty accounts", () => {
    const owned: FireflyAccount = {
      id: "asset",
      attributes: { name: "Cash wallet", type: "cash", active: true },
    }
    const expense: FireflyAccount = {
      id: "expense",
      attributes: { name: "Groceries", type: "expense", active: true },
    }
    const revenue: FireflyAccount = {
      id: "revenue",
      attributes: { name: "Salary", type: "revenue", active: true },
    }

    expect(isOwnedAccount(owned)).toBe(true)
    expect(isExpenseAccount(expense)).toBe(true)
    expect(isRevenueAccount(revenue)).toBe(true)
    expect(isOwnedAccount(expense)).toBe(false)
  })

  it("combines type, search, category, account, and date filters", () => {
    const transactions = flattenFireflyTransactions(groupedTransactions)
    transactions[0].sourceId = "wallet"
    const wallet: FireflyAccount = {
      id: "wallet",
      attributes: { name: "bKash", type: "asset" },
    }

    expect(
      filterTransactions(transactions, {
        type: "withdrawal",
        search: "lunch",
        categoryNames: ["Food & Dining"],
        accounts: [wallet],
        startDate: "2026-06-04",
        endDate: "2026-06-04",
      }),
    ).toEqual([transactions[0]])
    expect(
      filterTransactions(transactions, {
        type: "withdrawal",
        search: "",
        categoryNames: [],
        accounts: [wallet],
        startDate: "2026-06-05",
      }),
    ).toEqual([])
  })

  it("maps categories to meaningful icons with type fallbacks", () => {
    expect(getTransactionIconName({ type: "withdrawal", categoryName: "Food & Dining" })).toBe(
      "silverware-fork-knife",
    )
    expect(getTransactionIconName({ type: "transfer" })).toBe("swap-horizontal")
    expect(getTransactionIconName({ type: "deposit" })).toBe("arrow-down-left")
  })

  it("builds a manual Firefly request with account ids", () => {
    expect(
      manualTransactionToStoreRequest({
        type: "withdrawal",
        date: new Date(2026, 5, 6, 14, 5),
        amount: 250,
        description: "Lunch",
        sourceAccountId: "asset-1",
        destinationAccountId: "expense-1",
        categoryName: "Food",
        tags: ["work"],
        notes: "Team lunch",
      }),
    ).toEqual({
      error_if_duplicate_hash: false,
      apply_rules: true,
      fire_webhooks: true,
      transactions: [
        {
          type: "withdrawal",
          date: "2026-06-06T14:05:00",
          amount: "250.00",
          description: "Lunch",
          source_id: "asset-1",
          destination_id: "expense-1",
          category_name: "Food",
          tags: ["work"],
          notes: "Team lunch",
        },
      ],
    })
  })

  it("builds a safe update request with the existing journal id", () => {
    expect(
      manualTransactionToUpdateRequest(
        {
          type: "withdrawal",
          date: new Date(2026, 5, 6, 14, 5),
          amount: 300,
          description: "Updated lunch",
          sourceAccountId: "asset-1",
          destinationAccountId: "expense-1",
          categoryName: "Food",
          tags: [],
        },
        "journal-1",
      ),
    ).toEqual({
      apply_rules: true,
      fire_webhooks: true,
      transactions: [
        {
          transaction_journal_id: "journal-1",
          type: "withdrawal",
          date: "2026-06-06T14:05:00",
          amount: "300.00",
          description: "Updated lunch",
          source_id: "asset-1",
          destination_id: "expense-1",
          category_name: "Food",
          tags: undefined,
          notes: undefined,
        },
      ],
    })
  })
})
