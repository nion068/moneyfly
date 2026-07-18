import { fireEvent, render } from "@testing-library/react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import type { FireflyBudget, FireflyBudgetLimit } from "@/models/firefly"
import type { BudgetPeriod } from "@/services/firefly/transforms"
import { ThemeProvider } from "@/theme/context"

import { BudgetsScreen } from "./BudgetsScreen"

const mockNavigate = jest.fn()
const mockSetSelectedBudgetPeriod = jest.fn()
const mockPreviousBudgetPeriod = jest.fn()
const mockNextBudgetPeriod = jest.fn()
const mockResetBudgetMutation = jest.fn()
const mockRefresh = jest.fn()
let mockIsConfigured = true
let mockSelectedBudgetPeriod: BudgetPeriod = "month"

const budgets: FireflyBudget[] = [
  {
    id: "budget-food",
    attributes: {
      name: "Food & Dining",
      active: true,
      currency_code: "USD",
      currency_symbol: "$",
      spent: [{ currency_code: "USD", currency_symbol: "$", sum: "320.00" }],
    },
  },
  {
    id: "budget-rent",
    attributes: {
      name: "Rent",
      active: true,
      currency_code: "USD",
      currency_symbol: "$",
    },
  },
]

let mockBudgetLimits: FireflyBudgetLimit[] = [
  {
    id: "limit-food",
    attributes: {
      budget_id: "budget-food",
      start: "2026-07-01",
      end: "2026-07-31",
      amount: "500.00",
      currency_code: "USD",
      currency_symbol: "$",
      spent: [{ currency_code: "USD", currency_symbol: "$", sum: "320.00" }],
    },
  },
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
    budgets: { data: budgets, status: "ready" },
    budgetLimits: { data: mockBudgetLimits, status: "ready" },
    currencies: {
      data: [
        {
          id: "usd",
          attributes: {
            code: "USD",
            name: "US Dollar",
            symbol: "$",
            enabled: true,
            primary: true,
          },
        },
      ],
      status: "ready",
    },
    selectedCurrency: "USD",
    selectedBudgetPeriod: mockSelectedBudgetPeriod,
    selectedBudgetAnchor: new Date(2026, 6, 1),
    budgetRange: { start: "2026-07-01", end: "2026-07-31" },
    isBudgetPeriodLoading: false,
    isRefreshing: false,
    budgetMutation: { data: null, status: "idle" },
    setSelectedBudgetPeriod: mockSetSelectedBudgetPeriod,
    previousBudgetPeriod: mockPreviousBudgetPeriod,
    nextBudgetPeriod: mockNextBudgetPeriod,
    resetBudgetMutation: mockResetBudgetMutation,
    refresh: mockRefresh,
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
        <BudgetsScreen navigation={{ navigate: mockNavigate } as never} route={{} as never} />
      </ThemeProvider>
    </SafeAreaProvider>,
  )
}

describe("BudgetsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsConfigured = true
    mockSelectedBudgetPeriod = "month"
    mockBudgetLimits = [
      {
        id: "limit-food",
        attributes: {
          budget_id: "budget-food",
          start: "2026-07-01",
          end: "2026-07-31",
          amount: "500.00",
          currency_code: "USD",
          currency_symbol: "$",
          spent: [{ currency_code: "USD", currency_symbol: "$", sum: "320.00" }],
        },
      },
    ]
  })

  it("shows budget progress and filters by search", () => {
    const { getAllByText, getByLabelText, getByText, queryByText } = renderScreen()

    expect(getByText("Food & Dining")).toBeTruthy()
    expect(getByText("Rent")).toBeTruthy()
    expect(getAllByText("2026-07-01 - 2026-07-31").length).toBeGreaterThan(1)
    expect(queryByText(/No limit this period/)).toBeNull()
    expect(getAllByText("$ 500").length).toBeGreaterThan(0)
    expect(getAllByText("$ 320").length).toBeGreaterThan(0)

    fireEvent.changeText(getByLabelText("Search budgets"), "rent")

    expect(getByText("Rent")).toBeTruthy()
    expect(queryByText("Food & Dining")).toBeNull()
  })

  it("changes the selected period from the chips", () => {
    const { getByText } = renderScreen()

    fireEvent.press(getByText("Quarter"))

    expect(mockSetSelectedBudgetPeriod).toHaveBeenCalledWith("quarter")
  })

  it("navigates to the budget editor from the add button", () => {
    const { getByLabelText } = renderScreen()

    fireEvent.press(getByLabelText("Add budget"))

    expect(mockResetBudgetMutation).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith("BudgetEditor")
  })

  it("navigates directly to edit when one visible limit exists", () => {
    const { getByLabelText } = renderScreen()

    fireEvent.press(getByLabelText("Edit Food & Dining"))

    expect(mockNavigate).toHaveBeenCalledWith("BudgetEditor", {
      budgetId: "budget-food",
      limitId: "limit-food",
    })
  })

  it("navigates directly to edit when no visible limit exists", () => {
    const { getByLabelText } = renderScreen()

    fireEvent.press(getByLabelText("Edit Rent"))

    expect(mockNavigate).toHaveBeenCalledWith("BudgetEditor", {
      budgetId: "budget-rent",
      limitId: undefined,
    })
  })

  it("shows a selector before editing a budget with multiple visible limits", () => {
    mockBudgetLimits = [
      ...mockBudgetLimits,
      {
        id: "limit-food-2",
        attributes: {
          budget_id: "budget-food",
          start: "2026-07-15",
          end: "2026-07-31",
          amount: "200.00",
          currency_code: "USD",
          currency_symbol: "$",
        },
      },
    ]
    const { getAllByText, getByLabelText, getByText } = renderScreen()

    fireEvent.press(getByLabelText("Edit Food & Dining"))

    expect(getByText("Budget Limit")).toBeTruthy()
    expect(getAllByText("2026-07-01 - 2026-07-31").length).toBeGreaterThan(0)
    expect(getByText("2026-07-15 - 2026-07-31")).toBeTruthy()
  })

  it("navigates with the selected limit from the multi-limit selector", () => {
    mockBudgetLimits = [
      ...mockBudgetLimits,
      {
        id: "limit-food-2",
        attributes: {
          budget_id: "budget-food",
          start: "2026-07-15",
          end: "2026-07-31",
          amount: "200.00",
          currency_code: "USD",
          currency_symbol: "$",
        },
      },
    ]
    const { getByLabelText, getByText } = renderScreen()

    fireEvent.press(getByLabelText("Edit Food & Dining"))
    fireEvent.press(getByText("2026-07-15 - 2026-07-31"))

    expect(mockNavigate).toHaveBeenCalledWith("BudgetEditor", {
      budgetId: "budget-food",
      limitId: "limit-food-2",
    })
  })

  it("normalizes Firefly timestamp dates for card ranges", () => {
    mockBudgetLimits = [
      {
        id: "limit-food",
        attributes: {
          budget_id: "budget-food",
          start: "2026-07-01T00:00:00+00:00",
          end: "2026-07-31T23:59:59+00:00",
          amount: "500.00",
          currency_code: "USD",
          currency_symbol: "$",
        },
      },
    ]
    const { getAllByText, getByLabelText } = renderScreen()

    expect(getAllByText("2026-07-01 - 2026-07-31").length).toBeGreaterThan(0)

    expect(getByLabelText("Edit Food & Dining")).toBeTruthy()
  })

  it("opens Firefly settings from the add button when disconnected", () => {
    mockIsConfigured = false
    const { getByLabelText } = renderScreen()

    fireEvent.press(getByLabelText("Add budget"))

    expect(mockNavigate).toHaveBeenCalledWith("Settings", { screen: "SettingsFirefly" })
  })
})
