import {
  createContext,
  Dispatch,
  FC,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  SetStateAction,
} from "react"
import { useMMKVString } from "react-native-mmkv"

import {
  CurrencySummary,
  FireflyAccount,
  FireflyBudget,
  FireflyCategory,
  FireflyTag,
  FlatTransaction,
} from "@/models/firefly"
import { FireflyApi, FireflyProblem, normalizeBaseUrl } from "@/services/firefly/api"
import {
  buildSummariesByCurrency,
  flattenFireflyTransactions,
  getMonthRange,
  shiftMonth,
} from "@/services/firefly/transforms"

export type LoadState<T> = {
  data: T
  status: "idle" | "loading" | "ready" | "error"
  error?: FireflyProblem
}

type FireflyContextType = {
  isConfigured: boolean
  baseUrl: string
  token: string
  hideAmounts: boolean
  isTestingConnection: boolean
  connectionError?: string
  selectedMonth: Date
  accounts: LoadState<FireflyAccount[]>
  transactions: LoadState<FlatTransaction[]>
  categories: LoadState<FireflyCategory[]>
  budgets: LoadState<FireflyBudget[]>
  tags: LoadState<FireflyTag[]>
  summariesByCurrency: CurrencySummary[]
  selectedCurrency?: string
  isRefreshing: boolean
  lastSyncedAt?: Date
  setConnection: (baseUrl: string, token: string) => Promise<boolean>
  disconnect: () => void
  toggleHideAmounts: () => void
  refresh: () => Promise<void>
  previousMonth: () => void
  nextMonth: () => void
  setSelectedMonth: (month: Date) => void
  setSelectedCurrency: (currency: string) => void
}

const emptyState = <T,>(data: T): LoadState<T> => ({ data, status: "idle" })
const FireflyContext = createContext<FireflyContextType | null>(null)

export const FireflyProvider: FC<PropsWithChildren> = ({ children }) => {
  const [storedBaseUrl, setStoredBaseUrl] = useMMKVString("Firefly.baseUrl")
  const [storedToken, setStoredToken] = useMMKVString("Firefly.token")
  const [storedHideAmounts, setStoredHideAmounts] = useMMKVString("Firefly.hideAmounts")
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionError, setConnectionError] = useState<string>()
  const [selectedMonth, setSelectedMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  )
  const [accounts, setAccounts] = useState(() => emptyState<FireflyAccount[]>([]))
  const [transactions, setTransactions] = useState(() => emptyState<FlatTransaction[]>([]))
  const [categories, setCategories] = useState(() => emptyState<FireflyCategory[]>([]))
  const [budgets, setBudgets] = useState(() => emptyState<FireflyBudget[]>([]))
  const [tags, setTags] = useState(() => emptyState<FireflyTag[]>([]))
  const [selectedCurrency, setSelectedCurrency] = useState<string>()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>()
  const requestId = useRef(0)

  const hideAmounts = storedHideAmounts === "true"
  const baseUrl = storedBaseUrl ?? ""
  const token = storedToken ?? ""
  const isConfigured = baseUrl.length > 0 && token.length > 0

  const load = useCallback(
    async (manual = false) => {
      if (!isConfigured) return
      const currentRequest = ++requestId.current
      if (manual) setIsRefreshing(true)
      else {
        if (accounts.data.length === 0) setAccounts((state) => ({ ...state, status: "loading" }))
        if (transactions.data.length === 0)
          setTransactions((state) => ({ ...state, status: "loading" }))
        if (categories.data.length === 0)
          setCategories((state) => ({ ...state, status: "loading" }))
        if (budgets.data.length === 0) setBudgets((state) => ({ ...state, status: "loading" }))
        if (tags.data.length === 0) setTags((state) => ({ ...state, status: "loading" }))
      }

      const api = new FireflyApi(baseUrl, token)
      const range = getMonthRange(selectedMonth)
      const [accountResult, transactionResult, categoryResult, budgetResult, tagResult] =
        await Promise.all([
          api.getAccounts(),
          api.getTransactions(range),
          api.getCategories(),
          api.getBudgets(),
          api.getTags(),
        ])

      if (currentRequest !== requestId.current) return
      const apply = <T,>(
        result: { kind: "ok"; data: T } | FireflyProblem,
        setter: Dispatch<SetStateAction<LoadState<T>>>,
      ) => {
        if (result.kind === "ok") setter({ data: result.data, status: "ready" })
        else setter((state) => ({ ...state, status: "error", error: result }))
      }
      apply(accountResult, setAccounts)
      apply(
        transactionResult.kind === "ok"
          ? { kind: "ok", data: flattenFireflyTransactions(transactionResult.data) }
          : transactionResult,
        setTransactions,
      )
      apply(categoryResult, setCategories)
      apply(budgetResult, setBudgets)
      apply(tagResult, setTags)

      const results = [accountResult, transactionResult, categoryResult, budgetResult, tagResult]
      if (results.some((result) => result.kind === "ok")) setLastSyncedAt(new Date())
      setIsRefreshing(false)
    },
    [
      accounts.data.length,
      baseUrl,
      budgets.data.length,
      categories.data.length,
      isConfigured,
      selectedMonth,
      tags.data.length,
      token,
      transactions.data.length,
    ],
  )

  useEffect(() => {
    void load()
  }, [baseUrl, token, selectedMonth]) // eslint-disable-line react-hooks/exhaustive-deps

  const summariesByCurrency = useMemo(
    () => buildSummariesByCurrency(transactions.data),
    [transactions.data],
  )

  useEffect(() => {
    if (
      summariesByCurrency.length > 0 &&
      !summariesByCurrency.some((summary) => summary.currencyCode === selectedCurrency)
    ) {
      setSelectedCurrency(summariesByCurrency[0].currencyCode)
    }
  }, [selectedCurrency, summariesByCurrency])

  const setConnection = useCallback(
    async (nextBaseUrl: string, nextToken: string) => {
      setIsTestingConnection(true)
      setConnectionError(undefined)
      const normalizedBaseUrl = normalizeBaseUrl(nextBaseUrl)
      const normalizedToken = nextToken.trim()
      const result = await new FireflyApi(normalizedBaseUrl, normalizedToken).testConnection()
      setIsTestingConnection(false)
      if (result.kind !== "ok") {
        setConnectionError(result.message)
        return false
      }
      setStoredBaseUrl(normalizedBaseUrl)
      setStoredToken(normalizedToken)
      return true
    },
    [setStoredBaseUrl, setStoredToken],
  )

  const disconnect = useCallback(() => {
    requestId.current += 1
    setStoredBaseUrl(undefined)
    setStoredToken(undefined)
    setConnectionError(undefined)
    setAccounts(emptyState([]))
    setTransactions(emptyState([]))
    setCategories(emptyState([]))
    setBudgets(emptyState([]))
    setTags(emptyState([]))
    setSelectedCurrency(undefined)
    setLastSyncedAt(undefined)
    setIsRefreshing(false)
  }, [setStoredBaseUrl, setStoredToken])

  const value = useMemo<FireflyContextType>(
    () => ({
      isConfigured,
      baseUrl,
      token,
      hideAmounts,
      isTestingConnection,
      connectionError,
      selectedMonth,
      accounts,
      transactions,
      categories,
      budgets,
      tags,
      summariesByCurrency,
      selectedCurrency,
      isRefreshing,
      lastSyncedAt,
      setConnection,
      disconnect,
      toggleHideAmounts: () => setStoredHideAmounts(hideAmounts ? "false" : "true"),
      refresh: () => load(true),
      previousMonth: () => setSelectedMonth((month) => shiftMonth(month, -1)),
      nextMonth: () => setSelectedMonth((month) => shiftMonth(month, 1)),
      setSelectedMonth,
      setSelectedCurrency,
    }),
    [
      accounts,
      baseUrl,
      budgets,
      categories,
      connectionError,
      disconnect,
      hideAmounts,
      isConfigured,
      isRefreshing,
      isTestingConnection,
      lastSyncedAt,
      load,
      selectedCurrency,
      selectedMonth,
      setConnection,
      setStoredHideAmounts,
      summariesByCurrency,
      tags,
      token,
      transactions,
    ],
  )

  return <FireflyContext.Provider value={value}>{children}</FireflyContext.Provider>
}

export const useFirefly = () => {
  const context = useContext(FireflyContext)
  if (!context) throw new Error("useFirefly must be used within FireflyProvider")
  return context
}
