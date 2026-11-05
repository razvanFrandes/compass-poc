import type { PGlite } from '@electric-sql/pglite';

import type { Row } from './db.ts';
import { BUSINESS_DATE } from './seed.ts';

export interface Kpi {
  key: 'occupancy' | 'adr' | 'revpar' | 'revenue';
  value: number;
  lastYear: number;
}

export interface Dashboard {
  businessDate: string;
  hotel: string;
  kpis: Kpi[];
  series: Row[];
  upcoming: Row[];
}

/** `hotel` is a hotel id or `all`; every query filters with the same predicate. */
export async function loadDashboard(db: PGlite, hotel: string): Promise<Dashboard> {
  const params = [hotel, BUSINESS_DATE];

  const totals = await db.query<Row>(
    `
    WITH periods AS (
      SELECT 'current' AS period, $2::date - 30 AS start_date, $2::date - 1 AS end_date
      UNION ALL
      SELECT 'last_year', $2::date - 30 - 364, $2::date - 1 - 364
    )
    SELECT p.period,
           sum(d.rooms_sold)::float8 / sum(d.rooms_available) * 100 AS occupancy,
           sum(d.room_revenue)::float8 / nullif(sum(d.rooms_sold), 0) AS adr,
           sum(d.room_revenue)::float8 / sum(d.rooms_available) AS revpar,
           sum(d.room_revenue)::float8 AS revenue
    FROM periods p
    JOIN daily_performance d ON d.stay_date BETWEEN p.start_date AND p.end_date
    WHERE ($1 = 'all' OR d.hotel_id = $1)
    GROUP BY p.period
    `,
    params,
  );
  const current = totals.rows.find((r) => r['period'] === 'current') ?? {};
  const lastYear = totals.rows.find((r) => r['period'] === 'last_year') ?? {};
  const kpis = (['occupancy', 'adr', 'revpar', 'revenue'] as const).map((key) => ({
    key,
    value: Number(current[key] ?? 0),
    lastYear: Number(lastYear[key] ?? 0),
  }));

  const series = await db.query<Row>(
    `
    WITH daily AS (
      SELECT stay_date, sum(room_revenue)::float8 / sum(rooms_available) AS revpar
      FROM daily_performance
      WHERE ($1 = 'all' OR hotel_id = $1)
      GROUP BY stay_date
    )
    SELECT to_char(cur.stay_date, 'YYYY-MM-DD') AS date,
           round(cur.revpar::numeric, 2) AS revpar,
           round(ly.revpar::numeric, 2) AS revpar_ly
    FROM daily cur
    LEFT JOIN daily ly ON ly.stay_date = cur.stay_date - 364
    WHERE cur.stay_date BETWEEN $2::date - 90 AND $2::date - 1
    ORDER BY cur.stay_date
    `,
    params,
  );

  const upcoming = await db.query<Row>(
    `
    WITH comp AS (
      SELECT hotel_id, stay_date, percentile_cont(0.5) WITHIN GROUP (ORDER BY rate) AS comp_median
      FROM competitor_rates
      GROUP BY hotel_id, stay_date
    )
    SELECT to_char(p.stay_date, 'YYYY-MM-DD') AS date,
           sum(p.rooms_sold)::int AS rooms_otb,
           round(sum(p.rooms_sold)::numeric / sum(p.rooms_available) * 100, 1) AS occupancy_otb,
           sum(p.rooms_sold - p.rooms_sold_7d_ago)::int AS pickup_7d,
           round(avg(r.bar_rate), 2) AS bar_rate,
           round(avg(c.comp_median)::numeric, 2) AS comp_median,
           (SELECT string_agg(DISTINCT e.name, ', ')
              FROM events e
             WHERE ($1 = 'all' OR e.hotel_id = $1)
               AND p.stay_date BETWEEN e.start_date AND e.end_date) AS events
    FROM daily_performance p
    JOIN rates r USING (hotel_id, stay_date)
    JOIN comp c USING (hotel_id, stay_date)
    WHERE ($1 = 'all' OR p.hotel_id = $1)
      AND p.stay_date BETWEEN $2::date AND $2::date + 13
    GROUP BY p.stay_date
    ORDER BY p.stay_date
    `,
    params,
  );

  return { businessDate: BUSINESS_DATE, hotel, kpis, series: series.rows, upcoming: upcoming.rows };
}
