import { fireEvent, render, waitFor } from "@testing-library/react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import type { FireflyBudget, FireflyBudgetLimit } from "@/models/firefly"
import type { BudgetPeriod } from "@/services/firefly/transforms"
import { ThemeProvider } from "@/theme/context"

import { BudgetEditorScreen } from "./BudgetEditorScreen"

const mockGoBack = jest.fn()
const mockReplace = jest.fn()
const mockSaveBudgetWithLimit = jest.fn()
const mockDeleteBudget = jest.fn()
const mockResetBudgetMutation = jest.fn()
let mockIsConfigured = true
let mockBudgetMutation: { data: null; status: string; error?: { message: string } } = {
  data: null,
  status: "idle",
}
let mockSelectedBudgetPeriod: BudgetPeriod = "month"

const budgets: FireflyBudget[] = [
  {
    id: "budget-food",
    attributes: {
      name: "Food & Dining",
      active: true,
      notes: null,
      currency_code: "USD",
      currency_symbol: "$",
      auto_budget_type: "none",
    },
  },
]

let mockBudgetLimits: FireflyBudgetLimit[] = [
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
    budgetMutation: mockBudgetMutation,
    saveBudgetWithLimit: mockSaveBudgetWithLimit,
    deleteBudget: mockDeleteBudget,
    resetBudgetMutation: mockResetBudgetMutation,
  }),
}))

function renderEditor(params?: { budgetId?: string; limitId?: string }) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 375, height: 812 },
        insets: { top: 44, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider initialContext="dark">
        <BudgetEditorScreen
          navigation={{ goBack: mockGoBack, replace: mockReplace } as never}
          route={{ name: "BudgetEditor", params } as never}
        />
      </ThemeProvider>
    </SafeAreaProvider>,
  )
}

describe("BudgetEditorScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsConfigured = true
    mockBudgetMutation = { data: null, status: "idle" }
    mockSelectedBudgetPeriod = "month"
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
    mockSaveBudgetWithLimit.mockResolvedValue(true)
    mockDeleteBudget.mockResolvedValue(true)
  })

  it("creates a budget and matching limit with the existing payload shape", async () => {
    const { getByLabelText, getByText } = renderEditor()

    fireEvent.changeText(getByLabelText("Budget name"), "Utilities")
    fireEvent.changeText(getByLabelText("Budget amount"), "250")
    fireEvent.press(getByText("Save"))

    await waitFor(() => {
      expect(mockSaveBudgetWithLimit).toHaveBeenCalledWith(
        {
          name: "Utilities",
          active: true,
          notes: null,
          fire_webhooks: true,
          auto_budget_type: "none",
          auto_budget_currency_code: null,
          auto_budget_amount: null,
          auto_budget_period: null,
        },
        {
          currency_code: "USD",
          start: "2026-07-01",
          end: "2026-07-31",
          amount: "250.00",
          notes: null,
          fire_webhooks: true,
        },
        undefined,
        undefined,
      )
    })
    expect(mockGoBack).toHaveBeenCalled()
  })

  it("requires an auto-budget amount when auto-budget is enabled", () => {
    const { getByLabelText, getByText, queryByText } = renderEditor()

    fireEvent.changeText(getByLabelText("Budget name"), "Utilities")
    fireEvent.changeText(getByLabelText("Budget amount"), "250")
    fireEvent.press(getByLabelText("Auto-budget"))
    expect(queryByText("Add an amount every period and correct for overspending")).toBeNull()
    fireEvent.press(getByText("Set a fixed amount every period"))
    fireEvent.press(getByText("Save"))

    expect(getByText("Auto-budget amount must be a valid number.")).toBeTruthy()
    expect(mockSaveBudgetWithLimit).not.toHaveBeenCalled()
  })

  it("creates a budget with auto-budget fields", async () => {
    const { getByLabelText, getByText } = renderEditor()

    fireEvent.changeText(getByLabelText("Budget name"), "Utilities")
    fireEvent.changeText(getByLabelText("Budget amount"), "250")
    fireEvent.press(getByLabelText("Auto-budget"))
    fireEvent.press(getByText("Set a fixed amount every period"))
    fireEvent.changeText(getByLabelText("Auto-budget amount"), "250")
    fireEvent.press(getByLabelText("Auto-budget period"))
    fireEvent.press(getByText("Quarterly"))
    fireEvent.press(getByText("Save"))

    await waitFor(() => {
      expect(mockSaveBudgetWithLimit).toHaveBeenCalledWith(
        {
          name: "Utilities",
          active: true,
          notes: null,
          fire_webhooks: true,
          auto_budget_type: "reset",
          auto_budget_currency_code: "USD",
          auto_budget_amount: "250.00",
          auto_budget_period: "quarterly",
        },
        expect.objectContaining({ amount: "250.00" }),
        undefined,
        undefined,
      )
    })
  })

  it("prefills an existing budget and limit, then saves updates", async () => {
    const { getByDisplayValue, getByLabelText, getByText } = renderEditor({
      budgetId: "budget-food",
      limitId: "limit-food",
    })

    expect(getByText("Edit Budget")).toBeTruthy()
    expect(getByDisplayValue("Food & Dining")).toBeTruthy()
    expect(getByDisplayValue("500.00")).toBeTruthy()

    fireEvent.changeText(getByLabelText("Budget amount"), "650")
    fireEvent.press(getByText("Save"))

    await waitFor(() => {
      expect(mockSaveBudgetWithLimit).toHaveBeenCalledWith(
        {
          name: "Food & Dining",
          active: true,
          notes: null,
          fire_webhooks: true,
          auto_budget_type: "none",
          auto_budget_currency_code: null,
          auto_budget_amount: null,
          auto_budget_period: null,
        },
        {
          currency_code: "USD",
          start: "2026-07-01",
          end: "2026-07-31",
          amount: "650.00",
          notes: null,
          fire_webhooks: true,
        },
        budgets[0],
        mockBudgetLimits[0],
      )
    })
  })

  it("creates a budget with the selected custom range mode", async () => {
    const { getByLabelText, getByText } = renderEditor()

    fireEvent.changeText(getByLabelText("Budget name"), "Utilities")
    fireEvent.changeText(getByLabelText("Budget amount"), "250")
    fireEvent.press(getByLabelText("Range"))
    fireEvent.press(getByText("Custom"))
    fireEvent.press(getByText("Save"))

    await waitFor(() => {
      expect(mockSaveBudgetWithLimit).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          start: "2026-07-01",
          end: "2026-07-31",
        }),
        undefined,
        undefined,
      )
    })
  })

  it("confirms and deletes an existing budget", async () => {
    const { getByLabelText, getByText } = renderEditor({
      budgetId: "budget-food",
      limitId: "limit-food",
    })

    fireEvent.press(getByText("Delete budget"))

    expect(getByText("Delete budget?")).toBeTruthy()
    expect(
      getByText(
        'This permanently deletes "Food & Dining" from Firefly. Existing transactions may retain historical values.',
      ),
    ).toBeTruthy()
    fireEvent.press(getByLabelText("Confirm delete budget"))

    await waitFor(() => expect(mockDeleteBudget).toHaveBeenCalledWith("budget-food"))
    expect(mockGoBack).toHaveBeenCalled()
  })

  it("redirects to Firefly settings when disconnected", () => {
    mockIsConfigured = false

    renderEditor()

    expect(mockReplace).toHaveBeenCalledWith("Main", {
      screen: "Settings",
      params: { screen: "SettingsFirefly" },
    })
  })
})
