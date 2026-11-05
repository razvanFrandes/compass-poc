import { parentPort } from 'node:worker_threads';

import { openDatabase, runReadOnly } from './db.ts';

/**
 * Owns its own copy of the seeded database and runs model-written SQL on it.
 * PGlite blocks the thread it runs on, so a slow query here never stalls the API;
 * the parent terminates this worker when a query overruns.
 */
const db = await openDatabase();

parentPort?.on('message', async ({ id, sql, maxRows }: { id: number; sql: string; maxRows: number }) => {
  try {
    parentPort?.postMessage({ id, rows: await runReadOnly(db, sql, maxRows) });
  } catch (err) {
    parentPort?.postMessage({ id, error: (err as Error).message });
  }
});

parentPort?.postMessage({ ready: true });
