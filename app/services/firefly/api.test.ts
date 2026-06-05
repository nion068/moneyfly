import { create } from "apisauce"

import { FireflyApi } from "@/services/firefly/api"

jest.mock("apisauce", () => ({
  create: jest.fn(),
}))

describe("FireflyApi", () => {
  it("loads every page reported by Firefly", async () => {
    const get = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        data: { data: [{ id: "1" }], meta: { pagination: { total_pages: 7 } } },
      })
      .mockResolvedValueOnce({ ok: true, data: { data: [{ id: "2" }] } })
      .mockResolvedValueOnce({ ok: true, data: { data: [{ id: "3" }] } })
      .mockResolvedValueOnce({ ok: true, data: { data: [{ id: "4" }] } })
      .mockResolvedValueOnce({ ok: true, data: { data: [{ id: "5" }] } })
      .mockResolvedValueOnce({ ok: true, data: { data: [{ id: "6" }] } })
      .mockResolvedValueOnce({ ok: true, data: { data: [{ id: "7" }] } })
    ;(create as jest.Mock).mockReturnValue({ get, post: jest.fn() })

    const result = await new FireflyApi("https://firefly.example.com", "token").getAccounts()

    expect(result).toEqual({
      kind: "ok",
      data: Array.from({ length: 7 }, (_, index) => ({ id: String(index + 1) })),
    })
    expect(get).toHaveBeenCalledTimes(7)
    expect(get).toHaveBeenLastCalledWith("api/v1/accounts", { page: 7, type: "all" })
  })
})
