import { fireEvent, render } from "@testing-library/react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { ThemeProvider } from "@/theme/context"

import { HomeScreen } from "./HomeScreen"

const mockNavigate = jest.fn()
let mockIsConfigured = false
const mockSelectedMonth = new Date(2026, 5, 1)

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
    transactions: { data: [], status: "idle" },
    accounts: { data: [], status: "idle" },
    categories: { data: [], status: "idle" },
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
})
