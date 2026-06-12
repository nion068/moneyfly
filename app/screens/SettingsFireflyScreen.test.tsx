import { fireEvent, render, waitFor } from "@testing-library/react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { ThemeProvider } from "@/theme/context"

import { SettingsFireflyScreen } from "./SettingsFireflyScreen"

const mockSetConnection = jest.fn()

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
    isConfigured: false,
    baseUrl: "",
    accounts: { data: [], status: "idle" },
    transactions: { data: [], status: "idle" },
    lastSyncedAt: undefined,
    isRefreshing: false,
    isTestingConnection: false,
    connectionError: undefined,
    setConnection: mockSetConnection,
    refresh: jest.fn(),
    disconnect: jest.fn(),
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
        <SettingsFireflyScreen navigation={{ goBack: jest.fn() } as never} route={{} as never} />
      </ThemeProvider>
    </SafeAreaProvider>,
  )
}

describe("SettingsFireflyScreen disconnected state", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSetConnection.mockResolvedValue(true)
  })

  it("opens the credential editor and hides connected-only controls", () => {
    const { getAllByText, getByText, queryByText } = renderScreen()

    expect(getByText("Not connected")).toBeTruthy()
    expect(getAllByText("Server URL")).toHaveLength(2)
    expect(getByText("New personal access token")).toBeTruthy()
    expect(queryByText("Sync Now")).toBeNull()
    expect(queryByText("Disconnect Firefly")).toBeNull()
  })

  it("validates and saves both connection fields", async () => {
    const { getAllByDisplayValue, getByText } = renderScreen()
    const [serverInput, tokenInput] = getAllByDisplayValue("")

    fireEvent.changeText(serverInput, "firefly.example.com")
    fireEvent.changeText(tokenInput, "pat-token")
    fireEvent.press(getByText("Save Connection"))

    await waitFor(() => {
      expect(mockSetConnection).toHaveBeenCalledWith("firefly.example.com", "pat-token")
    })
  })
})
