import { AppState, AppStateStatus } from "react-native"
import * as LocalAuthentication from "expo-local-authentication"
import { act, render, waitFor } from "@testing-library/react-native"

import { SecurityProvider, useSecurity } from "./SecurityContext"

let mockStoredEnabled: string | undefined

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
  cancelAuthenticate: jest.fn(),
}))

jest.mock("react-native-mmkv", () => {
  const React = jest.requireActual("react")
  return {
    useMMKVString: () => React.useState(mockStoredEnabled),
  }
})

jest.mock("@/utils/storage", () => ({ storage: {} }))

type SecurityValue = ReturnType<typeof useSecurity>
let latestContext: SecurityValue
let appStateListener: ((state: AppStateStatus) => void) | undefined

function ContextProbe() {
  latestContext = useSecurity()
  return null
}

describe("SecurityProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStoredEnabled = undefined
    appStateListener = undefined
    ;(LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true)
    ;(LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true)
    ;(LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true })
    ;(LocalAuthentication.cancelAuthenticate as jest.Mock).mockResolvedValue(undefined)
    jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
      appStateListener = listener
      return { remove: jest.fn() }
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("checks device biometric availability on startup", async () => {
    render(
      <SecurityProvider>
        <ContextProbe />
      </SecurityProvider>,
    )

    await waitFor(() => expect(latestContext.isChecking).toBe(false))
    expect(latestContext.biometricSupported).toBe(true)
    expect(latestContext.biometricEnrolled).toBe(true)
    expect(latestContext.biometricEnabled).toBe(false)
    expect(latestContext.isLocked).toBe(false)
    expect(LocalAuthentication.hasHardwareAsync).toHaveBeenCalledTimes(1)
    expect(LocalAuthentication.isEnrolledAsync).toHaveBeenCalledTimes(1)
  })

  it("starts locked on cold launch when biometric locking was already enabled", async () => {
    mockStoredEnabled = "true"

    render(
      <SecurityProvider>
        <ContextProbe />
      </SecurityProvider>,
    )

    expect(latestContext.biometricEnabled).toBe(true)
    expect(latestContext.isLocked).toBe(true)
    await waitFor(() => expect(latestContext.isChecking).toBe(false))
    expect(latestContext.isLocked).toBe(true)
  })

  it("clears a persisted biometric lock when enrolled authentication is no longer available", async () => {
    mockStoredEnabled = "true"
    ;(LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(false)

    render(
      <SecurityProvider>
        <ContextProbe />
      </SecurityProvider>,
    )

    expect(latestContext.isLocked).toBe(true)
    await waitFor(() => expect(latestContext.isChecking).toBe(false))
    expect(latestContext.biometricEnabled).toBe(false)
    expect(latestContext.isLocked).toBe(false)
  })

  it("authenticates before enabling biometric locking", async () => {
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

    expect(enabled).toBe(true)
    expect(latestContext.biometricEnabled).toBe(true)
    expect(latestContext.isLocked).toBe(false)
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith({
      promptMessage: "Unlock Moneyfly",
      promptSubtitle: "Confirm it is you",
      promptDescription: "Use Face ID, fingerprint, or your device passcode.",
      cancelLabel: "Cancel",
      fallbackLabel: "Use Passcode",
      disableDeviceFallback: false,
    })
  })

  it("does not enable biometric locking after failed authentication", async () => {
    ;(LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
      success: false,
      error: "user_cancel",
    })

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
    expect(latestContext.error).toBe("Unlock was cancelled. Tap Unlock to try again.")
  })

  it("shows the native failure reason when system authentication is interrupted", async () => {
    ;(LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
      success: false,
      error: "app_cancel",
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

    expect(latestContext.error).toBe(
      "The system interrupted authentication. Tap Unlock to try again.",
    )
  })

  it("blocks enablement when biometrics are not enrolled", async () => {
    ;(LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(false)

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
    expect(latestContext.biometricSupported).toBe(true)
    expect(latestContext.biometricEnrolled).toBe(false)
    expect(latestContext.biometricEnabled).toBe(false)
    expect(latestContext.error).toBe(
      "Biometric authentication is not available or enrolled on this device.",
    )
    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled()
  })

  it("locks when the app leaves the foreground after biometric locking is enabled", async () => {
    render(
      <SecurityProvider>
        <ContextProbe />
      </SecurityProvider>,
    )

    await waitFor(() => expect(latestContext.isChecking).toBe(false))
    await act(async () => {
      await latestContext.setBiometricEnabled(true)
    })

    act(() => {
      appStateListener?.("inactive")
    })

    expect(latestContext.isLocked).toBe(true)
  })

  it("unlocks after successful authentication", async () => {
    mockStoredEnabled = "true"

    render(
      <SecurityProvider>
        <ContextProbe />
      </SecurityProvider>,
    )

    await waitFor(() => expect(latestContext.isChecking).toBe(false))
    act(() => {
      appStateListener?.("background")
    })

    expect(latestContext.isLocked).toBe(true)

    let unlocked = false
    await act(async () => {
      unlocked = await latestContext.unlock()
    })

    expect(unlocked).toBe(true)
    expect(latestContext.isLocked).toBe(false)
  })

  it("does not lock from app state changes caused by an active authentication prompt", async () => {
    let resolveAuthentication: (value: { success: true }) => void = () => {}
    ;(LocalAuthentication.authenticateAsync as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAuthentication = resolve
        }),
    )

    render(
      <SecurityProvider>
        <ContextProbe />
      </SecurityProvider>,
    )

    await waitFor(() => expect(latestContext.isChecking).toBe(false))
    let enablePromise: Promise<boolean>
    await act(async () => {
      enablePromise = latestContext.setBiometricEnabled(true)
    })

    act(() => {
      appStateListener?.("inactive")
    })

    expect(latestContext.isLocked).toBe(false)

    await act(async () => {
      resolveAuthentication({ success: true })
      await enablePromise
    })

    expect(latestContext.isLocked).toBe(false)
  })

  it("ignores overlapping authentication attempts", async () => {
    let resolveAuthentication: (value: { success: true }) => void = () => {}
    ;(LocalAuthentication.authenticateAsync as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAuthentication = resolve
        }),
    )

    render(
      <SecurityProvider>
        <ContextProbe />
      </SecurityProvider>,
    )

    await waitFor(() => expect(latestContext.isChecking).toBe(false))
    let firstUnlock: Promise<boolean>
    let secondUnlock: Promise<boolean>
    await act(async () => {
      firstUnlock = latestContext.unlock()
      secondUnlock = latestContext.unlock()
    })

    await expect(secondUnlock!).resolves.toBe(false)
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveAuthentication({ success: true })
      await firstUnlock
    })
  })
})
