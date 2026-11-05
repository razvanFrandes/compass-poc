import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/** A database row as the API serializes it. */
export type Row = Record<string, string | number | boolean | null>;

export interface Hotel {
  id: string;
  name: string;
  city: string;
  rooms: number;
  segment: string;
}

export type KpiKey = 'occupancy' | 'adr' | 'revpar' | 'revenue';

export interface Kpi {
  key: KpiKey;
  value: number;
  lastYear: number;
}

export interface Dashboard {
  businessDate: string;
  hotel: string;
  kpis: Kpi[];
  series: { date: string; revpar: number; revpar_ly: number | null }[];
  upcoming: {
    date: string;
    rooms_otb: number;
    occupancy_otb: number;
    pickup_7d: number;
    bar_rate: number;
    comp_median: number;
    events: string | null;
  }[];
}

export interface WidgetField {
  key: string;
  label: string;
}

export interface Widget {
  type: 'bar' | 'line' | 'area' | 'table';
  title: string;
  xKey: string;
  series: WidgetField[];
  columns: WidgetField[];
  rows: Row[];
}

export interface AskResult {
  answer: string;
  widget: Widget | null;
  sql: string | null;
  source: 'claude' | 'mock';
  durationMs: number;
}

export interface Health {
  ok: boolean;
  ai: 'claude' | 'mock';
}

/** Writes to the API. Reads are declared where they are used, with `httpResource`. */
@Service()
export class CompassApi {
  private readonly http = inject(HttpClient);

  ask(question: string, hotel: string): Promise<AskResult> {
    return firstValueFrom(this.http.post<AskResult>('/api/ask', { question, hotel }));
  }
}
