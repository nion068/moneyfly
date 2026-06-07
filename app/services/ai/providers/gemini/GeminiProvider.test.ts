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

  it("parses every draft in a multi-transaction response", async () => {
    const draft = {
      id: "model-id",
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
    }
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
                    assistantMessage: "Prepared two drafts.",
                    clarificationQuestion: null,
                    drafts: [
                      draft,
                      { ...draft, id: "model-id-2", amount: "120", description: "Transport" },
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
    if (result.kind === "ok" && result.data.kind === "drafts") {
      expect(result.data.drafts.map((item) => item.description)).toEqual(["Lunch", "Transport"])
    }
  })

  it("parses a transaction-focused clarification response", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    kind: "clarification",
                    assistantMessage: "I can only help prepare transaction drafts.",
                    clarificationQuestion:
                      "Describe a transaction, for example: Paid 450 for lunch from bKash.",
                    drafts: null,
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

    expect(result).toEqual({
      kind: "ok",
      data: {
        kind: "clarification",
        assistantMessage: "I can only help prepare transaction drafts.",
        clarificationQuestion:
          "Describe a transaction, for example: Paid 450 for lunch from bKash.",
      },
    })
  })

  it("rejects general answer responses", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    kind: "answer",
                    assistantMessage: "Here is a general-purpose answer.",
                    clarificationQuestion: null,
                    drafts: null,
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

    expect(result).toEqual({
      kind: "invalid-response",
      message: "Gemini returned an unknown response kind.",
    })
  })

  it("rejects a multi-transaction response when any draft is malformed", async () => {
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
                    assistantMessage: "Prepared two drafts.",
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
                      },
                      {
                        id: "draft-2",
                        type: "withdrawal",
                        amount: 120,
                        currencyCode: "BDT",
                        date: "2026-06-06",
                        description: "Transport",
                        sourceAccountId: "a1",
                        destinationAccountId: "a2",
                        categoryId: null,
                        budgetId: null,
                        tagIds: [],
                        notes: null,
                        missingFields: [],
                        status: "proposed",
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

    expect(result).toEqual({
      kind: "invalid-response",
      message: "Gemini returned one or more malformed drafts.",
    })
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
