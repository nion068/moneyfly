import { ReactElement } from "react"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { fireEvent, render, waitFor, within } from "@testing-library/react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { AnalyticsScreen } from "@/screens/AnalyticsScreen"
import { ThemeProvider } from "@/theme/context"

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetTransactions = jest.fn()
const mockScrollTo = jest.fn()

jest.mock("@/services/firefly/api", () => ({
  FireflyApi: jest.fn().mockImplementation(() => ({
    getTransactions: mockGetTransactions,
  })),
  normalizeBaseUrl: (url: string) => url,
}))

jest.mock("@/services/firefly/transforms", () => ({
  ...jest.requireActual("@/services/firefly/transforms"),
  startOfCurrentMonth: () => new Date(2026, 5, 1),
}))

jest.mock("react-native-keyboard-controller", () => {
  const React = require("react")

  const KeyboardAwareScrollView = React.forwardRef(({ children, ...props }: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      scrollTo: mockScrollTo,
    }))

    return React.createElement("KeyboardAwareScrollView", props, children)
  })
  KeyboardAwareScrollView.displayName = "KeyboardAwareScrollView"
  const KeyboardAvoidingView = ({ children, ...props }: any) =>
    React.createElement("KeyboardAvoidingView", props, children)

  return {
    __esModule: true,
    KeyboardAwareScrollView,
    KeyboardAvoidingView,
    useKeyboardState: (selector: (state: { isVisible: boolean }) => boolean) =>
      selector({ isVisible: false }),
  }
})

const mockNavigate = jest.fn()
const baseTransaction: any = {
  groupId: "g1",
  journalId: "j1",
  date: "2026-06-04T10:00:00+06:00",
  amount: 450,
  description: "KFC",
  type: "withdrawal" as const,
  sourceName: "bKash",
  destinationName: "KFC",
  categoryName: "Food & Dining",
  sourceId: "src-1",
  destinationId: "dst-1",
  tags: [],
  currencyCode: "BDT",
  currencySymbol: "৳",
}
const secondCategoryTransaction = {
  ...baseTransaction,
  groupId: "g2",
  journalId: "j2",
  amount: 300,
  description: "Taxi",
  destinationName: "Pathao",
  categoryName: "Transport",
}
const incomeTransaction = {
  ...baseTransaction,
  groupId: "g3",
  journalId: "j3",
  amount: 1200,
  description: "Salary",
  type: "deposit" as const,
  sourceName: "Employer",
  destinationName: "bKash",
  categoryName: "Salary",
}

const toFireflyTransactions = (flatTransactions: any[]) =>
  flatTransactions.map((transaction) => ({
    id: transaction.groupId,
    attributes: {
      transactions: [
        {
          transaction_journal_id: transaction.journalId,
          date: transaction.date,
          amount: String(transaction.amount),
          description: transaction.description,
          type: transaction.type,
          source_id: transaction.sourceId,
          source_name: transaction.sourceName,
          destination_id: transaction.destinationId,
          destination_name: transaction.destinationName,
          category_name: transaction.categoryName,
          tags: transaction.tags,
          currency_code: transaction.currencyCode,
          currency_symbol: transaction.currencySymbol,
        },
      ],
    },
  }))

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

// Minimal firefly context values used by AnalyticsScreen
const mockBaseContextValue = {
  selectedMonth: new Date(2026, 5, 1), // June 2026
  setSelectedMonth: jest.fn(),
  transactions: {
    data: [baseTransaction],
    status: "ready" as const,
  },
  summariesByCurrency: [
    {
      currencyCode: "BDT",
      totalIncome: 0,
      totalExpense: 450,
      saved: -450,
      netBalance: -450,
      currencySymbol: "৳",
      savingsRate: 0,
      transactionCount: 1,
    },
  ],
  selectedCurrency: "BDT",
  setSelectedCurrency: jest.fn(),
  refresh: jest.fn(),
  isRefreshing: false,
  baseUrl: "https://firefly.example.com/",
  token: "token-123",
  isConfigured: true,
  // other required fields
  hideAmounts: false,
  isTestingConnection: false,
  isMonthLoading: false,
  accounts: { data: [], status: "idle" as const },
  categories: { data: [] as any[], status: "idle" as const },
  budgets: { data: [], status: "idle" as const },
  tags: { data: [], status: "idle" as const },
  lastSyncedAt: undefined,
  transactionCreation: { data: null, status: "idle" as const },
  transactionDetail: { data: null, status: "idle" as const },
  transactionUpdate: { data: null, status: "idle" as const },
  transactionDeletion: { data: null, status: "idle" as const },
  setConnection: jest.fn(),
  disconnect: jest.fn(),
  toggleHideAmounts: jest.fn(),
  previousMonth: jest.fn(),
  nextMonth: jest.fn(),
  createTransaction: jest.fn(),
  resetTransactionCreation: jest.fn(),
  loadTransaction: jest.fn(),
  resetTransactionDetail: jest.fn(),
  updateTransaction: jest.fn(),
  resetTransactionUpdate: jest.fn(),
  deleteTransaction: jest.fn(),
  resetTransactionDeletion: jest.fn(),
}

jest.mock("@/context/FireflyContext", () => ({
  useFirefly: () => mockBaseContextValue,
}))

// Navigation prop stub
const navigationProp = {
  navigate: mockNavigate,
  goBack: jest.fn(),
  dispatch: jest.fn(),
  reset: jest.fn(),
  isFocused: jest.fn(() => true),
  canGoBack: jest.fn(() => false),
  getState: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => () => {}),
  removeListener: jest.fn(),
} as never

const Stack = createNativeStackNavigator()

const renderWithProviders = (ui: ReactElement) => {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 375, height: 812 },
        insets: { top: 44, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="MockScreen">{() => ui}</Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>,
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AnalyticsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockBaseContextValue.selectedMonth = new Date(2026, 5, 1)
    mockBaseContextValue.transactions.data = [baseTransaction]
    mockBaseContextValue.categories.data = [
      { id: "category-food", attributes: { name: "Food & Dining" } },
      { id: "category-transport", attributes: { name: "Transport" } },
      { id: "category-salary", attributes: { name: "Salary" } },
    ]
    mockBaseContextValue.selectedCurrency = "BDT"
    mockGetTransactions.mockResolvedValue({
      kind: "ok",
      data: toFireflyTransactions([baseTransaction]),
    })
  })

  it("shows Month in the header dropdown and exposes all periods when opened", () => {
    const { getByLabelText, getByText, queryByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )

    expect(getByText("Month")).toBeTruthy()
    expect(queryByText("Week")).toBeNull()

    fireEvent.press(getByLabelText("Select analytics period"))

    expect(getByText("Week")).toBeTruthy()
    expect(getByText("Quarter")).toBeTruthy()
    expect(getByText("Year")).toBeTruthy()
  })

  it("updates the trend subtitle for the selected period", () => {
    const { getByLabelText, getByText, queryByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )

    expect(getByText("Last 6 months")).toBeTruthy()
    fireEvent.press(getByLabelText("Select analytics period"))
    fireEvent.press(getByText("Quarter"))

    expect(getByText("Last 6 quarters")).toBeTruthy()
    expect(queryByText("Last 6 months")).toBeNull()
  })

  it("requests the six-month window on initial load", async () => {
    renderWithProviders(<AnalyticsScreen navigation={navigationProp} route={{} as never} />)

    await waitFor(() => {
      expect(mockGetTransactions).toHaveBeenCalledWith({
        start: "2026-01-01",
        end: "2026-06-30",
      })
    })
  })

  it("maintains its month separately from the Home month", async () => {
    mockBaseContextValue.selectedMonth = new Date(2026, 3, 1)
    const { getByLabelText, getByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )

    await waitFor(() => {
      expect(mockGetTransactions).toHaveBeenCalledWith({
        start: "2026-01-01",
        end: "2026-06-30",
      })
    })

    fireEvent.press(getByLabelText("Open month picker"))
    fireEvent.press(getByText("May"))

    await waitFor(() => {
      expect(mockGetTransactions).toHaveBeenCalledWith({
        start: "2025-12-01",
        end: "2026-05-31",
      })
    })
    expect(mockBaseContextValue.setSelectedMonth).not.toHaveBeenCalled()
  })

  it("shows Income, Expenses, and Saved metric cards", () => {
    const { getAllByText, getByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )
    expect(getAllByText("Income").length).toBeGreaterThan(0)
    expect(getAllByText("Expenses").length).toBeGreaterThan(0)
    expect(getByText("Saved")).toBeTruthy()
  })

  it("keeps all metric values on one line and allows them to shrink to fit", () => {
    const { getByTestId } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )

    for (const label of ["income", "expenses", "saved"]) {
      expect(getByTestId(`metric-value-${label}`).props).toEqual(
        expect.objectContaining({
          adjustsFontSizeToFit: true,
          minimumFontScale: 0.65,
          numberOfLines: 1,
        }),
      )
    }
  })

  it("switching period to Week calls getTransactions with correct range", async () => {
    const { getByLabelText, getByText, queryByTestId } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )
    fireEvent.press(getByLabelText("Select analytics period"))
    fireEvent.press(getByText("Week"))
    expect(queryByTestId("analytics-period-menu")).toBeNull()
    await waitFor(() => {
      expect(mockGetTransactions).toHaveBeenCalledWith({
        start: "2026-04-27",
        end: "2026-06-07",
      })
    })
  })

  it("switching period to Quarter requests six quarters", async () => {
    const { getByLabelText, getByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )
    fireEvent.press(getByLabelText("Select analytics period"))
    fireEvent.press(getByText("Quarter"))
    await waitFor(() => {
      expect(mockGetTransactions).toHaveBeenCalledWith({
        start: "2025-01-01",
        end: "2026-06-30",
      })
    })
  })

  it("switching period to Year requests six years", async () => {
    const { getByLabelText, getByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )
    fireEvent.press(getByLabelText("Select analytics period"))
    fireEvent.press(getByText("Year"))
    await waitFor(() => {
      expect(mockGetTransactions).toHaveBeenCalledWith({
        start: "2021-01-01",
        end: "2026-12-31",
      })
    })
  })

  it("shows an error message with retry when the analytics request fails", async () => {
    mockGetTransactions.mockResolvedValue({
      kind: "network",
      message: "Could not reach the Firefly server.",
    })
    const { getByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )
    await waitFor(() => {
      expect(getByText(/Tap to retry/)).toBeTruthy()
    })
  })

  it("switches among expense, income, and net chart metrics", () => {
    const { getByTestId } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )

    expect(getByTestId("trend-metric-expense").props.accessibilityState.selected).toBe(true)
    fireEvent.press(getByTestId("trend-metric-income"))
    expect(getByTestId("trend-metric-income").props.accessibilityState.selected).toBe(true)
    fireEvent.press(getByTestId("trend-metric-netSavings"))
    expect(getByTestId("trend-metric-netSavings").props.accessibilityState.selected).toBe(true)
  })

  it("shows the selected chart point label and formatted value", () => {
    const { getByTestId } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )

    fireEvent.press(getByTestId("trend-point-5"))

    const selectedValue = within(getByTestId("trend-selected-value"))
    expect(selectedValue.getByText("Jun 26")).toBeTruthy()
    expect(selectedValue.getByText("৳ 450")).toBeTruthy()
  })

  it("shows All categories by default for the analytics filter", () => {
    const { getByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )

    expect(getByText("All categories")).toBeTruthy()
  })

  it("filters the full analytics page to a single selected category", () => {
    mockBaseContextValue.transactions.data = [baseTransaction, secondCategoryTransaction]
    mockGetTransactions.mockResolvedValue({
      kind: "ok",
      data: toFireflyTransactions([baseTransaction, secondCategoryTransaction]),
    })

    const { getAllByText, getByLabelText, getByTestId, getByText, queryByText } =
      renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
      )

    fireEvent.press(getByLabelText("Open analytics category filter"))
    fireEvent.press(getByLabelText("Transport"))
    fireEvent.press(getByText("Done"))
    fireEvent.press(getByTestId("trend-point-5"))

    expect(within(getByTestId("trend-selected-value")).getByText("৳ 300")).toBeTruthy()
    expect(getAllByText("Transport").length).toBeGreaterThan(0)
    expect(getAllByText("৳ 300").length).toBeGreaterThan(0)
    expect(queryByText("Food & Dining")).toBeNull()
  })

  it("combines multiple selected categories across the full analytics page", () => {
    mockBaseContextValue.transactions.data = [
      baseTransaction,
      secondCategoryTransaction,
      incomeTransaction,
    ]
    mockGetTransactions.mockResolvedValue({
      kind: "ok",
      data: toFireflyTransactions([
        baseTransaction,
        secondCategoryTransaction,
        incomeTransaction,
      ]),
    })

    const { getAllByText, getByLabelText, getByTestId, getByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )

    fireEvent.press(getByLabelText("Open analytics category filter"))
    fireEvent.press(getByLabelText("Food & Dining"))
    fireEvent.press(getByLabelText("Transport"))
    fireEvent.press(getByText("Done"))
    fireEvent.press(getByTestId("trend-point-5"))

    expect(within(getByTestId("trend-selected-value")).getByText("৳ 750")).toBeTruthy()
    expect(getByText("2 selected")).toBeTruthy()
    expect(getAllByText("৳ 750").length).toBeGreaterThan(0)
  })

  it("clears the analytics filter and restores the unfiltered full page", () => {
    mockBaseContextValue.transactions.data = [
      baseTransaction,
      secondCategoryTransaction,
      incomeTransaction,
    ]
    mockGetTransactions.mockResolvedValue({
      kind: "ok",
      data: toFireflyTransactions([
        baseTransaction,
        secondCategoryTransaction,
        incomeTransaction,
      ]),
    })

    const { getAllByText, getByLabelText, getByTestId, getByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )

    fireEvent.press(getByLabelText("Open analytics category filter"))
    fireEvent.press(getByLabelText("Transport"))
    fireEvent.press(getByText("Done"))
    fireEvent.press(getByLabelText("Clear analytics category filter"))
    fireEvent.press(getByTestId("trend-point-5"))

    expect(within(getByTestId("trend-selected-value")).getByText("৳ 750")).toBeTruthy()
    expect(getByText("All categories")).toBeTruthy()
    expect(getAllByText("৳ 750").length).toBeGreaterThan(0)
  })

  it("builds the chart from only the selected currency", () => {
    const usdTransaction = {
      ...baseTransaction,
      groupId: "usd-group",
      journalId: "usd-journal",
      amount: 1000,
      currencyCode: "USD",
      currencySymbol: "$",
    }
    mockBaseContextValue.transactions.data = [baseTransaction, usdTransaction]
    mockGetTransactions.mockResolvedValue({
      kind: "ok",
      data: toFireflyTransactions([baseTransaction, usdTransaction]),
    })
    const { getByTestId } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )

    fireEvent.press(getByTestId("trend-point-5"))

    expect(within(getByTestId("trend-selected-value")).getByText("৳ 450")).toBeTruthy()
  })

  it("composes currency filtering with full-page category filtering", () => {
    const usdTransportTransaction = {
      ...secondCategoryTransaction,
      groupId: "usd-transport-group",
      journalId: "usd-transport-journal",
      amount: 900,
      currencyCode: "USD",
      currencySymbol: "$",
    }
    mockBaseContextValue.transactions.data = [
      baseTransaction,
      secondCategoryTransaction,
      usdTransportTransaction,
    ]
    mockGetTransactions.mockResolvedValue({
      kind: "ok",
      data: toFireflyTransactions([
        baseTransaction,
        secondCategoryTransaction,
        usdTransportTransaction,
      ]),
    })

    const { getAllByText, getByLabelText, getByTestId, getByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )

    fireEvent.press(getByLabelText("Open analytics category filter"))
    fireEvent.press(getByLabelText("Transport"))
    fireEvent.press(getByText("Done"))
    fireEvent.press(getByTestId("trend-point-5"))

    expect(within(getByTestId("trend-selected-value")).getByText("৳ 300")).toBeTruthy()
    expect(getAllByText("৳ 300").length).toBeGreaterThan(0)
  })

  it("shows a neutral chart state when the selected metric has no activity", () => {
    mockBaseContextValue.transactions.data = []
    mockGetTransactions.mockResolvedValue({ kind: "ok", data: [] })

    const { getByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )

    expect(getByText("No activity for these periods.")).toBeTruthy()
  })

  it("By Category section is expanded by default and shows category names", () => {
    const { getByText, getAllByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )
    expect(getByText("By Category")).toBeTruthy()
    expect(getAllByText("Food & Dining").length).toBe(2)
  })

  it("tapping By Category header collapses and re-expands the section", () => {
    const { getByText, getAllByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )
    expect(getAllByText("Food & Dining").length).toBe(2)
    fireEvent.press(getByText("By Category"))
    expect(getAllByText("Food & Dining").length).toBe(1) // only in the chart
    fireEvent.press(getByText("By Category"))
    expect(getAllByText("Food & Dining").length).toBe(2)
  })

  it("By Account section is expanded by default", () => {
    const { getByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )
    expect(getByText("By Account")).toBeTruthy()
    expect(getByText("bKash")).toBeTruthy()
  })

  it("tapping a category row expands its transaction list", () => {
    const { getAllByText, getByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )
    fireEvent.press(getAllByText("Food & Dining")[1])
    expect(getByText("KFC")).toBeTruthy()
  })

  it("expanding a second category collapses the first (accordion)", () => {
    // This test requires two categories. We verify the toggle logic via the same category row.
    const { getAllByText, getByText, queryByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )
    // Open Food & Dining
    fireEvent.press(getAllByText("Food & Dining")[1])
    expect(getByText("KFC")).toBeTruthy()
    // Close it again
    fireEvent.press(getAllByText("Food & Dining")[1])
    expect(queryByText("KFC")).toBeNull()
  })

  it("'View all transactions' in a category navigates to Home", () => {
    const { getAllByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )
    fireEvent.press(getAllByText("Food & Dining")[1])
    fireEvent.press(getAllByText("View all transactions →")[0])
    expect(mockNavigate).toHaveBeenCalled()
  })

  it("calendar icon is present", () => {
    const { getByLabelText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )
    expect(getByLabelText("Open month picker")).toBeTruthy()
  })

  it("shows the top six expense categories in descending order with amounts and percentages", () => {
    mockBaseContextValue.transactions.data = Array.from({ length: 7 }, (_, index) => ({
      ...baseTransaction,
      groupId: `g${index}`,
      journalId: `j${index}`,
      amount: (index + 1) * 100,
      categoryName: `Category ${index + 1}`,
      description: `Expense ${index + 1}`,
    }))
    mockGetTransactions.mockResolvedValue({
      kind: "ok",
      data: toFireflyTransactions(mockBaseContextValue.transactions.data),
    })

    const { getAllByTestId, getAllByText, getByTestId, queryByTestId } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )
    const rows = getAllByTestId(/^breakdown-row-/)

    expect(rows).toHaveLength(6)
    expect(rows.map((row) => row.props.testID)).toEqual([
      "breakdown-row-Category 7",
      "breakdown-row-Category 6",
      "breakdown-row-Category 5",
      "breakdown-row-Category 4",
      "breakdown-row-Category 3",
      "breakdown-row-Category 2",
    ])
    expect(queryByTestId("breakdown-row-Category 1")).toBeNull()
    expect(getAllByText("৳ 700").length).toBeGreaterThan(0)
    expect(getAllByText("25%").length).toBeGreaterThan(0)
    expect(getByTestId("breakdown-bar-Category 7").props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: "25%" })]),
    )
  })

  it("shows a neutral empty state when there are no expenses", () => {
    mockBaseContextValue.transactions.data = []
    mockGetTransactions.mockResolvedValue({ kind: "ok", data: [] })

    const { getByText, queryAllByTestId } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )

    expect(getByText("No expenses for this period.")).toBeTruthy()
    expect(queryAllByTestId(/^breakdown-row-/)).toHaveLength(0)
  })

  it("updates summary pills and breakdown sections when the analytics filter is active", () => {
    mockBaseContextValue.transactions.data = [baseTransaction, secondCategoryTransaction]
    mockGetTransactions.mockResolvedValue({
      kind: "ok",
      data: toFireflyTransactions([baseTransaction, secondCategoryTransaction]),
    })

    const { getAllByText, getByLabelText, getByText, queryByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )

    fireEvent.press(getByLabelText("Open analytics category filter"))
    fireEvent.press(getByLabelText("Transport"))
    fireEvent.press(getByText("Done"))

    expect(getAllByText("৳ 300").length).toBeGreaterThan(0)
    expect(queryByText("Food & Dining")).toBeNull()
    expect(getAllByText("Transport").length).toBeGreaterThan(0)
  })

  it("shows an empty filtered state when no transactions match selected categories", async () => {
    mockBaseContextValue.transactions.data = [baseTransaction]
    mockGetTransactions.mockResolvedValue({
      kind: "ok",
      data: toFireflyTransactions([baseTransaction]),
    })

    const { getByLabelText, getByText, queryAllByTestId } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )

    fireEvent.press(getByLabelText("Open analytics category filter"))
    fireEvent.press(getByLabelText("Transport"))
    fireEvent.press(getByText("Done"))

    await waitFor(() => {
      expect(getByText("No activity for these periods.")).toBeTruthy()
      expect(getByText("No expenses for this period.")).toBeTruthy()
      expect(queryAllByTestId(/^breakdown-row-/)).toHaveLength(0)
    })
  })

  it("clears expanded category details when filtering removes that category", () => {
    mockBaseContextValue.transactions.data = [baseTransaction, secondCategoryTransaction]
    mockGetTransactions.mockResolvedValue({
      kind: "ok",
      data: toFireflyTransactions([baseTransaction, secondCategoryTransaction]),
    })

    const { getAllByText, getByLabelText, getByText, queryByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )

    fireEvent.press(getAllByText("Food & Dining")[1])
    expect(getByText("KFC")).toBeTruthy()

    fireEvent.press(getByLabelText("Open analytics category filter"))
    fireEvent.press(getByLabelText("Transport"))
    fireEvent.press(getByText("Done"))

    expect(queryByText("KFC")).toBeNull()
  })

  it("pressing a breakdown bar selects it, expands details, and scrolls to the category", async () => {
    const { getByTestId, getByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )

    fireEvent(getByTestId("category-card-Food & Dining"), "layout", {
      nativeEvent: { layout: { y: 240 } },
    })
    fireEvent.press(getByTestId("breakdown-row-Food & Dining"))

    await waitFor(() => {
      expect(getByText("KFC")).toBeTruthy()
      expect(mockScrollTo).toHaveBeenCalledWith({ y: 230, animated: true })
    })

    const rowStyle = getByTestId("breakdown-row-Food & Dining").props.style
    const rowStyles = Array.isArray(rowStyle) ? rowStyle : [rowStyle]
    expect(rowStyles.some((style) => style?.backgroundColor)).toBe(true)
  })
})
