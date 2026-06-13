import { fireEvent, render, waitFor } from "@testing-library/react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import type { FireflyAccount } from "@/models/firefly"
import { ThemeProvider } from "@/theme/context"

import { AccountsScreen } from "./AccountsScreen"

const mockNavigate = jest.fn()
const mockSaveAccount = jest.fn()
let mockIsConfigured = true

const accounts: FireflyAccount[] = [
  {
    id: "asset",
    attributes: {
      name: "Main Bank",
      type: "asset",
      current_balance: "1000",
      currency_code: "USD",
      currency_symbol: "$",
      active: true,
    },
  },
  {
    id: "liability",
    attributes: {
      name: "Credit Card",
      type: "liability",
      current_balance: "-200",
      currency_code: "USD",
      currency_symbol: "$",
      active: true,
    },
  },
  {
    id: "expense",
    attributes: {
      name: "Groceries",
      type: "expense",
      currency_code: "USD",
      active: true,
    },
  },
  {
    id: "revenue",
    attributes: {
      name: "Salary",
      type: "revenue",
      currency_code: "USD",
      active: true,
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
    accounts: { data: accounts, status: "ready" },
    selectedCurrency: "USD",
    settingsMutation: { data: null, status: "idle" },
    saveAccount: mockSaveAccount,
    refresh: jest.fn(),
    isRefreshing: false,
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
        <AccountsScreen navigation={{ navigate: mockNavigate } as never} route={{} as never} />
      </ThemeProvider>
    </SafeAreaProvider>,
  )
}

describe("AccountsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsConfigured = true
    mockSaveAccount.mockResolvedValue(true)
  })

  it("shows compact net worth and filters account groups", () => {
    const { getByText, queryByText } = renderScreen()

    expect(getByText("$ 800")).toBeTruthy()
    expect(getByText("Asset Accounts")).toBeTruthy()
    expect(getByText("Expense Accounts")).toBeTruthy()

    fireEvent.press(getByText("Revenue"))

    expect(getByText("Revenue Accounts")).toBeTruthy()
    expect(getByText("Salary")).toBeTruthy()
    expect(queryByText("Main Bank")).toBeNull()
  })

  it("combines search with the selected account group", () => {
    const { getByLabelText, getByText, queryByText } = renderScreen()

    fireEvent.press(getByText("Asset"))
    fireEvent.changeText(getByLabelText("Search accounts"), "bank")

    expect(getByText("Main Bank")).toBeTruthy()
    expect(queryByText("Groceries")).toBeNull()

    fireEvent.changeText(getByLabelText("Search accounts"), "salary")

    expect(getByText('No accounts match "salary".')).toBeTruthy()
  })

  it("creates an account from the header plus button", async () => {
    const { getAllByDisplayValue, getByLabelText, getByText } = renderScreen()

    fireEvent.press(getByLabelText("Add account"))

    expect(getByText("New Account")).toBeTruthy()
    const emptyInputs = getAllByDisplayValue("")
    const nameInput = emptyInputs[emptyInputs.length - 1]
    fireEvent.changeText(nameInput, "Savings")
    fireEvent.press(getByText("Save"))

    await waitFor(() => {
      expect(mockSaveAccount).toHaveBeenCalledWith(
        {
          name: "Savings",
          type: "asset",
          currency_code: "USD",
          active: true,
        },
        undefined,
      )
    })
  })

  it("opens Firefly settings from the plus button when disconnected", () => {
    mockIsConfigured = false
    const { getByLabelText } = renderScreen()

    fireEvent.press(getByLabelText("Add account"))

    expect(mockNavigate).toHaveBeenCalledWith("Settings", { screen: "SettingsFirefly" })
  })
})
