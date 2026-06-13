import { act, render, waitFor } from "@testing-library/react-native"

import { FireflyProvider, useFirefly } from "./FireflyContext"

const mockGetAccounts = jest.fn()
const mockGetCurrencies = jest.fn()
const mockGetTransactions = jest.fn()
const mockGetCategories = jest.fn()
const mockGetBudgets = jest.fn()
const mockGetTags = jest.fn()
const mockGetCurrentUser = jest.fn()
const mockDeleteTransaction = jest.fn()
const mockCreateAccount = jest.fn()
const mockUpdateAccount = jest.fn()

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
    getTags: mockGetTags,
    getCurrentUser: mockGetCurrentUser,
    deleteTransaction: mockDeleteTransaction,
    createAccount: mockCreateAccount,
    updateAccount: mockUpdateAccount,
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
    mockGetTags.mockResolvedValue(ok)
    mockGetCurrentUser.mockResolvedValue({
      kind: "ok",
      data: { id: "user-1", attributes: { email: "user@example.com" } },
    })
    mockDeleteTransaction.mockResolvedValue({ kind: "ok", data: true })
    mockCreateAccount.mockResolvedValue({
      kind: "ok",
      data: { id: "asset-1", attributes: { name: "Checking", type: "asset" } },
    })
    mockUpdateAccount.mockResolvedValue({
      kind: "ok",
      data: { id: "liability-1", attributes: { name: "Loan", type: "liability" } },
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
