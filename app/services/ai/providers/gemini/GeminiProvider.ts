import { getMoneyAgentResponseSchema } from "../../prompts/moneyAgentPrompt"
import {
  AiError,
  AiResult,
  MoneyAgentProvider,
  MoneyAgentResponse,
  MoneyAgentTransactionDraft,
} from "../../types"

type GeminiResponse = {
  candidates?: Array<{
    finishReason?: string
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
  promptFeedback?: {
    blockReason?: string
  }
}

function toError(response: Response | undefined, fallback = "Unable to reach Gemini."): AiError {
  if (!response) {
    return { kind: "network", message: fallback }
  }

  if (response.status === 401 || response.status === 403) {
    return { kind: "unauthorized", message: "Gemini rejected the API key." }
  }

  if (response.status === 429) {
    return { kind: "quota", message: "Gemini quota exceeded." }
  }

  if (response.status >= 500) {
    return { kind: "unavailable", message: "Gemini is temporarily unavailable." }
  }

  return { kind: "invalid-response", message: fallback }
}

function isDraftField(value: unknown): value is MoneyAgentTransactionDraft {
  if (!value || typeof value !== "object") return false
  const draft = value as MoneyAgentTransactionDraft
  const nullableString = (field: unknown) => field === null || typeof field === "string"
  const validMissingFields = [
    "amount",
    "date",
    "description",
    "sourceAccountId",
    "destinationAccountId",
    "categoryId",
    "budgetId",
    "tagIds",
  ]
  return (
    typeof draft.id === "string" &&
    (draft.type === "withdrawal" || draft.type === "deposit" || draft.type === "transfer") &&
    typeof draft.amount === "string" &&
    typeof draft.currencyCode === "string" &&
    typeof draft.date === "string" &&
    typeof draft.description === "string" &&
    nullableString(draft.sourceAccountId) &&
    nullableString(draft.destinationAccountId) &&
    nullableString(draft.categoryId) &&
    nullableString(draft.budgetId) &&
    Array.isArray(draft.tagIds) &&
    draft.tagIds.every((tagId) => typeof tagId === "string") &&
    nullableString(draft.notes) &&
    Array.isArray(draft.missingFields) &&
    draft.missingFields.every((field) => validMissingFields.includes(field)) &&
    draft.status === "proposed"
  )
}

function parseResponseText(text: string): AiResult<MoneyAgentResponse> {
  try {
    const parsed = JSON.parse(text) as {
      kind?: string
      assistantMessage?: string
      clarificationQuestion?: string | null
      drafts?: unknown
    }

    if (parsed.kind !== "clarification" && parsed.kind !== "drafts") {
      return { kind: "invalid-response", message: "Gemini returned an unknown response kind." }
    }

    if (typeof parsed.assistantMessage !== "string") {
      return { kind: "invalid-response", message: "Gemini returned an invalid assistant message." }
    }

    if (parsed.kind === "clarification") {
      if (typeof parsed.clarificationQuestion !== "string") {
        return {
          kind: "invalid-response",
          message: "Gemini returned an invalid clarification question.",
        }
      }
      return {
        kind: "ok",
        data: {
          kind: "clarification",
          assistantMessage: parsed.assistantMessage,
          clarificationQuestion: parsed.clarificationQuestion,
        },
      }
    }

    if (!Array.isArray(parsed.drafts) || parsed.drafts.length === 0) {
      return { kind: "invalid-response", message: "Gemini returned no valid drafts." }
    }
    if (!parsed.drafts.every(isDraftField)) {
      return {
        kind: "invalid-response",
        message: "Gemini returned one or more malformed drafts.",
      }
    }

    return {
      kind: "ok",
      data: {
        kind: "drafts",
        assistantMessage: parsed.assistantMessage,
        drafts: parsed.drafts,
      },
    }
  } catch {
    return { kind: "invalid-response", message: "Gemini returned malformed JSON." }
  }
}

async function callGemini(request: {
  apiKey: string
  model: string
  prompt: string
}): Promise<AiResult<MoneyAgentResponse>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  let response: Response

  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        request.model,
      )}:generateContent?key=${encodeURIComponent(request.apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: request.prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: getMoneyAgentResponseSchema(),
            temperature: 0.1,
          },
        }),
      },
    )
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { kind: "timeout", message: "Gemini took too long to respond. Try again." }
    }
    return { kind: "network", message: "Could not connect to Gemini. Check your network." }
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) return toError(response)

  let data: GeminiResponse
  try {
    data = (await response.json()) as GeminiResponse
  } catch {
    return { kind: "invalid-response", message: "Gemini returned unreadable JSON." }
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    const blockReason = data.promptFeedback?.blockReason ?? data.candidates?.[0]?.finishReason
    if (blockReason) {
      return {
        kind: "invalid-response",
        message: `Gemini did not return a response (${blockReason}).`,
      }
    }
    return { kind: "invalid-response", message: "Gemini returned an empty response." }
  }

  return parseResponseText(text)
}

export const GeminiProvider: MoneyAgentProvider = {
  id: "gemini",
  testConnection: async ({ apiKey, model, prompt }) => {
    const result = await callGemini({
      apiKey,
      model,
      prompt: `${prompt}\nReply with: {"kind":"clarification","assistantMessage":"Money Agent is ready.","clarificationQuestion":"Describe a transaction, for example: Paid 450 for lunch from bKash.","drafts":null}`,
    })
    if (result.kind !== "ok") return result
    return { kind: "ok", data: true }
  },
  send: callGemini,
}
