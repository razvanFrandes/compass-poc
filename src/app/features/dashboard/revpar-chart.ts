import { Component, computed, input, signal } from '@angular/core';

import { ZardCardImports } from '@/shared/components/card/card.imports';
import { ZardChartImports } from '@/shared/components/chart/chart.imports';
import type { ZardChartConfig, ZardChartSeries } from '@/shared/components/chart/chart.types';
import { ZardSelectImports } from '@/shared/components/select/select.imports';
import { ZardToggleGroupComponent } from '@/shared/components/toggle-group/toggle-group.component';

import type { Dashboard } from '../../core/compass-api';

/** The interactive area chart from the dashboard-01 block: daily RevPAR against the same weekday last year. */
@Component({
  selector: 'app-revpar-chart',
  imports: [...ZardCardImports, ...ZardChartImports, ...ZardSelectImports, ZardToggleGroupComponent],
  host: { class: 'contents' },
  template: `
    <z-card class="pt-0">
      <z-card-header class="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div class="grid flex-1 gap-1">
          <z-card-title zTitle="Daily RevPAR" />
          <z-card-description zDescription="Revenue per available room, against the same weekday last year" />
        </div>

        <z-card-action class="flex items-center gap-2">
          <z-toggle-group
            zMode="single"
            zType="outline"
            zSize="sm"
            [zItems]="ranges"
            [zValue]="range()"
            (valueChange)="onRangeChange($event)"
            class="hidden lg:flex"
            zItemClass="px-4!"
          />

          <z-select class="w-40 rounded-lg lg:hidden" [(zValue)]="range">
            @for (option of ranges; track option.value) {
              <z-select-item [zValue]="option.value">{{ option.label }}</z-select-item>
            }
          </z-select>
        </z-card-action>
      </z-card-header>

      <z-card-content class="px-2 pt-4 sm:px-6 sm:pt-6">
        <z-chart
          zType="area"
          [zConfig]="chartConfig"
          [zData]="visibleData()"
          [zSeries]="series"
          zXAxisKey="date"
          [zXAxisFormatter]="shortDate"
          zGradient
          class="aspect-auto h-[250px] w-full"
        >
          <z-chart-tooltip zIndicator="dot" [zLabelFormatter]="longDate" />
        </z-chart>
      </z-card-content>
    </z-card>
  `,
})
export class RevparChart {
  readonly data = input.required<Dashboard['series']>();

  protected readonly chartConfig: ZardChartConfig = {
    revpar: { label: 'RevPAR 2026 (€)', color: 'var(--chart-1)' },
    revpar_ly: { label: 'RevPAR 2025 (€)', color: 'var(--chart-2)' },
  };

  protected readonly series: ZardChartSeries[] = [
    { dataKey: 'revpar_ly', smooth: true },
    { dataKey: 'revpar', smooth: true },
  ];

  protected readonly ranges = [
    { value: '90d', label: 'Last 3 months' },
    { value: '30d', label: 'Last 30 days' },
    { value: '7d', label: 'Last 7 days' },
  ];

  protected readonly range = signal('90d');

  /** The trailing slice of the series, counted back from the newest night. */
  protected readonly visibleData = computed(() => {
    const days = this.range() === '7d' ? 7 : this.range() === '30d' ? 30 : 90;
    return this.data().slice(-days);
  });

  protected onRangeChange(value: string | string[]): void {
    if (typeof value === 'string' && value) {
      this.range.set(value);
    }
  }

  protected readonly shortDate = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  protected readonly longDate = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
