import { serve } from '@hono/node-server';
import { Hono } from 'hono';

import { ask, type AiMode, type Turn } from './ai.ts';
import { loadDashboard } from './dashboard.ts';
import { openDatabase, type Row } from './db.ts';
import { SqlRunner } from './sql-runner.ts';

const PORT = Number(process.env['PORT'] ?? 3001);
// Local by default; the Cloudflare container sets HOST=0.0.0.0 and sits behind the Worker.
const HOST = process.env['HOST'] ?? '127.0.0.1';

function detectAiMode(): AiMode {
  const requested = process.env['COMPASS_AI'];
  if (requested === 'mock' || requested === 'claude') return requested;
  return process.env['ANTHROPIC_API_KEY'] ? 'claude' : 'mock';
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
  if (!hotelIds.has(hotel)) return c.json({ error: `Unknown hotel: ${hotel}` }, 404);
  return c.json(await loadDashboard(db, hotel));
});

app.post('/api/ask', async (c) => {
  // A JSON content type forces a CORS preflight, so other web pages cannot post here.
  if (!c.req.header('content-type')?.startsWith('application/json')) {
    return c.json({ error: 'Send the request as application/json.' }, 415);
  }
  const body: Record<string, unknown> = await c.req
    .json<unknown>()
    .then((value) => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {}))
    .catch(() => ({}));
  const question = typeof body['question'] === 'string' ? body['question'].trim() : '';
  const hotel = typeof body['hotel'] === 'string' && hotelIds.has(body['hotel']) ? body['hotel'] : 'all';
  if (!question || question.length > 500) {
    return c.json({ error: 'Write a question of at most 500 characters.' }, 400);
  }
  if (askInFlight) {
    return c.json({ error: 'Compass is still answering the previous question. Try again in a few seconds.' }, 429);
  }

  askInFlight = true;
  try {
    return c.json(await ask(sqlRunner, aiMode, question, hotel, parseHistory(body['history'])));
  } catch (err) {
    console.error('[ask]', err);
    return c.json({ error: 'The assistant could not answer. Try again or rephrase the question.' }, 502);
  } finally {
    askInFlight = false;
  }
});

serve({ fetch: app.fetch, port: PORT, hostname: HOST }, () => {
  console.log(`Compass API on http://${HOST}:${PORT} (AI: ${aiMode})`);
});
