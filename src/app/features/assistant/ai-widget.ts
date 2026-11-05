import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';

import { ZardChartImports } from '@/shared/components/chart/chart.imports';
import type { ZardChartConfig, ZardChartType } from '@/shared/components/chart/chart.types';
import { ZardTableImports } from '@/shared/components/table/table.imports';

import type { Widget } from '../../core/compass-api';

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

/** Renders a widget the assistant generated: a zard chart for series, a zard table otherwise. */
@Component({
  selector: 'app-ai-widget',
  imports: [...ZardChartImports, ...ZardTableImports, DecimalPipe],
  host: { class: 'contents' },
  template: `
    @let w = widget();
    @if (w.type !== 'table') {
      <z-chart
        [zType]="chartType()"
        [zConfig]="config()"
        [zData]="w.rows"
        [zSeries]="seriesKeys()"
        [zXAxisKey]="w.xKey"
        [zGradient]="w.type === 'area'"
        class="aspect-auto h-[250px] w-full"
      >
        <z-chart-tooltip zIndicator="dot" />
        <z-chart-legend />
      </z-chart>
    } @else {
      <div class="overflow-auto rounded-lg border">
        <table z-table>
          <thead z-table-header class="bg-muted sticky top-0 z-10">
            <tr z-table-row>
              @for (column of w.columns; track column.key) {
                <th z-table-head>{{ column.label }}</th>
              }
            </tr>
          </thead>
          <tbody z-table-body>
            @for (row of w.rows; track $index) {
              <tr z-table-row>
                @for (column of w.columns; track column.key) {
                  @let value = row[column.key];
                  <td z-table-cell class="tabular-nums">
                    @if (isNumber(value)) {
                      {{ value | number: '1.0-2' }}
                    } @else {
                      {{ value ?? '—' }}
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class AiWidget {
  readonly widget = input.required<Widget>();

  protected readonly chartType = computed<ZardChartType>(() => this.widget().type as ZardChartType);

  protected readonly seriesKeys = computed(() => this.widget().series.map((s) => s.key));

  protected readonly config = computed<ZardChartConfig>(() =>
    Object.fromEntries(
      this.widget().series.map((s, i) => [s.key, { label: s.label, color: CHART_COLORS[i % CHART_COLORS.length] }]),
    ),
  );

  protected isNumber(value: unknown): value is number {
    return typeof value === 'number';
  }
}
