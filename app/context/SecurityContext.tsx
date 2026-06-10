import {
  createContext,
  FC,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  isLocked: boolean
  error?: string
  setBiometricEnabled: (enabled: boolean) => Promise<boolean>
  unlock: () => Promise<boolean>
}

const SecurityContext = createContext<SecurityContextType | null>(null)
export const BIOMETRIC_AUTHENTICATION_ENABLED = false

export const SecurityProvider: FC<PropsWithChildren> = ({ children }) => {
  const [storedEnabled, setStoredEnabled] = useMMKVString("Security.biometricEnabled", storage)
  const [biometricSupported, setBiometricSupported] = useState(false)
  const [biometricEnrolled, setBiometricEnrolled] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [isLocked, setIsLocked] = useState(
    BIOMETRIC_AUTHENTICATION_ENABLED && storedEnabled === "true",
  )
  const [error, setError] = useState<string>()
  const biometricEnabled = BIOMETRIC_AUTHENTICATION_ENABLED && storedEnabled === "true"

  useEffect(() => {
    if (!BIOMETRIC_AUTHENTICATION_ENABLED) {
      setStoredEnabled("false")
      setBiometricSupported(false)
      setBiometricEnrolled(false)
      setIsLocked(false)
      setIsChecking(false)
      return
    }

    let active = true
    void (async () => {
      if (Platform.OS === "web") {
        if (active) setIsChecking(false)
        return
      }
      const [hardware, enrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ])
      if (!active) return
      setBiometricSupported(hardware)
      setBiometricEnrolled(enrolled)
      setIsChecking(false)
    })()
    return () => {
      active = false
    }
  }, [setStoredEnabled])

  const authenticate = useCallback(async () => {
    setError(undefined)
    if (!BIOMETRIC_AUTHENTICATION_ENABLED) {
      setError("Biometric authentication is temporarily unavailable.")
      return false
    }
    if (!biometricSupported || !biometricEnrolled) {
      setError("Biometric authentication is not available or enrolled on this device.")
      return false
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock Moneyfly",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    })
    if (!result.success) {
      setError("Authentication was cancelled or unsuccessful.")
      return false
    }
    return true
  }, [biometricEnrolled, biometricSupported])

  const unlock = useCallback(async () => {
    const ok = await authenticate()
    if (ok) setIsLocked(false)
    return ok
  }, [authenticate])

  const setBiometricEnabled = useCallback(
    async (enabled: boolean) => {
      if (!BIOMETRIC_AUTHENTICATION_ENABLED) {
        setStoredEnabled("false")
        setIsLocked(false)
        if (enabled) setError("Biometric authentication is temporarily unavailable.")
        return !enabled
      }
      if (enabled === biometricEnabled) return true
      const ok = await authenticate()
      if (!ok) return false
      setStoredEnabled(enabled ? "true" : "false")
      setIsLocked(false)
      return true
    },
    [authenticate, biometricEnabled, setStoredEnabled],
  )

  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === "background" && biometricEnabled) setIsLocked(true)
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
