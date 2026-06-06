import { act, render, waitFor } from "@testing-library/react-native"

import { FireflyProvider, useFirefly } from "./FireflyContext"

const mockGetAccounts = jest.fn()
const mockGetTransactions = jest.fn()
const mockGetCategories = jest.fn()
const mockGetBudgets = jest.fn()
const mockGetTags = jest.fn()

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
    getTransactions: mockGetTransactions,
    getCategories: mockGetCategories,
    getBudgets: mockGetBudgets,
    getTags: mockGetTags,
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
    mockGetTransactions.mockResolvedValue(ok)
    mockGetCategories.mockResolvedValue(ok)
    mockGetBudgets.mockResolvedValue(ok)
    mockGetTags.mockResolvedValue(ok)
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
})
