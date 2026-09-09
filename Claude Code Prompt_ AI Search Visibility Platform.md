# Claude Code Prompt: AI Search Visibility Platform

You are an expert full-stack engineer. Build a complete, production-quality AI SaaS application from scratch. This is an **AI Search Visibility Platform** called **Luminaire** that tracks how brands appear inside LLM responses (ChatGPT, Claude, Gemini, Perplexity, and Google AI Overviews).

---

## 🔐 API KEYS & ENV VARIABLES

Create a `.env.local` file with these placeholders. All API calls MUST be server-side only — never expose keys to the frontend.

```
OPENAI_API_KEY=<your-openai-key>
ANTHROPIC_API_KEY=<your-anthropic-key>
GEMINI_API_KEY=<your-gemini-key>
PERPLEXITY_API_KEY=<your-perplexity-key>
DATAFORSEO_LOGIN=<your-dataforseo-login>
DATAFORSEO_PASSWORD=<your-dataforseo-password>
SUPABASE_URL=<your-supabase-project-url>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
```

---

## 🧱 TECH STACK (Mandatory)

- **Next.js 16+** (App Router, `src/` directory)  
- **TypeScript** (strict mode)  
- **Tailwind CSS v4** (via `@tailwindcss/postcss`)  
- **Recharts** for all charts  
- **Supabase** (PostgreSQL via REST API, service\_role key)  
- **lucide-react** for icons  
- **clsx \+ tailwind-merge** for class composition  
- No additional UI framework — build all components from scratch

---

## 🎨 DESIGN SYSTEM — Dark Theme (Critical)

The UI must feel like a top-tier SaaS product (Linear, Vercel, Stripe quality). Dark theme with a **teal-green accent**. NOT purple. Minimal, clean, subtle.

### Color Tokens (CSS custom properties via `@theme` in globals.css):

```
--color-background: #0a0a0c
--color-foreground: #ececef
--color-card: #111114
--color-card-foreground: #ececef
--color-primary: #2eb88a          (teal-green — used for accent, active states, brand highlight)
--color-primary-foreground: #ffffff
--color-secondary: #161619
--color-muted: #161619
--color-muted-foreground: #8b8b92
--color-destructive: #e5484d
--color-border: #1e1e22
--color-input: #1e1e22
--color-ring: #2eb88a
--color-success: #30a46c
--color-warning: #f5a623
```

### Typography:

- Font: `"Inter", -apple-system, system-ui, sans-serif`  
- Enable `-webkit-font-smoothing: antialiased`  
- Use text sizes: `text-[10px]` for labels, `text-[11px]` for secondary, `text-[12px]` for table data, `text-[13px]` for body, `text-xl` for headings  
- Use `font-semibold` for headings, `tabular-nums` for numbers

### Spacing & Styling:

- Cards: `rounded-lg border border-border/40 bg-card/60 p-5`  
- Tables: No outer padding on card, table inside with `text-[13px]`, header rows `text-[10px] uppercase tracking-wider text-muted-foreground/40`  
- Row hover: `hover:bg-white/[0.015]`  
- Borders: `border-border/30` for subtle, `border-border/60` for visible  
- Interactive elements: use `bg-white/[0.04]` for hover, `bg-white/[0.06]` for active  
- Scrollbar: 5px width, \#2a2a2f thumb, transparent track  
- NO noise texture overlays. NO animations except subtle transition on hover.

### Chart Colors (consistent across all charts):

```
Brand (primary): #2eb88a (teal-green, 2px stroke, full opacity)
Competitor 1: #e5484d (red, 1.5px stroke, 0.6 opacity)
Competitor 2: #3b82f6 (blue)
Competitor 3: #f5a623 (amber)
Competitor 4: #8b5cf6 (purple)
Competitor 5: #ec4899 (pink)
Competitor 6: #06b6d4 (cyan)
```

### Domain Type Colors:

```
Corporate: #f5a623 (amber)
UGC: #3b82f6 (blue)
You: #2eb88a (teal-green)
Competitor: #e5484d (red)
Reference: #8b5cf6 (purple)
Other: #525259 (gray)
Editorial: #6366f1 (indigo)
Institutional: #14b8a6 (teal)
```

### LLM Model Colors:

```
ChatGPT/OpenAI: #10a37f (green)
Claude: #d97640 (orange)
Gemini: #4285f4 (blue)
Perplexity: #20b2aa (teal)
Google AI Overview: #ea4335 (red)
```

---

## 🗄️ DATABASE SCHEMA (Supabase PostgreSQL)

Create these 5 tables. Provide a `sql/schema.sql` file and a `/setup` page that shows table status and the SQL to paste into Supabase SQL Editor.

```sql
CREATE TABLE brands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  category TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE competitors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL,
  topic TEXT DEFAULT 'General',
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN DEFAULT true,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  response TEXT,
  mentioned BOOLEAN DEFAULT false,
  position_score REAL,
  sentiment TEXT DEFAULT 'neutral',
  competitor_mentions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE citations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  url TEXT,
  domain_type TEXT DEFAULT 'Other',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Add indexes on: `runs(prompt_id)`, `runs(created_at)`, `citations(run_id)`, `citations(domain)`, `prompts(brand_id)`, `competitors(brand_id)`.

---

## 📐 APP ARCHITECTURE

### Directory Structure:

```
src/
├── app/
│   ├── globals.css          # Theme tokens + scrollbar + typography
│   ├── layout.tsx           # Root layout, dark class, metadata
│   ├── page.tsx             # Entry: checks DB → onboarding or dashboard
│   ├── setup/page.tsx       # DB setup wizard
│   └── api/
│       ├── brand/           # GET primary brand
│       ├── setup-db/        # GET/POST verify tables exist
│       ├── overview/        # GET dashboard data (params: days, model)
│       ├── sources/         # GET citation data (params: days, model, view)
│       ├── prompts/         # CRUD prompts
│       ├── prompts/metrics/ # GET per-prompt metrics (params: days, model)
│       ├── prompts/run/     # POST execute prompts across models
│       ├── prompts/[id]/    # GET prompt detail with per-model breakdown
│       └── onboarding/
│           ├── crawl/       # POST website URL → crawl + extract
│           ├── generate-prompts/    # POST → 5 commercial-intent prompts
│           ├── generate-competitors/ # POST → 4-5 competitors
│           └── complete/    # POST → save brand + competitors + prompts
├── components/
│   ├── ui/                  # Button, Card, Input, Badge, Tabs, Spinner, MetricCard, ModelIcon
│   ├── charts/              # VisibilityChart, SourceChart
│   ├── dashboard/           # All dashboard components (see below)
│   └── onboarding/          # OnboardingFlow
├── lib/
│   ├── utils.ts             # cn(), formatPercent, extractDomain
│   ├── supabase.ts          # Client init
│   ├── supabase-admin.ts    # All DB CRUD operations
│   ├── metrics.ts           # All analytics calculations
│   ├── scraper.ts           # Website crawler
│   ├── generators.ts        # Prompt + competitor generation (uses Gemini)
│   └── llm/
│       ├── orchestrator.ts  # Runs prompts across all 5 models
│       ├── parser.ts        # Response analysis (mentions, position, sentiment, citations)
│       ├── openai.ts        # gpt-4o-mini integration
│       ├── claude.ts        # claude-sonnet-4-20250514 integration
│       ├── gemini.ts        # gemini-2.5-flash integration
│       ├── perplexity.ts    # sonar model integration
│       └── google-aio.ts    # DataForSEO AI Overview extraction
└── types/index.ts           # All TypeScript interfaces
```

---

## 🚀 ONBOARDING FLOW

When no brand exists in the database, show a 3-step onboarding wizard:

### Step 1: URL Input

- Centered card with globe icon  
- Input field: "[https://yourproduct.com](https://yourproduct.com)"  
- Arrow button to submit  
- Progress indicator: 3 steps (Website → Analyzing → Review & Launch)

### Step 2: Analyzing (loading state)

- Spinner \+ "Analyzing {domain}" message  
- Auto-triggers: crawl website → generate prompts \+ competitors in parallel

### Step 3: Review & Launch

Three cards stacked:

1. **Product Summary** — extracted title, description, category, audience (from crawl)  
2. **Generated Prompts** — 5 editable prompts, click to inline edit, X to remove  
3. **Competitors** — 4-5 competitors with name \+ domain, editable, removable

Bottom: "Start Over" (outline) \+ "Launch Tracking" (primary, with Zap icon)

### Website Crawling Logic:

- Fetch: homepage, /pricing, /features, /about, /integrations, /use-cases, /product  
- Strip HTML (scripts, styles, nav, footer, tags)  
- Use **Gemini 2.5 Flash** (with `responseMimeType: "application/json"`) to extract structured data:  
  - title, description, category, targetAudience, coreUseCase, features\[\], integrations\[\], pricingInfo, competitorHints\[\]

### Prompt Generation (Gemini):

- Generate 5 **commercial-intent, long-tail, buyer-focused** prompts  
- Must be queries a buyer would type into ChatGPT/Claude/Perplexity  
- Examples: "best influencer marketing tools for ecommerce", "top alternatives to \[competitor\]"

### Competitor Generation (Gemini):

- Return 4-5 direct competitors with name \+ domain  
- Based on category, positioning, and any hints from the website

---

## 🔁 LLM ORCHESTRATOR

For each prompt, run across 5 models **sequentially** (not parallel to avoid rate limits):

### Model Integrations:

1. **OpenAI** — `gpt-4o-mini`, max\_tokens 2000, temp 0.3. Handle 429/quota errors gracefully (return empty).  
2. **Claude** — `claude-sonnet-4-20250514`, max\_tokens 2000\. Extract text blocks from response.  
3. **Gemini** — `gemini-2.5-flash`, max\_tokens 2000, temp 0.3. Direct REST API call.  
4. **Perplexity** — model `"sonar"`, max\_tokens 2000, temp 0.3. Extract native `citations` array from response.  
5. **Google AI Overview** — DataForSEO SERP API (`/v3/serp/google/organic/live/advanced`). Extract only `ai_overview` type items. Fallback to `featured_snippet`. Extract text \+ reference URLs.

### Response Parsing (for each model response):

1. **Brand Mention Detection** — case-insensitive search for brand name or domain in response text  
2. **Position Score** (1-5 scale) — detect position by: (a) relative text position (early \= better), (b) numbered list detection (e.g., "1." → position 1 → score 1, "5." → score 3\)  
3. **Sentiment** — heuristic: count positive words (best, top, leading, recommended, etc.) vs negative words (worst, poor, limited, expensive, etc.) in sentences containing brand name. Return positive/neutral/negative.  
4. **Competitor Mentions** — check each competitor name/domain in response text. Store as `{ "CompName": true/false }` JSONB.  
5. **Citation Extraction** — regex extract all URLs from response text. Combine with API-provided citations (Perplexity, DataForSEO).  
6. **Domain Classification** — classify each cited domain:  
   - Match brand domain → "You"  
   - Match competitor domain → "Competitor"  
   - Known UGC domains (reddit, youtube, quora, medium, twitter, tiktok) → "UGC"  
   - Known editorial (techcrunch, wired, forbes, bloomberg) → "Editorial"  
   - Known reference (wikipedia, MDN) → "Reference"  
   - Review sites (g2, capterra, trustpilot) → "UGC"  
   - .edu/.gov/.org → "Institutional"  
   - Everything else → "Corporate"

### Storage:

- Create a `run` record for each model response  
- Create `citation` records for each extracted URL

---

## 🧮 METRICS CALCULATIONS

All metrics functions accept optional `model` filter parameter. When model is provided, filter runs to only that model.

### Visibility

```
visibility = mentionedRuns / totalRuns
```

### Share of Voice (SOV)

```
sov = brandMentions / (brandMentions + allCompetitorMentions)
```

### Position

```
avgPosition = sum(position_scores) / count(position_scores)
```

Where position\_score is 1-5 scale (1 \= best).

### Sentiment

Map to numeric: positive=80, neutral=55, negative=30. Average across runs.

### Visibility Change

Compare current period vs previous period of same length.

### Visibility Trend

Group runs by **week** (Sunday start). For each week, calculate visibility % for brand and each competitor.

### Domain Sources

For each domain in citations:

- `retrievalRate` \= citations\_for\_domain / total\_runs \* 100  
- `citationRate` \= citations\_for\_domain / total\_citations

### URL Sources

Same as domain sources but grouped by full URL instead of domain.

---

## 📊 DASHBOARD — 3 TABS

The app shell has a fixed sidebar (200px, bg `#0d0d10`) on the left and a header bar at the top. Content scrolls within the main area (max-width 1400px, centered, p-8).

### Sidebar:

- Logo: "Luminaire" with a teal Layers icon in rounded-md container  
- Nav items: Overview (LayoutDashboard), Prompts (MessageSquareText), Sources (Globe)  
- Active state: `bg-white/[0.06] text-foreground` with teal icon  
- Inactive: `text-muted-foreground hover:bg-white/[0.03]`  
- Bottom: "Run All Prompts" button (full-width, primary, Play icon)

### Header Bar:

- Left side: Brand name with pulsing green dot \+ **Date Range Dropdown** (7d/30d/90d/365d) \+ **Model Filter Dropdown** (All Models, ChatGPT, Claude, Gemini, Perplexity, AI Overview — each with color dot)  
- Right side: Last updated timestamp \+ Model status pills (colored text on colored bg at 12% opacity)  
- Dropdowns: absolute positioned, bg `#161619`, border-border/60, shadow-xl, rounded-lg

Both filter dropdowns must update ALL data across ALL tabs (Overview, Prompts, Sources). Pass `days` and `model` as query params to all API routes.

When a model is selected, the model pills on the right should dim (opacity-30) all non-selected models.

---

### TAB 1: OVERVIEW

Layout: **Metrics (280px column) \+ Visibility Chart (flex)** side by side at the top. This puts the chart above the fold.

#### A. Metric Cards (stacked vertically on left):

4 cards in a column:

1. **Visibility** — percentage, with change indicator (↑green or ↓red) and "vs prior" label  
2. **Mentioned In** — "X / Y" format (mentioned / total runs)  
3. **Avg Sentiment** — numeric score  
4. **Avg Position** — "\#X.X" format

Each card: `text-[11px]` uppercase tracking-widest label, `text-[28px]` bold value, muted icon top-right.

#### B. Visibility Trend Chart (right):

- Recharts `LineChart` with `monotone` lines  
- X-axis: date (Mon DD format), Y-axis: percentage  
- Grid: dashed, stroke `#1e1e22`  
- **Custom tooltip** showing: date header, then each brand sorted by value descending, with color dot \+ brand name \+ colored percentage value  
- Legend bar at bottom below chart border  
- Brand line: 2px stroke, full opacity. Competitor lines: 1.5px, 0.6 opacity.

#### C. Rankings Table:

Columns: \#, Brand, Visibility (with progress bar), SOV, Sentiment (color dot \+ number), Position

- Your brand row: `bg-primary/[0.03]`, name in teal, position in teal, initial avatar in teal bg  
- Other brands: gray avatar, neutral colors  
- Visibility column: thin progress bar (w-14 h-1) \+ percentage \+ optional change indicator

#### D. AI Search Impact (3 circles):

Three centered metric circles with ring borders:

1. **Competitive Rank** — `#N` in teal, `bg-primary/10 ring-1 ring-primary/20`  
2. **AI Visibility** — `N%` in blue, `bg-blue-500/10 ring-1 ring-blue-500/20`  
3. **Total Citations** — number in amber, `bg-amber-500/10 ring-1 ring-amber-500/20`

Below: "Key Insight" box (`bg-white/[0.02]`) with dynamic text based on visibility tier:

> - 30%: "strong visibility, focus on maintaining..."  
- 10-30%: "appears in N%, competitors average M%, focus on closing gap..."  
- \<10%: "low visibility, priority: create comparison content..."

#### E. Actions Section (2 columns):

Left: **Earned · Off-page** (blue ExternalLink icon) Right: **Owned · On-page** (teal FileText icon)

Each action card: left colored border (red=high, amber=medium, blue=low priority), icon \+ title \+ priority badge \+ description text.

Generate actions dynamically based on data:

- If top competitor has higher visibility → "Close visibility gap with {competitor}"  
- If UGC sources exist → "Increase presence on UGC platforms"  
- If visibility \< 30% → "Boost AI search visibility"  
- If brand domain retrieval rate \< 20% → "Optimize your domain for LLM retrieval"  
- Always: "Create an AI-optimized content hub"  
- If multiple corporate sources → "Get listed on top-cited corporate domains"

#### F. Sources Summary (2/3 \+ 1/3 grid):

Left (2/3): Top Domains table (compact, 8 rows max) — same as Sources tab table Right (1/3): Domain Types breakdown — color dot \+ type name \+ thin bar \+ percentage

#### G. Recent Chats:

Grid of cards (up to 3 columns). Each card shows:

- MessageSquare icon \+ prompt text (truncated)  
- Model icon group (colored pills: GPT, CL, GM, PX, AIO)  
- Footer: citation count (Link2 icon), sentiment dot \+ score, position, date

---

### TAB 2: PROMPTS

#### Header:

- Title: "Prompts" \+ subtitle  
- "+ Add Prompt" button (top right)

#### Prompts Table:

Columns: Prompt (clickable, max-width 400px truncated), Visibility%, Sentiment (dot \+ number), Position (\#X.X), Models (colored icon pills), Actions (play \+ archive icons)

Features:

- **Topic filter buttons** at top: All, Affiliate, Core, Category, Free tool, Competitor (generated from unique topics)  
- **Add Prompt**: inline form with text input \+ topic dropdown \+ Add button  
- **Click prompt text** → opens **Prompt Detail Modal**

#### Prompt Detail Modal:

- Fixed overlay with backdrop blur (`bg-black/60`)  
- Card with max-w-3xl, max-h-\[70vh\] overflow scroll  
- Header: "PROMPT DETAIL" label \+ full prompt text \+ X close button  
- Body: "PER-MODEL BREAKDOWN" section  
- 5 model cards (one per LLM), ordered: openai, claude, gemini, perplexity, google\_aio  
- Each card shows: ModelIcon \+ model name \+ Mentioned/Not mentioned badge \+ Position \+ Sentiment dot \+ Citation count  
- Cards with mentions get green border tint (`border-success/20 bg-success/[0.03]`)  
- Click to expand → shows response preview (300 chars)

---

### TAB 3: SOURCES

#### Header:

- Title \+ subtitle on left  
- **Domains | URLs toggle** on right (pill-style toggle, `bg-white/[0.04]` container, active item gets `bg-white/[0.08]`)

#### A. Source Retrieval Chart:

- Recharts `AreaChart` showing top 5 domains over time  
- Area fill at 0.06 opacity, 1.5px stroke  
- Same axis/tooltip styling as visibility chart

#### B. Sources Table \+ Domain Types (2/3 \+ 1/3 grid):

Left: Full domain/URL table (columns: \#, Domain/URL, Type badge, Retrieved bar \+ %, Citation Rate) Right: Domain Types breakdown card

When "URLs" toggle is active:

- Table header changes to "URL" column  
- Data shows full URLs instead of domains  
- API call passes `view=urls` parameter

---

## 🌐 API ROUTES

All routes accept query params for filtering. Return JSON.

### `GET /api/brand`

Returns `{ brand }` or `{ brand: null }`

### `GET/POST /api/setup-db`

Checks if all 5 tables exist by querying each via Supabase REST. Returns `{ allTablesExist, results[] }`.

### `GET /api/overview?days=90&model=claude`

Returns: `{ brand, competitors, metrics, rankings, trend, sources, domainTypes, recentChats }`

- `days` defaults to 7  
- `model` is optional (omit for all models)  
- `trend` uses `Math.max(days, 28)` to always show enough chart data

### `GET /api/sources?days=90&model=claude&view=urls`

Returns: `{ sources, domainTypes, trend, view }`

- `view` is "domains" (default) or "urls"

### `GET /api/prompts/metrics?days=90&model=claude`

Returns: `{ prompts: PromptWithMetrics[] }`

### `POST /api/prompts/run`

Body: `{ promptId?: string }` — runs single prompt or all prompts Returns: `{ results: [{ prompt, results: [{model, success, run}] }] }`

### `GET /api/prompts/[id]`

Returns: `{ prompt, runs[], citations[], modelBreakdown[] }`

### `POST /api/prompts`

Body: `{ text, topic }` — creates new prompt

### `DELETE /api/prompts`

Body: `{ id }` — archives prompt (sets is\_active=false)

### `POST /api/onboarding/crawl`

Body: `{ url }` — crawls website, returns CrawlResult

### `POST /api/onboarding/generate-prompts`

Body: `{ crawlData, domain }` — returns `{ prompts: string[] }`

### `POST /api/onboarding/generate-competitors`

Body: `{ crawlData, domain }` — returns `{ competitors: {name,domain}[] }`

### `POST /api/onboarding/complete`

Body: `{ brandName, domain, category, description, prompts[], competitors[] }` — creates all DB records

---

## 🏠 PAGE ROUTING

### `/` (page.tsx)

1. POST `/api/setup-db` → if tables missing, redirect to `/setup`  
2. GET `/api/brand` → if no brand, show OnboardingFlow  
3. Otherwise, show Dashboard

### `/setup`

- Database setup wizard with table status indicators  
- Copy-able SQL block  
- "Open Dashboard" link to Supabase SQL editor  
- "Check Tables" button that re-verifies

---

## 🚫 IMPORTANT RULES

- All API keys server-side only (never in client components)  
- No mock/fake data in the built app — only real API calls and real DB queries  
- Every API route must accept `days` and `model` query params where applicable  
- Build ALL components from scratch — no shadcn/ui CLI, no copy-paste from component libraries  
- The `model` filter in metrics.ts must add `.eq("model", model)` to Supabase queries when model param is provided  
- Use Gemini 2.5 Flash (not OpenAI) for onboarding crawl analysis and prompt/competitor generation — it's cheaper and supports JSON response mode  
- Handle OpenAI quota errors (429) gracefully — return empty response, don't crash  
- Chart tooltips MUST show brand names with their color dots, sorted by value descending  
- The visibility trend chart groups data by WEEK (Sunday start), not by day  
- Position score is 1-5 scale where 1 is BEST (appears first in response)  
- Sentiment maps to: positive=80, neutral=55, negative=30

---

## 📦 FINAL OUTPUT

The app must be runnable with:

```shell
npm install
npm run dev
```

Open `http://localhost:3000`. If tables don't exist, it redirects to `/setup` with the SQL to paste. After tables are created, it shows the onboarding flow. After onboarding, it shows the full dashboard.

Build this as a **complete, production-ready MVP** with every feature described above fully implemented and working.  
