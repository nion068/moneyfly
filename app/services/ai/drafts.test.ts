import {
  compatibleMoneyAgentAccounts,
  formatMoneyAgentDraftAmount,
  getMoneyAgentDraftType,
  reconcileMoneyAgentDraftAccounts,
} from "./drafts"
import type { MoneyAgentEntity, MoneyAgentTransactionDraft } from "./types"

const accounts: MoneyAgentEntity[] = [
  { id: "asset-1", name: "Checking", type: "asset" },
  { id: "asset-2", name: "Savings", type: "asset" },
  { id: "expense-1", name: "Groceries", type: "expense" },
  { id: "revenue-1", name: "Salary", type: "revenue" },
]

const draft: MoneyAgentTransactionDraft = {
  id: "draft-1",
  type: "withdrawal",
  amount: "1250",
  currencyCode: "BDT",
  date: "2026-06-07",
  description: "Test draft",
  sourceAccountId: "asset-1",
  destinationAccountId: "expense-1",
  categoryId: "category-1",
  budgetId: "budget-1",
  tagIds: ["tag-1"],
  newTags: [],
  notes: "Keep this",
  missingFields: [],
  status: "proposed",
}

describe("money agent draft helpers", () => {
  it.each([
    ["withdrawal", "Expense", "cash-minus", "-BDT 1,250"],
    ["deposit", "Income", "cash-plus", "+BDT 1,250"],
    ["transfer", "Transfer", "bank-transfer", "BDT 1,250"],
  ] as const)("presents %s drafts distinctly", (type, label, icon, amount) => {
    expect(getMoneyAgentDraftType(type)).toMatchObject({ label, icon })
    expect(formatMoneyAgentDraftAmount({ ...draft, type })).toBe(amount)
  })

  it("preserves compatible accounts and clears incompatible accounts on type changes", () => {
    const transfer = reconcileMoneyAgentDraftAccounts({ ...draft, type: "transfer" }, accounts)

    expect(transfer).toEqual({
      ...draft,
      type: "transfer",
      destinationAccountId: null,
      missingFields: ["destinationAccountId"],
    })
  })

  it("clears both expense endpoints when changing to income", () => {
    const income = reconcileMoneyAgentDraftAccounts({ ...draft, type: "deposit" }, accounts)

    expect(income.sourceAccountId).toBeNull()
    expect(income.destinationAccountId).toBeNull()
    expect(income.missingFields).toEqual(
      expect.arrayContaining(["sourceAccountId", "destinationAccountId"]),
    )
    expect(income).toMatchObject({
      amount: draft.amount,
      description: draft.description,
      date: draft.date,
      categoryId: draft.categoryId,
      budgetId: draft.budgetId,
      notes: draft.notes,
      tagIds: draft.tagIds,
      status: draft.status,
    })
  })

  it("filters endpoints by type and excludes the opposite transfer account", () => {
    const transfer = {
      ...draft,
      type: "transfer" as const,
      destinationAccountId: "asset-2",
    }

    expect(compatibleMoneyAgentAccounts(accounts, transfer, "source").map(({ id }) => id)).toEqual([
      "asset-1",
    ])
    expect(
      compatibleMoneyAgentAccounts(accounts, transfer, "destination").map(({ id }) => id),
    ).toEqual(["asset-2"])
  })

  it("does not allow a transfer to retain the same source and destination", () => {
    const transfer = reconcileMoneyAgentDraftAccounts(
      {
        ...draft,
        type: "transfer",
        sourceAccountId: "asset-1",
        destinationAccountId: "asset-1",
      },
      accounts,
    )

    expect(transfer.sourceAccountId).toBe("asset-1")
    expect(transfer.destinationAccountId).toBeNull()
    expect(transfer.missingFields).toContain("destinationAccountId")
  })
})
