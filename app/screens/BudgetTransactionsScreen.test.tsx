import { fireEvent, render, waitFor } from "@testing-library/react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import type { FireflyTransaction } from "@/models/firefly"
import { FireflyApi } from "@/services/firefly/api"
import { ThemeProvider } from "@/theme/context"

import { BudgetTransactionsScreen } from "./BudgetTransactionsScreen"

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()
const mockReplace = jest.fn()
const mockGetTransactions = jest.fn()
let mockIsConfigured = true

const fireflyTransactions: FireflyTransaction[] = [
  {
    id: "group-food",
    attributes: {
      transactions: [
        {
          transaction_journal_id: "journal-food",
          date: "2026-07-04T10:00:00+06:00",
          amount: "450.00",
          description: "KFC",
          type: "withdrawal",
          source_name: "bKash",
          destination_name: "KFC",
          category_name: "Food & Dining",
          budget_id: "budget-food",
          budget_name: "Food & Dining",
          currency_code: "BDT",
          currency_symbol: "৳",
        },
      ],
    },
  },
  {
    id: "group-rent",
    attributes: {
      transactions: [
        {
          transaction_journal_id: "journal-rent",
          date: "2026-07-05T10:00:00+06:00",
          amount: "1000.00",
          description: "Rent",
          type: "withdrawal",
          source_name: "Bank",
          destination_name: "Landlord",
          category_name: "Housing",
          budget_id: "budget-rent",
          currency_code: "BDT",
          currency_symbol: "৳",
        },
      ],
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
    baseUrl: "https://firefly.example.com",
    token: "token",
    isConfigured: mockIsConfigured,
    hideAmounts: false,
  }),
}))

jest.mock("@/services/firefly/api", () => ({
  FireflyApi: jest.fn().mockImplementation(() => ({
    getTransactions: mockGetTransactions,
  })),
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
        <BudgetTransactionsScreen
          navigation={{ navigate: mockNavigate, goBack: mockGoBack, replace: mockReplace } as never}
          route={
            {
              params: {
                budgetId: "budget-food",
                budgetName: "Food & Dining",
                range: { start: "2026-07-01", end: "2026-07-31" },
                allocated: 500,
                symbol: "৳",
              },
            } as never
          }
        />
      </ThemeProvider>
    </SafeAreaProvider>,
  )
}

describe("BudgetTransactionsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsConfigured = true
    mockGetTransactions.mockResolvedValue({ kind: "ok", data: fireflyTransactions })
  })

  it("fetches the route range and renders only transactions for the budget", async () => {
    const { getByText, queryByText } = renderScreen()

    await waitFor(() => expect(getByText("KFC")).toBeTruthy())

    expect(FireflyApi).toHaveBeenCalledWith("https://firefly.example.com", "token")
    expect(mockGetTransactions).toHaveBeenCalledWith({
      start: "2026-07-01",
      end: "2026-07-31",
      type: "withdrawal",
    })
    expect(queryByText("Rent")).toBeNull()
  })

  it("opens transaction details from a transaction row", async () => {
    const { getByLabelText } = renderScreen()

    await waitFor(() => expect(getByLabelText("View KFC")).toBeTruthy())
    fireEvent.press(getByLabelText("View KFC"))

    expect(mockNavigate).toHaveBeenCalledWith("TransactionDetails", {
      transaction: expect.objectContaining({
        groupId: "group-food",
        journalId: "journal-food",
        budgetId: "budget-food",
      }),
    })
  })

  it("renders an empty state when no transactions match the budget", async () => {
    mockGetTransactions.mockResolvedValueOnce({ kind: "ok", data: [fireflyTransactions[1]] })
    const { getByText } = renderScreen()

    await waitFor(() => expect(getByText("No transactions found for this budget.")).toBeTruthy())
  })

  it("renders an error state when Firefly fails", async () => {
    mockGetTransactions.mockResolvedValueOnce({
      kind: "network",
      message: "Could not reach Firefly.",
    })
    const { getByText } = renderScreen()

    await waitFor(() => expect(getByText("Could not reach Firefly. Tap retry.")).toBeTruthy())
  })
})
