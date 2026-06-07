import {
  createContext,
  FC,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import { useMMKVString } from "react-native-mmkv"

import { useFirefly } from "@/context/FireflyContext"
import type {
  FireflyAccount,
  FireflyBudget,
  FireflyCategory,
  FireflyTag,
  StoreTransactionRequest,
} from "@/models/firefly"
import {
  buildMoneyAgentPrompt,
  buildMoneyAgentDraftRetryPrompt,
  cloneDraft,
  GeminiProvider,
  loadSecret,
  MoneyAgentChatItem,
  MoneyAgentConversationState,
  MoneyAgentDraftField,
  MoneyAgentEntity,
  MoneyAgentEntitySnapshot,
  MoneyAgentMessage,
  AiProviderId,
  MoneyAgentSaveSettingsInput,
  MoneyAgentTransactionDraft,
  removeSecret,
  saveSecret,
} from "@/services/ai"
import { load, save } from "@/utils/storage"

const CONVERSATION_KEY = "MoneyAgent.conversation"
const SNAPSHOT_KEY = "MoneyAgent.snapshot"
const PROVIDER_KEY = "MoneyAgent.providerId"
const MODEL_KEY = "MoneyAgent.model"
const API_KEY = "MoneyAgent.apiKey"
const DEFAULT_MODEL = "gemini-2.5-flash"
const DEFAULT_PROVIDER: AiProviderId = "gemini"

type MoneyAgentContextType = {
  isReady: boolean
  providerId: AiProviderId
  model: string
  hasApiKey: boolean
  isSavingSettings: boolean
  isSending: boolean
  error?: string
  items: MoneyAgentChatItem[]
  drafts: MoneyAgentTransactionDraft[]
  input: string
  setInput: (value: string) => void
  sendMessage: (text?: string) => Promise<void>
  sendQuickPrompt: (text: string) => Promise<void>
  clearConversation: (discardDrafts: boolean) => void
  updateDraft: (draft: MoneyAgentTransactionDraft) => void
  confirmDraft: (draftId: string) => Promise<void>
  discardDraft: (draftId: string) => void
  saveSettings: (input: MoneyAgentSaveSettingsInput) => Promise<boolean>
  removeCredentials: () => Promise<void>
  refreshSnapshot: () => void
  testCurrentConnection: (input: MoneyAgentSaveSettingsInput) => Promise<boolean>
  snapshot: MoneyAgentEntitySnapshot
}

const MoneyAgentContext = createContext<MoneyAgentContextType | null>(null)

function generateId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function nowIso() {
  return new Date().toISOString()
}

function currentDateInTimeZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? ""
  return `${value("year")}-${value("month")}-${value("day")}`
}

function accountToEntity(account: FireflyAccount): MoneyAgentEntity {
  return {
    id: account.id,
    name: account.attributes.name,
    type: account.attributes.type,
    role: account.attributes.account_role,
    currencyCode: account.attributes.currency_code,
  }
}

function simpleEntity(entity: {
  id: string
  attributes: { name?: string; tag?: string }
}): MoneyAgentEntity {
  return {
    id: entity.id,
    name: entity.attributes.tag ?? entity.attributes.name ?? entity.id,
  }
}

function buildSnapshot(
  accounts: FireflyAccount[],
  categories: FireflyCategory[],
  budgets: FireflyBudget[],
  tags: FireflyTag[],
): MoneyAgentEntitySnapshot {
  return {
    syncedAt: nowIso(),
    accounts: accounts.map(accountToEntity),
    categories: categories.map(simpleEntity),
    budgets: budgets.map(simpleEntity),
    tags: tags.map(simpleEntity),
    currencies: Array.from(
      new Set(accounts.map((account) => account.attributes.currency_code).filter(Boolean)),
    ) as string[],
  }
}

function defaultConversation(): MoneyAgentConversationState {
  return {
    items: [
      {
        id: generateId(),
        kind: "message",
        message: {
          id: generateId(),
          role: "assistant",
          text: "I’m Money Agent. Send whatever transaction details you have and I’ll prepare the best matching draft for review.",
          createdAt: nowIso(),
        },
      },
    ],
    drafts: [],
  }
}

function ensureDraftConsistency(
  draft: MoneyAgentTransactionDraft,
  snapshot: MoneyAgentEntitySnapshot,
): MoneyAgentTransactionDraft {
  const hasFieldValue = (field: MoneyAgentDraftField) => {
    if (field === "tagIds") return draft.tagIds.length > 0
    return !!draft[field] && String(draft[field]).trim().length > 0
  }
  const missingFields = new Set<MoneyAgentDraftField>(
    draft.missingFields.filter((field) => !hasFieldValue(field)),
  )
  const required = ["amount", "date", "description"] as const

  required.forEach((field) => {
    if (!draft[field] || String(draft[field]).trim().length === 0) missingFields.add(field)
  })
  if (!Number.isFinite(Number(draft.amount)) || Number(draft.amount) <= 0) {
    missingFields.add("amount")
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
    Number.isNaN(Date.parse(`${draft.date}T12:00:00`))
  ) {
    missingFields.add("date")
  }

  if (!draft.sourceAccountId) missingFields.add("sourceAccountId")
  if (!draft.destinationAccountId) missingFields.add("destinationAccountId")

  const sourceExists =
    !draft.sourceAccountId ||
    snapshot.accounts.some((account) => account.id === draft.sourceAccountId)
  const destinationExists =
    !draft.destinationAccountId ||
    snapshot.accounts.some((account) => account.id === draft.destinationAccountId)
  const categoryExists =
    !draft.categoryId || snapshot.categories.some((category) => category.id === draft.categoryId)
  const budgetExists =
    !draft.budgetId || snapshot.budgets.some((budget) => budget.id === draft.budgetId)
  const tagsExist =
    draft.tagIds.length === 0 ||
    draft.tagIds.every((tagId) => snapshot.tags.some((tag) => tag.id === tagId))

  if (!sourceExists) missingFields.add("sourceAccountId")
  if (!destinationExists) missingFields.add("destinationAccountId")
  if (!categoryExists) missingFields.add("categoryId")
  if (!budgetExists) missingFields.add("budgetId")
  if (!tagsExist) missingFields.add("tagIds")

  return {
    ...cloneDraft(draft),
    sourceAccountId: sourceExists ? draft.sourceAccountId : null,
    destinationAccountId: destinationExists ? draft.destinationAccountId : null,
    categoryId: categoryExists ? draft.categoryId : null,
    budgetId: budgetExists ? draft.budgetId : null,
    tagIds: tagsExist ? [...draft.tagIds] : [],
    missingFields: Array.from(missingFields),
    status: draft.status,
  }
}

function isDraftReady(draft: MoneyAgentTransactionDraft) {
  return draft.missingFields.length === 0
}

function buildStoreRequest(
  draft: MoneyAgentTransactionDraft,
  snapshot: MoneyAgentEntitySnapshot,
): StoreTransactionRequest {
  const parsed = new Date(`${draft.date}T12:00:00`)
  return {
    error_if_duplicate_hash: false,
    apply_rules: true,
    fire_webhooks: true,
    transactions: [
      {
        type: draft.type,
        date: `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(
          parsed.getDate(),
        ).padStart(2, "0")}T${String(parsed.getHours()).padStart(2, "0")}:${String(
          parsed.getMinutes(),
        ).padStart(2, "0")}:00`,
        amount: Number(draft.amount).toFixed(2),
        description: draft.description.trim(),
        source_id: draft.sourceAccountId ?? undefined,
        destination_id: draft.destinationAccountId ?? undefined,
        category_id: draft.categoryId ?? undefined,
        budget_id: draft.budgetId ?? undefined,
        tags:
          draft.tagIds.length > 0
            ? draft.tagIds.map(
                (tagId) => snapshot.tags.find((tag) => tag.id === tagId)?.name ?? tagId,
              )
            : undefined,
        notes: draft.notes?.trim() || undefined,
      },
    ],
  }
}

export const MoneyAgentProvider: FC<PropsWithChildren> = ({ children }) => {
  const firefly = useFirefly()
  const [storedProviderId, setStoredProviderId] = useMMKVString(PROVIDER_KEY)
  const [storedModel, setStoredModel] = useMMKVString(MODEL_KEY)
  const [conversation, setConversation] = useState<MoneyAgentConversationState>(() => {
    const saved = load<MoneyAgentConversationState>(CONVERSATION_KEY)
    return saved ?? defaultConversation()
  })
  const [snapshot, setSnapshot] = useState<MoneyAgentEntitySnapshot>(() => {
    const saved = load<MoneyAgentEntitySnapshot>(SNAPSHOT_KEY)
    return (
      saved ?? {
        accounts: [],
        categories: [],
        budgets: [],
        tags: [],
        currencies: [],
      }
    )
  })
  const [input, setInput] = useState("")
  const [hasApiKey, setHasApiKey] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string>()

  const providerId = (storedProviderId as AiProviderId) ?? DEFAULT_PROVIDER
  const model = storedModel ?? DEFAULT_MODEL
  const isReady = firefly.isConfigured && hasApiKey

  useEffect(() => {
    void loadSecret(API_KEY).then((value) => setHasApiKey(!!value))
  }, [])

  useEffect(() => {
    if (!firefly.isConfigured) {
      const emptySnapshot: MoneyAgentEntitySnapshot = {
        accounts: [],
        categories: [],
        budgets: [],
        tags: [],
        currencies: [],
      }
      setSnapshot(emptySnapshot)
      save(SNAPSHOT_KEY, emptySnapshot)
      return
    }

    const registriesReady = [
      firefly.accounts.status,
      firefly.categories.status,
      firefly.budgets.status,
      firefly.tags.status,
    ].every((status) => status === "ready")
    if (!registriesReady) return

    const nextSnapshot = buildSnapshot(
      firefly.accounts.data,
      firefly.categories.data,
      firefly.budgets.data,
      firefly.tags.data,
    )
    setSnapshot(nextSnapshot)
    save(SNAPSHOT_KEY, nextSnapshot)
  }, [
    firefly.accounts.data,
    firefly.accounts.status,
    firefly.budgets.data,
    firefly.budgets.status,
    firefly.categories.data,
    firefly.categories.status,
    firefly.isConfigured,
    firefly.tags.data,
    firefly.tags.status,
  ])

  useEffect(() => {
    save(CONVERSATION_KEY, conversation)
  }, [conversation])

  useEffect(() => {
    if (storedProviderId) return
    setStoredProviderId(DEFAULT_PROVIDER)
  }, [setStoredProviderId, storedProviderId])

  useEffect(() => {
    if (storedModel) return
    setStoredModel(DEFAULT_MODEL)
  }, [setStoredModel, storedModel])

  const provider = GeminiProvider

  const appendItems = useCallback((items: MoneyAgentChatItem[]) => {
    setConversation((current) => ({ ...current, items: [...current.items, ...items] }))
  }, [])

  const appendDrafts = useCallback(
    (drafts: MoneyAgentTransactionDraft[]) => {
      setConversation((current) => ({
        ...current,
        drafts: [
          ...drafts.map((draft) => ensureDraftConsistency(draft, snapshot)),
          ...current.drafts,
        ],
        items: [
          ...current.items,
          ...drafts.map((draft) => ({
            id: draft.id,
            kind: "draft" as const,
            draftId: draft.id,
            createdAt: nowIso(),
          })),
        ],
      }))
    },
    [snapshot],
  )

  const saveSettings = useCallback(
    async ({
      providerId: nextProviderId,
      model: nextModel,
      apiKey,
    }: MoneyAgentSaveSettingsInput) => {
      setIsSavingSettings(true)
      setError(undefined)
      try {
        const trimmedKey = apiKey.trim()
        if (!trimmedKey && !hasApiKey) {
          setError("Add a Gemini key before saving settings.")
          return false
        }

        if (!trimmedKey) {
          setStoredProviderId(nextProviderId)
          setStoredModel(nextModel)
          return true
        }

        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
        const prompt = buildMoneyAgentPrompt({
          currentDate: currentDateInTimeZone(timeZone),
          timeZone,
          snapshot,
          messages: conversation.items
            .filter((item) => item.kind === "message")
            .map((item) => item.message)
            .filter((message) => message.role !== "status"),
        })
        const result = await provider.testConnection({
          apiKey,
          model: nextModel,
          prompt,
        })
        if (result.kind !== "ok") {
          setError(result.message)
          return false
        }

        setStoredProviderId(nextProviderId)
        setStoredModel(nextModel)
        const saved = await saveSecret(API_KEY, trimmedKey)
        setHasApiKey(saved)
        if (!saved) {
          setError("Could not save the Gemini key securely.")
        }
        return saved
      } finally {
        setIsSavingSettings(false)
      }
    },
    [conversation.items, hasApiKey, provider, snapshot, setStoredModel, setStoredProviderId],
  )

  const testCurrentConnection = useCallback(
    async ({ model: nextModel, apiKey }: MoneyAgentSaveSettingsInput) => {
      const trimmedKey = apiKey.trim()
      if (!trimmedKey) {
        setError("Enter a Gemini key to test the connection.")
        return false
      }
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const prompt = buildMoneyAgentPrompt({
        currentDate: currentDateInTimeZone(timeZone),
        timeZone,
        snapshot,
        messages: conversation.items
          .filter((item) => item.kind === "message")
          .map((item) => item.message)
          .filter((message) => message.role !== "status"),
      })
      const result = await provider.testConnection({
        apiKey: trimmedKey,
        model: nextModel,
        prompt,
      })
      if (result.kind !== "ok") {
        setError(result.message)
        return false
      }
      setError(undefined)
      return true
    },
    [conversation.items, provider, snapshot],
  )

  const removeCredentials = useCallback(async () => {
    await removeSecret(API_KEY)
    setHasApiKey(false)
  }, [])

  const clearConversation = useCallback((discardDrafts: boolean) => {
    setConversation((current) =>
      discardDrafts
        ? defaultConversation()
        : {
            items: [
              ...defaultConversation().items,
              ...current.items.filter((item) => item.kind === "draft"),
            ],
            drafts: current.drafts,
          },
    )
  }, [])

  const updateDraft = useCallback(
    (draft: MoneyAgentTransactionDraft) => {
      setConversation((current) => ({
        ...current,
        drafts: current.drafts.map((item) =>
          item.id === draft.id ? ensureDraftConsistency(draft, snapshot) : item,
        ),
      }))
    },
    [snapshot],
  )

  const discardDraft = useCallback((draftId: string) => {
    setConversation((current) => ({
      ...current,
      drafts: current.drafts.map((draft) =>
        draft.id === draftId ? { ...draft, status: "discarded" } : draft,
      ),
    }))
  }, [])

  const confirmDraft = useCallback(
    async (draftId: string) => {
      const current = conversation.drafts.find((draft) => draft.id === draftId)
      if (!current) return

      const resolved = ensureDraftConsistency(current, snapshot)
      if (!isDraftReady(resolved)) {
        setError("Resolve the missing fields before confirming.")
        updateDraft(resolved)
        return
      }

      try {
        setConversation((state) => ({
          ...state,
          drafts: state.drafts.map((draft) =>
            draft.id === draftId ? { ...draft, status: "confirming" } : draft,
          ),
        }))
        const succeeded = await firefly.createTransaction(buildStoreRequest(resolved, snapshot))
        if (!succeeded) {
          setError("Firefly rejected the transaction.")
          setConversation((state) => ({
            ...state,
            drafts: state.drafts.map((draft) =>
              draft.id === draftId
                ? {
                    ...draft,
                    status: "failed",
                    errorMessage: "Firefly rejected the transaction.",
                  }
                : draft,
            ),
          }))
          return
        }
        setConversation((state) => ({
          ...state,
          drafts: state.drafts.map((draft) =>
            draft.id === draftId ? { ...draft, status: "confirmed" } : draft,
          ),
        }))
        await firefly.refresh()
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not confirm draft.")
        setConversation((state) => ({
          ...state,
          drafts: state.drafts.map((draft) =>
            draft.id === draftId
              ? {
                  ...draft,
                  status: "failed",
                  errorMessage:
                    caught instanceof Error ? caught.message : "Could not confirm draft.",
                }
              : draft,
          ),
        }))
      }
    },
    [conversation.drafts, firefly, snapshot, updateDraft],
  )

  const sendMessage = useCallback(
    async (text?: string) => {
      const value = (text ?? input).trim()
      if (!value) return
      if (!isReady) {
        setError("Add a Firefly connection and a Gemini key first.")
        return
      }

      const apiKey = await loadSecret(API_KEY)
      if (!apiKey) {
        setError("Add a Gemini key in Settings first.")
        return
      }

      const pendingItemId = generateId()
      const pendingMessageId = generateId()
      setInput("")
      setIsSending(true)
      setError(undefined)
      try {
        const userMessage: MoneyAgentMessage = {
          id: generateId(),
          role: "user",
          text: value,
          createdAt: nowIso(),
        }
        appendItems([
          { id: userMessage.id, kind: "message", message: userMessage },
          {
            id: pendingItemId,
            kind: "message",
            message: {
              id: pendingMessageId,
              role: "status",
              text: "Money Agent is thinking...",
              createdAt: nowIso(),
            },
          },
        ])

        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
        const prompt = buildMoneyAgentPrompt({
          currentDate: currentDateInTimeZone(timeZone),
          timeZone,
          snapshot,
          messages: [
            ...conversation.items
              .filter((item) => item.kind === "message")
              .map((item) => item.message)
              .filter((message) => message.role !== "status"),
            userMessage,
          ],
        })

        let result = await provider.send({
          apiKey,
          model,
          prompt,
        })

        if (result.kind === "ok" && result.data.kind === "clarification") {
          result = await provider.send({
            apiKey,
            model,
            prompt: buildMoneyAgentDraftRetryPrompt(prompt),
          })
        }

        if (result.kind !== "ok") {
          setError(result.message)
          setConversation((current) => ({
            ...current,
            items: current.items.map((item) =>
              item.id === pendingItemId
                ? {
                    id: generateId(),
                    kind: "message" as const,
                    message: {
                      id: generateId(),
                      role: "assistant" as const,
                      text: result.message,
                      createdAt: nowIso(),
                    },
                  }
                : item,
            ),
          }))
          return
        }

        const responseText =
          result.data.kind === "clarification"
            ? [result.data.assistantMessage, result.data.clarificationQuestion]
                .filter((part, index, all) => !!part && all.indexOf(part) === index)
                .join("\n\n")
            : result.data.assistantMessage
        setConversation((current) => ({
          ...current,
          items: current.items.map((item) =>
            item.id === pendingItemId
              ? {
                  id: generateId(),
                  kind: "message" as const,
                  message: {
                    id: generateId(),
                    role: "assistant" as const,
                    text: responseText,
                    createdAt: nowIso(),
                  },
                }
              : item,
          ),
        }))

        if (result.data.kind === "drafts") {
          appendDrafts(result.data.drafts)
        }
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : "Money Agent could not process the response."
        setError(message)
        setConversation((current) => ({
          ...current,
          items: current.items.map((item) =>
            item.id === pendingItemId
              ? {
                  id: generateId(),
                  kind: "message" as const,
                  message: {
                    id: generateId(),
                    role: "assistant" as const,
                    text: message,
                    createdAt: nowIso(),
                  },
                }
              : item,
          ),
        }))
      } finally {
        setIsSending(false)
      }
    },
    [appendDrafts, appendItems, conversation.items, input, isReady, model, provider, snapshot],
  )

  const refreshSnapshot = useCallback(() => {
    const nextSnapshot = buildSnapshot(
      firefly.accounts.data,
      firefly.categories.data,
      firefly.budgets.data,
      firefly.tags.data,
    )
    setSnapshot(nextSnapshot)
    save(SNAPSHOT_KEY, nextSnapshot)
  }, [firefly.accounts.data, firefly.budgets.data, firefly.categories.data, firefly.tags.data])

  const value: MoneyAgentContextType = {
    isReady,
    providerId,
    model,
    hasApiKey,
    isSavingSettings,
    isSending,
    error,
    items: conversation.items,
    drafts: conversation.drafts,
    input,
    setInput,
    sendMessage,
    sendQuickPrompt: sendMessage,
    clearConversation,
    updateDraft,
    confirmDraft,
    discardDraft,
    saveSettings,
    removeCredentials,
    refreshSnapshot,
    testCurrentConnection,
    snapshot,
  }

  return <MoneyAgentContext.Provider value={value}>{children}</MoneyAgentContext.Provider>
}

export const useMoneyAgent = () => {
  const context = useContext(MoneyAgentContext)
  if (!context) throw new Error("useMoneyAgent must be used within a MoneyAgentProvider")
  return context
}
