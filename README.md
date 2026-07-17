# Grok Voice — Alexa Skill (Freemium + ISP)

Production-oriented **Alexa custom skill** that answers questions with the **xAI Grok API**, monetized via **In-Skill Purchasing** (subscription + consumable boost packs).

| Item | Value |
|------|--------|
| Skill name | Grok Voice |
| Invocation | `grok voice` → *“Alexa, open Grok Voice”* |
| Runtime | Node.js 20, ASK SDK v2 |
| Backend | AWS Lambda |
| Persistence | DynamoDB (`GrokVoiceUsers`) |
| AI | `https://api.x.ai/v1/chat/completions` |

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Alexa device│────▶│ Lambda (ASK SDK) │────▶│ xAI Grok API    │
└─────────────┘     │  - rate limits   │     │ free / premium  │
                    │  - ISP checks    │     │ models          │
                    │  - upsells       │     └─────────────────┘
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │ DynamoDB users   │
                    │ quota, boosts,   │
                    │ history, metrics │
                    └──────────────────┘
                             │
                    ┌────────▼─────────┐
                    │ Alexa Monetization│
                    │ API (entitlements)│
                    └──────────────────┘
```

### Tier model

| Tier | Queries | Model (default) | Memory | Notes |
|------|---------|-----------------|--------|--------|
| **Free** | 15/day (UTC) | `grok-4.3` | Session only | Soft upsells; hard limit → Premium upsell |
| **Boost** | +25 per pack | Free model | Session only | Consumable; used after free daily is exhausted |
| **Premium** | Unlimited | `grok-4.5` | Persisted turns | Subscription via ISP |

Models are env-configurable (`GROK_FREE_MODEL`, `GROK_PREMIUM_MODEL`). Confirm current IDs at [docs.x.ai/developers/models](https://docs.x.ai/developers/models).

---

## Project layout

```
alexa-grok-voice/
├── README.md
├── ask-resources.json          # ASK CLI profile
├── .env.example
├── skill-package/
│   ├── skill.json
│   ├── interactionModels/custom/en-US.json
│   └── isps/
│       ├── grok_premium_subscription.json
│       └── query_boost_pack.json
├── lambda/
│   ├── index.js                # Skill entry
│   ├── config.js
│   ├── constants.js
│   ├── package.json
│   ├── handlers/               # Launch, Ask, ISP, built-ins
│   ├── interceptors/           # User load + logging
│   ├── services/               # Grok, DynamoDB, entitlements, analytics
│   └── utils/
└── infrastructure/
    ├── create-table.ps1 | .sh
    ├── dynamodb-table.json
    └── lambda-iam-policy.json
```

---

## Prerequisites

1. [Amazon Developer account](https://developer.amazon.com/)
2. AWS account (Lambda + DynamoDB in **us-east-1** recommended for Alexa)
3. [xAI API key](https://console.x.ai) with credits (`XAI_API_KEY`)
4. Node.js 18+ and npm
5. Optional: [ASK CLI](https://developer.amazon.com/en-US/docs/alexa/smapi/ask-cli-command-reference.html) `npm i -g ask-cli`

---

## Quick start

### 1. Create DynamoDB table

```powershell
cd infrastructure
.\create-table.ps1 -Region us-east-1
```

### 2. Install Lambda dependencies

```powershell
cd ..\lambda
npm install
```

### 3. Create Lambda function

1. AWS Console → Lambda → **Create function**  
   - Runtime: **Node.js 20.x**  
   - Name: `alexa-grok-voice`  
   - Region: **us-east-1**
2. Zip and upload the `lambda` folder (including `node_modules`):

```powershell
# From lambda/
npm ci --omit=dev
Compress-Archive -Path * -DestinationPath ..\grok-voice-lambda.zip -Force
```

3. Handler: `index.handler`  
4. Timeout: **10 seconds** (Alexa ~8s voice budget; Grok call capped at 7s)  
5. Memory: **256 MB** (512 MB if cold starts are slow)  
6. Environment variables (see `.env.example`):

| Variable | Example |
|----------|---------|
| `XAI_API_KEY` | `xai-...` |
| `DYNAMODB_TABLE_NAME` | `GrokVoiceUsers` |
| `GROK_FREE_MODEL` | `grok-4.3` |
| `GROK_PREMIUM_MODEL` | `grok-4.5` |
| `FREE_DAILY_LIMIT` | `15` |
| `BOOST_PACK_QUERIES` | `25` |

7. Attach IAM policy from `infrastructure/lambda-iam-policy.json` (replace `ACCOUNT_ID`).
8. **Configuration → Permissions**: allow Alexa Skills Kit trigger; add skill ID after skill creation.

### 4. Create the skill (Developer Console)

1. [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask) → **Create Skill**
2. Name: **Grok Voice**  
3. Model: **Custom**  
4. Hosting: **Provision your own** (custom Lambda)
5. Template: **Start from scratch**
6. **Invocation**: `grok voice`
7. **JSON Editor**: paste `skill-package/interactionModels/custom/en-US.json` contents (or merge intents)
8. **Build Model**
9. **Endpoint**: HTTPS → AWS Lambda ARN of your function; copy Skill ID into Lambda resource policy

### 5. Create ISP products

Console path: Skill → **In-Skill Products** → **Create new product**

#### A) Premium subscription

| Field | Value |
|-------|--------|
| Reference name | `grok_premium_subscription` |
| Type | **Subscription** |
| Display name | Grok Voice Premium |
| Billing | Monthly (e.g. **$4.99**) |
| Description | Unlimited questions, better model, memory |

#### B) Query boost consumable

| Field | Value |
|-------|--------|
| Reference name | `query_boost_pack` |
| Type | **Consumable** |
| Display name | Query Boost Pack |
| Price | e.g. **$0.99** |
| Description | +25 questions (must match `BOOST_PACK_QUERIES`) |

Link both products to the skill. Reference names **must** match `config.productRefs` / env:

- `ISP_PREMIUM_REF=grok_premium_subscription`
- `ISP_BOOST_REF=query_boost_pack`

Sample JSON lives under `skill-package/isps/` (console is source of truth for live prices).

### 6. Privacy & compliance

In skill **Privacy & Compliance**:

- **Allows purchases**: Yes  
- Provide real **privacy policy** and **terms** URLs (required for ISP certification)  
- Disclose that queries are sent to xAI  

Replace placeholder URLs in `skill.json` and ISP JSON before certification.

### 7. Test

| Scenario | How |
|----------|-----|
| Happy path | *Open Grok Voice* → *what is gravity* |
| Quota | Set `FREE_DAILY_LIMIT=2`, ask 3 times → upsell |
| Soft upsell | Ask several times; occasional Premium CTA |
| Buy Premium | *upgrade* or *buy premium* (ISP sandbox) |
| Boost | *buy query boost* after limit |
| Inventory | *how many questions do I have left* |
| Status | *what is my status* |
| Cancel | *cancel my subscription for premium* |

**ISP testing:** Use Amazon’s ISP test guide and development accounts; reset entitlements with ASK CLI `reset-isp-entitlement` when iterating.

Device test: enable skill under your developer account → *Alexa, open Grok Voice*.

---

## Voice UX & revenue flows

1. **Free use** — engaging answers, short token budget.  
2. **Soft upsell** — after N free questions, probabilistic verbal CTA (*“Want to hear about Premium?”*). *Yes* → Buy directive.  
3. **Hard limit** — formal **Upsell** directive for Premium (Alexa handles purchase UX).  
4. **Boost alternative** — cheaper impulse purchase for light users.  
5. **Premium** — unlimited + `grok-4.5` + DynamoDB conversation history.

Never upsell every turn. Defaults: soft upsell after 5 queries, ~35% chance.

---

## Analytics (CloudWatch)

Structured JSON logs:

```text
{ "type":"analytics", "event":"query", "isPremium":false, "tokensIn":120, "tokensOut":80, ... }
{ "type":"analytics", "event":"upsell_offered", "reason":"daily_limit", ... }
{ "type":"analytics", "event":"purchase_result", "purchaseResult":"ACCEPTED", ... }
```

Suggested CloudWatch Logs Insights queries:

```sql
fields @timestamp, event, isPremium, tokensIn, tokensOut, latencyMs
| filter type = "analytics" and event = "query"
| stats count() as queries, sum(tokensIn) as tin, sum(tokensOut) as tout by isPremium
```

```sql
fields @timestamp, reason, productRef
| filter event = "upsell_offered"
| stats count() by reason
```

```sql
fields @timestamp, purchaseResult, name
| filter event = "purchase_result"
| stats count() by purchaseResult
```

User IDs are hashed in analytics (`userIdHash`) to reduce PII in logs.

---

## Cost optimization

| Lever | Guidance |
|-------|----------|
| Free model | Keep free on cheaper SKU (`grok-4.3` or current fast/cheap alias) |
| `FREE_MAX_TOKENS` | Default 280 — voice doesn’t need long essays |
| System prompt | Forces brevity on free tier |
| Daily cap | 15/day limits worst-case free abuse |
| History | Free: session-only, short; Premium: capped turns (`MAX_HISTORY_TURNS`) |
| Timeout | Abort Grok at 7s to fail gracefully under Alexa limits |
| DynamoDB | On-demand billing; one Get+Update per turn |
| Monitor | Alert when free token spend ≫ ISP revenue |

**Rough free-unit economics (illustrative):**  
If free answers average ~400 tokens total at ~$1–3 / 1M tokens, cost per free answer is fractions of a cent. Set daily limit and Premium price so conversion + boost packs cover free pool + margin.

**Scaling:** Lambda concurrency scales with traffic; pin reserved concurrency if you want spend caps. Consider a free-tier circuit breaker (disable free globally) via env if xAI spend spikes.

---

## Security

- **Never** commit `XAI_API_KEY`. Use Lambda env vars or AWS Secrets Manager (inject at runtime).
- Least-privilege IAM (see `lambda-iam-policy.json`).
- Skill endpoint locked to your Skill ID in Lambda resource-based policy.
- No child-directed content; set compliance flags correctly.
- Conversation history only for entitled Premium users; cleared on cancel when possible.

---

## ASK CLI deploy (optional)

```bash
ask configure
# Set XAI_API_KEY in Lambda after first deploy (do not put secrets in ask-resources.json git)
ask deploy
```

After deploy, create/link ISP products and set secrets in AWS.

---

## Certification checklist

- [ ] Privacy policy + terms live HTTPS URLs  
- [ ] ISP products linked and purchasable in test  
- [ ] Upsell / buy / cancel / inventory paths work  
- [ ] Free limit messaging is clear and non-deceptive  
- [ ] No claim that this replaces Alexa system AI globally  
- [ ] Testing instructions document sandbox steps  
- [ ] Icons 108 / 512 for skill and products  
- [ ] Example phrases match invocation name  

Amazon revenue share applies to ISP; review current [Alexa developer revenue policies](https://developer.amazon.com/en-US/alexa).

---

## Local module smoke test

```powershell
cd lambda
node -e "const s=require('./utils/speech'); console.log(s.truncateSpeech('Hello **world**. https://x.ai more text'));"
```

---

## Configuration reference

| Env | Default | Purpose |
|-----|---------|---------|
| `XAI_API_KEY` | — | **Required** |
| `XAI_BASE_URL` | `https://api.x.ai/v1` | API host |
| `GROK_FREE_MODEL` | `grok-4.3` | Free tier model |
| `GROK_PREMIUM_MODEL` | `grok-4.5` | Premium model |
| `FREE_DAILY_LIMIT` | `15` | Free queries / UTC day |
| `BOOST_PACK_QUERIES` | `25` | Queries per consumable |
| `SOFT_UPSELL_AFTER` | `5` | Min free uses before soft CTA |
| `SOFT_UPSELL_PROBABILITY` | `0.35` | Soft CTA chance |
| `FREE_MAX_TOKENS` | `280` | Free completion cap |
| `PREMIUM_MAX_TOKENS` | `500` | Premium completion cap |
| `XAI_TIMEOUT_MS` | `7000` | HTTP timeout |
| `DYNAMODB_TABLE_NAME` | `GrokVoiceUsers` | User table |
| `ISP_PREMIUM_REF` | `grok_premium_subscription` | ISP referenceName |
| `ISP_BOOST_REF` | `query_boost_pack` | ISP referenceName |

---

## Known limitations

1. Users must **open the skill** — this does not replace Alexa’s default assistant.  
2. Alexa NLU + `AMAZON.SearchQuery` works best with carrier phrases (“ask …”, “what is …”).  
3. ISP product JSON schemas can differ slightly by console version — create products in console if CLI import fails.  
4. Multi-locale requires extra interaction models + ISP locale entries.  
5. Image analysis / live web search can be added later via xAI tools for Premium only (cost control).

---

## Next extensions (optional)

- Premium-only web search tool calling  
- Skill events for disable/enable cleanup  
- Secrets Manager rotation for `XAI_API_KEY`  
- Multi-language locales  
- Admin dashboard on analytics events  

---

## License

MIT — you are responsible for Alexa certification, xAI usage terms, pricing, and tax compliance.
