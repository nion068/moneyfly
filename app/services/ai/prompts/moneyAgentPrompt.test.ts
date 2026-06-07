import { buildMoneyAgentDraftRetryPrompt, buildMoneyAgentPrompt } from "./moneyAgentPrompt"

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
    expect(prompt).toContain("Choose the single most probable listed account")
    expect(prompt).toContain("Never invent a numeric amount")
    expect(prompt).toContain("Use today's date")
    expect(prompt).not.toContain("message-0")
    expect(prompt).toContain("message-12")
  })

  it("builds a retry that requires incomplete transaction requests to become drafts", () => {
    const prompt = buildMoneyAgentDraftRetryPrompt("original prompt")

    expect(prompt).toContain("original prompt")
    expect(prompt).toContain("return kind drafts now")
    expect(prompt).toContain("Do not return clarification")
    expect(prompt).toContain("unknown amount")
  })
})
