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
  FireflyTransaction,
  FireflyUser,
  FlatTransaction,
  StoreAccountRequest,
  StoreCategoryRequest,
  StoreTagRequest,
  StoreTransactionRequest,
  UpdateTransactionRequest,
} from "@/models/firefly"
import { FireflyApi, FireflyProblem, FireflyResult, normalizeBaseUrl } from "@/services/firefly/api"
import {
  buildSummariesByCurrency,
  clampMonthToPresent,
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
  isMonthLoading: boolean
  accounts: LoadState<FireflyAccount[]>
  transactions: LoadState<FlatTransaction[]>
  categories: LoadState<FireflyCategory[]>
  budgets: LoadState<FireflyBudget[]>
  tags: LoadState<FireflyTag[]>
  currentUser: LoadState<FireflyUser | null>
  summariesByCurrency: CurrencySummary[]
  selectedCurrency?: string
  isRefreshing: boolean
  lastSyncedAt?: Date
  transactionCreation: LoadState<FireflyTransaction | null>
  transactionDetail: LoadState<FireflyTransaction | null>
  transactionUpdate: LoadState<FireflyTransaction | null>
  transactionDeletion: LoadState<null>
  settingsMutation: LoadState<null>
  setConnection: (baseUrl: string, token: string) => Promise<boolean>
  disconnect: () => void
  toggleHideAmounts: () => void
  refresh: () => Promise<void>
  previousMonth: () => void
  nextMonth: () => void
  setSelectedMonth: (month: Date) => void
  setSelectedCurrency: (currency: string) => void
  createTransaction: (request: StoreTransactionRequest) => Promise<boolean>
  resetTransactionCreation: () => void
  loadTransaction: (id: string) => Promise<boolean>
  resetTransactionDetail: () => void
  updateTransaction: (id: string, request: UpdateTransactionRequest) => Promise<boolean>
  resetTransactionUpdate: () => void
  deleteTransaction: (id: string) => Promise<boolean>
  resetTransactionDeletion: () => void
  saveAccount: (request: StoreAccountRequest, id?: string) => Promise<boolean>
  saveCategory: (request: StoreCategoryRequest, id?: string) => Promise<boolean>
  deleteCategory: (id: string) => Promise<boolean>
  saveTag: (request: StoreTagRequest, id?: string) => Promise<boolean>
  deleteTag: (id: string) => Promise<boolean>
  resetSettingsMutation: () => void
}

const emptyState = <T,>(data: T): LoadState<T> => ({ data, status: "idle" })
const FireflyContext = createContext<FireflyContextType | null>(null)

export const FireflyProvider: FC<PropsWithChildren> = ({ children }) => {
  const [storedBaseUrl, setStoredBaseUrl] = useMMKVString("Firefly.baseUrl")
  const [storedToken, setStoredToken] = useMMKVString("Firefly.token")
  const [storedHideAmounts, setStoredHideAmounts] = useMMKVString("Firefly.hideAmounts")
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionError, setConnectionError] = useState<string>()
  const [selectedMonth, setSelectedMonthState] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  )
  const [isMonthLoading, setIsMonthLoading] = useState(false)
  const [accounts, setAccounts] = useState(() => emptyState<FireflyAccount[]>([]))
  const [transactions, setTransactions] = useState(() => emptyState<FlatTransaction[]>([]))
  const [categories, setCategories] = useState(() => emptyState<FireflyCategory[]>([]))
  const [budgets, setBudgets] = useState(() => emptyState<FireflyBudget[]>([]))
  const [tags, setTags] = useState(() => emptyState<FireflyTag[]>([]))
  const [currentUser, setCurrentUser] = useState(() => emptyState<FireflyUser | null>(null))
  const [selectedCurrency, setSelectedCurrency] = useState<string>()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>()
  const [transactionCreation, setTransactionCreation] = useState(() =>
    emptyState<FireflyTransaction | null>(null),
  )
  const [transactionDetail, setTransactionDetail] = useState(() =>
    emptyState<FireflyTransaction | null>(null),
  )
  const [transactionUpdate, setTransactionUpdate] = useState(() =>
    emptyState<FireflyTransaction | null>(null),
  )
  const [transactionDeletion, setTransactionDeletion] = useState(() => emptyState<null>(null))
  const [settingsMutation, setSettingsMutation] = useState(() => emptyState<null>(null))
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
      const [
        accountResult,
        transactionResult,
        categoryResult,
        budgetResult,
        tagResult,
        userResult,
      ] = await Promise.all([
        api.getAccounts(),
        api.getTransactions(range),
        api.getCategories(),
        api.getBudgets(),
        api.getTags(),
        api.getCurrentUser(),
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
      if (userResult.kind === "ok") {
        setCurrentUser({ data: userResult.data, status: "ready" })
      } else {
        setCurrentUser((state) => ({ ...state, status: "error", error: userResult }))
      }

      const results = [
        accountResult,
        transactionResult,
        categoryResult,
        budgetResult,
        tagResult,
        userResult,
      ]
      if (results.some((result) => result.kind === "ok")) setLastSyncedAt(new Date())
      setIsRefreshing(false)
      setIsMonthLoading(false)
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
    setCurrentUser(emptyState(null))
    setSelectedCurrency(undefined)
    setLastSyncedAt(undefined)
    setIsRefreshing(false)
    setIsMonthLoading(false)
    setTransactionCreation(emptyState(null))
    setTransactionDetail(emptyState(null))
    setTransactionUpdate(emptyState(null))
    setTransactionDeletion(emptyState(null))
    setSettingsMutation(emptyState(null))
  }, [setStoredBaseUrl, setStoredToken])

  const createTransaction = useCallback(
    async (request: StoreTransactionRequest) => {
      if (!isConfigured) return false
      setTransactionCreation({ data: null, status: "loading" })
      const result = await new FireflyApi(baseUrl, token).createTransaction(request)
      if (result.kind !== "ok") {
        setTransactionCreation({ data: null, status: "error", error: result })
        return false
      }
      setTransactionCreation({ data: result.data, status: "ready" })
      return true
    },
    [baseUrl, isConfigured, token],
  )
  const resetTransactionCreation = useCallback(() => setTransactionCreation(emptyState(null)), [])
  const loadTransaction = useCallback(
    async (id: string) => {
      if (!isConfigured) return false
      setTransactionDetail({ data: null, status: "loading" })
      const result = await new FireflyApi(baseUrl, token).getTransaction(id)
      if (result.kind !== "ok") {
        setTransactionDetail({ data: null, status: "error", error: result })
        return false
      }
      setTransactionDetail({ data: result.data, status: "ready" })
      return true
    },
    [baseUrl, isConfigured, token],
  )
  const resetTransactionDetail = useCallback(() => setTransactionDetail(emptyState(null)), [])
  const updateTransaction = useCallback(
    async (id: string, request: UpdateTransactionRequest) => {
      if (!isConfigured) return false
      setTransactionUpdate({ data: null, status: "loading" })
      const result = await new FireflyApi(baseUrl, token).updateTransaction(id, request)
      if (result.kind !== "ok") {
        setTransactionUpdate({ data: null, status: "error", error: result })
        return false
      }
      setTransactionUpdate({ data: result.data, status: "ready" })
      setTransactionDetail({ data: result.data, status: "ready" })
      return true
    },
    [baseUrl, isConfigured, token],
  )
  const resetTransactionUpdate = useCallback(() => setTransactionUpdate(emptyState(null)), [])
  const deleteTransaction = useCallback(
    async (id: string) => {
      if (!isConfigured) return false
      setTransactionDeletion({ data: null, status: "loading" })
      const result = await new FireflyApi(baseUrl, token).deleteTransaction(id)
      if (result.kind !== "ok") {
        setTransactionDeletion({ data: null, status: "error", error: result })
        return false
      }

      setTransactionDeletion({ data: null, status: "ready" })
      setTransactions((state) => ({
        ...state,
        data: state.data.filter((transaction) => transaction.groupId !== id),
      }))
      setTransactionDetail(emptyState(null))
      setTransactionUpdate(emptyState(null))
      void load(true)
      return true
    },
    [baseUrl, isConfigured, load, token],
  )
  const resetTransactionDeletion = useCallback(() => setTransactionDeletion(emptyState(null)), [])

  const runSettingsMutation = useCallback(
    async (operation: (api: FireflyApi) => Promise<FireflyResult<unknown>>) => {
      if (!isConfigured) return false
      setSettingsMutation({ data: null, status: "loading" })
      const result = await operation(new FireflyApi(baseUrl, token))
      if (result.kind !== "ok") {
        setSettingsMutation({ data: null, status: "error", error: result })
        return false
      }
      setSettingsMutation({ data: null, status: "ready" })
      await load(true)
      return true
    },
    [baseUrl, isConfigured, load, token],
  )

  const saveAccount = useCallback(
    (request: StoreAccountRequest, id?: string) =>
      runSettingsMutation((api) =>
        id ? api.updateAccount(id, request) : api.createAccount(request),
      ),
    [runSettingsMutation],
  )
  const saveCategory = useCallback(
    (request: StoreCategoryRequest, id?: string) =>
      runSettingsMutation((api) =>
        id ? api.updateCategory(id, request) : api.createCategory(request),
      ),
    [runSettingsMutation],
  )
  const removeCategory = useCallback(
    (id: string) => runSettingsMutation((api) => api.deleteCategory(id)),
    [runSettingsMutation],
  )
  const saveTag = useCallback(
    (request: StoreTagRequest, id?: string) =>
      runSettingsMutation((api) => (id ? api.updateTag(id, request) : api.createTag(request))),
    [runSettingsMutation],
  )
  const removeTag = useCallback(
    (id: string) => runSettingsMutation((api) => api.deleteTag(id)),
    [runSettingsMutation],
  )
  const resetSettingsMutation = useCallback(() => setSettingsMutation(emptyState(null)), [])

  const changeSelectedMonth = useCallback(
    (month: Date) => {
      const nextMonth = clampMonthToPresent(month)
      if (
        nextMonth.getFullYear() === selectedMonth.getFullYear() &&
        nextMonth.getMonth() === selectedMonth.getMonth()
      ) {
        return
      }
      setIsMonthLoading(true)
      setSelectedMonthState(nextMonth)
    },
    [selectedMonth],
  )

  const value = useMemo<FireflyContextType>(
    () => ({
      isConfigured,
      baseUrl,
      token,
      hideAmounts,
      isTestingConnection,
      connectionError,
      selectedMonth,
      isMonthLoading,
      accounts,
      transactions,
      categories,
      budgets,
      tags,
      currentUser,
      summariesByCurrency,
      selectedCurrency,
      isRefreshing,
      lastSyncedAt,
      transactionCreation,
      transactionDetail,
      transactionUpdate,
      transactionDeletion,
      settingsMutation,
      setConnection,
      disconnect,
      toggleHideAmounts: () => setStoredHideAmounts(hideAmounts ? "false" : "true"),
      refresh: () => load(true),
      previousMonth: () => changeSelectedMonth(shiftMonth(selectedMonth, -1)),
      nextMonth: () => changeSelectedMonth(shiftMonth(selectedMonth, 1)),
      setSelectedMonth: changeSelectedMonth,
      setSelectedCurrency,
      createTransaction,
      resetTransactionCreation,
      loadTransaction,
      resetTransactionDetail,
      updateTransaction,
      resetTransactionUpdate,
      deleteTransaction,
      resetTransactionDeletion,
      saveAccount,
      saveCategory,
      deleteCategory: removeCategory,
      saveTag,
      deleteTag: removeTag,
      resetSettingsMutation,
    }),
    [
      accounts,
      baseUrl,
      budgets,
      categories,
      changeSelectedMonth,
      connectionError,
      currentUser,
      createTransaction,
      deleteTransaction,
      disconnect,
      hideAmounts,
      isConfigured,
      isMonthLoading,
      isRefreshing,
      isTestingConnection,
      lastSyncedAt,
      loadTransaction,
      load,
      resetTransactionDetail,
      resetTransactionCreation,
      resetTransactionDeletion,
      resetTransactionUpdate,
      resetSettingsMutation,
      removeCategory,
      removeTag,
      saveAccount,
      saveCategory,
      saveTag,
      selectedCurrency,
      selectedMonth,
      setConnection,
      setStoredHideAmounts,
      summariesByCurrency,
      tags,
      settingsMutation,
      token,
      transactionCreation,
      transactionDeletion,
      transactionDetail,
      transactionUpdate,
      transactions,
      updateTransaction,
    ],
  )

  return <FireflyContext.Provider value={value}>{children}</FireflyContext.Provider>
}

export const useFirefly = () => {
  const context = useContext(FireflyContext)
  if (!context) throw new Error("useFirefly must be used within FireflyProvider")
  return context
}
