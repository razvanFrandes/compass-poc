import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Row } from './db.ts';
import { BUSINESS_DATE } from './seed.ts';
import type { SqlRunner } from './sql-runner.ts';

export type WidgetType = 'bar' | 'line' | 'area' | 'table';

export interface WidgetField {
  key: string;
  label: string;
}

export interface Widget {
  type: WidgetType;
  title: string;
  xKey: string;
  series: WidgetField[];
  columns: WidgetField[];
  rows: Row[];
}

/** An earlier turn of the same conversation, so follow-up questions have context. */
export interface Turn {
  question: string;
  sql: string | null;
}

export interface AskResult {
  answer: string;
  widget: Widget | null;
  sql: string | null;
  source: 'claude' | 'mock';
  durationMs: number;
}

/** What the model returns in the planning step: a query and how to show its result. */
interface Plan {
  sql: string;
  reply: string;
  widget: {
    type: WidgetType;
    title: string;
    x_key: string;
    series: WidgetField[];
    columns: WidgetField[];
  };
}

const FIELD_LIST = {
  type: 'array',
  items: {
    type: 'object',
    properties: { key: { type: 'string' }, label: { type: 'string' } },
    required: ['key', 'label'],
  },
};

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    sql: { type: 'string', description: 'One read-only PostgreSQL SELECT, or an empty string when no data is needed.' },
    reply: { type: 'string', description: 'Only when sql is empty: a short answer in Romanian.' },
    widget: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['bar', 'line', 'area', 'table'] },
        title: { type: 'string', description: 'Short Romanian title.' },
        x_key: { type: 'string', description: 'Result column for the category or date axis.' },
        series: { ...FIELD_LIST, description: 'Numeric result columns to plot, with Romanian labels.' },
        columns: { ...FIELD_LIST, description: 'Every result column, in display order, with Romanian labels.' },
      },
      required: ['type', 'title', 'x_key', 'series', 'columns'],
    },
  },
  required: ['sql', 'reply', 'widget'],
};

const ANSWER_SCHEMA = {
  type: 'object',
  properties: { answer: { type: 'string' } },
  required: ['answer'],
};

const PLAN_PROMPT = `You are Compass, the commercial analyst of Fagus Hotels, a Romanian hotel group.
You answer questions by writing ONE PostgreSQL 18 SELECT over the schema below, and by choosing how the result is shown.

Business date (today): ${BUSINESS_DATE}. Stay dates before it are actuals; stay dates from it on are on-the-books (reservations so far).
Currency: EUR.

Schema:
- hotels(id text, name text, city text, rooms int, segment text). ids: 'CLJ' Fagus Cluj (160 rooms), 'BUC' Fagus București (220 rooms), 'BRV' Fagus Brașov (90 rooms).
- daily_performance(hotel_id, stay_date date, rooms_available int, rooms_sold int, room_revenue numeric, rooms_sold_7d_ago int). One row per hotel per night from 2025-01-01 to 2027-02-28. For future dates rooms_sold is on-the-books and rooms_sold - rooms_sold_7d_ago is the 7-day pickup.
- channel_performance(hotel_id, stay_date, channel text, rooms_sold int, room_revenue numeric, commission_pct numeric). Actuals only. Channels: 'Direct', 'Booking.com', 'Expedia', 'Corporate', 'Grupuri'.
- rates(hotel_id, stay_date, bar_rate numeric). Our published rate, next 120 days.
- competitor_rates(hotel_id, stay_date, competitor text, rate numeric). Three competitors per hotel, next 120 days.
- events(hotel_id, name text, start_date date, end_date date). City events that drive demand (UNTOLD, Electric Castle, Târgul de Crăciun, congresses).

Metric definitions (always compute them from sums, never average ratios):
- occupancy % = 100 * sum(rooms_sold) / sum(rooms_available)
- ADR = sum(room_revenue) / sum(rooms_sold)
- RevPAR = sum(room_revenue) / sum(rooms_available)
- net revenue after commission = sum(room_revenue * (1 - commission_pct / 100))
- same period last year: stay_date - 364 (keeps the weekday).

Rules:
- Exactly one SELECT or WITH … SELECT. No semicolons, no writes, no functions with side effects.
- Format dates as text with to_char(date, 'YYYY-MM-DD') and months with to_char(date, 'YYYY-MM').
- Cast numeric results with round(x::numeric, 1 or 2) so they are readable.
- Use short snake_case aliases. Use hotel names (from hotels.name) rather than ids in the output.
- Return at most 60 rows, ordered meaningfully.
- When the user's current hotel filter is not 'all', restrict to that hotel unless the question names other hotels.
- Widget: 'line' or 'area' for time series, 'bar' for comparisons between hotels, channels or months, 'table' for lists. For a comparison of several hotels over time, return one column per hotel (pivot with sum(...) FILTER (WHERE ...)).
- x_key must be a column of the result; series must be numeric columns of the result; columns lists every result column.
- If the question cannot be answered from this data, return sql = "" and explain in reply (Romanian).`;

const ANSWER_PROMPT = `You are Compass, the commercial analyst of Fagus Hotels.
Write the answer to the user's question in Romanian, in 2 to 4 short sentences, based ONLY on the query result you are given.
Use only numbers that appear in the result (you may round them). Mention hotel names and dates as they appear. Currency is EUR.
If the result is empty, say that there is no data for that question. Do not mention SQL.`;

const PLAN_MODEL = process.env['COMPASS_PLAN_MODEL'] ?? 'claude-sonnet-5-5';
const ANSWER_MODEL = process.env['COMPASS_ANSWER_MODEL'] ?? 'claude-haiku-5-5';

/** Runs one headless Claude Code call with no tools, no customizations and a JSON-schema answer. */
function callClaude<T>(model: string, systemPrompt: string, prompt: string, schema: object, timeoutMs = 90_000): Promise<T> {
  const cwd = mkdtempSync(join(tmpdir(), 'compass-claude-'));
  const env = { ...process.env };
  // A stray API key silently switches billing away from the local subscription.
  delete env['ANTHROPIC_API_KEY'];
  delete env['ANTHROPIC_AUTH_TOKEN'];

  const args = [
    '-p',
    prompt,
    '--model',
    model,
    '--output-format',
    'json',
    '--safe-mode',
    '--tools',
    '',
    '--no-session-persistence',
    '--system-prompt',
    systemPrompt,
    '--json-schema',
    JSON.stringify(schema),
  ];

  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`claude timed out after ${timeoutMs} ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        const result = JSON.parse(stdout) as { is_error?: boolean; result?: string; structured_output?: T };
        if (code !== 0 || result.is_error || !result.structured_output) {
          reject(new Error(`claude failed (exit ${code}): ${result.result ?? stderr}`));
          return;
        }
        resolve(result.structured_output);
      } catch {
        reject(new Error(`claude returned invalid JSON (exit ${code}): ${stderr || stdout.slice(0, 500)}`));
      }
    });
  });
}

function hotelContext(hotel: string): string {
  return hotel === 'all' ? "Current hotel filter: 'all' (the whole group)." : `Current hotel filter: '${hotel}'.`;
}

function historyContext(history: readonly Turn[]): string {
  if (!history.length) return '';
  const turns = history.map((t, i) => `${i + 1}. Question: ${t.question}${t.sql ? `\n   SQL: ${t.sql}` : ''}`).join('\n');
  return `Earlier in this conversation (oldest first):\n${turns}\nInterpret the new question as a follow-up when it refers to them.\n`;
}

function noDataAnswer(plan: Plan): Omit<AskResult, 'durationMs'> {
  return { answer: plan.reply || 'Nu pot răspunde la asta din datele disponibile.', widget: null, sql: null, source: 'claude' };
}

function toWidget(plan: Plan, rows: Row[]): Widget | null {
  if (!rows.length) return null;
  const present = new Set(Object.keys(rows[0]));
  const columns = plan.widget.columns.filter((c) => present.has(c.key));
  const series = plan.widget.series.filter((s) => present.has(s.key) && typeof rows[0][s.key] === 'number');
  const chartable = plan.widget.type !== 'table' && present.has(plan.widget.x_key) && series.length > 0;
  return {
    type: chartable ? plan.widget.type : 'table',
    title: plan.widget.title,
    xKey: plan.widget.x_key,
    series,
    columns: columns.length ? columns : [...present].map((key) => ({ key, label: key })),
    rows,
  };
}

async function askClaude(sql: SqlRunner, question: string, hotel: string, history: readonly Turn[]): Promise<Omit<AskResult, 'durationMs'>> {
  const request = `${historyContext(history)}${hotelContext(hotel)}\nQuestion: ${question}`;
  let plan = await callClaude<Plan>(PLAN_MODEL, PLAN_PROMPT, request, PLAN_SCHEMA);
  if (!plan.sql.trim()) return noDataAnswer(plan);

  let rows: Row[];
  try {
    rows = await sql.run(plan.sql);
  } catch (err) {
    // One repair attempt: show the model its own query and the database error.
    const repair = `${request}\n\nYour previous query failed.\nQuery: ${plan.sql}\nError: ${(err as Error).message}\nReturn a corrected plan.`;
    plan = await callClaude<Plan>(PLAN_MODEL, PLAN_PROMPT, repair, PLAN_SCHEMA);
    if (!plan.sql.trim()) return noDataAnswer(plan);
    rows = await sql.run(plan.sql);
  }

  const answerRequest = `Question: ${question}\n${hotelContext(hotel)}\nQuery result (JSON, ${rows.length} rows):\n${JSON.stringify(rows.slice(0, 60))}`;
  const { answer } = await callClaude<{ answer: string }>(ANSWER_MODEL, ANSWER_PROMPT, answerRequest, ANSWER_SCHEMA);
  return { answer, widget: toWidget(plan, rows), sql: plan.sql, source: 'claude' };
}

// ---------------------------------------------------------------------------
// Mock provider: canned plans for a few question shapes, answered from real query results.

interface MockCase {
  match: RegExp;
  plan: (hotel: string) => Plan;
  answer: (rows: Row[]) => string;
}

const hotelFilter = (hotel: string, column = 'h.id') => (hotel === 'all' ? 'TRUE' : `${column} = '${hotel}'`);

const MOCK_CASES: readonly MockCase[] = [
  {
    match: /canal|channel|booking|expedia|comision/i,
    plan: (hotel) => ({
      sql: `SELECT c.channel,
                   round(sum(c.room_revenue)::numeric, 0) AS venit,
                   round(sum(c.room_revenue * (1 - c.commission_pct / 100))::numeric, 0) AS venit_net
            FROM channel_performance c JOIN hotels h ON h.id = c.hotel_id
            WHERE ${hotelFilter(hotel)} AND c.stay_date BETWEEN DATE '${BUSINESS_DATE}' - 90 AND DATE '${BUSINESS_DATE}' - 1
            GROUP BY c.channel ORDER BY venit DESC`,
      reply: '',
      widget: {
        type: 'bar',
        title: 'Venit pe canal, ultimele 90 de zile',
        x_key: 'channel',
        series: [
          { key: 'venit', label: 'Venit brut' },
          { key: 'venit_net', label: 'Venit net' },
        ],
        columns: [
          { key: 'channel', label: 'Canal' },
          { key: 'venit', label: 'Venit brut (EUR)' },
          { key: 'venit_net', label: 'Venit net (EUR)' },
        ],
      },
    }),
    answer: (rows) =>
      `În ultimele 90 de zile, cel mai mare venit a venit din ${rows[0]?.['channel']} (${rows[0]?.['venit']} EUR brut, ${rows[0]?.['venit_net']} EUR net după comision). ` +
      `Pe ultimul loc este ${rows.at(-1)?.['channel']}, cu ${rows.at(-1)?.['venit']} EUR.`,
  },
  {
    match: /concuren|comp set|competitor|tarif/i,
    plan: (hotel) => ({
      sql: `SELECT to_char(r.stay_date, 'YYYY-MM-DD') AS data,
                   round(avg(r.bar_rate)::numeric, 2) AS tariful_nostru,
                   round(avg(c.rate)::numeric, 2) AS media_concurentei
            FROM rates r
            JOIN competitor_rates c USING (hotel_id, stay_date)
            JOIN hotels h ON h.id = r.hotel_id
            WHERE ${hotelFilter(hotel)} AND r.stay_date BETWEEN DATE '${BUSINESS_DATE}' AND DATE '${BUSINESS_DATE}' + 29
            GROUP BY r.stay_date ORDER BY r.stay_date`,
      reply: '',
      widget: {
        type: 'line',
        title: 'Tariful nostru față de concurență, următoarele 30 de zile',
        x_key: 'data',
        series: [
          { key: 'tariful_nostru', label: 'Tariful nostru' },
          { key: 'media_concurentei', label: 'Media concurenței' },
        ],
        columns: [
          { key: 'data', label: 'Data' },
          { key: 'tariful_nostru', label: 'Tariful nostru (EUR)' },
          { key: 'media_concurentei', label: 'Media concurenței (EUR)' },
        ],
      },
    }),
    answer: (rows) => {
      const below = rows.filter((r) => Number(r['tariful_nostru']) < Number(r['media_concurentei']));
      return `În următoarele 30 de zile suntem sub media concurenței în ${below.length} nopți din ${rows.length}.` +
        (below[0] ? ` Prima dintre ele este ${below[0]['data']} (${below[0]['tariful_nostru']} EUR față de ${below[0]['media_concurentei']} EUR).` : '');
    },
  },
  {
    match: /.*/,
    plan: () => ({
      sql: `SELECT to_char(d.stay_date, 'YYYY-MM') AS luna,
                   round(100 * sum(d.rooms_sold) FILTER (WHERE d.hotel_id = 'CLJ')::numeric / sum(d.rooms_available) FILTER (WHERE d.hotel_id = 'CLJ'), 1) AS cluj,
                   round(100 * sum(d.rooms_sold) FILTER (WHERE d.hotel_id = 'BUC')::numeric / sum(d.rooms_available) FILTER (WHERE d.hotel_id = 'BUC'), 1) AS bucuresti,
                   round(100 * sum(d.rooms_sold) FILTER (WHERE d.hotel_id = 'BRV')::numeric / sum(d.rooms_available) FILTER (WHERE d.hotel_id = 'BRV'), 1) AS brasov
            FROM daily_performance d
            WHERE d.stay_date BETWEEN DATE '2025-11-01' AND DATE '${BUSINESS_DATE}' - 1
            GROUP BY luna ORDER BY luna`,
      reply: '',
      widget: {
        type: 'bar',
        title: 'Ocupare pe luni, ultimele 12 luni',
        x_key: 'luna',
        series: [
          { key: 'cluj', label: 'Fagus Cluj' },
          { key: 'bucuresti', label: 'Fagus București' },
          { key: 'brasov', label: 'Fagus Brașov' },
        ],
        columns: [
          { key: 'luna', label: 'Luna' },
          { key: 'cluj', label: 'Cluj (%)' },
          { key: 'bucuresti', label: 'București (%)' },
          { key: 'brasov', label: 'Brașov (%)' },
        ],
      },
    }),
    answer: (rows) => {
      const best = [...rows].sort((a, b) => Number(b['cluj']) - Number(a['cluj']))[0];
      return `Am pus ocuparea lunară a celor trei hoteluri pe ultimele 12 luni. Cluj a avut cea mai bună lună în ${best?.['luna']}, cu ${best?.['cluj']}%. ` +
        'Răspunsul vine din modul demo, pentru că Claude Code nu este pornit.';
    },
  },
];

async function askMock(sql: SqlRunner, question: string, hotel: string): Promise<Omit<AskResult, 'durationMs'>> {
  const mock = MOCK_CASES.find((c) => c.match.test(question)) ?? MOCK_CASES[MOCK_CASES.length - 1];
  const plan = mock.plan(hotel);
  const rows = await sql.run(plan.sql);
  return { answer: mock.answer(rows), widget: toWidget(plan, rows), sql: plan.sql, source: 'mock' };
}

export type AiMode = 'claude' | 'mock';

export async function ask(
  sql: SqlRunner,
  mode: AiMode,
  question: string,
  hotel: string,
  history: readonly Turn[] = [],
): Promise<AskResult> {
  const started = performance.now();
  const result = mode === 'claude' ? await askClaude(sql, question, hotel, history) : await askMock(sql, question, hotel);
  return { ...result, durationMs: Math.round(performance.now() - started) };
}
