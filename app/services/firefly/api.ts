import { ApiResponse, ApisauceInstance, create } from "apisauce"

import {
  FireflyAccount,
  FireflyBudget,
  FireflyCategory,
  FireflyCurrency,
  FireflyEnvelope,
  FireflySingleEnvelope,
  FireflyTag,
  FireflyTransaction,
  FireflyUser,
  StoreAccountRequest,
  StoreCategoryRequest,
  StoreTagRequest,
  StoreTransactionRequest,
  UpdateTransactionRequest,
} from "@/models/firefly"

export type FireflyProblem = {
  kind: "timeout" | "unauthorized" | "not-found" | "server" | "network" | "bad-data"
  message: string
}

export type FireflyResult<T> = { kind: "ok"; data: T } | FireflyProblem

const toProblem = (response: ApiResponse<unknown>): FireflyProblem => {
  if (response.problem === "TIMEOUT_ERROR") {
    return { kind: "timeout", message: "Connection timed out. Check the server URL." }
  }

  if (response.status === 401 || response.status === 403) {
    return { kind: "unauthorized", message: "Firefly rejected the token." }
  }

  if (response.status === 404) {
    return { kind: "not-found", message: "Firefly endpoint was not found. Check the base URL." }
  }

  if (response.problem === "NETWORK_ERROR" || response.problem === "CONNECTION_ERROR") {
    return { kind: "network", message: "Could not reach the Firefly server." }
  }

  return { kind: "server", message: "Firefly returned an unexpected response." }
}

export class FireflyApi {
  private apisauce: ApisauceInstance

  constructor(baseUrl: string, token: string) {
    this.apisauce = create({
      baseURL: normalizeBaseUrl(baseUrl),
      timeout: 10000,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
  }

  async testConnection(): Promise<FireflyResult<true>> {
    const response = await this.apisauce.get("api/v1/about/user")
    if (!response.ok) return toProblem(response)
    return { kind: "ok", data: true }
  }

  async getCurrentUser(): Promise<FireflyResult<FireflyUser>> {
    return this.getSingle<FireflyUser>("api/v1/about/user")
  }

  async createAccount(request: StoreAccountRequest): Promise<FireflyResult<FireflyAccount>> {
    return this.postSingle<FireflyAccount>("api/v1/accounts", request)
  }

  async updateAccount(
    id: string,
    request: StoreAccountRequest,
  ): Promise<FireflyResult<FireflyAccount>> {
    return this.putSingle<FireflyAccount>(`api/v1/accounts/${id}`, request)
  }

  async createCategory(request: StoreCategoryRequest): Promise<FireflyResult<FireflyCategory>> {
    return this.postSingle<FireflyCategory>("api/v1/categories", request)
  }

  async updateCategory(
    id: string,
    request: StoreCategoryRequest,
  ): Promise<FireflyResult<FireflyCategory>> {
    return this.putSingle<FireflyCategory>(`api/v1/categories/${id}`, request)
  }

  async deleteCategory(id: string): Promise<FireflyResult<true>> {
    return this.deleteSingle(`api/v1/categories/${id}`)
  }

  async createTag(request: StoreTagRequest): Promise<FireflyResult<FireflyTag>> {
    return this.postSingle<FireflyTag>("api/v1/tags", request)
  }

  async updateTag(id: string, request: StoreTagRequest): Promise<FireflyResult<FireflyTag>> {
    return this.putSingle<FireflyTag>(`api/v1/tags/${id}`, request)
  }

  async deleteTag(id: string): Promise<FireflyResult<true>> {
    return this.deleteSingle(`api/v1/tags/${id}`)
  }

  private async getSingle<T>(path: string): Promise<FireflyResult<T>> {
    const response: ApiResponse<FireflySingleEnvelope<T>> = await this.apisauce.get(path)
    if (!response.ok) return toProblem(response)
    if (!response.data?.data) return { kind: "bad-data", message: "Firefly returned invalid data." }
    return { kind: "ok", data: response.data.data }
  }

  async getAccounts(type = "all"): Promise<FireflyResult<FireflyAccount[]>> {
    return this.getCollection<FireflyAccount>("api/v1/accounts", { type })
  }

  async getCurrencies(): Promise<FireflyResult<FireflyCurrency[]>> {
    return this.getCollection<FireflyCurrency>("api/v1/currencies")
  }

  async getTransactions(params: {
    start: string
    end: string
    type?: "all" | "withdrawal" | "deposit" | "transfer"
  }): Promise<FireflyResult<FireflyTransaction[]>> {
    return this.getCollection<FireflyTransaction>("api/v1/transactions", {
      start: params.start,
      end: params.end,
      type: params.type ?? "all",
    })
  }

  async getCategories(): Promise<FireflyResult<FireflyCategory[]>> {
    return this.getCollection<FireflyCategory>("api/v1/categories")
  }

  async getBudgets(): Promise<FireflyResult<FireflyBudget[]>> {
    return this.getCollection<FireflyBudget>("api/v1/budgets")
  }

  async getTags(): Promise<FireflyResult<FireflyTag[]>> {
    return this.getCollection<FireflyTag>("api/v1/tags")
  }

  async createTransaction(
    request: StoreTransactionRequest,
  ): Promise<FireflyResult<FireflyTransaction>> {
    const response: ApiResponse<FireflySingleEnvelope<FireflyTransaction>> =
      await this.apisauce.post("api/v1/transactions", request)

    if (!response.ok) return toProblem(response)
    if (!response.data?.data) return { kind: "bad-data", message: "Firefly returned invalid data." }

    return { kind: "ok", data: response.data.data }
  }

  async getTransaction(id: string): Promise<FireflyResult<FireflyTransaction>> {
    const response: ApiResponse<FireflySingleEnvelope<FireflyTransaction>> =
      await this.apisauce.get(`api/v1/transactions/${id}`)

    if (!response.ok) return toProblem(response)
    if (!response.data?.data) return { kind: "bad-data", message: "Firefly returned invalid data." }

    return { kind: "ok", data: response.data.data }
  }

  async updateTransaction(
    id: string,
    request: UpdateTransactionRequest,
  ): Promise<FireflyResult<FireflyTransaction>> {
    const response: ApiResponse<FireflySingleEnvelope<FireflyTransaction>> =
      await this.apisauce.put(`api/v1/transactions/${id}`, request)

    if (!response.ok) return toProblem(response)
    if (!response.data?.data) return { kind: "bad-data", message: "Firefly returned invalid data." }

    return { kind: "ok", data: response.data.data }
  }

  async deleteTransaction(id: string): Promise<FireflyResult<true>> {
    return this.deleteSingle(`api/v1/transactions/${id}`)
  }

  private async deleteSingle(path: string): Promise<FireflyResult<true>> {
    const response = await this.apisauce.delete(path)
    if (!response.ok) return toProblem(response)
    return { kind: "ok", data: true }
  }

  private async postSingle<T>(path: string, request: unknown): Promise<FireflyResult<T>> {
    const response: ApiResponse<FireflySingleEnvelope<T>> = await this.apisauce.post(path, request)
    if (!response.ok) return toProblem(response)
    if (!response.data?.data) return { kind: "bad-data", message: "Firefly returned invalid data." }
    return { kind: "ok", data: response.data.data }
  }

  private async putSingle<T>(path: string, request: unknown): Promise<FireflyResult<T>> {
    const response: ApiResponse<FireflySingleEnvelope<T>> = await this.apisauce.put(path, request)
    if (!response.ok) return toProblem(response)
    if (!response.data?.data) return { kind: "bad-data", message: "Firefly returned invalid data." }
    return { kind: "ok", data: response.data.data }
  }

  private async getCollection<T>(
    path: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<FireflyResult<T[]>> {
    const firstResponse: ApiResponse<FireflyEnvelope<T>> = await this.apisauce.get(path, {
      ...params,
      page: 1,
    })

    if (!firstResponse.ok) return toProblem(firstResponse)
    if (!firstResponse.data?.data)
      return { kind: "bad-data", message: "Firefly returned invalid data." }

    const totalPages = firstResponse.data.meta?.pagination?.total_pages ?? 1
    const data = [...firstResponse.data.data]

    for (let page = 2; page <= totalPages; page += 1) {
      const response: ApiResponse<FireflyEnvelope<T>> = await this.apisauce.get(path, {
        ...params,
        page,
      })

      if (!response.ok) return toProblem(response)
      if (!response.data?.data)
        return { kind: "bad-data", message: "Firefly returned invalid data." }
      data.push(...response.data.data)
    }

    return { kind: "ok", data }
  }
}

export function normalizeBaseUrl(input: string) {
  const trimmed = input.trim()
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return withProtocol.endsWith("/") ? withProtocol : `${withProtocol}/`
}
