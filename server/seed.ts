import type { PGlite } from '@electric-sql/pglite';

/** The business day the demo is frozen at. Everything before it is actuals, everything from it on is on the books. */
export const BUSINESS_DATE = '2026-11-05';

const HISTORY_START = '2025-01-01';
const FUTURE_END = '2027-02-28';

interface HotelProfile {
  id: string;
  name: string;
  city: string;
  rooms: number;
  segment: string;
  baseAdr: number;
  /** Base occupancy per weekday, Monday first. */
  weekday: readonly number[];
  /** Occupancy multiplier per month, January first. */
  month: readonly number[];
  channelMix: Readonly<Record<string, number>>;
}

const HOTELS: readonly HotelProfile[] = [
  {
    id: 'CLJ',
    name: 'Fagus Cluj',
    city: 'Cluj-Napoca',
    rooms: 160,
    segment: 'Business și festivaluri',
    baseAdr: 88,
    weekday: [0.74, 0.82, 0.86, 0.84, 0.7, 0.58, 0.5],
    month: [0.78, 0.85, 0.92, 0.98, 1.02, 1.04, 1.06, 1.08, 1.04, 1.02, 0.96, 0.82],
    channelMix: { Direct: 0.24, 'Booking.com': 0.34, Expedia: 0.1, Corporate: 0.22, Grupuri: 0.1 },
  },
  {
    id: 'BUC',
    name: 'Fagus București',
    city: 'București',
    rooms: 220,
    segment: 'Corporate și MICE',
    baseAdr: 112,
    weekday: [0.82, 0.9, 0.92, 0.88, 0.72, 0.52, 0.46],
    month: [0.8, 0.88, 0.96, 1, 1.02, 0.98, 0.9, 0.78, 1.04, 1.08, 1.04, 0.86],
    channelMix: { Direct: 0.18, 'Booking.com': 0.26, Expedia: 0.12, Corporate: 0.3, Grupuri: 0.14 },
  },
  {
    id: 'BRV',
    name: 'Fagus Brașov',
    city: 'Brașov',
    rooms: 90,
    segment: 'Leisure boutique',
    baseAdr: 96,
    weekday: [0.52, 0.5, 0.54, 0.62, 0.84, 0.94, 0.78],
    month: [1.04, 1.06, 0.92, 0.84, 0.92, 1, 1.1, 1.14, 0.98, 0.9, 0.84, 1.08],
    channelMix: { Direct: 0.3, 'Booking.com': 0.42, Expedia: 0.14, Corporate: 0.06, Grupuri: 0.08 },
  },
];

interface DemandEvent {
  hotelId: string;
  name: string;
  start: string;
  end: string;
  /** Extra occupancy on the event nights, as a fraction of capacity. */
  lift: number;
  /** ADR multiplier on the event nights. */
  adrLift: number;
}

const EVENTS: readonly DemandEvent[] = [
  { hotelId: 'CLJ', name: 'Electric Castle', start: '2025-07-16', end: '2025-07-20', lift: 0.3, adrLift: 1.45 },
  { hotelId: 'CLJ', name: 'UNTOLD', start: '2025-08-07', end: '2025-08-10', lift: 0.4, adrLift: 1.9 },
  { hotelId: 'CLJ', name: 'TIFF', start: '2025-06-13', end: '2025-06-22', lift: 0.12, adrLift: 1.15 },
  { hotelId: 'CLJ', name: 'TIFF', start: '2026-06-12', end: '2026-06-21', lift: 0.12, adrLift: 1.15 },
  { hotelId: 'CLJ', name: 'Electric Castle', start: '2026-07-15', end: '2026-07-19', lift: 0.3, adrLift: 1.5 },
  { hotelId: 'CLJ', name: 'UNTOLD', start: '2026-08-06', end: '2026-08-09', lift: 0.4, adrLift: 2 },
  { hotelId: 'CLJ', name: 'Târgul de Crăciun', start: '2026-11-27', end: '2026-12-23', lift: 0.08, adrLift: 1.05 },
  { hotelId: 'BUC', name: 'Romanian Tech Summit', start: '2025-10-21', end: '2025-10-23', lift: 0.18, adrLift: 1.3 },
  { hotelId: 'BUC', name: 'Romanian Tech Summit', start: '2026-10-20', end: '2026-10-22', lift: 0.18, adrLift: 1.35 },
  { hotelId: 'BUC', name: 'Concert Arena Națională', start: '2026-06-27', end: '2026-06-28', lift: 0.25, adrLift: 1.4 },
  { hotelId: 'BUC', name: 'Congres medical ERS', start: '2026-11-17', end: '2026-11-20', lift: 0.2, adrLift: 1.3 },
  { hotelId: 'BUC', name: 'Gaudeamus', start: '2026-11-25', end: '2026-11-29', lift: 0.08, adrLift: 1.05 },
  { hotelId: 'BRV', name: 'Târgul de Crăciun', start: '2025-11-28', end: '2025-12-23', lift: 0.15, adrLift: 1.15 },
  { hotelId: 'BRV', name: 'Revelion', start: '2025-12-30', end: '2026-01-01', lift: 0.3, adrLift: 1.8 },
  { hotelId: 'BRV', name: 'Cerbul de Aur', start: '2026-08-27', end: '2026-08-30', lift: 0.2, adrLift: 1.3 },
  { hotelId: 'BRV', name: 'Târgul de Crăciun', start: '2026-11-27', end: '2026-12-23', lift: 0.15, adrLift: 1.18 },
  { hotelId: 'BRV', name: 'Revelion', start: '2026-12-30', end: '2027-01-01', lift: 0.3, adrLift: 1.85 },
  { hotelId: 'BRV', name: 'Sezon de schi Poiana Brașov', start: '2027-01-08', end: '2027-02-28', lift: 0.1, adrLift: 1.12 },
];

const COMPETITORS: Readonly<Record<string, readonly [string, number][]>> = {
  CLJ: [['Grand Hotel Napoca', 1.08], ['City Plaza Cluj', 0.94], ['Opera Boutique', 1.15]],
  BUC: [['Capital Business Hotel', 1.05], ['Herăstrău Park Inn', 0.96], ['Victoriei Suites', 1.12]],
  BRV: [['Old Town Brașov', 1.06], ['Tâmpa View', 0.92], ['Poiana Lodge', 1.1]],
};

/** Deterministic PRNG so every start produces the same world. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY_MS = 86_400_000;
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

function eventFor(hotelId: string, iso: string): DemandEvent | undefined {
  return EVENTS.find((e) => e.hotelId === hotelId && iso >= e.start && iso <= e.end);
}

/** Share of the final pickup already on the books, by days before arrival. */
function bookedShare(daysOut: number): number {
  return clamp(Math.exp(-daysOut / 38), 0.12, 1);
}

export async function seed(db: PGlite): Promise<void> {
  await db.exec(`
    CREATE TABLE hotels (
      id text PRIMARY KEY,
      name text NOT NULL,
      city text NOT NULL,
      rooms int NOT NULL,
      segment text NOT NULL
    );
    CREATE TABLE daily_performance (
      hotel_id text NOT NULL REFERENCES hotels(id),
      stay_date date NOT NULL,
      rooms_available int NOT NULL,
      rooms_sold int NOT NULL,
      room_revenue numeric(12,2) NOT NULL,
      rooms_sold_7d_ago int NOT NULL,
      PRIMARY KEY (hotel_id, stay_date)
    );
    CREATE TABLE channel_performance (
      hotel_id text NOT NULL REFERENCES hotels(id),
      stay_date date NOT NULL,
      channel text NOT NULL,
      rooms_sold int NOT NULL,
      room_revenue numeric(12,2) NOT NULL,
      commission_pct numeric(5,2) NOT NULL,
      PRIMARY KEY (hotel_id, stay_date, channel)
    );
    CREATE TABLE rates (
      hotel_id text NOT NULL REFERENCES hotels(id),
      stay_date date NOT NULL,
      bar_rate numeric(10,2) NOT NULL,
      PRIMARY KEY (hotel_id, stay_date)
    );
    CREATE TABLE competitor_rates (
      hotel_id text NOT NULL REFERENCES hotels(id),
      stay_date date NOT NULL,
      competitor text NOT NULL,
      rate numeric(10,2) NOT NULL,
      PRIMARY KEY (hotel_id, stay_date, competitor)
    );
    CREATE TABLE events (
      hotel_id text NOT NULL REFERENCES hotels(id),
      name text NOT NULL,
      start_date date NOT NULL,
      end_date date NOT NULL
    );
  `);

  for (const h of HOTELS) {
    await db.query('INSERT INTO hotels VALUES ($1, $2, $3, $4, $5)', [h.id, h.name, h.city, h.rooms, h.segment]);
  }
  for (const e of EVENTS) {
    await db.query('INSERT INTO events VALUES ($1, $2, $3, $4)', [e.hotelId, e.name, e.start, e.end]);
  }

  const commission: Record<string, number> = { Direct: 0, 'Booking.com': 17, Expedia: 18, Corporate: 0, Grupuri: 0 };
  const business = toDate(BUSINESS_DATE).getTime();
  const daily: unknown[][] = [];
  const channels: unknown[][] = [];
  const rates: unknown[][] = [];
  const comp: unknown[][] = [];

  for (const [index, h] of HOTELS.entries()) {
    const rand = mulberry32(1000 + index);
    for (let t = toDate(HISTORY_START).getTime(); t <= toDate(FUTURE_END).getTime(); t += DAY_MS) {
      const d = new Date(t);
      const iso = toIso(d);
      const weekday = (d.getUTCDay() + 6) % 7;
      const event = eventFor(h.id, iso);
      // 2026 runs a little ahead of 2025, so year-over-year deltas are visible.
      const growth = d.getUTCFullYear() >= 2026 ? 1.04 : 1;
      const noise = 0.92 + rand() * 0.16;

      const finalOcc = clamp(
        h.weekday[weekday] * h.month[d.getUTCMonth()] * noise * growth + (event?.lift ?? 0),
        0.22,
        0.99,
      );
      const finalAdr = h.baseAdr * (0.9 + finalOcc * 0.25) * (event?.adrLift ?? 1) * (growth > 1 ? 1.03 : 1);

      const daysOut = Math.round((t - business) / DAY_MS);
      const isFuture = daysOut >= 0;
      const share = isFuture ? bookedShare(daysOut) : 1;
      const shareWeekAgo = isFuture ? bookedShare(daysOut + 7) : 1;

      const roomsSold = Math.round(h.rooms * finalOcc * share);
      const roomsSoldWeekAgo = Math.min(roomsSold, Math.round(h.rooms * finalOcc * shareWeekAgo));
      const adr = round2(finalAdr * (0.97 + rand() * 0.06));
      daily.push([h.id, iso, h.rooms, roomsSold, round2(roomsSold * adr), isFuture ? roomsSoldWeekAgo : roomsSold]);

      if (!isFuture) {
        let left = roomsSold;
        const names = Object.keys(h.channelMix);
        names.forEach((channel, i) => {
          const sold = i === names.length - 1 ? left : Math.min(left, Math.round(roomsSold * h.channelMix[channel] * (0.85 + rand() * 0.3)));
          left -= sold;
          const channelAdr = adr * (channel === 'Corporate' || channel === 'Grupuri' ? 0.88 : channel === 'Direct' ? 1.02 : 1);
          channels.push([h.id, iso, channel, sold, round2(sold * channelAdr), commission[channel]]);
        });
      }

      if (isFuture && daysOut <= 120) {
        const bar = round2(finalAdr * 1.05);
        rates.push([h.id, iso, bar]);
        for (const [name, factor] of COMPETITORS[h.id]) {
          comp.push([h.id, iso, name, round2(finalAdr * factor * (0.95 + rand() * 0.1))]);
        }
      }
    }
  }

  await bulkInsert(db, 'daily_performance', 6, daily);
  await bulkInsert(db, 'channel_performance', 6, channels);
  await bulkInsert(db, 'rates', 3, rates);
  await bulkInsert(db, 'competitor_rates', 4, comp);
}

async function bulkInsert(db: PGlite, table: string, columns: number, rows: unknown[][]): Promise<void> {
  const chunk = 500;
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const placeholders = part
      .map((_, r) => `(${Array.from({ length: columns }, (_, c) => `$${r * columns + c + 1}`).join(', ')})`)
      .join(', ');
    await db.query(`INSERT INTO ${table} VALUES ${placeholders}`, part.flat());
  }
}
