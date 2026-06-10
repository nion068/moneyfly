import * as LocalAuthentication from "expo-local-authentication"
import { act, render, waitFor } from "@testing-library/react-native"

import { SecurityProvider, useSecurity } from "./SecurityContext"

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}))

jest.mock("react-native-mmkv", () => {
  const React = jest.requireActual("react")
  return {
    useMMKVString: () => React.useState(undefined),
  }
})

jest.mock("@/utils/storage", () => ({ storage: {} }))

type SecurityValue = ReturnType<typeof useSecurity>
let latestContext: SecurityValue

function ContextProbe() {
  latestContext = useSecurity()
  return null
}

describe("SecurityProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true)
    ;(LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true)
    ;(LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true })
  })

  it("enables biometric locking only after successful authentication", async () => {
    render(
      <SecurityProvider>
        <ContextProbe />
      </SecurityProvider>,
    )

    await waitFor(() => expect(latestContext.isChecking).toBe(false))
    expect(latestContext.biometricSupported).toBe(true)
    expect(latestContext.biometricEnrolled).toBe(true)

    await act(async () => {
      await latestContext.setBiometricEnabled(true)
    })

    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1)
    expect(latestContext.biometricEnabled).toBe(true)
  })

  it("keeps biometric locking disabled when authentication fails", async () => {
    ;(LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: "user_cancel",
    })
    render(
      <SecurityProvider>
        <ContextProbe />
      </SecurityProvider>,
    )

    await waitFor(() => expect(latestContext.isChecking).toBe(false))
    await act(async () => {
      await latestContext.setBiometricEnabled(true)
    })

    expect(latestContext.biometricEnabled).toBe(false)
    expect(latestContext.error).toBeTruthy()
  })
})
