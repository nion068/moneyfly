import { buildMoneyAgentPrompt, getMoneyAgentResponseSchema } from "./moneyAgentPrompt"

describe("buildMoneyAgentPrompt", () => {
  it("includes the current snapshot and only the recent conversation turns", () => {
    const prompt = buildMoneyAgentPrompt({
      currentDate: "2026-06-06",
      timeZone: "Asia/Dhaka",
      snapshot: {
        syncedAt: "2026-06-06T10:00:00Z",
        accounts: [{ id: "a1", name: "Cash Wallet" }],
        categories: [{ id: "c1", name: "Food" }],
        budgets: [],
        tags: [],
        currencies: ["BDT"],
      },
      messages: Array.from({ length: 13 }, (_, index) => ({
        id: `m${index}`,
        role: "user" as const,
        text: `message-${index}`,
        createdAt: "2026-06-06T10:00:00Z",
      })),
    })

    expect(prompt).toContain("2026-06-06")
    expect(prompt).toContain("Asia/Dhaka")
    expect(prompt).toContain("Cash Wallet")
    expect(prompt).toContain('ID "a1" means "Cash Wallet"')
    expect(prompt).toContain('ID "c1" means "Food"')
    expect(prompt).toContain("IDs are opaque identifiers")
    expect(prompt).toContain("return at least one draft immediately")
    expect(prompt).toContain("exactly one draft for every distinct")
    expect(prompt).toContain("Never combine separate payments")
    expect(prompt).toContain("returns two withdrawal drafts")
    expect(prompt).toContain("one deposit draft and one transfer draft")
    expect(prompt).toContain("Choose the single most probable listed account")
    expect(prompt).toContain("Never invent a numeric amount")
    expect(prompt).toContain("Use today's date")
    expect(prompt).toContain("Never answer general-purpose questions")
    expect(prompt).toContain("If no real transaction is identifiable, return clarification")
    expect(prompt).toContain("Help me add a transaction")
    expect(prompt).toContain("Paid 450 for lunch from bKash")
    expect(prompt).not.toContain("message-0")
    expect(prompt).toContain("message-12")
  })

  it("only permits drafts and transaction-focused clarification responses", () => {
    const schema = getMoneyAgentResponseSchema()

    expect(schema.properties.kind.enum).toEqual(["clarification", "drafts"])
    expect(schema.properties.clarificationQuestion.description).toContain(
      "ask for a concrete transaction",
    )
  })
})
