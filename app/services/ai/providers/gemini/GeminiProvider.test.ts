import { GeminiProvider } from "./GeminiProvider"

describe("GeminiProvider", () => {
  beforeEach(() => {
    jest.restoreAllMocks()
  })

  it("parses a draft response", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    kind: "drafts",
                    assistantMessage: "Parsed it.",
                    clarificationQuestion: null,
                    drafts: [
                      {
                        id: "draft-1",
                        type: "withdrawal",
                        amount: "450",
                        currencyCode: "BDT",
                        date: "2026-06-06",
                        description: "Lunch",
                        sourceAccountId: "a1",
                        destinationAccountId: "a2",
                        categoryId: null,
                        budgetId: null,
                        tagIds: [],
                        notes: null,
                        missingFields: [],
                        status: "proposed",
                        fireflyTransactionId: null,
                        errorMessage: null,
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    } as never)

    const result = await GeminiProvider.send({
      apiKey: "key",
      model: "gemini-2.5-flash",
      prompt: "prompt",
    })

    expect(result.kind).toBe("ok")
    if (result.kind === "ok") {
      expect(result.data.kind).toBe("drafts")
      if (result.data.kind === "drafts") {
        expect(result.data.drafts).toHaveLength(1)
        expect(result.data.drafts[0].description).toBe("Lunch")
      }
    }
  })

  it("rejects malformed JSON", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: "{not json" }],
            },
          },
        ],
      }),
    } as never)

    const result = await GeminiProvider.send({
      apiKey: "key",
      model: "gemini-2.5-flash",
      prompt: "prompt",
    })

    expect(result.kind).toBe("invalid-response")
  })

  it("normalizes network failures", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Network request failed"))

    const result = await GeminiProvider.send({
      apiKey: "key",
      model: "gemini-2.5-flash",
      prompt: "prompt",
    })

    expect(result).toEqual({
      kind: "network",
      message: "Could not connect to Gemini. Check your network.",
    })
  })
})
