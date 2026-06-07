import { createDraftGroup, keepDraftGroups, normalizeMoneyAgentConversation } from "./conversation"
import type { MoneyAgentConversationState, MoneyAgentTransactionDraft } from "./types"

const draft: MoneyAgentTransactionDraft = {
  id: "model-id",
  type: "withdrawal",
  amount: "450",
  currencyCode: "BDT",
  date: "2026-06-07",
  description: "Lunch",
  sourceAccountId: "a1",
  destinationAccountId: "a2",
  categoryId: null,
  budgetId: null,
  tagIds: [],
  notes: null,
  missingFields: [],
  status: "proposed",
}

function idGenerator() {
  let value = 0
  return () => `generated-${++value}`
}

describe("money agent conversation groups", () => {
  it("replaces model draft IDs and associates drafts with their source message", () => {
    const group = createDraftGroup(
      [draft, { ...draft, description: "Transport" }],
      "message-1",
      "2026-06-07T12:00:00.000Z",
      idGenerator(),
    )

    expect(group.drafts.map((item) => item.id)).toEqual(["generated-1", "generated-2"])
    expect(new Set(group.drafts.map((item) => item.id)).size).toBe(2)
    expect(group.item).toMatchObject({
      kind: "draft-group",
      groupId: "generated-3",
      draftIds: ["generated-1", "generated-2"],
      sourceMessageId: "message-1",
    })
  })

  it("migrates a persisted legacy draft item into a one-draft group in place", () => {
    const state: MoneyAgentConversationState = {
      items: [
        {
          id: "legacy-item",
          kind: "draft",
          draftId: "draft-1",
          createdAt: "2026-06-07T12:00:00.000Z",
        },
      ],
      drafts: [{ ...draft, id: "draft-1", status: "confirmed" }],
    }

    const normalized = normalizeMoneyAgentConversation(state, idGenerator())

    expect(normalized.items[0]).toMatchObject({
      kind: "draft-group",
      draftIds: ["draft-1"],
      createdAt: "2026-06-07T12:00:00.000Z",
    })
    expect(normalized.drafts[0]).toMatchObject({ id: "draft-1", status: "confirmed" })
  })

  it("keeps only complete draft groups when chat history is cleared", () => {
    const state: MoneyAgentConversationState = {
      items: [
        {
          id: "group-1",
          kind: "draft-group",
          groupId: "group-1",
          draftIds: ["draft-1", "draft-2"],
          sourceMessageId: "message-1",
          createdAt: "2026-06-07T12:00:00.000Z",
        },
        {
          id: "group-2",
          kind: "draft-group",
          groupId: "group-2",
          draftIds: ["missing"],
          sourceMessageId: "message-2",
          createdAt: "2026-06-07T12:01:00.000Z",
        },
      ],
      drafts: [
        { ...draft, id: "draft-1" },
        { ...draft, id: "draft-2" },
      ],
    }

    expect(keepDraftGroups(state.items, state.drafts)).toEqual([state.items[0]])
  })
})
