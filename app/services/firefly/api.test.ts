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
    ;(create as jest.Mock).mockReturnValue({ get, post: jest.fn(), put: jest.fn() })

    const result = await new FireflyApi("https://firefly.example.com", "token").getAccounts()

    expect(result).toEqual({
      kind: "ok",
      data: Array.from({ length: 7 }, (_, index) => ({ id: String(index + 1) })),
    })
    expect(get).toHaveBeenCalledTimes(7)
    expect(get).toHaveBeenLastCalledWith("api/v1/accounts", { page: 7, type: "all" })
  })

  it("loads enabled currency metadata from Firefly", async () => {
    const get = jest.fn().mockResolvedValue({
      ok: true,
      data: {
        data: [
          {
            id: "usd",
            attributes: {
              code: "USD",
              name: "US Dollar",
              symbol: "$",
              enabled: true,
              primary: true,
            },
          },
        ],
      },
    })
    ;(create as jest.Mock).mockReturnValue({ get, post: jest.fn(), put: jest.fn() })

    await expect(
      new FireflyApi("https://firefly.example.com", "token").getCurrencies(),
    ).resolves.toEqual({
      kind: "ok",
      data: [
        {
          id: "usd",
          attributes: {
            code: "USD",
            name: "US Dollar",
            symbol: "$",
            enabled: true,
            primary: true,
          },
        },
      ],
    })
    expect(get).toHaveBeenCalledWith("api/v1/currencies", { page: 1 })
  })

  it("loads budgets and budget limits for a date range", async () => {
    const get = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        data: { data: [{ id: "budget-1", attributes: { name: "Food" } }] },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          data: [
            {
              id: "limit-1",
              attributes: {
                budget_id: "budget-1",
                amount: "500.00",
                start: "2026-07-01",
                end: "2026-07-31",
              },
            },
          ],
        },
      })
    ;(create as jest.Mock).mockReturnValue({ get, post: jest.fn(), put: jest.fn() })
    const api = new FireflyApi("https://firefly.example.com", "token")

    await expect(api.getBudgets({ start: "2026-07-01", end: "2026-07-31" })).resolves.toEqual({
      kind: "ok",
      data: [{ id: "budget-1", attributes: { name: "Food" } }],
    })
    await expect(api.getBudgetLimits({ start: "2026-07-01", end: "2026-07-31" })).resolves.toEqual({
      kind: "ok",
      data: [
        {
          id: "limit-1",
          attributes: {
            budget_id: "budget-1",
            amount: "500.00",
            start: "2026-07-01",
            end: "2026-07-31",
          },
        },
      ],
    })
    expect(get).toHaveBeenNthCalledWith(1, "api/v1/budgets", {
      page: 1,
      start: "2026-07-01",
      end: "2026-07-31",
    })
    expect(get).toHaveBeenNthCalledWith(2, "api/v1/budget-limits", {
      page: 1,
      start: "2026-07-01",
      end: "2026-07-31",
    })
  })

  it("creates a transaction through Firefly", async () => {
    const post = jest.fn().mockResolvedValue({
      ok: true,
      data: {
        data: {
          id: "group-1",
          attributes: { transactions: [] },
        },
      },
    })
    ;(create as jest.Mock).mockReturnValue({ get: jest.fn(), post, put: jest.fn() })
    const request = {
      error_if_duplicate_hash: false,
      apply_rules: true,
      fire_webhooks: true,
      transactions: [
        {
          type: "withdrawal" as const,
          date: "2026-06-06T12:00:00",
          amount: "10.00",
          description: "Lunch",
          source_id: "asset-1",
          destination_id: "expense-1",
        },
      ],
    }

    await expect(
      new FireflyApi("https://firefly.example.com", "token").createTransaction(request),
    ).resolves.toEqual({
      kind: "ok",
      data: { id: "group-1", attributes: { transactions: [] } },
    })
    expect(post).toHaveBeenCalledWith("api/v1/transactions", request)
  })

  it("loads a transaction group by id", async () => {
    const get = jest.fn().mockResolvedValue({
      ok: true,
      data: {
        data: {
          id: "group-1",
          attributes: { transactions: [{ transaction_journal_id: "journal-1" }] },
        },
      },
    })
    ;(create as jest.Mock).mockReturnValue({ get, post: jest.fn(), put: jest.fn() })

    await expect(
      new FireflyApi("https://firefly.example.com", "token").getTransaction("group-1"),
    ).resolves.toEqual({
      kind: "ok",
      data: {
        id: "group-1",
        attributes: { transactions: [{ transaction_journal_id: "journal-1" }] },
      },
    })
    expect(get).toHaveBeenCalledWith("api/v1/transactions/group-1")
  })

  it("updates a transaction group through Firefly", async () => {
    const put = jest.fn().mockResolvedValue({
      ok: true,
      data: {
        data: {
          id: "group-1",
          attributes: { transactions: [] },
        },
      },
    })
    ;(create as jest.Mock).mockReturnValue({ get: jest.fn(), post: jest.fn(), put })
    const request = {
      apply_rules: true,
      fire_webhooks: true,
      transactions: [
        {
          transaction_journal_id: "journal-1",
          type: "withdrawal" as const,
          date: "2026-06-06T12:00:00",
          amount: "20.00",
          description: "Updated lunch",
          source_id: "asset-1",
          destination_id: "expense-1",
        },
      ],
    }

    await expect(
      new FireflyApi("https://firefly.example.com", "token").updateTransaction("group-1", request),
    ).resolves.toEqual({
      kind: "ok",
      data: { id: "group-1", attributes: { transactions: [] } },
    })
    expect(put).toHaveBeenCalledWith("api/v1/transactions/group-1", request)
  })

  it("deletes a transaction group through Firefly", async () => {
    const deleteRequest = jest.fn().mockResolvedValue({ ok: true, status: 204 })
    ;(create as jest.Mock).mockReturnValue({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: deleteRequest,
    })

    await expect(
      new FireflyApi("https://firefly.example.com", "token").deleteTransaction("group-1"),
    ).resolves.toEqual({ kind: "ok", data: true })
    expect(deleteRequest).toHaveBeenCalledWith("api/v1/transactions/group-1")
  })

  it("creates and updates settings entities through Firefly", async () => {
    const post = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        data: { data: { id: "account-1", attributes: { name: "Checking", type: "asset" } } },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { data: { id: "category-1", attributes: { name: "Food" } } },
      })
    const put = jest.fn().mockResolvedValue({
      ok: true,
      data: { data: { id: "tag-1", attributes: { tag: "monthly" } } },
    })
    ;(create as jest.Mock).mockReturnValue({ get: jest.fn(), post, put, delete: jest.fn() })
    const api = new FireflyApi("https://firefly.example.com", "token")

    await api.createAccount({
      name: "Checking",
      type: "asset",
      currency_code: "USD",
      active: true,
      account_role: "defaultAsset",
      opening_balance: null,
      opening_balance_date: null,
      include_net_worth: true,
      notes: null,
    })
    await api.createCategory({ name: "Food" })
    await api.updateAccount("account-2", {
      name: "Loan",
      type: "liability",
      currency_code: "USD",
      active: true,
      opening_balance: "5000",
      opening_balance_date: "2026-02-03T00:00:00.000Z",
      liability_type: "loan",
      liability_direction: "debit",
      interest: "3.5",
      interest_period: "monthly",
    })
    await api.updateTag("tag-1", { tag: "monthly" })

    expect(post).toHaveBeenNthCalledWith(1, "api/v1/accounts", {
      name: "Checking",
      type: "asset",
      currency_code: "USD",
      active: true,
      account_role: "defaultAsset",
      opening_balance: null,
      opening_balance_date: null,
      include_net_worth: true,
      notes: null,
    })
    expect(post).toHaveBeenNthCalledWith(2, "api/v1/categories", { name: "Food" })
    expect(put).toHaveBeenNthCalledWith(1, "api/v1/accounts/account-2", {
      name: "Loan",
      type: "liability",
      currency_code: "USD",
      active: true,
      opening_balance: "5000",
      opening_balance_date: "2026-02-03T00:00:00.000Z",
      liability_type: "loan",
      liability_direction: "debit",
      interest: "3.5",
      interest_period: "monthly",
    })
    expect(put).toHaveBeenNthCalledWith(2, "api/v1/tags/tag-1", { tag: "monthly" })
  })

  it("creates budgets and budget limits through Firefly", async () => {
    const post = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        data: { data: { id: "budget-1", attributes: { name: "Food" } } },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { data: { id: "limit-1", attributes: { budget_id: "budget-1" } } },
      })
    ;(create as jest.Mock).mockReturnValue({ get: jest.fn(), post, put: jest.fn() })
    const api = new FireflyApi("https://firefly.example.com", "token")

    await api.createBudget({
      name: "Food",
      active: true,
      notes: null,
      fire_webhooks: true,
      auto_budget_type: "reset",
      auto_budget_currency_code: "USD",
      auto_budget_amount: "500.00",
      auto_budget_period: "monthly",
    })
    await api.createBudgetLimit("budget-1", {
      budget_id: "budget-1",
      currency_code: "USD",
      start: "2026-07-01",
      end: "2026-07-31",
      amount: "500.00",
      notes: null,
      fire_webhooks: true,
    })

    expect(post).toHaveBeenNthCalledWith(1, "api/v1/budgets", {
      name: "Food",
      active: true,
      notes: null,
      fire_webhooks: true,
      auto_budget_type: "reset",
      auto_budget_currency_code: "USD",
      auto_budget_amount: "500.00",
      auto_budget_period: "monthly",
    })
    expect(post).toHaveBeenNthCalledWith(2, "api/v1/budgets/budget-1/limits", {
      budget_id: "budget-1",
      currency_code: "USD",
      start: "2026-07-01",
      end: "2026-07-31",
      amount: "500.00",
      notes: null,
      fire_webhooks: true,
    })
  })

  it("updates budgets and budget limits through Firefly", async () => {
    const put = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        data: { data: { id: "budget-1", attributes: { name: "Groceries" } } },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { data: { id: "limit-1", attributes: { budget_id: "budget-1" } } },
      })
    ;(create as jest.Mock).mockReturnValue({ get: jest.fn(), post: jest.fn(), put })
    const api = new FireflyApi("https://firefly.example.com", "token")

    await api.updateBudget("budget-1", {
      name: "Groceries",
      active: true,
      notes: "Weekly food",
      fire_webhooks: true,
      auto_budget_type: "adjusted",
      auto_budget_currency_code: "USD",
      auto_budget_amount: "650.00",
      auto_budget_period: "monthly",
    })
    await api.updateBudgetLimit("budget-1", "limit-1", {
      budget_id: "budget-1",
      currency_code: "USD",
      start: "2026-07-01",
      end: "2026-07-31",
      amount: "650.00",
      notes: "Weekly food",
      fire_webhooks: true,
    })

    expect(put).toHaveBeenNthCalledWith(1, "api/v1/budgets/budget-1", {
      name: "Groceries",
      active: true,
      notes: "Weekly food",
      fire_webhooks: true,
      auto_budget_type: "adjusted",
      auto_budget_currency_code: "USD",
      auto_budget_amount: "650.00",
      auto_budget_period: "monthly",
    })
    expect(put).toHaveBeenNthCalledWith(2, "api/v1/budgets/budget-1/limits/limit-1", {
      budget_id: "budget-1",
      currency_code: "USD",
      start: "2026-07-01",
      end: "2026-07-31",
      amount: "650.00",
      notes: "Weekly food",
      fire_webhooks: true,
    })
  })

  it("deletes budgets through Firefly", async () => {
    const deleteRequest = jest.fn().mockResolvedValue({ ok: true, status: 204 })
    ;(create as jest.Mock).mockReturnValue({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: deleteRequest,
    })

    await expect(
      new FireflyApi("https://firefly.example.com", "token").deleteBudget("budget-1"),
    ).resolves.toEqual({ kind: "ok", data: true })
    expect(deleteRequest).toHaveBeenCalledWith("api/v1/budgets/budget-1")
  })

  it("surfaces Firefly validation messages from failed requests", async () => {
    const post = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      data: {
        message: "The given data was invalid.",
        errors: {
          amount: ["The amount must be greater than zero."],
        },
      },
    })
    ;(create as jest.Mock).mockReturnValue({ get: jest.fn(), post, put: jest.fn() })

    await expect(
      new FireflyApi("https://firefly.example.com", "token").createBudgetLimit("budget-1", {
        budget_id: "budget-1",
        currency_code: "USD",
        start: "2026-07-01",
        end: "2026-07-31",
        amount: "0.00",
        notes: null,
        fire_webhooks: true,
      }),
    ).resolves.toEqual({
      kind: "server",
      message: "The given data was invalid. The amount must be greater than zero.",
    })
  })
})
