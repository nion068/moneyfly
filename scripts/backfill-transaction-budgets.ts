declare function require(moduleName: string): unknown

const fs = require("fs") as {
  existsSync: (path: string) => boolean
  readFileSync: (path: string, encoding: "utf8") => string
}

type TransactionType = "withdrawal" | "deposit" | "transfer"

type FireflyEnvelope<T> = {
  data?: T[]
  meta?: {
    pagination?: {
      total_pages?: number
    }
  }
}

type FireflySingleEnvelope<T> = {
  data?: T
}

export type FireflyBudget = {
  id: string
  attributes: {
    name: string
    active?: boolean
  }
}

export type FireflyTransactionSplit = {
  transaction_journal_id?: string
  date: string
  amount: string
  description: string
  type: TransactionType
  source_id?: string
  source_name?: string
  destination_id?: string
  destination_name?: string
  category_id?: string
  category_name?: string
  budget_id?: string | null
  budget_name?: string | null
  tags?: string[]
  notes?: string | null
  currency_code?: string
}

export type FireflyTransaction = {
  id: string
  attributes: {
    group_title?: string | null
    transactions: FireflyTransactionSplit[]
  }
}

export type BudgetAssignment = {
  transactionJournalId: string
  budgetId: string | null
  reason: string
}

type GeminiAssignmentResponse = {
  assignments?: unknown
}

type CliOptions = {
  month: string
  dryRun: boolean
  batchSize: number
  cooldownMs: number
  model?: string
  limit?: number
}

type Env = {
  FIREFLY_BASE_URL: string
  FIREFLY_PAT: string
  GEMINI_API_KEY: string
  GEMINI_MODEL?: string
}

type MissingBudgetSplit = {
  group: FireflyTransaction
  split: FireflyTransactionSplit
}

type Fetcher = typeof fetch

const DEFAULT_BATCH_SIZE = 10
const DEFAULT_COOLDOWN_MS = 30_000
const DEFAULT_MODEL = "gemini-2.5-flash"

export function parseMonthRange(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) throw new Error("Use --month in YYYY-MM format, for example --month 2026-07.")

  const year = Number(match[1])
  const monthNumber = Number(match[2])
  if (monthNumber < 1 || monthNumber > 12) {
    throw new Error("Month must be between 01 and 12.")
  }

  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, "0")}`,
  }
}

export function findWithdrawalSplitsWithoutBudget(
  transactions: FireflyTransaction[],
): MissingBudgetSplit[] {
  return transactions.flatMap((group) =>
    group.attributes.transactions
      .filter(
        (split) =>
          split.type === "withdrawal" && !!split.transaction_journal_id && !split.budget_id?.trim(),
      )
      .map((split) => ({ group, split })),
  )
}

export function validateAssignments(
  response: GeminiAssignmentResponse,
  budgetIds: Set<string>,
  journalIds: Set<string>,
): BudgetAssignment[] {
  if (!Array.isArray(response.assignments)) {
    throw new Error("Gemini returned JSON without an assignments array.")
  }

  return response.assignments.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const assignment = item as Record<string, unknown>
    const transactionJournalId = assignment.transactionJournalId
    const budgetId = assignment.budgetId
    const reason = assignment.reason

    if (typeof transactionJournalId !== "string" || !journalIds.has(transactionJournalId)) {
      return []
    }
    if (budgetId !== null && (typeof budgetId !== "string" || !budgetIds.has(budgetId))) {
      return []
    }

    return [
      {
        transactionJournalId,
        budgetId,
        reason: typeof reason === "string" ? reason : "",
      },
    ]
  })
}

export function buildTransactionUpdateRequest(
  group: FireflyTransaction,
  assignments: Map<string, string | null>,
) {
  return {
    apply_rules: false,
    fire_webhooks: true,
    group_title: group.attributes.group_title ?? undefined,
    transactions: group.attributes.transactions.map((split) => {
      const journalId = split.transaction_journal_id
      const assignedBudgetId = journalId ? assignments.get(journalId) : undefined
      const budgetId = assignedBudgetId === undefined ? split.budget_id : assignedBudgetId

      return stripUndefined({
        transaction_journal_id: split.transaction_journal_id,
        type: split.type,
        date: split.date,
        amount: split.amount,
        description: split.description,
        source_id: split.source_id,
        source_name: split.source_id ? undefined : split.source_name,
        destination_id: split.destination_id,
        destination_name: split.destination_id ? undefined : split.destination_name,
        category_id: split.category_id,
        category_name: split.category_id ? undefined : split.category_name,
        budget_id: budgetId || undefined,
        tags: split.tags && split.tags.length > 0 ? split.tags : undefined,
        notes: split.notes?.trim() || undefined,
      })
    }),
  }
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined))
}

function parseEnvFile(path = ".env.local"): Partial<Env> {
  if (!fs.existsSync(path)) return {}

  return fs
    .readFileSync(path, "utf8")
    .split(/\r?\n/)
    .reduce<Record<string, string>>((result, line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) return result

      const separator = trimmed.indexOf("=")
      if (separator === -1) return result

      const key = trimmed.slice(0, separator).trim()
      let value = trimmed.slice(separator + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      result[key] = value
      return result
    }, {})
}

function loadEnv(): Env {
  const fileEnv = parseEnvFile()
  const env = {
    FIREFLY_BASE_URL: process.env.FIREFLY_BASE_URL ?? fileEnv.FIREFLY_BASE_URL,
    FIREFLY_PAT: process.env.FIREFLY_PAT ?? fileEnv.FIREFLY_PAT,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? fileEnv.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL ?? fileEnv.GEMINI_MODEL,
  }

  const missing = Object.entries(env)
    .filter(([key, value]) => key !== "GEMINI_MODEL" && !value)
    .map(([key]) => key)
  if (missing.length > 0) {
    throw new Error(`Missing required environment value(s): ${missing.join(", ")}.`)
  }

  return env as Env
}

function normalizeBaseUrl(input: string) {
  const trimmed = input.trim()
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return withProtocol.endsWith("/") ? withProtocol : `${withProtocol}/`
}

async function getCollection<T>(
  fetcher: Fetcher,
  baseUrl: string,
  token: string,
  path: string,
  params: Record<string, string | number | undefined>,
) {
  const all: T[] = []
  let totalPages = 1

  for (let page = 1; page <= totalPages; page += 1) {
    const url = new URL(path, baseUrl)
    Object.entries({ ...params, page }).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, String(value))
    })

    const response = await fetcher(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
    if (!response.ok) {
      throw new Error(
        `Firefly ${path} failed with HTTP ${response.status}: ${await response.text()}`,
      )
    }

    const body = (await response.json()) as FireflyEnvelope<T>
    if (!Array.isArray(body.data)) throw new Error(`Firefly ${path} returned invalid data.`)
    all.push(...body.data)
    totalPages = body.meta?.pagination?.total_pages ?? 1
  }

  return all
}

async function updateTransaction(
  fetcher: Fetcher,
  baseUrl: string,
  token: string,
  groupId: string,
  request: ReturnType<typeof buildTransactionUpdateRequest>,
) {
  const response = await fetcher(new URL(`api/v1/transactions/${groupId}`, baseUrl), {
    method: "PUT",
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(
      `Firefly transaction ${groupId} update failed with HTTP ${response.status}: ${await response.text()}`,
    )
  }

  const body = (await response.json()) as FireflySingleEnvelope<FireflyTransaction>
  if (!body.data) throw new Error(`Firefly transaction ${groupId} returned invalid data.`)
  return body.data
}

function compactTransaction(split: FireflyTransactionSplit) {
  return {
    transactionJournalId: split.transaction_journal_id,
    date: split.date.slice(0, 10),
    amount: split.amount,
    currencyCode: split.currency_code,
    description: split.description,
    source: split.source_name,
    destination: split.destination_name,
    category: split.category_name,
    tags: split.tags ?? [],
    notes: split.notes,
  }
}

function buildGeminiPrompt(budgets: FireflyBudget[], splits: FireflyTransactionSplit[]) {
  return [
    "You assign Firefly III budgets to existing withdrawal transactions.",
    "Return JSON only. Choose only from the listed budget IDs. Never invent a budget.",
    "Use null when no listed budget is a reasonable match.",
    "Match by transaction description, destination, category, notes, tags, and common personal finance meaning.",
    `Budgets: ${JSON.stringify(
      budgets.map((budget) => ({ id: budget.id, name: budget.attributes.name })),
    )}`,
    `Transactions: ${JSON.stringify(splits.map(compactTransaction))}`,
  ].join("\n")
}

function getGeminiResponseSchema() {
  return {
    type: "object",
    properties: {
      assignments: {
        type: "array",
        items: {
          type: "object",
          properties: {
            transactionJournalId: { type: "string" },
            budgetId: { type: ["string", "null"] },
            reason: { type: "string" },
          },
          required: ["transactionJournalId", "budgetId", "reason"],
        },
      },
    },
    required: ["assignments"],
  }
}

async function classifyBatch(args: {
  fetcher: Fetcher
  apiKey: string
  model: string
  budgets: FireflyBudget[]
  splits: FireflyTransactionSplit[]
}) {
  const response = await args.fetcher(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      args.model,
    )}:generateContent?key=${encodeURIComponent(args.apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildGeminiPrompt(args.budgets, args.splits) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: getGeminiResponseSchema(),
          temperature: 0.1,
        },
      }),
    },
  )

  if (!response.ok) {
    throw new Error(`Gemini failed with HTTP ${response.status}: ${await response.text()}`)
  }

  const body = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error("Gemini returned an empty response.")

  return JSON.parse(text) as GeminiAssignmentResponse
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    month: "",
    dryRun: false,
    batchSize: DEFAULT_BATCH_SIZE,
    cooldownMs: DEFAULT_COOLDOWN_MS,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const readValue = () => {
      const value = argv[index + 1]
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}.`)
      index += 1
      return value
    }

    if (arg === "--") continue
    else if (arg === "--help" || arg === "-h") {
      throw new Error(
        [
          "Usage: pnpm run backfill:budgets -- --month YYYY-MM [options]",
          "",
          "Options:",
          "  --dry-run                 Print proposed changes without updating Firefly.",
          "  --batch-size N            Transactions per Gemini call. Default: 10.",
          "  --cooldown-ms N           Delay between Gemini calls. Default: 30000.",
          "  --model MODEL             Gemini model. Default: GEMINI_MODEL or gemini-2.5-flash.",
          "  --limit N                 Process only the first N missing-budget transactions.",
        ].join("\n"),
      )
    } else if (arg === "--dry-run") options.dryRun = true
    else if (arg === "--month") options.month = readValue()
    else if (arg.startsWith("--month=")) options.month = arg.slice("--month=".length)
    else if (arg === "--batch-size") options.batchSize = Number(readValue())
    else if (arg.startsWith("--batch-size=")) options.batchSize = Number(arg.slice(13))
    else if (arg === "--cooldown-ms") options.cooldownMs = Number(readValue())
    else if (arg.startsWith("--cooldown-ms=")) options.cooldownMs = Number(arg.slice(14))
    else if (arg === "--model") options.model = readValue()
    else if (arg.startsWith("--model=")) options.model = arg.slice(8)
    else if (arg === "--limit") options.limit = Number(readValue())
    else if (arg.startsWith("--limit=")) options.limit = Number(arg.slice(8))
    else throw new Error(`Unknown argument: ${arg}.`)
  }

  if (!options.month) throw new Error("Missing required --month YYYY-MM argument.")
  if (!Number.isInteger(options.batchSize) || options.batchSize < 1) {
    throw new Error("--batch-size must be a positive integer.")
  }
  if (!Number.isInteger(options.cooldownMs) || options.cooldownMs < 0) {
    throw new Error("--cooldown-ms must be a non-negative integer.")
  }
  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error("--limit must be a positive integer.")
  }

  return options
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function delay(ms: number) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms))
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  const env = loadEnv()
  const range = parseMonthRange(options.month)
  const baseUrl = normalizeBaseUrl(env.FIREFLY_BASE_URL)
  const model = options.model ?? env.GEMINI_MODEL ?? DEFAULT_MODEL

  console.log(`Fetching Firefly withdrawals for ${range.start} through ${range.end}...`)
  const [transactions, budgets] = await Promise.all([
    getCollection<FireflyTransaction>(fetch, baseUrl, env.FIREFLY_PAT, "api/v1/transactions", {
      start: range.start,
      end: range.end,
      type: "withdrawal",
    }),
    getCollection<FireflyBudget>(fetch, baseUrl, env.FIREFLY_PAT, "api/v1/budgets", {
      start: range.start,
      end: range.end,
    }),
  ])

  const activeBudgets = budgets.filter((budget) => budget.attributes.active !== false)
  const missing = findWithdrawalSplitsWithoutBudget(transactions).slice(0, options.limit)
  const budgetIds = new Set(activeBudgets.map((budget) => budget.id))

  console.log(
    `Found ${transactions.length} transaction group(s), ${activeBudgets.length} active budget(s), and ${missing.length} withdrawal split(s) without a budget.`,
  )

  if (missing.length === 0) return
  if (activeBudgets.length === 0) throw new Error("No active budgets found in Firefly.")

  const assignments = new Map<string, BudgetAssignment>()
  const batches = chunk(missing, options.batchSize)

  for (const [index, batch] of batches.entries()) {
    console.log(
      `Classifying batch ${index + 1}/${batches.length} (${batch.length} transaction(s))...`,
    )
    const journalIds = new Set(
      batch.flatMap(({ split }) =>
        split.transaction_journal_id ? [split.transaction_journal_id] : [],
      ),
    )
    const response = await classifyBatch({
      fetcher: fetch,
      apiKey: env.GEMINI_API_KEY,
      model,
      budgets: activeBudgets,
      splits: batch.map(({ split }) => split),
    })
    const validAssignments = validateAssignments(response, budgetIds, journalIds)
    validAssignments.forEach((assignment) => {
      assignments.set(assignment.transactionJournalId, assignment)
      const budgetName =
        activeBudgets.find((budget) => budget.id === assignment.budgetId)?.attributes.name ?? "none"
      console.log(`  ${assignment.transactionJournalId}: ${budgetName} (${assignment.reason})`)
    })

    if (index < batches.length - 1 && options.cooldownMs > 0) {
      console.log(`Waiting ${options.cooldownMs}ms before the next Gemini call...`)
      await delay(options.cooldownMs)
    }
  }

  const appliedAssignments = new Map(
    Array.from(assignments.values())
      .filter((assignment) => assignment.budgetId)
      .map((assignment) => [assignment.transactionJournalId, assignment.budgetId]),
  )
  const affectedGroups = transactions.filter((group) =>
    group.attributes.transactions.some(
      (split) =>
        split.transaction_journal_id && appliedAssignments.has(split.transaction_journal_id),
    ),
  )

  if (options.dryRun) {
    console.log(`Dry run complete. ${appliedAssignments.size} split(s) would be updated.`)
    return
  }

  let updated = 0
  for (const group of affectedGroups) {
    const request = buildTransactionUpdateRequest(group, appliedAssignments)
    await updateTransaction(fetch, baseUrl, env.FIREFLY_PAT, group.id, request)
    updated += 1
    console.log(`Updated transaction group ${group.id}.`)
  }

  console.log(
    `Done. Scanned ${missing.length} missing split(s), assigned ${appliedAssignments.size}, skipped ${
      missing.length - appliedAssignments.size
    }, updated ${updated} transaction group(s).`,
  )
}

if ((process.argv[1] ?? "").endsWith("backfill-transaction-budgets.ts")) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
