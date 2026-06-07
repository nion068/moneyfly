import { render } from "@testing-library/react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { AiAssistantScreen } from "@/screens/AiAssistantScreen"
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
  ],
  drafts: [],
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
    accounts: [],
    categories: [],
    budgets: [],
    tags: [],
    currencies: [],
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
})
