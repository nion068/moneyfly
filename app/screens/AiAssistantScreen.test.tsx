import { fireEvent, render } from "@testing-library/react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { AiAssistantScreen } from "@/screens/AiAssistantScreen"
import type { MoneyAgentChatItem, MoneyAgentTransactionDraft } from "@/services/ai/types"
import { ThemeProvider } from "@/theme/context"

const mockMoneyAgentValue = {
  items: [
    {
      id: "item-1",
      kind: "message" as const,
      message: {
        id: "message-1",
        role: "assistant" as const,
        text: "Describe a transaction and I will prepare a draft.",
        createdAt: "2026-06-07T12:00:00.000Z",
      },
    },
  ] as MoneyAgentChatItem[],
  drafts: [] as MoneyAgentTransactionDraft[],
  input: "",
  setInput: jest.fn(),
  sendMessage: jest.fn(),
  sendQuickPrompt: jest.fn(),
  clearConversation: jest.fn(),
  updateDraft: jest.fn(),
  confirmDraft: jest.fn(),
  discardDraft: jest.fn(),
  isSending: false,
  error: undefined,
  providerId: "gemini" as const,
  model: "gemini-2.5-flash",
  hasApiKey: true,
  isReady: true,
  snapshot: {
    accounts: [] as { id: string; name: string }[],
    categories: [] as { id: string; name: string }[],
    budgets: [] as { id: string; name: string }[],
    tags: [] as { id: string; name: string }[],
    currencies: [] as string[],
  },
}

jest.mock("@/context/MoneyAgentContext", () => ({
  useMoneyAgent: () => mockMoneyAgentValue,
}))

jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native")
  return {
    MaterialCommunityIcons: (props: object) => <View {...props} />,
  }
})

jest.mock("react-native-keyboard-controller", () => {
  const { View } = require("react-native")
  return {
    KeyboardAwareScrollView: View,
  }
})

const navigation = {
  navigate: jest.fn(),
} as never

describe("AiAssistantScreen", () => {
  afterEach(() => {
    mockMoneyAgentValue.items = mockMoneyAgentValue.items.filter((item) => item.kind === "message")
    mockMoneyAgentValue.drafts = []
    mockMoneyAgentValue.snapshot.accounts = []
    mockMoneyAgentValue.snapshot.categories = []
  })

  it("renders the complete chat layout without collapsing the conversation", () => {
    const { getByTestId, getByText } = render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 375, height: 812 },
          insets: { top: 44, left: 0, right: 0, bottom: 34 },
        }}
      >
        <ThemeProvider initialContext="dark">
          <AiAssistantScreen navigation={navigation} route={{} as never} />
        </ThemeProvider>
      </SafeAreaProvider>,
    )

    expect(getByText("Money Agent")).toBeTruthy()
    expect(getByText("GEMINI · Ready to help")).toBeTruthy()
    expect(getByText("Log a meal")).toBeTruthy()
    expect(getByText("Add transport")).toBeTruthy()
    expect(getByText("Shopping item")).toBeTruthy()
    expect(getByText("Describe a transaction and I will prepare a draft.")).toBeTruthy()
    expect(getByTestId("money-agent-conversation")).toHaveStyle({ flex: 1 })
  })

  it("collapses and expands a transaction draft while keeping its summary visible", () => {
    mockMoneyAgentValue.items.push({
      id: "draft-item-1",
      kind: "draft",
      draftId: "draft-1",
      createdAt: "2026-06-07T12:01:00.000Z",
    })
    mockMoneyAgentValue.drafts.push({
      id: "draft-1",
      type: "withdrawal",
      amount: "450",
      currencyCode: "BDT",
      date: "2026-06-07",
      description: "Lunch at KFC",
      sourceAccountId: "account-1",
      destinationAccountId: "expense-1",
      categoryId: "category-1",
      budgetId: null,
      tagIds: [],
      notes: null,
      missingFields: [],
      status: "proposed",
    })
    mockMoneyAgentValue.snapshot.accounts = [
      { id: "account-1", name: "bKash" },
      { id: "expense-1", name: "Food expense" },
    ]
    mockMoneyAgentValue.snapshot.categories = [{ id: "category-1", name: "Food" }]

    const { getByLabelText, getByText, queryByText } = render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 375, height: 812 },
          insets: { top: 44, left: 0, right: 0, bottom: 34 },
        }}
      >
        <ThemeProvider initialContext="dark">
          <AiAssistantScreen navigation={navigation} route={{} as never} />
        </ThemeProvider>
      </SafeAreaProvider>,
    )

    expect(getByText("Lunch at KFC")).toBeTruthy()
    fireEvent.press(getByLabelText("Collapse transaction draft"))

    expect(queryByText("Lunch at KFC")).toBeNull()
    expect(queryByText("Edit")).toBeNull()
    expect(getByText("BDT 450")).toBeTruthy()

    fireEvent.press(getByLabelText("Expand transaction draft"))
    expect(getByText("Lunch at KFC")).toBeTruthy()
    expect(getByText("Edit")).toBeTruthy()
  })
})
