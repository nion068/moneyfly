# Money Agent Implementation Plan

## Goal

Replace the placeholder AI Assistant with **Money Agent**, a persistent conversational interface
that can understand finance requests, propose Firefly III transactions, and execute a transaction
only after explicit user confirmation.

The first provider will be Gemini. The domain and UI must not depend on Gemini so OpenAI,
OpenAI-compatible servers, or local models can be added without changing chat or transaction
logic.

## Product Rules

1. Every user message goes to the configured AI provider. There is no regex or keyword parser.
2. AI output is always treated as untrusted input.
3. Every transaction-like message produces a best-effort draft on the first turn. The model should
   select the most probable compatible account, category, budget, tags, date, currency, and
   transaction type from the supplied context.
4. The model must not invent Firefly entities or numeric amounts. Values with no defensible match
   remain missing and editable, while the rest of the draft is still shown immediately.
5. No transaction is sent to Firefly until the user presses **Confirm**.
6. A draft remains in its original chat position until it is confirmed or discarded.
7. Confirmed, discarded, and failed cards remain in chat with their final status.
8. Clearing chat is explicit and must warn when unresolved drafts exist.

## Recommended Architecture

### 1. Provider-Neutral AI Layer

Create `app/services/ai/` with these boundaries:

```text
app/services/ai/
  types.ts
  provider.ts
  registry.ts
  prompts/
    moneyAgentPrompt.ts
  providers/
    gemini/
      GeminiProvider.ts
      GeminiTransport.ts
      GeminiMapper.ts
```

Core contract:

```ts
type AiProviderId = "gemini" | "openai" | "openai-compatible" | "local"

interface AiProvider {
  id: AiProviderId
  testConnection(config: AiProviderRuntimeConfig): Promise<AiResult<ProviderInfo>>
  send(request: MoneyAgentRequest): Promise<AiResult<MoneyAgentResponse>>
}
```

`MoneyAgentRequest` contains canonical messages, current time zone/date, a compact Firefly context
snapshot, and supported action schemas. `MoneyAgentResponse` contains normalized assistant text and
zero or more typed proposals. Provider-specific request and response shapes do not leave the
provider adapter.

Do not make the rest of the app import a Gemini SDK or Gemini response type.

### 2. Typed Action Protocol

Use a small canonical action set:

- `propose_transactions`: one or more transaction drafts
- `request_clarification`: missing or ambiguous fields with a user-facing question
- `answer`: a normal assistant response with no side effect

The first milestone should not let the model call Firefly directly. Function calling or structured
output is only a transport mechanism for producing proposals. The app owns confirmation and
execution.

Draft fields should use Firefly IDs where possible:

```ts
type MoneyAgentTransactionDraft = {
  id: string
  type: "withdrawal" | "deposit" | "transfer"
  amount: string
  currencyCode: string
  date: string
  description: string
  sourceAccountId: string | null
  destinationAccountId: string | null
  categoryId: string | null
  budgetId: string | null
  tagIds: string[]
  notes: string | null
  missingFields: DraftField[]
  status: "proposed" | "confirming" | "confirmed" | "discarded" | "failed"
  fireflyTransactionId?: string
  errorMessage?: string
}
```

IDs prevent the current prototype bug where invented names can create or target the wrong Firefly
entities. Display names can be derived from the cached entity registry.

The existing `TransactionDraft` and `draftToStoreRequest` are too narrow and withdrawal-specific.
Replace them with a type-aware mapper that uses IDs and handles withdrawals, deposits, and
transfers separately.

### 3. Firefly Context Cache

Add a dedicated `MoneyAgentContextRepository`, persisted with MMKV, separate from chat state.

Cache:

- active accounts: ID, exact name, type, role, currency
- categories: ID and exact name
- budgets: ID and exact name
- tags: ID and exact value
- supported currencies observed in accounts
- `syncedAt`, Firefly server identity, and a schema version

Update the snapshot after each successful Firefly refresh. Keep the last good snapshot if a later
refresh fails. Clear it on Firefly disconnect or when the base URL changes.

Do not send balances, tokens, the server URL, or full transaction history on every prompt. For the
transaction-drafting milestone, the compact entity registry is enough. Later analytics questions
should use explicit read-only tools such as `get_transactions_for_range` so only requested data is
sent.

Context rules:

- Prefer current in-memory Firefly data.
- Fall back to the persisted snapshot when offline or during startup.
- Include `syncedAt` in the AI request so the model can disclose stale context.
- Resolve AI-returned IDs against the snapshot. Reject unknown IDs.
- Never fuzzy-match or substitute an ID after the model response.

### 4. Chat and Draft Persistence

Add `MoneyAgentProvider` or a focused repository/hook outside `FireflyContext`. Firefly connection
state and chat state have different lifecycles and should not be combined.

Persist:

```ts
type MoneyAgentConversation = {
  id: string
  messages: MoneyAgentMessage[]
  createdAt: string
  updatedAt: string
  promptVersion: number
}

type MoneyAgentMessage =
  | UserTextMessage
  | AssistantTextMessage
  | DraftCardMessage
  | SystemStatusMessage
```

Required behavior:

- Restore the conversation after app restart.
- Append the user message before starting the request.
- Show an in-place pending assistant message while waiting.
- Retry a failed turn without duplicating the user message.
- Edit a draft locally through the same account/category selectors used by manual entry.
- Confirm one draft at a time.
- On success, update the card to `confirmed` and refresh Firefly data.
- On failure, retain the draft as `failed` with retry available.
- Discard changes only that card's status.
- Clear chat removes resolved history.
- If unresolved drafts exist, offer **Cancel**, **Discard drafts and clear**, or **Keep drafts**.

For the first release, keep one active conversation. Multiple conversation history can be added
later without changing message storage.

### 5. Provider Settings and Credential Storage

Replace the current “Gemini coming later” row with:

- Provider selector
- Model text/select field
- API key field for providers that require it
- Optional base URL for OpenAI-compatible/local providers
- **Test connection**
- **Save**
- **Remove credentials**
- Connection status and last successful test

Store non-secret provider settings in MMKV. Do not store provider API keys in the current plain MMKV
instance. Add `expo-secure-store` for native key storage.

Security decision:

- Development/BYOK mode may call Gemini directly with the user's own key.
- Production with an app-owned Gemini key should use a backend proxy or Firebase AI Logic with App
  Check. A long-lived Gemini key embedded in a mobile or web client can be extracted.
- On web, either require a proxy or clearly disable persistent direct-key storage.

The selected model must be configuration, not a constant in `GeminiProvider`.

### 6. Gemini Implementation

Use Gemini structured output or function calling with an explicit schema. Do not rely on
“JSON-only” prompt wording and then parse arbitrary text.

The system instruction should contain:

- Money Agent role and allowed actions
- exact current date, time, and IANA time zone
- Firefly transaction semantics
- explicit rule that only supplied entity IDs are valid
- explicit rule to return clarification instead of inventing entities
- explicit no-write-without-confirmation behavior
- compact account/category/budget/tag registry
- output/action schema descriptions

Keep the prompt in a versioned pure function and test the generated prompt. Avoid hardcoded years,
default cash accounts, default expense/revenue accounts, and hidden fallback behavior from the
prototype.

Recommended request behavior:

- low temperature for transaction extraction
- request timeout and abort support
- normalized provider errors: auth, quota, timeout, network, safety refusal, invalid response
- one retry only for transient transport errors
- no retry for authentication, schema validation, or quota errors
- log request IDs and timing, never prompts, finance context, or API keys

### 7. Money Agent Screen

Use the supplied chat mock as the visual direction while preserving the existing Moneyfly theme.

Header:

- “Money Agent”
- provider status
- clear chat action
- overflow action for AI settings

Conversation:

- initial assistant capability message
- user and assistant message bubbles
- persistent transaction draft cards
- card states for incomplete, ready, confirming, confirmed, discarded, and failed
- quick prompts such as **Log a meal**, **Add transport**, and **Shopping item**

Composer:

- multiline input
- send button
- disabled state while empty
- keyboard-safe bottom placement
- sending indicator

Draft card:

- type, amount, currency, description
- source and destination accounts
- category, budget, tags, date, and notes when present
- missing-field warning instead of a fake confidence score
- **Edit**, **Confirm**, and **Discard**

Do not display model-generated confidence percentages. They are not calibrated and can imply a
level of safety the system does not have.

## Delivery Phases

### Phase 1: Domain and Storage

- Add provider-neutral AI types and result/error types.
- Add secure secret storage.
- Add provider settings repository.
- Add context snapshot builder and MMKV persistence.
- Replace the current transaction draft model with the canonical typed draft.
- Add type-aware draft-to-Firefly validation and request mapping.

Exit criteria: domain tests pass without any network or UI dependency.

### Phase 2: Gemini Adapter

- Implement Gemini transport.
- Implement structured action schema.
- Implement versioned Money Agent prompt.
- Add connection testing and normalized errors.
- Add fixture-based tests for valid, malformed, ambiguous, and multi-transaction responses.

Exit criteria: Gemini can return validated proposals, but cannot write to Firefly.

### Phase 3: Conversation Engine

- Add persistent message repository and state provider.
- Implement send, retry, edit, discard, confirm, and clear flows.
- Wire confirmation to `createTransaction`.
- Refresh Firefly and update card status after a successful write.

Exit criteria: drafts survive navigation and restart until acted on.

### Phase 4: Screen and Settings UI

- Build the Money Agent chat screen.
- Build editable draft cards using existing selection components.
- Add provider settings and test-connection controls.
- Rename navigation labels and screen copy from AI Assistant to Money Agent.

Exit criteria: the complete typed transaction flow works on Android, iOS, and web, with web
credential restrictions enforced.

### Phase 5: Read-Only Finance Tools

- Add explicit read-only tools for summaries and transaction lookup.
- Fetch only the requested date range from Firefly.
- Return tool results to the model for a final conversational answer.
- Keep write tools proposal-only and user-confirmed.

Exit criteria: requests such as “show today’s summary” work without putting full history into every
prompt.

### Phase 6: Additional Providers

- Add OpenAI adapter.
- Add OpenAI-compatible adapter with configurable base URL and model.
- Test against at least one local server such as Ollama or LM Studio.
- Add provider capability flags for structured output, tools, streaming, and context limits.

Exit criteria: changing providers requires settings changes only, not UI or domain changes.

## Test Plan

Unit tests:

- context snapshot creation, persistence, migration, and server isolation
- provider registry and configuration validation
- prompt includes exact date/time zone and current entity IDs
- response schema parsing and unknown-ID rejection
- withdrawal, deposit, and transfer request mapping
- missing-field validation
- chat reducer/repository state transitions
- clear-chat behavior with unresolved drafts
- credential removal and disconnect cleanup

Integration tests:

- Gemini success, empty response, malformed response, refusal, timeout, auth failure, and quota error
- multi-transaction proposal
- clarification turn followed by a completed proposal
- confirmation success and Firefly failure/retry
- app restart with pending drafts
- context refresh while a conversation is active

Screen tests:

- empty, loading, conversation, and error states
- send and retry
- edit, confirm, discard
- clear chat warning
- provider-not-configured route to settings
- keyboard and long-message behavior

Verification commands:

```sh
pnpm run compile
pnpm run lint:check
pnpm test
```

## Decisions to Lock Before Coding

1. Use direct Gemini BYOK only for development/personal use; use a proxy/Firebase AI Logic for an
   app-owned production key.
2. Use IDs in AI proposals and reject unknown IDs.
3. Keep one persistent conversation for the first release.
4. Retain resolved cards until chat is cleared.
5. Do not use AI-generated confidence percentages.
6. Do not include SMS automation in the first Money Agent milestone.

## Prototype Code to Reuse or Reject

Reuse conceptually:

- passing known accounts and categories to the model
- supporting multiple transaction drafts
- persisting pending drafts
- explicit review before submit

Reject:

- `parseHeuristically`
- invented “Cash wallet”, “Expense Account”, or “Revenue Account” values
- hardcoded model and year
- arbitrary JSON extraction without a schema
- direct draft submission based on names
- amount/date-only duplicate detection
- clearing input or drafts before a durable message/action state exists
