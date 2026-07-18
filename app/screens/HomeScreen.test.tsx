import { fireEvent, render } from "@testing-library/react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import type { FireflyBudget, FlatTransaction } from "@/models/firefly"
import { ThemeProvider } from "@/theme/context"

import { HomeScreen } from "./HomeScreen"

const mockNavigate = jest.fn()
let mockIsConfigured = false
const mockSelectedMonth = new Date(2026, 5, 1)
const mockTransactions: FlatTransaction[] = [
  {
    groupId: "group-food",
    journalId: "journal-food",
    date: "2026-06-04T10:00:00+06:00",
    amount: 450,
    description: "KFC",
    type: "withdrawal",
    sourceId: "asset-1",
    sourceName: "bKash",
    destinationName: "KFC",
    categoryName: "Food & Dining",
    budgetId: "budget-food",
    budgetName: "Food & Dining",
    tags: [],
    currencyCode: "BDT",
    currencySymbol: "৳",
  },
  {
    groupId: "group-rent",
    journalId: "journal-rent",
    date: "2026-06-05T10:00:00+06:00",
    amount: 1000,
    description: "Rent",
    type: "withdrawal",
    sourceId: "asset-1",
    sourceName: "Bank",
    destinationName: "Landlord",
    categoryName: "Housing",
    budgetId: "budget-rent",
    budgetName: "Rent",
    tags: [],
    currencyCode: "BDT",
    currencySymbol: "৳",
  },
]
const mockBudgets: FireflyBudget[] = [
  { id: "budget-food", attributes: { name: "Food & Dining", active: true } },
  { id: "budget-rent", attributes: { name: "Rent", active: true } },
]

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useScrollToTop: jest.fn(),
}))

jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: (props: object) => {
    const { View } = require("react-native")
    return <View {...props} />
  },
}))

jest.mock("@/context/FireflyContext", () => ({
  useFirefly: () => ({
    isConfigured: mockIsConfigured,
    hideAmounts: false,
    toggleHideAmounts: jest.fn(),
    selectedMonth: mockSelectedMonth,
    setSelectedMonth: jest.fn(),
    transactions: { data: mockIsConfigured ? mockTransactions : [], status: "idle" },
    accounts: { data: [], status: "idle" },
    categories: { data: [], status: "idle" },
    budgets: { data: mockBudgets, status: "ready" },
    selectedCurrency: undefined,
    summariesByCurrency: [],
    refresh: jest.fn(),
    isRefreshing: false,
    isMonthLoading: false,
  }),
}))

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 375, height: 812 },
        insets: { top: 44, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider initialContext="dark">
        <HomeScreen navigation={{ navigate: mockNavigate } as never} route={{} as never} />
      </ThemeProvider>
    </SafeAreaProvider>,
  )
}

describe("HomeScreen Firefly setup banner", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsConfigured = false
  })

  it("opens Firefly settings when the disconnected banner is pressed", () => {
    const { getByLabelText } = renderScreen()

    fireEvent.press(getByLabelText("Connect Firefly III"))

    expect(mockNavigate).toHaveBeenCalledWith("Settings", { screen: "SettingsFirefly" })
  })

  it("hides the setup banner after Firefly is configured", () => {
    mockIsConfigured = true

    const { queryByLabelText } = renderScreen()

    expect(queryByLabelText("Connect Firefly III")).toBeNull()
  })

  it("filters home transactions by selected budget", () => {
    mockIsConfigured = true
    const { getByLabelText, getByText, queryByText } = renderScreen()

    expect(getByText("KFC")).toBeTruthy()
    expect(getByText("Rent")).toBeTruthy()

    fireEvent.press(getByLabelText("Filter transactions"))
    fireEvent.press(getByText("All budgets"))
    fireEvent.press(getByLabelText("Food & Dining"))
    fireEvent.press(getByText("Done"))
    fireEvent.press(getByText("Apply"))

    expect(getByText("KFC")).toBeTruthy()
    expect(queryByText("Rent")).toBeNull()
  })
})
