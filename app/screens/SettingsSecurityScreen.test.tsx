import { fireEvent, render } from "@testing-library/react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { ThemeProvider } from "@/theme/context"

import { SettingsSecurityScreen } from "./SettingsSecurityScreen"

const mockSetBiometricEnabled = jest.fn()
const mockSetBiometricLockDelaySeconds = jest.fn()

const mockSecurityState = {
  biometricEnabled: true,
  biometricLockDelaySeconds: 30,
  biometricSupported: true,
  biometricEnrolled: true,
  isChecking: false,
  isAuthenticating: false,
  isLocked: false,
  error: undefined,
  setBiometricEnabled: mockSetBiometricEnabled,
  setBiometricLockDelaySeconds: mockSetBiometricLockDelaySeconds,
  unlock: jest.fn(),
}

jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: (props: object) => {
    const { View } = require("react-native")
    return <View {...props} />
  },
}))

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useScrollToTop: jest.fn(),
}))

jest.mock("@/context/SecurityContext", () => {
  const actual = jest.requireActual("@/context/SecurityContext")
  return {
    ...actual,
    useSecurity: () => mockSecurityState,
  }
})

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 375, height: 812 },
        insets: { top: 44, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider initialContext="dark">
        <SettingsSecurityScreen navigation={{ goBack: jest.fn() } as never} route={{} as never} />
      </ThemeProvider>
    </SafeAreaProvider>,
  )
}

describe("SettingsSecurityScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Object.assign(mockSecurityState, {
      biometricEnabled: true,
      biometricLockDelaySeconds: 30,
      biometricSupported: true,
      biometricEnrolled: true,
      isChecking: false,
      error: undefined,
    })
  })

  it("renders the biometric lock delay presets", () => {
    const { getByLabelText, getByText } = renderScreen()

    expect(getByLabelText("Lock Delay").props.accessibilityState.expanded).toBe(true)

    expect(getByText("Immediately")).toBeTruthy()
    expect(getByText("After 15 seconds")).toBeTruthy()
    expect(getByText("After 30 seconds")).toBeTruthy()
    expect(getByText("After 1 minute")).toBeTruthy()
    expect(getByText("After 5 minutes")).toBeTruthy()
  })

  it("shows the default 30 second selection in the notice copy", () => {
    const { getByLabelText, getByText } = renderScreen()

    expect(getByText("After 30 seconds")).toBeTruthy()
    expect(getByLabelText("After 30 seconds").props.accessibilityState.selected).toBe(true)
    expect(
      getByText(
        "Moneyfly will lock 30 seconds after it leaves the foreground and ask for device authentication when reopened.",
      ),
    ).toBeTruthy()
  })

  it("updates the stored delay when a new preset is selected", () => {
    const { getByLabelText } = renderScreen()

    fireEvent.press(getByLabelText("After 1 minute"))

    expect(mockSetBiometricLockDelaySeconds).toHaveBeenCalledWith(60)
  })

  it("collapses and expands the lock delay section", () => {
    const { getByLabelText, queryByText } = renderScreen()

    fireEvent.press(getByLabelText("Lock Delay"))

    expect(getByLabelText("Lock Delay").props.accessibilityState.expanded).toBe(false)
    expect(queryByText("After 1 minute")).toBeNull()

    fireEvent.press(getByLabelText("Lock Delay"))

    expect(getByLabelText("Lock Delay").props.accessibilityState.expanded).toBe(true)
    expect(queryByText("After 1 minute")).toBeTruthy()
  })

  it("preserves the disabled state when biometric unlock is unavailable", () => {
    Object.assign(mockSecurityState, {
      biometricEnabled: false,
      biometricEnrolled: false,
      biometricSupported: true,
    })

    const { getByLabelText } = renderScreen()

    expect(getByLabelText("Immediately").props.accessibilityState.disabled).toBe(true)
    expect(getByLabelText("After 30 seconds").props.accessibilityState.disabled).toBe(true)
  })
})
