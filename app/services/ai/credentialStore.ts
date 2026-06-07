import { Platform } from "react-native"
import * as SecureStore from "expo-secure-store"

const webSecrets = new Map<string, string>()

export async function loadSecret(key: string): Promise<string | null> {
  if (Platform.OS === "web") return webSecrets.get(key) ?? null
  try {
    return (await SecureStore.getItemAsync(key)) ?? null
  } catch {
    return null
  }
}

export async function saveSecret(key: string, value: string): Promise<boolean> {
  if (Platform.OS === "web") {
    webSecrets.set(key, value)
    return true
  }

  try {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    })
    return true
  } catch {
    return false
  }
}

export async function removeSecret(key: string): Promise<void> {
  if (Platform.OS === "web") {
    webSecrets.delete(key)
    return
  }

  try {
    await SecureStore.deleteItemAsync(key)
  } catch {}
}
