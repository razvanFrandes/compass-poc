# Compass POC

A dashboard for a fictional hotel group (Fagus Hotels: Cluj, București, Brașov) with an AI assistant that answers from the database and builds the right chart for the question.

- **UI:** Angular 22.2 (zoneless, standalone, signals) + [ZardUI](https://zardui.com) (shadcn for Angular), starting from the `dashboard-01` block.
- **Theme:** tweakcn "LIT" (`https://tweakcn.com/r/themes/cmp6klh75000104jxgwp9cbog`), applied in `src/styles.css`.
- **Data:** PGlite (Postgres in WASM), in memory, regenerated on every start (`server/seed.ts`).
- **AI:** the Claude API through the official SDK (`@anthropic-ai/sdk`), with a demo mode when no API key is set.
- **Live:** https://compass.razvanfrandes.com (Cloudflare Worker + Container).

## Getting started

```bash
nvm use          # Node 24.22 (Angular CLI 22 needs at least 22.22.3)
pnpm install
echo 'ANTHROPIC_API_KEY=sk-ant-...' > .env   # optional; git ignores it
pnpm dev         # API on :3001 + Angular on :4200
```

Open http://localhost:4200.

| Variable | Default | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | none | Claude API key, read from `.env` locally and from a Worker secret in production |
| `COMPASS_AI` | detected | `claude` or `mock` (canned answers, no Claude needed) |
| `COMPASS_PLAN_MODEL` | `claude-sonnet-5-5` | model that writes the SQL and picks the chart |
| `COMPASS_ANSWER_MODEL` | `claude-haiku-5-5` | model that writes the answer from the result |

With `ANTHROPIC_API_KEY` set, the assistant calls the Claude API; without it, it falls back to demo mode. The header shows which one is active.

## How the data flows

```
Angular (httpResource)  ──GET /api/dashboard/:hotel──▶  Hono  ──SQL──▶  PGlite
Assistant (signals)     ──POST /api/ask──────────────▶  Hono
                                                         ├─ Claude API (Sonnet): question + schema → { sql, widget }
                                                         ├─ worker thread: SQL in a READ ONLY transaction, then ROLLBACK
                                                         └─ Claude API (Haiku): rows → answer
                         ◀── { answer, widget, sql, source, durationMs } ──
```

- The model never computes numbers: the SQL produces them, and the answer is written only from the returned rows.
- Both calls use structured outputs (`output_config.format` with a JSON schema), so the server always gets valid JSON back.
- Model-written SQL runs in a worker thread with a 5 s limit and a row cap, so a slow query cannot stall the API.
- If the SQL fails, the model gets the error back and has one attempt to repair it.
- The last few questions are sent along, so follow-ups ("and for București?") have context.
- The API accepts JSON only, so other websites cannot post to it. Locally it listens on 127.0.0.1; in production it sits behind the Worker, which rate-limits questions (5 per minute per visitor, 30 per minute in total).

## Where things are

| File | Role | Angular concept |
|---|---|---|
| `src/app/app.config.ts` | providers: HTTP, router, locale, ZardUI, ECharts | DI, `ApplicationConfig` |
| `src/app/app.routes.ts` | `/:hotel`, lazy loaded | routing, `loadComponent`, `withComponentInputBinding` |
| `features/dashboard/dashboard-page.ts` | the page; loads data with `httpResource` | route `input()`, `computed()`, `httpResource` |
| `features/dashboard/kpi-cards.ts` | the four KPI cards | `input.required()`, `formatNumber` / `formatCurrency` |
| `features/dashboard/revpar-chart.ts` | the RevPAR chart (z-chart) | local `signal()`, `computed()` |
| `features/dashboard/upcoming-table.ts` | the next 14 nights (z-table) | pipes: `date`, `number`, `currency`, `@let` |
| `features/assistant/assistant-panel.ts` | the chat with Compass | Signal Forms (`form`, `[formField]`), `afterRenderEffect`, `viewChild` |
| `features/assistant/pinned-widgets.ts` | charts pinned to the dashboard | singleton service with `@Service()`, shared state with signals |
| `features/layout/*` | sidebar and header from the block | small components, `host`, `RouterLink` |
| `core/compass-api.ts` | API types and the `ask` call | `inject(HttpClient)` |
| `server/*` | Hono API, PGlite, Claude API integration | — |
| `worker/index.ts`, `wrangler.jsonc`, `Dockerfile` | Cloudflare deployment | — |

`src/app/shared/**` is ZardUI source installed by `zard-cli`; it is used, not edited.

## Deploying to Cloudflare

```
browser ──▶ Worker (compass.razvanfrandes.com)
              ├─ /*      → static Angular build (Workers static assets)
              └─ /api/*  → rate limits → Container running server/ (Node 24, PGlite in memory)
```

```bash
pnpm exec wrangler login            # once
pnpm run deploy                     # ng build + wrangler deploy (builds and pushes the Docker image)
pnpm exec wrangler secret put ANTHROPIC_API_KEY   # once, or: wrangler deploy --secrets-file .env
```

Containers need the Workers Paid plan and Docker running locally. The container sleeps after 20 idle minutes; the first request after that waits a few seconds while the database is seeded again.

## Claude Code setup

- `CLAUDE.md`: Angular 22 rules generated by `ng new --ai-config=claude-code`.
- `.claude/skills/zard`: the official ZardUI skill (styling, composition and icon rules).
- `.mcp.json`: the `angular-cli` and `zard-ui` MCP servers.

## Notes

- The live site spends the API key on every question. Set a monthly spend limit in the Claude Console.
- One theme deviation: `--destructive` uses the shadcn v4 values, because ZardUI renders it as text and the theme's values fail WCAG AA.
