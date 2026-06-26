import { ReactNode } from "react"
import { act, render, waitFor } from "@testing-library/react-native"
import { View } from "react-native"

import { ThemeProvider } from "@/theme/context"

import { SecurityGate } from "./SecurityGate"

const mockUnlock = jest.fn()

type MockSecurityState = {
  biometricEnabled: boolean
  biometricEnrolled: boolean
  biometricSupported: boolean
  isAuthenticating: boolean
  isChecking: boolean
  isLocked: boolean
  error?: string
}

let mockSecurityState: MockSecurityState = {
  biometricEnabled: false,
  biometricEnrolled: true,
  biometricSupported: true,
  isAuthenticating: false,
  isChecking: false,
  isLocked: false,
}

jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: (props: object) => {
    const { View } = require("react-native")
    return <View {...props} />
  },
}))

jest.mock("@/context/SecurityContext", () => ({
  useSecurity: () => ({
    ...mockSecurityState,
    unlock: mockUnlock,
  }),
}))

function renderGate(children: ReactNode = <View testID="protected-content" />) {
  return render(
    <ThemeProvider initialContext="dark">
      <SecurityGate>{children}</SecurityGate>
    </ThemeProvider>,
  )
}

describe("SecurityGate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    mockSecurityState = {
      biometricEnabled: false,
      biometricEnrolled: true,
      biometricSupported: true,
      isAuthenticating: false,
      isChecking: false,
      isLocked: false,
    }
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("keeps protected content mounted while showing the lock overlay", () => {
    mockSecurityState = {
      ...mockSecurityState,
      biometricEnabled: true,
      isLocked: true,
    }

    const { UNSAFE_getByProps, getByText } = renderGate()

    expect(UNSAFE_getByProps({ testID: "protected-content" })).toBeTruthy()
    expect(getByText("Moneyfly is locked")).toBeTruthy()
    expect(
      getByText("Use Face ID, fingerprint, or your device passcode to continue."),
    ).toBeTruthy()
  })

  it("starts a single delayed unlock attempt for each lock event", async () => {
    mockSecurityState = {
      ...mockSecurityState,
      biometricEnabled: true,
      isLocked: true,
    }

    const view = renderGate()

    await act(async () => {
      jest.advanceTimersByTime(650)
    })

    expect(mockUnlock).toHaveBeenCalledTimes(1)

    view.rerender(
      <ThemeProvider initialContext="dark">
        <SecurityGate>
          <View testID="protected-content" />
        </SecurityGate>
      </ThemeProvider>,
    )

    expect(mockUnlock).toHaveBeenCalledTimes(1)

    mockSecurityState = {
      ...mockSecurityState,
      isLocked: false,
    }

    view.rerender(
      <ThemeProvider initialContext="dark">
        <SecurityGate>
          <View testID="protected-content" />
        </SecurityGate>
      </ThemeProvider>,
    )

    mockSecurityState = {
      ...mockSecurityState,
      isLocked: true,
    }

    view.rerender(
      <ThemeProvider initialContext="dark">
        <SecurityGate>
          <View testID="protected-content" />
        </SecurityGate>
      </ThemeProvider>,
    )

    await act(async () => {
      jest.advanceTimersByTime(650)
    })

    await waitFor(() => expect(mockUnlock).toHaveBeenCalledTimes(2))
  })
})
