import { act, render, waitFor } from "@testing-library/react-native"

import { FireflyProvider, useFirefly } from "./FireflyContext"

const mockGetAccounts = jest.fn()
const mockGetCurrencies = jest.fn()
const mockGetTransactions = jest.fn()
const mockGetCategories = jest.fn()
const mockGetBudgets = jest.fn()
const mockGetBudgetLimits = jest.fn()
const mockGetTags = jest.fn()
const mockGetCurrentUser = jest.fn()
const mockDeleteTransaction = jest.fn()
const mockCreateAccount = jest.fn()
const mockUpdateAccount = jest.fn()
const mockCreateBudget = jest.fn()
const mockUpdateBudget = jest.fn()
const mockDeleteBudget = jest.fn()
const mockCreateBudgetLimit = jest.fn()
const mockUpdateBudgetLimit = jest.fn()

jest.mock("react-native-mmkv", () => ({
  useMMKVString: (key: string) => {
    const values: Record<string, string | undefined> = {
      "Firefly.baseUrl": "https://firefly.example.com",
      "Firefly.token": "token",
    }
    return [values[key], jest.fn()]
  },
}))

jest.mock("@/services/firefly/api", () => ({
  FireflyApi: jest.fn().mockImplementation(() => ({
    getAccounts: mockGetAccounts,
    getCurrencies: mockGetCurrencies,
    getTransactions: mockGetTransactions,
    getCategories: mockGetCategories,
    getBudgets: mockGetBudgets,
    getBudgetLimits: mockGetBudgetLimits,
    getTags: mockGetTags,
    getCurrentUser: mockGetCurrentUser,
    deleteTransaction: mockDeleteTransaction,
    createAccount: mockCreateAccount,
    updateAccount: mockUpdateAccount,
    createBudget: mockCreateBudget,
    updateBudget: mockUpdateBudget,
    deleteBudget: mockDeleteBudget,
    createBudgetLimit: mockCreateBudgetLimit,
    updateBudgetLimit: mockUpdateBudgetLimit,
  })),
  normalizeBaseUrl: (value: string) => value,
}))

type FireflyValue = ReturnType<typeof useFirefly>

let latestContext: FireflyValue

function ContextProbe() {
  latestContext = useFirefly()
  return null
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

const ok = { kind: "ok" as const, data: [] }

describe("FireflyProvider month loading", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAccounts.mockResolvedValue(ok)
    mockGetCurrencies.mockResolvedValue(ok)
    mockGetTransactions.mockResolvedValue(ok)
    mockGetCategories.mockResolvedValue(ok)
    mockGetBudgets.mockResolvedValue(ok)
    mockGetBudgetLimits.mockResolvedValue(ok)
    mockGetTags.mockResolvedValue(ok)
    mockGetCurrentUser.mockResolvedValue({
      kind: "ok",
      data: { id: "user-1", attributes: { email: "user@example.com" } },
    })
    mockDeleteTransaction.mockResolvedValue({ kind: "ok", data: true })
    mockDeleteBudget.mockResolvedValue({ kind: "ok", data: true })
    mockCreateAccount.mockResolvedValue({
      kind: "ok",
      data: { id: "asset-1", attributes: { name: "Checking", type: "asset" } },
    })
    mockUpdateAccount.mockResolvedValue({
      kind: "ok",
      data: { id: "liability-1", attributes: { name: "Loan", type: "liability" } },
    })
    mockCreateBudget.mockResolvedValue({
      kind: "ok",
      data: { id: "budget-1", attributes: { name: "Food" } },
    })
    mockUpdateBudget.mockResolvedValue({
      kind: "ok",
      data: { id: "budget-1", attributes: { name: "Groceries" } },
    })
    mockCreateBudgetLimit.mockResolvedValue({
      kind: "ok",
      data: { id: "limit-1", attributes: { budget_id: "budget-1" } },
    })
    mockUpdateBudgetLimit.mockResolvedValue({
      kind: "ok",
      data: { id: "limit-1", attributes: { budget_id: "budget-1" } },
    })
  })

  it("sets month loading immediately and clears it after the month request", async () => {
    render(
      <FireflyProvider>
        <ContextProbe />
      </FireflyProvider>,
    )
    await waitFor(() => expect(latestContext.transactions.status).toBe("ready"))

    const monthRequest = deferred<typeof ok>()
    mockGetTransactions.mockReturnValueOnce(monthRequest.promise)

    act(() => latestContext.previousMonth())
    expect(latestContext.isMonthLoading).toBe(true)

    await act(async () => monthRequest.resolve(ok))
    await waitFor(() => expect(latestContext.isMonthLoading).toBe(false))
  })

  it("loads only enabled currencies and keeps primary metadata", async () => {
    mockGetCurrencies.mockResolvedValueOnce({
      kind: "ok",
      data: [
        {
          id: "eur",
          attributes: {
            code: "EUR",
            name: "Euro",
            symbol: "€",
            enabled: true,
            primary: true,
          },
        },
        {
          id: "old",
          attributes: {
            code: "OLD",
            name: "Disabled",
            symbol: "O",
            enabled: false,
            primary: false,
          },
        },
      ],
    })

    render(
      <FireflyProvider>
        <ContextProbe />
      </FireflyProvider>,
    )

    await waitFor(() => expect(latestContext.currencies.status).toBe("ready"))
    expect(latestContext.currencies.data).toEqual([
      expect.objectContaining({
        id: "eur",
        attributes: expect.objectContaining({ code: "EUR", primary: true }),
      }),
    ])
  })

  it("passes expanded account create and update payloads to the API", async () => {
    render(
      <FireflyProvider>
        <ContextProbe />
      </FireflyProvider>,
    )
    await waitFor(() => expect(latestContext.accounts.status).toBe("ready"))

    const assetRequest = {
      name: "Checking",
      type: "asset" as const,
      currency_code: "EUR",
      active: true,
      account_role: "defaultAsset" as const,
      opening_balance: "100",
      opening_balance_date: "2026-02-03T00:00:00.000Z",
      virtual_balance: null,
      include_net_worth: true,
      notes: null,
    }
    const liabilityRequest = {
      name: "Loan",
      type: "liability" as const,
      currency_code: "USD",
      active: true,
      opening_balance: "5000",
      opening_balance_date: "2026-02-03T00:00:00.000Z",
      liability_type: "loan" as const,
      liability_direction: "debit" as const,
      interest: "3.5",
      interest_period: "monthly" as const,
    }

    await act(async () => {
      await latestContext.saveAccount(assetRequest)
      await latestContext.saveAccount(liabilityRequest, "liability-1")
    })

    expect(mockCreateAccount).toHaveBeenCalledWith(assetRequest)
    expect(mockUpdateAccount).toHaveBeenCalledWith("liability-1", liabilityRequest)
  })

  it("loads budgets and limits for the selected budget period", async () => {
    render(
      <FireflyProvider>
        <ContextProbe />
      </FireflyProvider>,
    )

    await waitFor(() => expect(latestContext.budgets.status).toBe("ready"))
    expect(mockGetBudgets).toHaveBeenCalledWith(
      expect.objectContaining({ start: expect.any(String), end: expect.any(String) }),
    )
    expect(mockGetBudgetLimits).toHaveBeenCalledWith(
      expect.objectContaining({ start: expect.any(String), end: expect.any(String) }),
    )

    act(() => latestContext.setSelectedBudgetPeriod("quarter"))

    await waitFor(() =>
      expect(mockGetBudgets).toHaveBeenLastCalledWith(
        expect.objectContaining({ start: expect.any(String), end: expect.any(String) }),
      ),
    )
    expect(latestContext.selectedBudgetPeriod).toBe("quarter")
  })

  it("creates a budget and its limit through the context", async () => {
    render(
      <FireflyProvider>
        <ContextProbe />
      </FireflyProvider>,
    )
    await waitFor(() => expect(latestContext.budgets.status).toBe("ready"))

    let saved = false
    await act(async () => {
      saved = await latestContext.saveBudgetWithLimit(
        {
          name: "Food",
          active: true,
          notes: null,
          fire_webhooks: true,
          auto_budget_type: "reset",
          auto_budget_currency_code: "USD",
          auto_budget_amount: "500.00",
          auto_budget_period: "monthly",
        },
        {
          currency_code: "USD",
          start: "2026-07-01",
          end: "2026-07-31",
          amount: "500.00",
          notes: null,
          fire_webhooks: true,
        },
      )
    })

    expect(saved).toBe(true)
    expect(mockCreateBudget).toHaveBeenCalledWith({
      name: "Food",
      active: true,
      notes: null,
      fire_webhooks: true,
      auto_budget_type: "reset",
      auto_budget_currency_code: "USD",
      auto_budget_amount: "500.00",
      auto_budget_period: "monthly",
    })
    expect(mockCreateBudgetLimit).toHaveBeenCalledWith("budget-1", {
      budget_id: "budget-1",
      currency_code: "USD",
      start: "2026-07-01",
      end: "2026-07-31",
      amount: "500.00",
      notes: null,
      fire_webhooks: true,
    })
  })

  it("updates an existing budget and selected limit through the context", async () => {
    render(
      <FireflyProvider>
        <ContextProbe />
      </FireflyProvider>,
    )
    await waitFor(() => expect(latestContext.budgets.status).toBe("ready"))

    let saved = false
    await act(async () => {
      saved = await latestContext.saveBudgetWithLimit(
        {
          name: "Groceries",
          active: true,
          notes: "Weekly food",
          fire_webhooks: true,
          auto_budget_type: "adjusted",
          auto_budget_currency_code: "USD",
          auto_budget_amount: "650.00",
          auto_budget_period: "monthly",
        },
        {
          currency_code: "USD",
          start: "2026-07-01",
          end: "2026-07-31",
          amount: "650.00",
          notes: "Weekly food",
          fire_webhooks: true,
        },
        { id: "budget-1", attributes: { name: "Food" } },
        {
          id: "limit-1",
          attributes: {
            budget_id: "budget-1",
            start: "2026-07-01",
            end: "2026-07-31",
            amount: "500.00",
          },
        },
      )
    })

    expect(saved).toBe(true)
    expect(mockUpdateBudget).toHaveBeenCalledWith("budget-1", {
      name: "Groceries",
      active: true,
      notes: "Weekly food",
      fire_webhooks: true,
      auto_budget_type: "adjusted",
      auto_budget_currency_code: "USD",
      auto_budget_amount: "650.00",
      auto_budget_period: "monthly",
    })
    expect(mockUpdateBudgetLimit).toHaveBeenCalledWith("budget-1", "limit-1", {
      budget_id: "budget-1",
      currency_code: "USD",
      start: "2026-07-01",
      end: "2026-07-31",
      amount: "650.00",
      notes: "Weekly food",
      fire_webhooks: true,
    })
  })

  it("creates a limit when editing a budget without a selected limit", async () => {
    mockUpdateBudget.mockResolvedValueOnce({
      kind: "ok",
      data: { id: "budget-2", attributes: { name: "Rent" } },
    })
    render(
      <FireflyProvider>
        <ContextProbe />
      </FireflyProvider>,
    )
    await waitFor(() => expect(latestContext.budgets.status).toBe("ready"))

    let saved = false
    await act(async () => {
      saved = await latestContext.saveBudgetWithLimit(
        {
          name: "Rent",
          active: true,
          notes: null,
          fire_webhooks: true,
        },
        {
          currency_code: "USD",
          start: "2026-07-01",
          end: "2026-07-31",
          amount: "1200.00",
          notes: null,
          fire_webhooks: true,
        },
        { id: "budget-2", attributes: { name: "Rent" } },
      )
    })

    expect(saved).toBe(true)
    expect(mockUpdateBudget).toHaveBeenCalledWith("budget-2", {
      name: "Rent",
      active: true,
      notes: null,
      fire_webhooks: true,
    })
    expect(mockCreateBudgetLimit).toHaveBeenCalledWith("budget-2", {
      budget_id: "budget-2",
      currency_code: "USD",
      start: "2026-07-01",
      end: "2026-07-31",
      amount: "1200.00",
      notes: null,
      fire_webhooks: true,
    })
  })

  it("reports partial failure when the budget saves but the limit fails", async () => {
    mockUpdateBudgetLimit.mockResolvedValueOnce({
      kind: "server",
      message: "Request failed",
    })
    render(
      <FireflyProvider>
        <ContextProbe />
      </FireflyProvider>,
    )
    await waitFor(() => expect(latestContext.budgets.status).toBe("ready"))

    let saved = true
    await act(async () => {
      saved = await latestContext.saveBudgetWithLimit(
        {
          name: "Groceries",
          active: true,
          notes: null,
          fire_webhooks: true,
        },
        {
          currency_code: "USD",
          start: "2026-07-01",
          end: "2026-07-31",
          amount: "650.00",
          notes: null,
          fire_webhooks: true,
        },
        { id: "budget-1", attributes: { name: "Food" } },
        {
          id: "limit-1",
          attributes: {
            budget_id: "budget-1",
            start: "2026-07-01",
            end: "2026-07-31",
            amount: "500.00",
          },
        },
      )
    })

    expect(saved).toBe(false)
    expect(latestContext.budgetMutation.status).toBe("error")
    expect(latestContext.budgetMutation.error?.message).toBe(
      "Budget updated, but Firefly could not update the limit: Request failed",
    )
  })

  it("deletes a budget through the context", async () => {
    render(
      <FireflyProvider>
        <ContextProbe />
      </FireflyProvider>,
    )
    await waitFor(() => expect(latestContext.budgets.status).toBe("ready"))

    let deleted = false
    await act(async () => {
      deleted = await latestContext.deleteBudget("budget-1")
    })

    expect(deleted).toBe(true)
    expect(mockDeleteBudget).toHaveBeenCalledWith("budget-1")
    expect(latestContext.budgetMutation.status).toBe("ready")
  })

  it("keeps loading until the latest rapid month request finishes", async () => {
    render(
      <FireflyProvider>
        <ContextProbe />
      </FireflyProvider>,
    )
    await waitFor(() => expect(latestContext.transactions.status).toBe("ready"))

    const staleRequest = deferred<typeof ok>()
    const latestRequest = deferred<typeof ok>()
    mockGetTransactions
      .mockReturnValueOnce(staleRequest.promise)
      .mockReturnValueOnce(latestRequest.promise)

    act(() => latestContext.previousMonth())
    act(() => latestContext.previousMonth())

    await act(async () => staleRequest.resolve(ok))
    expect(latestContext.isMonthLoading).toBe(true)

    await act(async () => latestRequest.resolve(ok))
    await waitFor(() => expect(latestContext.isMonthLoading).toBe(false))
  })

  it("clears month loading when the month request fails", async () => {
    render(
      <FireflyProvider>
        <ContextProbe />
      </FireflyProvider>,
    )
    await waitFor(() => expect(latestContext.transactions.status).toBe("ready"))

    mockGetTransactions.mockResolvedValueOnce({
      kind: "server",
      message: "Request failed",
      status: 500,
    })

    act(() => latestContext.previousMonth())

    await waitFor(() => expect(latestContext.isMonthLoading).toBe(false))
    expect(latestContext.transactions.status).toBe("error")
  })

  it("removes every split in a deleted transaction group", async () => {
    mockGetTransactions.mockResolvedValueOnce({
      kind: "ok",
      data: [
        {
          id: "group-1",
          attributes: {
            transactions: [
              {
                transaction_journal_id: "journal-1",
                date: "2026-06-06T12:00:00",
                amount: "10.00",
                description: "Lunch",
                type: "withdrawal",
                source_name: "Checking",
                destination_name: "Food",
                currency_code: "USD",
                currency_symbol: "$",
              },
              {
                transaction_journal_id: "journal-2",
                date: "2026-06-06T12:00:00",
                amount: "5.00",
                description: "Coffee",
                type: "withdrawal",
                source_name: "Checking",
                destination_name: "Food",
                currency_code: "USD",
                currency_symbol: "$",
              },
            ],
          },
        },
      ],
    })

    render(
      <FireflyProvider>
        <ContextProbe />
      </FireflyProvider>,
    )
    await waitFor(() => expect(latestContext.transactions.data).toHaveLength(2))

    let deleted = false
    await act(async () => {
      deleted = await latestContext.deleteTransaction("group-1")
    })

    expect(deleted).toBe(true)
    expect(mockDeleteTransaction).toHaveBeenCalledWith("group-1")
    expect(latestContext.transactions.data).toEqual([])
    expect(latestContext.transactionDeletion.status).toBe("ready")
  })
})
