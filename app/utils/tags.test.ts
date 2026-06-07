import { mergeTagNames, normalizeTagName } from "./tags"

describe("tag helpers", () => {
  it("normalizes leading hashes and whitespace", () => {
    expect(normalizeTagName("  ##monthly  ")).toBe("monthly")
  })

  it("deduplicates tags case-insensitively while preserving the first spelling", () => {
    expect(mergeTagNames(["Monthly", " food "], ["monthly", "#Travel"])).toEqual([
      "Monthly",
      "food",
      "Travel",
    ])
  })
})
