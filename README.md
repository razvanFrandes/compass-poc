# Compass POC

Dashboard pentru un grup hotelier fictiv (Fagus Hotels: Cluj, București, Brașov) cu un asistent AI care răspunde din baza de date și construiește graficul potrivit.

- **UI:** Angular 22.2 (zoneless, standalone, signals) + [ZardUI](https://zardui.com) (shadcn pentru Angular), pornind de la block-ul `dashboard-01`.
- **Temă:** tweakcn „LIT” (`https://tweakcn.com/r/themes/cmp6klh75000104jxgwp9cbog`), aplicată în `src/styles.css`.
- **Date:** PGlite (Postgres în WASM), în memorie, generat la fiecare pornire (`server/seed.ts`).
- **AI:** Claude Code local (`claude -p`, pe abonament, fără API key), cu mod demo dacă `claude` lipsește.

## Pornire

```bash
nvm use          # Node 24.22 (Angular CLI 22 cere minim 22.22.3)
pnpm install
pnpm dev         # API pe :3001 + Angular pe :4200
```

Deschide http://localhost:4200.

| Variabilă | Implicit | Ce face |
|---|---|---|
| `COMPASS_AI` | detectat | `claude` sau `mock` (răspunsuri predefinite, fără Claude) |
| `COMPASS_PLAN_MODEL` | `claude-sonnet-5-5` | modelul care scrie SQL-ul și alege graficul |
| `COMPASS_ANSWER_MODEL` | `claude-haiku-5-5` | modelul care scrie răspunsul din rezultat |

## Cum curg datele

```
Angular (httpResource)  ──GET /api/dashboard/:hotel──▶  Hono  ──SQL──▶  PGlite
Asistent (signals)      ──POST /api/ask──────────────▶  Hono
                                                         ├─ claude -p (Sonnet): întrebare + schemă → { sql, widget }
                                                         ├─ PGlite: SQL în tranzacție READ ONLY, apoi ROLLBACK
                                                         └─ claude -p (Haiku): rânduri → răspuns în română
                         ◀── { answer, widget, sql, source, durationMs } ──
```

- Modelul nu calculează cifre: le scoate SQL-ul, iar răspunsul se scrie doar din rândurile întoarse.
- Fiecare apel `claude` rulează cu `--safe-mode --tools ""` într-un director temporar gol, fără `ANTHROPIC_API_KEY` în mediu.
- Dacă SQL-ul dă eroare, modelul primește eroarea și are o singură încercare de reparare.

## Ce găsești unde

| Fișier | Rol | Concept Angular |
|---|---|---|
| `src/app/app.config.ts` | providers: HTTP, router, locale `ro`, ZardUI, ECharts | DI, `ApplicationConfig` |
| `src/app/app.routes.ts` | `/:hotel`, încărcat lazy | routing, `loadComponent`, `withComponentInputBinding` |
| `features/dashboard/dashboard-page.ts` | pagina; citește datele cu `httpResource` | `input()` din ruta, `computed()`, `httpResource` |
| `features/dashboard/kpi-cards.ts` | cele 4 carduri KPI | `input.required()`, `formatNumber`/`formatCurrency` |
| `features/dashboard/revpar-chart.ts` | graficul RevPAR (z-chart) | `signal()` local, `computed()` |
| `features/dashboard/upcoming-table.ts` | următoarele 14 nopți (z-table) | pipes: `date`, `number`, `currency`, `@let` |
| `features/assistant/assistant-panel.ts` | chatul cu Compass | Signal Forms (`form`, `[formField]`), `afterRenderEffect`, `viewChild` |
| `features/assistant/pinned-widgets.ts` | graficele fixate pe dashboard | serviciu singleton `@Service()`, stare partajată cu signals |
| `features/layout/*` | sidebar și header din block | componente mici, `host`, `RouterLink` |
| `core/compass-api.ts` | tipurile API-ului și apelul `ask` | `inject(HttpClient)` |
| `server/*` | API-ul Hono, PGlite, Claude Code | — |

## Setup pentru Claude Code

- `CLAUDE.md`: regulile Angular 22 generate de `ng new --ai-config=claude-code`.
- `.claude/skills/zard`: skill-ul oficial ZardUI (reguli de stil, compoziție, iconuri).
- `.mcp.json`: serverele MCP `angular-cli` și `zard-ui`.
