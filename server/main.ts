import { spawnSync } from 'node:child_process';

import { serve } from '@hono/node-server';
import { Hono } from 'hono';

import { ask, type AiMode, type Turn } from './ai.ts';
import { loadDashboard } from './dashboard.ts';
import { openDatabase, type Row } from './db.ts';
import { SqlRunner } from './sql-runner.ts';

const PORT = Number(process.env['PORT'] ?? 3001);

function detectAiMode(): AiMode {
  const requested = process.env['COMPASS_AI'];
  if (requested === 'mock' || requested === 'claude') return requested;
  const probe = spawnSync('claude', ['--version'], { encoding: 'utf8' });
  return probe.status === 0 ? 'claude' : 'mock';
}

/** Turns of earlier conversation the client may send along with a question. */
function parseHistory(value: unknown): Turn[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-4)
    .filter((t): t is { question: string; sql?: unknown } => typeof t?.question === 'string')
    .map((t) => ({
      question: t.question.slice(0, 500),
      sql: typeof t.sql === 'string' ? t.sql.slice(0, 2000) : null,
    }));
}

// The dashboard reads the main database; model-written SQL runs on a worker's copy with a time limit.
const db = await openDatabase();
const sqlRunner = new SqlRunner();
const aiMode = detectAiMode();
let askInFlight = false;
const hotels = (await db.query<Row>('SELECT id, name, city, rooms, segment FROM hotels ORDER BY rooms DESC')).rows;
const hotelIds = new Set(['all', ...hotels.map((h) => String(h['id']))]);

const app = new Hono();

app.get('/api/health', (c) => c.json({ ok: true, ai: aiMode }));

app.get('/api/hotels', (c) => c.json(hotels));

app.get('/api/dashboard/:hotel', async (c) => {
  const hotel = c.req.param('hotel');
  if (!hotelIds.has(hotel)) return c.json({ error: `Hotel necunoscut: ${hotel}` }, 404);
  return c.json(await loadDashboard(db, hotel));
});

app.post('/api/ask', async (c) => {
  // A JSON content type forces a CORS preflight, so other web pages cannot post here.
  if (!c.req.header('content-type')?.startsWith('application/json')) {
    return c.json({ error: 'Trimite cererea ca application/json.' }, 415);
  }
  const body: Record<string, unknown> = await c.req
    .json<unknown>()
    .then((value) => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {}))
    .catch(() => ({}));
  const question = typeof body['question'] === 'string' ? body['question'].trim() : '';
  const hotel = typeof body['hotel'] === 'string' && hotelIds.has(body['hotel']) ? body['hotel'] : 'all';
  if (!question || question.length > 500) {
    return c.json({ error: 'Scrie o întrebare de cel mult 500 de caractere.' }, 400);
  }
  if (askInFlight) {
    return c.json({ error: 'Compass încă răspunde la întrebarea anterioară. Încearcă peste câteva secunde.' }, 429);
  }

  askInFlight = true;
  try {
    return c.json(await ask(sqlRunner, aiMode, question, hotel, parseHistory(body['history'])));
  } catch (err) {
    console.error('[ask]', err);
    return c.json({ error: 'Asistentul nu a putut răspunde. Încearcă din nou sau reformulează întrebarea.' }, 502);
  } finally {
    askInFlight = false;
  }
});

// Local only: the API spends the developer's Claude Code subscription.
serve({ fetch: app.fetch, port: PORT, hostname: '127.0.0.1' }, () => {
  console.log(`Compass API on http://localhost:${PORT} (AI: ${aiMode})`);
});
