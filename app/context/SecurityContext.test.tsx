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

  it("keeps biometric locking disabled without checking device hardware", async () => {
    render(
      <SecurityProvider>
        <ContextProbe />
      </SecurityProvider>,
    )

    await waitFor(() => expect(latestContext.isChecking).toBe(false))
    expect(latestContext.biometricSupported).toBe(false)
    expect(latestContext.biometricEnrolled).toBe(false)
    expect(latestContext.biometricEnabled).toBe(false)
    expect(latestContext.isLocked).toBe(false)
    expect(LocalAuthentication.hasHardwareAsync).not.toHaveBeenCalled()
    expect(LocalAuthentication.isEnrolledAsync).not.toHaveBeenCalled()
  })

  it("does not allow biometric locking to be enabled", async () => {
    render(
      <SecurityProvider>
        <ContextProbe />
      </SecurityProvider>,
    )

    await waitFor(() => expect(latestContext.isChecking).toBe(false))
    let enabled = true
    await act(async () => {
      enabled = await latestContext.setBiometricEnabled(true)
    })

    expect(enabled).toBe(false)
    expect(latestContext.biometricEnabled).toBe(false)
    expect(latestContext.isLocked).toBe(false)
    expect(latestContext.error).toBe("Biometric authentication is temporarily unavailable.")
    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled()
  })
})
