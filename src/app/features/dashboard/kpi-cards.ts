import { formatCurrency, formatNumber } from '@angular/common';
import { Component, computed, inject, input, LOCALE_ID } from '@angular/core';

import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTrendingDown, lucideTrendingUp } from '@ng-icons/lucide';

import { ZardBadgeComponent } from '@/shared/components/badge/badge.component';
import { ZardCardImports } from '@/shared/components/card/card.imports';

import type { Kpi, KpiKey } from '../../core/compass-api';

const LABELS: Record<KpiKey, string> = {
  occupancy: 'Grad de ocupare',
  adr: 'ADR (tarif mediu)',
  revpar: 'RevPAR',
  revenue: 'Venit din camere',
};

/** The four section cards from the dashboard-01 block, fed with the last 30 days against last year. */
@Component({
  selector: 'app-kpi-cards',
  imports: [...ZardCardImports, ZardBadgeComponent, NgIcon],
  viewProviders: [provideIcons({ lucideTrendingDown, lucideTrendingUp })],
  host: { class: 'contents' },
  template: `
    <div
      class="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs sm:grid-cols-2 lg:px-6 xl:grid-cols-4"
    >
      @for (card of cards(); track card.key) {
        <z-card>
          <z-card-header>
            <z-card-description [zDescription]="card.label" />
            <z-card-title [zTitle]="card.value" class="text-2xl font-semibold tabular-nums lg:text-3xl" />
            <z-card-action>
              <z-badge zType="outline">
                <ng-icon [name]="card.up ? 'lucideTrendingUp' : 'lucideTrendingDown'" />
                {{ card.delta }}
              </z-badge>
            </z-card-action>
          </z-card-header>

          <z-card-footer class="flex-col items-start gap-1.5 bg-transparent text-sm">
            <div class="line-clamp-1 flex gap-2 font-medium">
              {{ card.up ? 'Peste anul trecut' : 'Sub anul trecut' }}
              <ng-icon [name]="card.up ? 'lucideTrendingUp' : 'lucideTrendingDown'" class="size-4" />
            </div>
            <div class="text-muted-foreground">Anul trecut: {{ card.lastYear }}</div>
          </z-card-footer>
        </z-card>
      }
    </div>
  `,
})
export class KpiCards {
  readonly kpis = input.required<readonly Kpi[]>();

  private readonly locale = inject(LOCALE_ID);

  protected readonly cards = computed(() =>
    this.kpis().map((kpi) => {
      const isOccupancy = kpi.key === 'occupancy';
      const diff = isOccupancy ? kpi.value - kpi.lastYear : ((kpi.value - kpi.lastYear) / kpi.lastYear) * 100;
      const sign = diff >= 0 ? '+' : '−';
      return {
        key: kpi.key,
        label: LABELS[kpi.key],
        value: this.format(kpi.key, kpi.value),
        lastYear: this.format(kpi.key, kpi.lastYear),
        delta: `${sign}${formatNumber(Math.abs(diff), this.locale, '1.1-1')}${isOccupancy ? ' pp' : '%'}`,
        up: diff >= 0,
      };
    }),
  );

  private format(key: KpiKey, value: number): string {
    if (key === 'occupancy') return `${formatNumber(value, this.locale, '1.1-1')}%`;
    return formatCurrency(value, this.locale, '€', 'EUR', key === 'revenue' ? '1.0-0' : '1.2-2');
  }
}
