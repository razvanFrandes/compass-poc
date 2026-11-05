import { Worker } from 'node:worker_threads';

import type { Row } from './db.ts';

interface Pending {
  resolve: (rows: Row[]) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

/** Runs model-written SQL in a worker thread with a wall-clock limit; an overrun kills and restarts the worker. */
export class SqlRunner {
  private worker!: Worker;
  private ready!: Promise<void>;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private readonly timeoutMs: number;

  constructor(timeoutMs = 5_000) {
    this.timeoutMs = timeoutMs;
    this.start();
  }

  async run(sql: string, maxRows = 200): Promise<Row[]> {
    await this.ready;
    const id = this.nextId++;
    return new Promise<Row[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Query exceeded ${this.timeoutMs} ms and was stopped.`));
        this.restart();
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, sql, maxRows });
    });
  }

  private start(): void {
    this.worker = new Worker(new URL('./sql-worker.ts', import.meta.url));
    this.ready = new Promise((resolve, reject) => {
      this.worker.once('error', reject);
      this.worker.on('message', (msg: { ready?: boolean; id?: number; rows?: Row[]; error?: string }) => {
        if (msg.ready) {
          resolve();
          return;
        }
        const job = msg.id === undefined ? undefined : this.pending.get(msg.id);
        if (!job || msg.id === undefined) return;
        clearTimeout(job.timer);
        this.pending.delete(msg.id);
        if (msg.error) job.reject(new Error(msg.error));
        else job.resolve(msg.rows ?? []);
      });
    });
  }

  private restart(): void {
    for (const [id, job] of this.pending) {
      clearTimeout(job.timer);
      job.reject(new Error('The query worker was restarted.'));
      this.pending.delete(id);
    }
    void this.worker.terminate();
    this.start();
  }
}
