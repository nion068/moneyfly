import { MoneyAgentEntitySnapshot, MoneyAgentMessage, MoneyAgentTransactionDraft } from "../types"

export const MONEY_AGENT_PROMPT_VERSION = 3

const responseSchema = {
  type: "object",
  properties: {
    kind: {
      type: "string",
      enum: ["answer", "clarification", "drafts"],
      description:
        "Use drafts for every transaction-like user message, including incomplete or ambiguous ones.",
    },
    assistantMessage: {
      type: "string",
      description: "The assistant-facing message to show in chat.",
    },
    clarificationQuestion: {
      type: ["string", "null"],
      description:
        "Only use for a non-transaction request that cannot be answered. Transaction requests must return drafts.",
    },
    drafts: {
      type: ["array", "null"],
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: ["withdrawal", "deposit", "transfer"] },
          amount: { type: "string" },
          currencyCode: { type: "string" },
          date: { type: "string" },
          description: { type: "string" },
          sourceAccountId: {
            type: ["string", "null"],
            description: "Exact listed source account ID, never the account name.",
          },
          destinationAccountId: {
            type: ["string", "null"],
            description: "Exact listed destination account ID, never the account name.",
          },
          categoryId: {
            type: ["string", "null"],
            description: "Exact listed category ID, never the category name.",
          },
          budgetId: {
            type: ["string", "null"],
            description: "Exact listed budget ID, never the budget name.",
          },
          tagIds: {
            type: "array",
            items: { type: "string" },
            description: "Exact listed tag IDs, never tag names.",
          },
          notes: { type: ["string", "null"] },
          missingFields: {
            type: "array",
            description:
              "Only fields with no usable value. Do not mark a field missing when you supplied a best guess.",
            items: {
              type: "string",
              enum: [
                "amount",
                "date",
                "description",
                "sourceAccountId",
                "destinationAccountId",
                "categoryId",
                "budgetId",
                "tagIds",
              ],
            },
          },
          status: { type: "string", enum: ["proposed"] },
          fireflyTransactionId: { type: ["string", "null"] },
          errorMessage: { type: ["string", "null"] },
        },
        required: [
          "id",
          "type",
          "amount",
          "currencyCode",
          "date",
          "description",
          "sourceAccountId",
          "destinationAccountId",
          "categoryId",
          "budgetId",
          "tagIds",
          "notes",
          "missingFields",
          "status",
        ],
      },
    },
  },
  required: ["kind", "assistantMessage", "clarificationQuestion", "drafts"],
} as const

export function getMoneyAgentResponseSchema() {
  return responseSchema
}

export function buildMoneyAgentPrompt(args: {
  currentDate: string
  timeZone: string
  snapshot: MoneyAgentEntitySnapshot
  messages: MoneyAgentMessage[]
}) {
  const lastMessages = args.messages.slice(-12).map((message) => ({
    role: message.role,
    text: message.text,
  }))
  const formatEntities = (
    entities: MoneyAgentEntitySnapshot["accounts"],
    includeAccountDetails = false,
  ) =>
    entities.length === 0
      ? "- None available"
      : entities
          .map((entity) => {
            const details = includeAccountDetails
              ? [
                  entity.type && `type: ${entity.type}`,
                  entity.role && `role: ${entity.role}`,
                  entity.currencyCode && `currency: ${entity.currencyCode}`,
                ]
                  .filter(Boolean)
                  .join(", ")
              : ""
            return `- ID "${entity.id}" means "${entity.name}"${details ? ` (${details})` : ""}`
          })
          .join("\n")

  return [
    `Money Agent prompt version: ${MONEY_AGENT_PROMPT_VERSION}`,
    "You are Money Agent, a careful finance assistant for Firefly III.",
    "Understand the user's natural-language request using the human-readable entity names below.",
    "Return the matching ID in draft ID fields. IDs are opaque identifiers, not meaningful names.",
    "For every transaction-like message, return at least one draft immediately, even when the message is incomplete or ambiguous.",
    "Do not respond with clarification instead of a draft for a transaction-like message.",
    "Best-effort matching order: exact mentioned name, close human-readable name, semantic purpose/category fit, then the most probable compatible listed entity.",
    "Choose the single most probable listed account, category, budget, and tags when the user does not specify them.",
    "You may infer transaction type, date, description, account, category, budget, tags, and currency from context and common financial meaning.",
    "Use today's date when no date is provided.",
    "Use the account's currency when no currency is provided.",
    "If an amount is not provided and cannot be derived, use an empty string and include amount in missingFields. Never invent a numeric amount.",
    "Never invent an entity or ID that is not listed. If no compatible listed entity exists, use null and mark that field missing.",
    "A best-guessed field is not missing: return its selected value and omit it from missingFields.",
    "Mention important assumptions briefly in assistantMessage so the user can review them.",
    "For a withdrawal, source is the user's asset/cash account and destination is an expense account.",
    "For a deposit, source is a revenue account and destination is the user's asset/cash account.",
    "For a transfer, source and destination are both the user's asset/cash accounts.",
    "Use categoryId for the matching category and tagIds for matching tags. Do not put names in ID fields.",
    "Use the user's wording for a concise description. Do not create a transaction yourself.",
    "The app will validate and ask the user to confirm every draft before writing to Firefly.",
    "Return answer only for clearly non-transaction conversation. Return clarification only for a non-transaction request that cannot be answered.",
    `Current date: ${args.currentDate}`,
    `IANA time zone: ${args.timeZone}`,
    `Context last synced: ${args.snapshot.syncedAt ?? "unknown"}`,
    `Supported currencies: ${args.snapshot.currencies.join(", ") || "none supplied"}`,
    "Accounts:",
    formatEntities(args.snapshot.accounts, true),
    "Categories:",
    formatEntities(args.snapshot.categories),
    "Budgets:",
    formatEntities(args.snapshot.budgets),
    "Tags:",
    formatEntities(args.snapshot.tags),
    `Recent conversation: ${JSON.stringify(lastMessages)}`,
  ].join("\n")
}

export function buildMoneyAgentDraftRetryPrompt(prompt: string) {
  return [
    prompt,
    "Correction for the previous response:",
    "Re-evaluate the latest user message under the first-turn draft rule.",
    "If it can reasonably describe a withdrawal, deposit, or transfer, return kind drafts now.",
    "Select the most probable compatible listed entities and current date.",
    "Keep only genuinely unavailable values, especially an unknown amount, in missingFields.",
    "Do not return clarification merely because some transaction details were omitted.",
  ].join("\n")
}

export function cloneDraft(draft: MoneyAgentTransactionDraft): MoneyAgentTransactionDraft {
  return {
    ...draft,
    tagIds: [...draft.tagIds],
    missingFields: [...draft.missingFields],
  }
}
