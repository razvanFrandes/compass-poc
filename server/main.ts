import { spawnSync } from 'node:child_process';

import { serve } from '@hono/node-server';
import { Hono } from 'hono';

import { ask, type AiMode } from './ai.ts';
import { loadDashboard } from './dashboard.ts';
import { openDatabase, type Row } from './db.ts';

const PORT = Number(process.env['PORT'] ?? 3001);

function detectAiMode(): AiMode {
  const requested = process.env['COMPASS_AI'];
  if (requested === 'mock' || requested === 'claude') return requested;
  const probe = spawnSync('claude', ['--version'], { encoding: 'utf8' });
  return probe.status === 0 ? 'claude' : 'mock';
}

const db = await openDatabase();
const aiMode = detectAiMode();
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
  const body = await c.req.json<{ question?: unknown; hotel?: unknown }>().catch(() => ({}) as Record<string, unknown>);
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  const hotel = typeof body.hotel === 'string' && hotelIds.has(body.hotel) ? body.hotel : 'all';
  if (!question || question.length > 500) {
    return c.json({ error: 'Scrie o întrebare de cel mult 500 de caractere.' }, 400);
  }
  try {
    return c.json(await ask(db, aiMode, question, hotel));
  } catch (err) {
    console.error('[ask]', err);
    return c.json({ error: 'Asistentul nu a putut răspunde. Încearcă din nou sau reformulează întrebarea.' }, 502);
  }
});

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Compass API on http://localhost:${PORT} (AI: ${aiMode})`);
});
