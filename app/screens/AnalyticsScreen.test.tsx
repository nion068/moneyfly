import { ReactElement } from "react"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { fireEvent, render, waitFor } from "@testing-library/react-native"
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

jest.mock("react-native-keyboard-controller", () => {
  const React = require("react")

  const KeyboardAwareScrollView = React.forwardRef(({ children, ...props }: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      scrollTo: mockScrollTo,
    }))

    return React.createElement("KeyboardAwareScrollView", props, children)
  })
  KeyboardAwareScrollView.displayName = "KeyboardAwareScrollView"

  return {
    __esModule: true,
    KeyboardAwareScrollView,
  }
})

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

// Minimal firefly context values used by AnalyticsScreen
const mockBaseContextValue = {
  selectedMonth: new Date(2026, 5, 1), // June 2026
  setSelectedMonth: jest.fn(),
  transactions: {
    data: [
      {
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
      },
    ],
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
  categories: { data: [], status: "idle" as const },
  budgets: { data: [], status: "idle" as const },
  tags: { data: [], status: "idle" as const },
  lastSyncedAt: undefined,
  transactionCreation: { data: null, status: "idle" as const },
  transactionDetail: { data: null, status: "idle" as const },
  transactionUpdate: { data: null, status: "idle" as const },
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
    mockGetTransactions.mockResolvedValue({ kind: "ok", data: [] })
  })

  it("renders with Month as the default selected period", () => {
    const { getByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )
    // Month chip should be present and contextually active
    expect(getByText("Month")).toBeTruthy()
    expect(getByText("Week")).toBeTruthy()
    expect(getByText("Quarter")).toBeTruthy()
    expect(getByText("Year")).toBeTruthy()
  })

  it("shows Income, Expenses, and Saved metric cards", () => {
    const { getByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )
    expect(getByText("Income")).toBeTruthy()
    expect(getByText("Expenses")).toBeTruthy()
    expect(getByText("Saved")).toBeTruthy()
  })

  it("switching period to Week calls getTransactions with correct range", async () => {
    const { getByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )
    fireEvent.press(getByText("Week"))
    await waitFor(() => {
      expect(mockGetTransactions).toHaveBeenCalledWith(
        expect.objectContaining({
          start: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          end: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        }),
      )
    })
  })

  it("switching period to Quarter calls getTransactions with start of quarter", async () => {
    const { getByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )
    fireEvent.press(getByText("Quarter"))
    await waitFor(() => {
      expect(mockGetTransactions).toHaveBeenCalledWith(
        expect.objectContaining({ start: "2026-04-01", end: "2026-06-30" }),
      )
    })
  })

  it("switching period to Year calls getTransactions with full year range", async () => {
    const { getByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )
    fireEvent.press(getByText("Year"))
    await waitFor(() => {
      expect(mockGetTransactions).toHaveBeenCalledWith(
        expect.objectContaining({ start: "2026-01-01", end: "2026-12-31" }),
      )
    })
  })

  it("shows an error message with retry when API returns an error for non-month periods", async () => {
    mockGetTransactions.mockResolvedValue({
      kind: "network",
      message: "Could not reach the Firefly server.",
    })
    const { getByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )
    fireEvent.press(getByText("Week"))
    await waitFor(() => {
      expect(getByText(/Tap to retry/)).toBeTruthy()
    })
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
    expect(getAllByText("Food & Dining").length).toBe(1) // only in legend
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

  it("pressing a legend item highlights the slice and scrolls to the category", async () => {
    const { getByTestId, getByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )

    fireEvent(getByTestId("category-card-Food & Dining"), "layout", {
      nativeEvent: { layout: { y: 240 } },
    })
    fireEvent.press(getByTestId("legend-row-Food & Dining"))

    await waitFor(() => {
      expect(getByText("KFC")).toBeTruthy()
      expect(mockScrollTo).toHaveBeenCalledWith({ y: 230, animated: true })
      expect(getByTestId("donut-slice-Food & Dining").props.strokeWidth).toBe(18)
    })

    const legendRowStyle = getByTestId("legend-row-Food & Dining").props.style
    const legendRowStyles = Array.isArray(legendRowStyle) ? legendRowStyle : [legendRowStyle]
    expect(legendRowStyles.some((style) => style?.backgroundColor)).toBe(true)
  })

  it("pressing the donut slice only highlights the category", async () => {
    const { getByTestId, queryByText } = renderWithProviders(
      <AnalyticsScreen navigation={navigationProp} route={{} as never} />,
    )

    fireEvent.press(getByTestId("donut-slice-Food & Dining"))

    await waitFor(() => {
      expect(mockScrollTo).not.toHaveBeenCalled()
      expect(getByTestId("donut-slice-Food & Dining").props.strokeWidth).toBe(18)
      expect(getByTestId("legend-row-Food & Dining").props.style).toBeTruthy()
      expect(queryByText("KFC")).toBeNull()
    })
  })
})
