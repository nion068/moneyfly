import {
  createContext,
  FC,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { AppState, AppStateStatus, Platform } from "react-native"
import * as LocalAuthentication from "expo-local-authentication"
import { useMMKVString } from "react-native-mmkv"

import { storage } from "@/utils/storage"

type SecurityContextType = {
  biometricEnabled: boolean
  biometricSupported: boolean
  biometricEnrolled: boolean
  isChecking: boolean
  isAuthenticating: boolean
  isLocked: boolean
  error?: string
  setBiometricEnabled: (enabled: boolean) => Promise<boolean>
  unlock: () => Promise<boolean>
}

const SecurityContext = createContext<SecurityContextType | null>(null)

function getAuthenticationErrorMessage(error?: string) {
  switch (error) {
    case "user_cancel":
      return "Unlock was cancelled. Tap Unlock to try again."
    case "app_cancel":
    case "system_cancel":
      return "The system interrupted authentication. Tap Unlock to try again."
    case "lockout":
      return "Too many attempts. Use your device passcode or try again later."
    case "passcode_not_set":
      return "Set a device passcode before using biometric unlock."
    case "not_enrolled":
      return "Enroll Face ID, fingerprint, or device authentication in system settings."
    case "not_available":
      return "Device authentication is not available on this device."
    case "timeout":
      return "Authentication timed out. Tap Unlock to try again."
    case "authentication_failed":
      return "Authentication failed. Tap Unlock to try again."
    default:
      return error
        ? `Authentication failed (${error}). Tap Unlock to try again.`
        : "Authentication failed. Tap Unlock to try again."
  }
}

export const SecurityProvider: FC<PropsWithChildren> = ({ children }) => {
  const [storedEnabled, setStoredEnabled] = useMMKVString("Security.biometricEnabled", storage)
  const [biometricSupported, setBiometricSupported] = useState(false)
  const [biometricEnrolled, setBiometricEnrolled] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isLocked, setIsLocked] = useState(storedEnabled === "true")
  const [error, setError] = useState<string>()
  const isAuthenticatingRef = useRef(false)
  const biometricEnabled = storedEnabled === "true"

  useEffect(() => {
    let active = true
    void (async () => {
      setError(undefined)
      if (Platform.OS === "web") {
        if (active) {
          setBiometricSupported(false)
          setBiometricEnrolled(false)
          setStoredEnabled("false")
          setIsLocked(false)
          setIsChecking(false)
        }
        return
      }
      try {
        const [hardware, enrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ])
        if (!active) return
        setBiometricSupported(hardware)
        setBiometricEnrolled(enrolled)
        if (!hardware || !enrolled) {
          setStoredEnabled("false")
          setIsLocked(false)
        }
      } catch {
        if (!active) return
        setBiometricSupported(false)
        setBiometricEnrolled(false)
        setStoredEnabled("false")
        setIsLocked(false)
        setError("Unable to check biometric authentication on this device.")
      } finally {
        if (active) setIsChecking(false)
      }
    })()
    return () => {
      active = false
    }
  }, [setStoredEnabled])

  const authenticate = useCallback(async () => {
    if (isAuthenticatingRef.current) {
      setError("Authentication is already in progress.")
      return false
    }

    setError(undefined)
    if (!biometricSupported || !biometricEnrolled) {
      setError("Biometric authentication is not available or enrolled on this device.")
      return false
    }
    isAuthenticatingRef.current = true
    setIsAuthenticating(true)
    try {
      await LocalAuthentication.cancelAuthenticate().catch(() => {})

      let timeout: ReturnType<typeof setTimeout> | undefined
      const result = await Promise.race([
        LocalAuthentication.authenticateAsync({
          promptMessage: "Unlock Moneyfly",
          promptSubtitle: "Confirm it is you",
          promptDescription: "Use Face ID, fingerprint, or your device passcode.",
          cancelLabel: "Cancel",
          fallbackLabel: "Use Passcode",
          disableDeviceFallback: false,
        }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("authentication-timeout")), 30000)
        }),
      ]).finally(() => {
        if (timeout) clearTimeout(timeout)
      })

      if (!result.success) {
        setError(getAuthenticationErrorMessage(result.error))
        return false
      }
      return true
    } catch (authError) {
      await LocalAuthentication.cancelAuthenticate().catch(() => {})
      setError(
        authError instanceof Error && authError.message === "authentication-timeout"
          ? "Authentication did not appear. Tap Unlock to try again."
          : "Authentication could not start. Tap Unlock to try again.",
      )
      return false
    } finally {
      isAuthenticatingRef.current = false
      setIsAuthenticating(false)
    }
  }, [biometricEnrolled, biometricSupported])

  const unlock = useCallback(async () => {
    const ok = await authenticate()
    if (ok) setIsLocked(false)
    return ok
  }, [authenticate])

  const setBiometricEnabled = useCallback(
    async (enabled: boolean) => {
      setError(undefined)
      if (enabled === biometricEnabled) return true
      if (enabled) {
        const ok = await authenticate()
        if (!ok) return false
      }
      setStoredEnabled(enabled ? "true" : "false")
      setIsLocked(false)
      return true
    },
    [authenticate, biometricEnabled, setStoredEnabled],
  )

  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (isAuthenticatingRef.current) return
      if (nextState !== "active" && biometricEnabled) setIsLocked(true)
    }
    const subscription = AppState.addEventListener("change", handleAppState)
    return () => subscription.remove()
  }, [biometricEnabled])

  const value = useMemo(
    () => ({
      biometricEnabled,
      biometricSupported,
      biometricEnrolled,
      isChecking,
      isAuthenticating,
      isLocked,
      error,
      setBiometricEnabled,
      unlock,
    }),
    [
      biometricEnabled,
      biometricEnrolled,
      biometricSupported,
      error,
      isAuthenticating,
      isChecking,
      isLocked,
      setBiometricEnabled,
      unlock,
    ],
  )

  return <SecurityContext.Provider value={value}>{children}</SecurityContext.Provider>
}

export function useSecurity() {
  const context = useContext(SecurityContext)
  if (!context) throw new Error("useSecurity must be used within SecurityProvider")
  return context
}
