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
  getAnalyticsRange,
  getTransactionIconName,
  getMonthRange,
  groupExpensesByAccount,
  groupTransactionsByDate,
  isExpenseAccount,
  isOwnedAccount,
  isRevenueAccount,
  isVisibleAccount,
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

  it("groups transactions by calendar date with each day ordered by time descending", () => {
    const transactions = flattenFireflyTransactions(groupedTransactions).reverse()
    const grouped = groupTransactionsByDate(transactions)

    expect(Object.keys(grouped)).toEqual(["2026-06-04"])
    expect(grouped["2026-06-04"].map((transaction) => transaction.journalId)).toEqual([
      "journal-1",
      "journal-2",
    ])
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

  it("hides only the generated cash account from account selectors", () => {
    const generatedCash: FireflyAccount = {
      id: "generated-cash",
      attributes: { name: " Cash Account ", type: "cash", active: true },
    }
    const cashWallet: FireflyAccount = {
      id: "cash-wallet",
      attributes: { name: "Cash wallet", type: "cash", active: true },
    }

    expect(isVisibleAccount(generatedCash)).toBe(false)
    expect(isOwnedAccount(generatedCash)).toBe(false)
    expect(isVisibleAccount(cashWallet)).toBe(true)
    expect(isOwnedAccount(cashWallet)).toBe(true)
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

describe("getAnalyticsRange", () => {
  it("month returns the same range as getMonthRange", () => {
    const anchor = new Date(2026, 5, 1) // June 2026
    expect(getAnalyticsRange(anchor, "month")).toEqual(getMonthRange(anchor))
  })

  it("quarter aligns to calendar quarter boundaries", () => {
    // Q2: April–June
    expect(getAnalyticsRange(new Date(2026, 4, 1), "quarter")).toEqual({
      start: "2026-04-01",
      end: "2026-06-30",
    })
    // Q1: January–March
    expect(getAnalyticsRange(new Date(2026, 0, 1), "quarter")).toEqual({
      start: "2026-01-01",
      end: "2026-03-31",
    })
    // Q3: July–September
    expect(getAnalyticsRange(new Date(2026, 6, 1), "quarter")).toEqual({
      start: "2026-07-01",
      end: "2026-09-30",
    })
    // Q4: October–December
    expect(getAnalyticsRange(new Date(2026, 9, 1), "quarter")).toEqual({
      start: "2026-10-01",
      end: "2026-12-31",
    })
  })

  it("year spans Jan 1 to Dec 31 of the anchor year", () => {
    expect(getAnalyticsRange(new Date(2025, 3, 1), "year")).toEqual({
      start: "2025-01-01",
      end: "2025-12-31",
    })
  })

  it("week returns the ISO week (Mon–Sun) containing the 1st of the anchor month", () => {
    // June 1 2026 is a Monday → week is Jun 1–Jun 7
    expect(getAnalyticsRange(new Date(2026, 5, 1), "week")).toEqual({
      start: "2026-06-01",
      end: "2026-06-07",
    })
    // March 1 2026 is a Sunday → Monday is Feb 23, Sunday is Mar 1
    expect(getAnalyticsRange(new Date(2026, 2, 1), "week")).toEqual({
      start: "2026-02-23",
      end: "2026-03-01",
    })
    // July 1 2026 is a Wednesday → Monday is Jun 29, Sunday is Jul 5
    expect(getAnalyticsRange(new Date(2026, 6, 1), "week")).toEqual({
      start: "2026-06-29",
      end: "2026-07-05",
    })
  })
})

describe("groupExpensesByAccount", () => {
  it("buckets withdrawal transactions by sourceName", () => {
    const transactions = flattenFireflyTransactions(groupedTransactions)
    // transactions[0] is withdrawal from bKash; transactions[1] is deposit (ignored)
    const result = groupExpensesByAccount(transactions)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      name: "bKash",
      amount: 450,
      percentage: 100,
    })
  })

  it("computes percentage relative to total expense", () => {
    const base = flattenFireflyTransactions(groupedTransactions)
    const extra = {
      ...base[0],
      journalId: "extra-1",
      sourceName: "Cash",
      amount: 550,
    }
    const result = groupExpensesByAccount([...base, extra])

    expect(result[0].name).toBe("Cash")
    expect(result[0].percentage).toBe(55)
    expect(result[1].name).toBe("bKash")
    expect(result[1].percentage).toBe(45)
  })

  it("returns empty array when there are no withdrawal transactions", () => {
    const transactions = flattenFireflyTransactions(groupedTransactions).filter(
      (t) => t.type !== "withdrawal",
    )
    expect(groupExpensesByAccount(transactions)).toEqual([])
  })
})
