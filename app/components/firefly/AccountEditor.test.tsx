import { fireEvent, render, waitFor } from "@testing-library/react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import type { FireflyAccount, FireflyCurrency } from "@/models/firefly"
import { ThemeProvider } from "@/theme/context"

import { AccountEditor } from "./AccountEditor"

jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: (props: object) => {
    const { View } = require("react-native")
    return <View {...props} />
  },
}))

jest.mock("@/components/firefly/DateTimeFieldPicker", () => ({
  DateTimeFieldPicker: ({
    visible,
    onChange,
    onClose,
  }: {
    visible: boolean
    onChange: (date: Date) => void
    onClose: () => void
  }) => {
    const { Pressable } = require("react-native")
    return visible ? (
      <Pressable
        accessibilityLabel="Set picker date"
        onPress={() => {
          onChange(new Date("2026-02-03T00:00:00.000Z"))
          onClose()
        }}
      />
    ) : null
  },
}))

const currencies: FireflyCurrency[] = [
  {
    id: "eur",
    attributes: {
      code: "EUR",
      name: "Euro",
      symbol: "€",
      enabled: true,
      primary: true,
    },
  },
  {
    id: "usd",
    attributes: {
      code: "USD",
      name: "US Dollar",
      symbol: "$",
      enabled: true,
    },
  },
]

function renderEditor({
  account,
  onSave = jest.fn().mockResolvedValue(true),
  requestError,
}: {
  account?: FireflyAccount
  onSave?: jest.Mock
  requestError?: string
} = {}) {
  const onClose = jest.fn()
  const result = render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 375, height: 812 },
        insets: { top: 44, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider initialContext="dark">
        <AccountEditor
          visible
          account={account}
          currencies={currencies}
          selectedCurrency="USD"
          requestError={requestError}
          onClose={onClose}
          onSave={onSave}
        />
      </ThemeProvider>
    </SafeAreaProvider>,
  )
  return { ...result, onClose, onSave }
}

async function choose(editor: ReturnType<typeof renderEditor>, field: string, option: string) {
  fireEvent.press(editor.getByLabelText(field))
  fireEvent.press(editor.getByLabelText(option))
  await waitFor(() => expect(editor.queryByLabelText(option)).toBeNull())
}

describe("AccountEditor", () => {
  it("shows Save and Add Another only when creating an account", () => {
    const createEditor = renderEditor()
    expect(createEditor.getByText("Save and Add Another")).toBeTruthy()
    createEditor.unmount()

    const editEditor = renderEditor({
      account: {
        id: "expense-1",
        attributes: { name: "Groceries", type: "expense", active: true },
      },
    })
    expect(editEditor.queryByText("Save and Add Another")).toBeNull()
    expect(editEditor.getByText("Save")).toBeTruthy()
  })

  it("shows only the fields applicable to each creation type", async () => {
    const editor = renderEditor()

    expect(editor.getByLabelText("Currency")).toBeTruthy()
    expect(editor.getByLabelText("Opening balance")).toBeTruthy()
    expect(editor.queryByLabelText("Debt start amount")).toBeNull()

    await choose(editor, "Account Type", "Expense")
    expect(editor.getByLabelText("Account number")).toBeTruthy()
    expect(editor.getByLabelText("Notes")).toBeTruthy()
    expect(editor.queryByLabelText("Currency")).toBeNull()
    expect(editor.queryByLabelText("Opening balance")).toBeNull()

    await choose(editor, "Account Type", "Revenue")
    expect(editor.queryByLabelText("Currency")).toBeNull()
    expect(editor.queryByLabelText("Debt start amount")).toBeNull()

    await choose(editor, "Account Type", "Liability")
    expect(editor.getByLabelText("Currency")).toBeTruthy()
    expect(editor.getByLabelText("Debt start amount")).toBeTruthy()
    expect(editor.getByLabelText("Interest percentage")).toBeTruthy()
    expect(editor.queryByLabelText("Account number")).toBeNull()
    expect(editor.queryByLabelText("Notes")).toBeNull()
  })

  it("submits normalized asset metadata and credit-card fields", async () => {
    const editor = renderEditor()
    fireEvent.changeText(editor.getByLabelText("Account name"), " Travel Card ")
    await choose(editor, "Currency", "USD - US Dollar")
    fireEvent.changeText(editor.getByLabelText("Account number"), " 123 ")
    fireEvent.changeText(editor.getByLabelText("Opening balance"), "250.50")
    fireEvent.press(editor.getByLabelText("Opening Date"))
    fireEvent.press(editor.getByLabelText("Set picker date"))
    await choose(editor, "Account Role", "Credit card")
    fireEvent.press(editor.getByLabelText("Monthly Payment Date"))
    fireEvent.press(editor.getByLabelText("Set picker date"))
    fireEvent.changeText(editor.getByLabelText("Virtual balance"), "")
    fireEvent.changeText(editor.getByLabelText("Notes"), "  Paid monthly  ")
    fireEvent.press(editor.getByText("Include in net worth"))
    fireEvent.press(editor.getByText("Save"))

    await waitFor(() =>
      expect(editor.onSave).toHaveBeenCalledWith(
        {
          name: "Travel Card",
          type: "asset",
          currency_code: "USD",
          active: true,
          account_number: "123",
          opening_balance: "250.50",
          opening_balance_date: "2026-02-03T00:00:00.000Z",
          account_role: "ccAsset",
          virtual_balance: null,
          include_net_worth: false,
          notes: "Paid monthly",
          credit_card_type: "monthlyFull",
          monthly_payment_date: "2026-02-03T00:00:00.000Z",
        },
        undefined,
      ),
    )
  })

  it.each(["Expense", "Revenue"] as const)(
    "omits currency and financial metadata for %s accounts",
    async (label) => {
      const editor = renderEditor()
      await choose(editor, "Account Type", label)
      fireEvent.changeText(editor.getByLabelText("Account name"), ` ${label} account `)
      fireEvent.changeText(editor.getByLabelText("Account number"), "")
      fireEvent.changeText(editor.getByLabelText("Notes"), " Optional note ")
      fireEvent.press(editor.getByText("Save"))

      await waitFor(() =>
        expect(editor.onSave).toHaveBeenCalledWith(
          {
            name: `${label} account`,
            type: label.toLowerCase(),
            active: true,
            account_number: null,
            notes: "Optional note",
          },
          undefined,
        ),
      )
    },
  )

  it("validates and submits the complete liability field set", async () => {
    const editor = renderEditor()
    await choose(editor, "Account Type", "Liability")
    fireEvent.changeText(editor.getByLabelText("Account name"), "Mortgage")
    fireEvent.press(editor.getByText("Save"))
    expect(editor.getByText("Debt start amount must be a valid number.")).toBeTruthy()

    fireEvent.changeText(editor.getByLabelText("Debt start amount"), "150000")
    fireEvent.press(editor.getByLabelText("Debt Start Date"))
    fireEvent.press(editor.getByLabelText("Set picker date"))
    await choose(editor, "Liability Type", "Mortgage")
    await choose(editor, "Direction", "I am owed this debt")
    await choose(editor, "Interest Period", "Yearly")
    fireEvent.changeText(editor.getByLabelText("Interest percentage"), "4.25")
    fireEvent.press(editor.getByText("Save"))

    await waitFor(() =>
      expect(editor.onSave).toHaveBeenCalledWith(
        {
          name: "Mortgage",
          type: "liability",
          currency_code: "EUR",
          active: true,
          opening_balance: "150000",
          opening_balance_date: "2026-02-03T00:00:00.000Z",
          liability_type: "mortgage",
          liability_direction: "credit",
          interest: "4.25",
          interest_period: "yearly",
        },
        undefined,
      ),
    )
  })

  it("resets asset fields to asset defaults after Save and Add Another succeeds", async () => {
    const editor = renderEditor()
    fireEvent.changeText(editor.getByLabelText("Account name"), "Travel Card")
    await choose(editor, "Currency", "USD - US Dollar")
    fireEvent.changeText(editor.getByLabelText("Account number"), "123")
    fireEvent.changeText(editor.getByLabelText("Opening balance"), "250")
    fireEvent.press(editor.getByLabelText("Opening Date"))
    fireEvent.press(editor.getByLabelText("Set picker date"))
    await choose(editor, "Account Role", "Savings account")
    fireEvent.changeText(editor.getByLabelText("Virtual balance"), "10")
    fireEvent.changeText(editor.getByLabelText("Notes"), "Note")
    fireEvent.press(editor.getByText("Include in net worth"))
    fireEvent.press(editor.getByText("Save and Add Another"))

    await waitFor(() => expect(editor.getByLabelText("Account name").props.value).toBe(""))
    expect(editor.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ type: "asset" }),
      undefined,
      true,
    )
    expect(editor.getByText("New Account")).toBeTruthy()
    expect(editor.getByLabelText("Currency")).toHaveTextContent("EUR")
    expect(editor.getByLabelText("Account Role")).toHaveTextContent("Default asset account")
    expect(editor.getByLabelText("Account number").props.value).toBe("")
    expect(editor.getByLabelText("Opening balance").props.value).toBe("")
    expect(editor.getByLabelText("Virtual balance").props.value).toBe("")
    expect(editor.getByLabelText("Notes").props.value).toBe("")
    expect(editor.queryByLabelText("Clear Opening Date")).toBeNull()
    expect(editor.getByRole("switch").props.accessibilityState.checked).toBe(true)
    expect(editor.onClose).not.toHaveBeenCalled()
  })

  it.each(["Expense", "Revenue"] as const)(
    "preserves %s type and clears its fields after Save and Add Another succeeds",
    async (label) => {
      const editor = renderEditor()
      await choose(editor, "Account Type", label)
      fireEvent.changeText(editor.getByLabelText("Account name"), `${label} account`)
      fireEvent.changeText(editor.getByLabelText("Account number"), "123")
      fireEvent.changeText(editor.getByLabelText("Notes"), "Note")
      fireEvent.press(editor.getByText("Save and Add Another"))

      await waitFor(() => expect(editor.getByLabelText("Account name").props.value).toBe(""))
      expect(editor.onSave).toHaveBeenCalledWith(
        expect.objectContaining({ type: label.toLowerCase() }),
        undefined,
        true,
      )
      expect(editor.getByLabelText("Account Type")).toHaveTextContent(label)
      expect(editor.getByLabelText("Account number").props.value).toBe("")
      expect(editor.getByLabelText("Notes").props.value).toBe("")
    },
  )

  it("preserves liability type and restores liability defaults after adding another", async () => {
    const editor = renderEditor()
    await choose(editor, "Account Type", "Liability")
    fireEvent.changeText(editor.getByLabelText("Account name"), "Mortgage")
    await choose(editor, "Currency", "USD - US Dollar")
    await choose(editor, "Liability Type", "Mortgage")
    fireEvent.changeText(editor.getByLabelText("Debt start amount"), "150000")
    fireEvent.press(editor.getByLabelText("Debt Start Date"))
    fireEvent.press(editor.getByLabelText("Set picker date"))
    await choose(editor, "Direction", "I am owed this debt")
    fireEvent.changeText(editor.getByLabelText("Interest percentage"), "4.25")
    await choose(editor, "Interest Period", "Yearly")
    fireEvent.press(editor.getByText("Save and Add Another"))

    await waitFor(() => expect(editor.getByLabelText("Account name").props.value).toBe(""))
    expect(editor.getByLabelText("Account Type")).toHaveTextContent("Liability")
    expect(editor.getByLabelText("Currency")).toHaveTextContent("EUR")
    expect(editor.getByLabelText("Liability Type")).toHaveTextContent("Loan")
    expect(editor.getByLabelText("Debt start amount").props.value).toBe("")
    expect(editor.getByLabelText("Debt Start Date")).toHaveTextContent("Select date")
    expect(editor.getByLabelText("Direction")).toHaveTextContent("I owe this debt")
    expect(editor.getByLabelText("Interest percentage").props.value).toBe("0")
    expect(editor.getByLabelText("Interest Period")).toHaveTextContent("Monthly")
  })

  it("keeps entered fields and errors when Save and Add Another fails", async () => {
    const editor = renderEditor({
      onSave: jest.fn().mockResolvedValue(false),
      requestError: "Server rejected the account.",
    })
    fireEvent.changeText(editor.getByLabelText("Account name"), "Checking")
    fireEvent.changeText(editor.getByLabelText("Account number"), "123")
    fireEvent.press(editor.getByText("Save and Add Another"))

    await waitFor(() => expect(editor.onSave).toHaveBeenCalled())
    expect(editor.getByLabelText("Account name").props.value).toBe("Checking")
    expect(editor.getByLabelText("Account number").props.value).toBe("123")
    expect(editor.getByText("Server rejected the account.")).toBeTruthy()
  })

  it("locks edit type, preloads metadata, and sends null for cleared optional fields", async () => {
    const account: FireflyAccount = {
      id: "asset-1",
      attributes: {
        name: "Checking",
        type: "asset",
        active: false,
        currency_code: "USD",
        account_number: "999",
        account_role: "savingAsset",
        virtual_balance: "10",
        include_net_worth: false,
        notes: "Old note",
      },
    }
    const editor = renderEditor({ account })

    expect(editor.getByText("Asset")).toBeTruthy()
    expect(editor.queryByLabelText("Account Type")).toBeNull()
    expect(editor.queryByText("Save and Add Another")).toBeNull()
    expect(editor.getByDisplayValue("Checking")).toBeTruthy()
    expect(editor.getByDisplayValue("999")).toBeTruthy()
    fireEvent.changeText(editor.getByLabelText("Account number"), "")
    fireEvent.changeText(editor.getByLabelText("Virtual balance"), "")
    fireEvent.changeText(editor.getByLabelText("Notes"), "")
    fireEvent.press(editor.getByText("Active"))
    fireEvent.press(editor.getByText("Save"))

    await waitFor(() =>
      expect(editor.onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Checking",
          type: "asset",
          active: true,
          account_number: null,
          virtual_balance: null,
          notes: null,
          account_role: "savingAsset",
        }),
        "asset-1",
      ),
    )
    expect(editor.onClose).not.toHaveBeenCalled()
  })
})
