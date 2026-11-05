import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';

import { ZardBadgeComponent } from '@/shared/components/badge/badge.component';
import { ZardCardImports } from '@/shared/components/card/card.imports';
import { ZardTableImports } from '@/shared/components/table/table.imports';

import type { Dashboard } from '../../core/compass-api';

/** The next 14 nights: what is on the books, the 7-day pickup and our rate against the competitors. */
@Component({
  selector: 'app-upcoming-table',
  imports: [...ZardCardImports, ...ZardTableImports, ZardBadgeComponent, DatePipe, DecimalPipe, CurrencyPipe],
  host: { class: 'contents' },
  template: `
    <z-card>
      <z-card-header>
        <z-card-title zTitle="Următoarele 14 nopți" />
        <z-card-description
          zDescription="Rezervări deja confirmate (on the books), pickup-ul din ultimele 7 zile și tariful nostru față de mediana concurenței"
        />
      </z-card-header>

      <z-card-content>
        <div class="overflow-auto rounded-lg border">
          <table z-table>
            <thead z-table-header class="sticky top-0 z-10">
              <tr z-table-row>
                <th z-table-head>Noaptea</th>
                <th z-table-head class="text-right">Ocupare</th>
                <th z-table-head class="text-right">Pickup 7 zile</th>
                <th z-table-head class="text-right">Tariful nostru</th>
                <th z-table-head class="text-right">Concurența</th>
                <th z-table-head>Poziție</th>
                <th z-table-head>Eveniment</th>
              </tr>
            </thead>
            <tbody z-table-body>
              @for (night of nights(); track night.date) {
                @let gap = (night.bar_rate / night.comp_median - 1) * 100;
                <tr z-table-row>
                  <td z-table-cell class="font-medium">{{ night.date | date: 'EEE, d MMM' }}</td>
                  <td z-table-cell class="text-right tabular-nums">
                    {{ night.occupancy_otb | number: '1.1-1' }}%
                    <span class="text-muted-foreground">({{ night.rooms_otb }})</span>
                  </td>
                  <td z-table-cell class="text-right tabular-nums">+{{ night.pickup_7d }}</td>
                  <td z-table-cell class="text-right tabular-nums">{{ night.bar_rate | currency: 'EUR' : 'symbol-narrow' : '1.0-0' }}</td>
                  <td z-table-cell class="text-right tabular-nums">{{ night.comp_median | currency: 'EUR' : 'symbol-narrow' : '1.0-0' }}</td>
                  <td z-table-cell>
                    <z-badge [zType]="gap < 0 ? 'secondary' : 'outline'">
                      {{ gap < 0 ? 'Sub piață' : 'Peste piață' }} {{ (gap < 0 ? -gap : gap) | number: '1.1-1' }}%
                    </z-badge>
                  </td>
                  <td z-table-cell>
                    @if (night.events) {
                      <z-badge zType="outline">{{ night.events }}</z-badge>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </z-card-content>
    </z-card>
  `,
})
export class UpcomingTable {
  readonly nights = input.required<Dashboard['upcoming']>();
}
