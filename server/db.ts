import { PGlite, types } from '@electric-sql/pglite';

import { seed } from './seed.ts';

export type Row = Record<string, string | number | boolean | null>;

/** In-memory Postgres, seeded on every start so the demo is always the same world. */
export async function openDatabase(): Promise<PGlite> {
  const db = new PGlite({
    // Return numerics and bigints as JS numbers and dates as ISO strings: the API speaks JSON.
    parsers: {
      [types.NUMERIC]: (v: string) => Number(v),
      [types.INT8]: (v: string) => Number(v),
      [types.DATE]: (v: string) => v,
    },
  });
  await seed(db);
  return db;
}

/** Runs one statement written by the model, inside a read-only transaction that is always rolled back. */
export async function runReadOnly(db: PGlite, sql: string, maxRows = 200): Promise<Row[]> {
  const statement = sql.trim().replace(/;+\s*$/, '');
  if (!/^(with|select)\b/i.test(statement)) {
    throw new Error('Only a single SELECT (or WITH … SELECT) statement is allowed.');
  }
  if (statement.includes(';')) {
    throw new Error('Only one statement is allowed.');
  }

  return db.transaction(async (tx) => {
    await tx.exec('SET TRANSACTION READ ONLY');
    const result = await tx.query<Row>(statement);
    await tx.rollback();
    return result.rows.slice(0, maxRows);
  });
}
