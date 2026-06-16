import { fireEvent, render } from "@testing-library/react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { AiAssistantScreen } from "@/screens/AiAssistantScreen"
import type {
  MoneyAgentChatItem,
  MoneyAgentEntity,
  MoneyAgentTransactionDraft,
} from "@/services/ai/types"
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
    accounts: [] as MoneyAgentEntity[],
    categories: [] as { id: string; name: string }[],
    budgets: [] as { id: string; name: string }[],
    tags: [] as { id: string; name: string }[],
    currencies: [] as string[],
  },
}

jest.mock("@/context/MoneyAgentContext", () => ({
  useMoneyAgent: () => mockMoneyAgentValue,
}))

jest.mock("@/context/FireflyContext", () => ({
  useFirefly: () => ({ isConfigured: true }),
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
    KeyboardAvoidingView: View,
    KeyboardAwareScrollView: View,
    useKeyboardState: (
      selector: (state: { isVisible: boolean; height: number }) => boolean | number,
    ) => selector({ isVisible: false, height: 0 }),
  }
})

const navigation = {
  navigate: jest.fn(),
} as never

function renderScreen() {
  return render(
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
}

function createDraft(
  id: string,
  status: MoneyAgentTransactionDraft["status"] = "proposed",
): MoneyAgentTransactionDraft {
  return {
    id,
    type: "withdrawal",
    amount: "450",
    currencyCode: "BDT",
    date: "2026-06-07",
    description: `Description ${id}`,
    sourceAccountId: "account-1",
    destinationAccountId: "expense-1",
    categoryId: null,
    budgetId: null,
    tagIds: [],
    newTags: [],
    notes: null,
    missingFields: [],
    status,
  }
}

describe("AiAssistantScreen", () => {
  afterEach(() => {
    jest.clearAllMocks()
    mockMoneyAgentValue.items = mockMoneyAgentValue.items.filter((item) => item.id === "item-1")
    mockMoneyAgentValue.drafts = []
    mockMoneyAgentValue.snapshot.accounts = []
    mockMoneyAgentValue.snapshot.categories = []
    mockMoneyAgentValue.isSending = false
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

  it("resends only the latest user message", () => {
    mockMoneyAgentValue.items.push(
      {
        id: "user-item-1",
        kind: "message",
        message: {
          id: "user-message-1",
          role: "user",
          text: "Paid 450 for lunch",
          createdAt: "2026-06-07T12:01:00.000Z",
        },
      },
      {
        id: "assistant-item-2",
        kind: "message",
        message: {
          id: "assistant-message-2",
          role: "assistant",
          text: "Gemini is temporarily unavailable.",
          createdAt: "2026-06-07T12:02:00.000Z",
        },
      },
      {
        id: "user-item-2",
        kind: "message",
        message: {
          id: "user-message-2",
          role: "user",
          text: "Paid 120 for transport",
          createdAt: "2026-06-07T12:03:00.000Z",
        },
      },
    )

    const screen = renderScreen()

    expect(screen.getAllByLabelText("Resend last message")).toHaveLength(1)
    fireEvent.press(screen.getByLabelText("Resend last message"))
    expect(mockMoneyAgentValue.sendMessage).toHaveBeenCalledWith("Paid 120 for transport")
  })

  it("animates the thinking status", () => {
    mockMoneyAgentValue.items.push({
      id: "thinking-item",
      kind: "message",
      message: {
        id: "thinking-message",
        role: "status",
        text: "Money Agent is thinking...",
        createdAt: "2026-06-07T12:01:00.000Z",
      },
    })

    const screen = renderScreen()

    expect(screen.getByTestId("money-agent-thinking")).toBeTruthy()
    expect(screen.getByLabelText("Money Agent is thinking...")).toBeTruthy()
  })

  it("uses a themed confirmation modal when clearing chat with unresolved drafts", () => {
    mockMoneyAgentValue.drafts.push(createDraft("draft-1"))
    const screen = renderScreen()

    fireEvent.press(screen.getByLabelText("Clear chat"))

    expect(screen.getByText("Clear chat?")).toBeTruthy()
    expect(screen.getByText("There are unresolved drafts. Clearing will discard them and clear the chat history.")).toBeTruthy()
    expect(screen.getByText("Cancel")).toBeTruthy()
    expect(screen.getByLabelText("Confirm clear chat")).toBeTruthy()
    expect(screen.queryByText("Keep drafts")).toBeNull()

    fireEvent.press(screen.getByLabelText("Confirm clear chat"))
    expect(mockMoneyAgentValue.clearConversation).toHaveBeenCalledWith(true)
    expect(screen.queryByText("Clear chat?")).toBeNull()
  })

  it("shows a generic confirmation modal when clearing chat with no unresolved drafts", () => {
    const screen = renderScreen()

    fireEvent.press(screen.getByLabelText("Clear chat"))

    expect(screen.getByText("Clear chat?")).toBeTruthy()
    expect(screen.getByText("This will clear the current chat history.")).toBeTruthy()
    expect(screen.getByText("Cancel")).toBeTruthy()
    expect(screen.getByText("Clear chat")).toBeTruthy()
    expect(mockMoneyAgentValue.clearConversation).not.toHaveBeenCalled()

    fireEvent.press(screen.getByText("Clear chat"))

    expect(mockMoneyAgentValue.clearConversation).toHaveBeenCalledWith(true)
    expect(screen.queryByText("Clear chat?")).toBeNull()
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
      newTags: [],
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
    expect(getByText("-BDT 450")).toBeTruthy()
    expect(getByText("EXPENSE DRAFT")).toBeTruthy()
    expect(getByText("bKash → Food expense")).toBeTruthy()

    fireEvent.press(getByLabelText("Expand transaction draft"))
    expect(getByText("Lunch at KFC")).toBeTruthy()
    expect(getByText("Edit")).toBeTruthy()
  })

  it("renders a grouped count with only the first draft expanded and independent actions", () => {
    mockMoneyAgentValue.items.push({
      id: "group-1",
      kind: "draft-group",
      groupId: "group-1",
      draftIds: ["draft-1", "draft-2"],
      sourceMessageId: "message-1",
      createdAt: "2026-06-07T12:01:00.000Z",
    })
    mockMoneyAgentValue.drafts.push(
      {
        id: "draft-1",
        type: "withdrawal",
        amount: "450",
        currencyCode: "BDT",
        date: "2026-06-07",
        description: "Lunch",
        sourceAccountId: "account-1",
        destinationAccountId: "expense-1",
        categoryId: null,
        budgetId: null,
        tagIds: [],
        newTags: [],
        notes: null,
        missingFields: [],
        status: "proposed",
      },
      {
        id: "draft-2",
        type: "withdrawal",
        amount: "120",
        currencyCode: "BDT",
        date: "2026-06-07",
        description: "Transport",
        sourceAccountId: "account-1",
        destinationAccountId: "expense-1",
        categoryId: null,
        budgetId: null,
        tagIds: [],
        newTags: [],
        notes: null,
        missingFields: [],
        status: "failed",
        errorMessage: "Try again.",
      },
    )

    const { getAllByLabelText, getAllByText, getByText, queryByText } = render(
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

    expect(getByText("2 transaction drafts")).toBeTruthy()
    expect(getByText("Lunch")).toBeTruthy()
    expect(queryByText("Transport")).toBeNull()
    expect(getAllByLabelText("Collapse transaction draft")).toHaveLength(1)
    expect(getAllByLabelText("Expand transaction draft")).toHaveLength(1)

    fireEvent.press(getAllByLabelText("Expand transaction draft")[0])
    expect(getByText("Transport")).toBeTruthy()
    expect(getAllByText("Confirm")).toHaveLength(2)

    fireEvent.press(getAllByText("Discard")[1])
    expect(mockMoneyAgentValue.discardDraft).toHaveBeenCalledWith("draft-2")
    fireEvent.press(getAllByText("Confirm")[0])
    expect(mockMoneyAgentValue.confirmDraft).toHaveBeenCalledWith("draft-1")
  })

  it("renders distinct accessible badges for every draft state", () => {
    const draftIds = ["pending", "needs-details", "confirming", "confirmed", "discarded", "failed"]
    mockMoneyAgentValue.items.push({
      id: "status-group",
      kind: "draft-group",
      groupId: "status-group",
      draftIds,
      sourceMessageId: "message-1",
      createdAt: "2026-06-07T12:01:00.000Z",
    })
    mockMoneyAgentValue.drafts.push(
      createDraft("pending"),
      { ...createDraft("needs-details"), missingFields: ["amount"] },
      createDraft("confirming", "confirming"),
      { ...createDraft("confirmed", "confirmed"), missingFields: ["amount"] },
      createDraft("discarded", "discarded"),
      createDraft("failed", "failed"),
    )

    const { getByLabelText, getByTestId } = renderScreen()

    const expectedIcons = {
      "Draft": "clock-outline",
      "Needs details": "alert-circle-outline",
      "Confirming": "loading",
      "Confirmed": "check-circle",
      "Discarded": "close-circle",
      "Failed": "alert-circle",
    }
    Object.entries(expectedIcons).forEach(([label, icon]) => {
      expect(
        getByLabelText(`Transaction status: ${label}`).findByProps({ name: icon }),
      ).toBeTruthy()
    })
    expect(getByTestId("draft-status-pending")).toHaveStyle({
      backgroundColor: "rgba(246, 207, 98, 0.14)",
    })
    expect(getByTestId("draft-status-confirmed")).toHaveStyle({
      backgroundColor: "rgba(62, 165, 118, 0.18)",
    })
  })

  it.each([
    ["withdrawal", "EXPENSE DRAFT", "-BDT 450", "cash-minus", "#d87162"],
    ["deposit", "INCOME DRAFT", "+BDT 450", "cash-plus", "#6cdca0"],
    ["transfer", "TRANSFER DRAFT", "BDT 450", "bank-transfer", "#86cdea"],
  ] as const)(
    "renders %s drafts with their type presentation",
    (type, label, amount, icon, color) => {
      mockMoneyAgentValue.items.push({
        id: `draft-item-${type}`,
        kind: "draft",
        draftId: `draft-${type}`,
        createdAt: "2026-06-07T12:01:00.000Z",
      })
      mockMoneyAgentValue.drafts.push({ ...createDraft(`draft-${type}`), type })
      mockMoneyAgentValue.snapshot.accounts = [
        { id: "account-1", name: "Main account", type: "asset" },
        { id: "expense-1", name: "Other account", type: "expense" },
      ]

      const screen = renderScreen()

      expect(screen.UNSAFE_getAllByProps({ name: icon }).length).toBeGreaterThanOrEqual(2)
      expect(screen.getByText(amount)).toHaveStyle({ color })
      expect(screen.getByText("Main account → Other account")).toBeTruthy()
    },
  )

  it("changes draft type, preserves compatible fields, and filters account selectors", () => {
    const draft = createDraft("editable")
    mockMoneyAgentValue.items.push({
      id: "editable-item",
      kind: "draft",
      draftId: draft.id,
      createdAt: "2026-06-07T12:01:00.000Z",
    })
    mockMoneyAgentValue.drafts.push(draft)
    mockMoneyAgentValue.snapshot.accounts = [
      { id: "account-1", name: "Checking", type: "asset" },
      { id: "account-2", name: "Savings", type: "asset" },
      { id: "expense-1", name: "Groceries", type: "expense" },
      { id: "revenue-1", name: "Salary", type: "revenue" },
    ]

    const screen = renderScreen()
    fireEvent.press(screen.getByText("Edit"))
    fireEvent.press(screen.getByLabelText("Transfer transaction type"))

    expect(screen.getByText("TRANSFER DRAFT")).toBeTruthy()
    expect(screen.getByText("Checking → Not selected")).toBeTruthy()
    expect(mockMoneyAgentValue.updateDraft).toHaveBeenLastCalledWith({
      ...draft,
      type: "transfer",
      destinationAccountId: null,
      missingFields: ["destinationAccountId"],
    })

    fireEvent.press(screen.getByLabelText("Select destination account"))
    expect(screen.getByRole("radio", { name: "Savings" })).toBeTruthy()
    expect(screen.queryByRole("radio", { name: "Checking" })).toBeNull()
    expect(screen.queryByRole("radio", { name: "Groceries" })).toBeNull()
    expect(screen.queryByRole("radio", { name: "Salary" })).toBeNull()
  })

  it("starts persisted resolved drafts collapsed and allows expanding them", () => {
    mockMoneyAgentValue.items.push({
      id: "resolved-group",
      kind: "draft-group",
      groupId: "resolved-group",
      draftIds: ["confirmed"],
      sourceMessageId: "message-1",
      createdAt: "2026-06-07T12:01:00.000Z",
    })
    mockMoneyAgentValue.drafts.push(createDraft("confirmed", "confirmed"))

    const { getByLabelText, getByText, queryByText } = renderScreen()

    expect(queryByText("Description confirmed")).toBeNull()
    fireEvent.press(getByLabelText("Expand transaction draft"))
    expect(getByText("Description confirmed")).toBeTruthy()
  })

  it("auto-collapses only the draft that becomes resolved", () => {
    mockMoneyAgentValue.items.push({
      id: "transition-group",
      kind: "draft-group",
      groupId: "transition-group",
      draftIds: ["draft-1", "draft-2"],
      sourceMessageId: "message-1",
      createdAt: "2026-06-07T12:01:00.000Z",
    })
    mockMoneyAgentValue.drafts.push(createDraft("draft-1"), createDraft("draft-2", "failed"))

    const screen = renderScreen()
    fireEvent.press(screen.getByLabelText("Expand transaction draft"))
    expect(screen.getByText("Description draft-1")).toBeTruthy()
    expect(screen.getByText("Description draft-2")).toBeTruthy()

    mockMoneyAgentValue.drafts = [
      createDraft("draft-1", "confirmed"),
      createDraft("draft-2", "failed"),
    ]
    screen.rerender(
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

    expect(screen.queryByText("Description draft-1")).toBeNull()
    expect(screen.getByText("Description draft-2")).toBeTruthy()
    fireEvent.press(screen.getAllByLabelText("Expand transaction draft")[0])
    expect(screen.getByText("Description draft-1")).toBeTruthy()
  })
})
