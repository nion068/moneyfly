import type {
  MoneyAgentChatItem,
  MoneyAgentConversationState,
  MoneyAgentTransactionDraft,
} from "./types"

type IdGenerator = () => string

export function normalizeMoneyAgentConversation(
  conversation: MoneyAgentConversationState,
  generateId: IdGenerator,
): MoneyAgentConversationState {
  return {
    ...conversation,
    items: conversation.items.map((item) =>
      item.kind === "draft"
        ? {
            id: generateId(),
            kind: "draft-group" as const,
            groupId: generateId(),
            draftIds: [item.draftId],
            sourceMessageId: item.id,
            createdAt: item.createdAt,
          }
        : item,
    ),
  }
}

export function createDraftGroup(
  drafts: MoneyAgentTransactionDraft[],
  sourceMessageId: string,
  createdAt: string,
  generateId: IdGenerator,
) {
  const normalizedDrafts = drafts.map((draft) => ({
    ...draft,
    id: generateId(),
    tagIds: [...draft.tagIds],
    missingFields: [...draft.missingFields],
  }))
  const groupId = generateId()
  const item: MoneyAgentChatItem = {
    id: groupId,
    kind: "draft-group",
    groupId,
    draftIds: normalizedDrafts.map((draft) => draft.id),
    sourceMessageId,
    createdAt,
  }

  return { drafts: normalizedDrafts, item }
}

export function keepDraftGroups(items: MoneyAgentChatItem[], drafts: MoneyAgentTransactionDraft[]) {
  const draftIds = new Set(drafts.map((draft) => draft.id))
  return items.filter(
    (item) =>
      item.kind === "draft-group" &&
      item.draftIds.length > 0 &&
      item.draftIds.every((draftId) => draftIds.has(draftId)),
  )
}
