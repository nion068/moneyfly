import { MoneyAgentEntitySnapshot, MoneyAgentMessage, MoneyAgentTransactionDraft } from "../types"

export const MONEY_AGENT_PROMPT_VERSION = 5

const responseSchema = {
  type: "object",
  properties: {
    kind: {
      type: "string",
      enum: ["clarification", "drafts"],
      description:
        "Use drafts for transaction-like messages and clarification when no real transaction is identifiable.",
    },
    assistantMessage: {
      type: "string",
      description: "The assistant-facing message to show in chat.",
    },
    clarificationQuestion: {
      type: ["string", "null"],
      description:
        "For clarification responses, ask for a concrete transaction and include transaction examples.",
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
    "Your only purpose is preparing transaction drafts. Never answer general-purpose questions.",
    "Understand the user's natural-language request using the human-readable entity names below.",
    "Return the matching ID in draft ID fields. IDs are opaque identifiers, not meaningful names.",
    "First decide whether the latest user message identifies a real withdrawal, deposit, or transfer.",
    "If it does, return at least one draft immediately, even when transaction details are incomplete or ambiguous.",
    "Return exactly one draft for every distinct withdrawal, deposit, or transfer described by the user.",
    "Never combine separate payments, purchases, income, deposits, or transfers into one draft, even when they share a date or account.",
    "Details that apply to the whole message, such as today or from bKash, may be applied to every relevant draft.",
    'Example: "Paid 450 for lunch and 120 for transport today from bKash" returns two withdrawal drafts with the same date and source account.',
    'Example: "Salary 50000 arrived in Bank and I moved 10000 from Bank to Savings" returns one deposit draft and one transfer draft.',
    "Do not respond with clarification instead of a draft for a transaction-like message.",
    'A short transaction such as "Lunch today" is draftable; leave the unknown amount empty and mark it missing.',
    'A generic request such as "Help me add a transaction" is not draftable because it identifies no real transaction.',
    "If no real transaction is identifiable, return clarification. This includes greetings, general-purpose questions, financial advice, and generic requests.",
    "For clarification, do not answer the unrelated question. Guide the user to describe a real transaction and include concrete examples such as:",
    '- "Paid 450 for lunch from bKash."',
    '- "Received a 50,000 salary in my bank account."',
    '- "Transferred 2,000 from Bank to Savings."',
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
    "The only valid response kinds are drafts and clarification.",
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

export function cloneDraft(draft: MoneyAgentTransactionDraft): MoneyAgentTransactionDraft {
  return {
    ...draft,
    tagIds: [...draft.tagIds],
    missingFields: [...draft.missingFields],
  }
}
