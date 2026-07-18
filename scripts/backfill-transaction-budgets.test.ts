import {
  buildTransactionUpdateRequest,
  findWithdrawalSplitsWithoutBudget,
  FireflyTransaction,
  parseMonthRange,
  validateAssignments,
} from "./backfill-transaction-budgets"

describe("backfill transaction budgets script helpers", () => {
  it("parses a month into an inclusive Firefly date range", () => {
    expect(parseMonthRange("2026-07")).toEqual({
      start: "2026-07-01",
      end: "2026-07-31",
    })
    expect(parseMonthRange("2028-02")).toEqual({
      start: "2028-02-01",
      end: "2028-02-29",
    })
  })

  it("finds only withdrawal splits that have a journal ID and no budget", () => {
    const transactions: FireflyTransaction[] = [
      {
        id: "group-1",
        attributes: {
          transactions: [
            {
              transaction_journal_id: "journal-1",
              type: "withdrawal",
              date: "2026-07-03T12:00:00+06:00",
              amount: "120.00",
              description: "Bus fare",
            },
            {
              transaction_journal_id: "journal-2",
              type: "withdrawal",
              date: "2026-07-04T12:00:00+06:00",
              amount: "500.00",
              description: "Groceries",
              budget_id: "budget-food",
            },
            {
              transaction_journal_id: "journal-3",
              type: "deposit",
              date: "2026-07-05T12:00:00+06:00",
              amount: "1000.00",
              description: "Refund",
            },
            {
              type: "withdrawal",
              date: "2026-07-06T12:00:00+06:00",
              amount: "50.00",
              description: "No journal",
            },
          ],
        },
      },
    ]

    expect(findWithdrawalSplitsWithoutBudget(transactions)).toEqual([
      { group: transactions[0], split: transactions[0].attributes.transactions[0] },
    ])
  })

  it("validates Gemini assignments against known budgets and journal IDs", () => {
    expect(
      validateAssignments(
        {
          assignments: [
            { transactionJournalId: "journal-1", budgetId: "budget-food", reason: "Food shop" },
            { transactionJournalId: "journal-2", budgetId: null, reason: "No match" },
            { transactionJournalId: "journal-3", budgetId: "budget-food", reason: "Unknown tx" },
            { transactionJournalId: "journal-1", budgetId: "budget-missing", reason: "Bad ID" },
          ],
        },
        new Set(["budget-food"]),
        new Set(["journal-1", "journal-2"]),
      ),
    ).toEqual([
      { transactionJournalId: "journal-1", budgetId: "budget-food", reason: "Food shop" },
      { transactionJournalId: "journal-2", budgetId: null, reason: "No match" },
    ])
  })

  it("builds a group update payload while preserving existing split fields", () => {
    const group: FireflyTransaction = {
      id: "group-1",
      attributes: {
        group_title: "Split shopping",
        transactions: [
          {
            transaction_journal_id: "journal-1",
            type: "withdrawal",
            date: "2026-07-03T12:00:00+06:00",
            amount: "120.00",
            description: "Bus fare",
            source_id: "asset-1",
            source_name: "Cash",
            destination_name: "Bus company",
            category_id: "category-transport",
            category_name: "Transport",
            tags: ["commute"],
            notes: "office",
          },
          {
            transaction_journal_id: "journal-2",
            type: "withdrawal",
            date: "2026-07-03T12:00:00+06:00",
            amount: "500.00",
            description: "Groceries",
            source_id: "asset-1",
            destination_id: "expense-1",
            category_name: "Food",
            budget_id: "budget-old",
          },
        ],
      },
    }

    expect(
      buildTransactionUpdateRequest(group, new Map([["journal-1", "budget-transport"]])),
    ).toEqual({
      apply_rules: false,
      fire_webhooks: true,
      group_title: "Split shopping",
      transactions: [
        {
          transaction_journal_id: "journal-1",
          type: "withdrawal",
          date: "2026-07-03T12:00:00+06:00",
          amount: "120.00",
          description: "Bus fare",
          source_id: "asset-1",
          destination_name: "Bus company",
          category_id: "category-transport",
          budget_id: "budget-transport",
          tags: ["commute"],
          notes: "office",
        },
        {
          transaction_journal_id: "journal-2",
          type: "withdrawal",
          date: "2026-07-03T12:00:00+06:00",
          amount: "500.00",
          description: "Groceries",
          source_id: "asset-1",
          destination_id: "expense-1",
          category_name: "Food",
          budget_id: "budget-old",
        },
      ],
    })
  })
})
