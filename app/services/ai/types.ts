export type AiProviderId = "gemini" | "openai" | "openai-compatible" | "local"

export type AiError = {
  kind: "unauthorized" | "timeout" | "network" | "quota" | "invalid-response" | "unavailable"
  message: string
}

export type AiResult<T> = { kind: "ok"; data: T } | AiError

export type AiProviderSettings = {
  providerId: AiProviderId
  model: string
}

export type MoneyAgentEntitySnapshot = {
  syncedAt?: string
  accounts: MoneyAgentEntity[]
  categories: MoneyAgentEntity[]
  budgets: MoneyAgentEntity[]
  tags: MoneyAgentEntity[]
  currencies: string[]
}

export type MoneyAgentEntity = {
  id: string
  name: string
  type?: string
  role?: string
  currencyCode?: string
}

export type MoneyAgentMessageRole = "user" | "assistant" | "status"

export type MoneyAgentMessage = {
  id: string
  role: MoneyAgentMessageRole
  text: string
  createdAt: string
}

export type MoneyAgentChatItem =
  | {
      id: string
      kind: "message"
      message: MoneyAgentMessage
    }
  | {
      id: string
      kind: "draft"
      draftId: string
      createdAt: string
    }
  | {
      id: string
      kind: "draft-group"
      groupId: string
      draftIds: string[]
      sourceMessageId: string
      createdAt: string
    }

export type MoneyAgentDraftField =
  | "amount"
  | "date"
  | "description"
  | "sourceAccountId"
  | "destinationAccountId"
  | "categoryId"
  | "budgetId"

export type MoneyAgentTransactionDraft = {
  id: string
  type: "withdrawal" | "deposit" | "transfer"
  amount: string
  currencyCode: string
  date: string
  description: string
  sourceAccountId: string | null
  destinationAccountId: string | null
  categoryId: string | null
  budgetId: string | null
  tagIds: string[]
  newTags: string[]
  notes: string | null
  missingFields: MoneyAgentDraftField[]
  status: "proposed" | "confirming" | "confirmed" | "discarded" | "failed"
  fireflyTransactionId?: string
  errorMessage?: string
}

export type MoneyAgentConversationState = {
  items: MoneyAgentChatItem[]
  drafts: MoneyAgentTransactionDraft[]
}

export type MoneyAgentResponse =
  | {
      kind: "clarification"
      assistantMessage: string
      clarificationQuestion: string
    }
  | {
      kind: "drafts"
      assistantMessage: string
      drafts: MoneyAgentTransactionDraft[]
    }

export type MoneyAgentProvider = {
  id: AiProviderId
  testConnection: (args: {
    apiKey: string
    model: string
    prompt: string
  }) => Promise<AiResult<true>>
  send: (args: {
    apiKey: string
    model: string
    prompt: string
  }) => Promise<AiResult<MoneyAgentResponse>>
}

export type MoneyAgentSaveSettingsInput = {
  providerId: AiProviderId
  model: string
  apiKey: string
  projectId?: string
  location?: string
}
