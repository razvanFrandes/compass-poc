import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBuilding2, lucideCompass, lucideHotel } from '@ng-icons/lucide';

import { ZardSidebarImports } from '@/shared/components/sidebar/sidebar.imports';

import type { Hotel } from '../../core/compass-api';

/** The app sidebar from the dashboard-01 block, with hotels as the navigation. */
@Component({
  selector: 'app-hotel-sidebar',
  imports: [...ZardSidebarImports, NgIcon, RouterLink],
  viewProviders: [provideIcons({ lucideBuilding2, lucideCompass, lucideHotel })],
  host: { class: 'contents' },
  template: `
    <z-sidebar zCollapsible="offcanvas" zVariant="inset">
      <div z-sidebar-header>
        <ul z-sidebar-menu>
          <li z-sidebar-menu-item>
            <a z-sidebar-menu-button routerLink="/all" class="p-1.5!">
              <ng-icon name="lucideCompass" class="size-5!" />
              <span class="text-base font-semibold">Compass</span>
            </a>
          </li>
        </ul>
      </div>

      <z-sidebar-content>
        <div z-sidebar-group>
          <div z-sidebar-group-label>Portofoliu</div>
          <div z-sidebar-group-content>
            <ul z-sidebar-menu>
              <li z-sidebar-menu-item>
                <a z-sidebar-menu-button routerLink="/all" [zActive]="current() === 'all'" zTooltip="Toate hotelurile">
                  <ng-icon name="lucideBuilding2" />
                  <span>Toate hotelurile</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div z-sidebar-group>
          <div z-sidebar-group-label>Hoteluri</div>
          <div z-sidebar-group-content>
            <ul z-sidebar-menu>
              @for (hotel of hotels(); track hotel.id) {
                <li z-sidebar-menu-item>
                  <a
                    z-sidebar-menu-button
                    [routerLink]="['/', hotel.id]"
                    [zActive]="current() === hotel.id"
                    [zTooltip]="hotel.name"
                  >
                    <ng-icon name="lucideHotel" />
                    <span>{{ hotel.name }}</span>
                  </a>
                  <z-sidebar-menu-badge>{{ hotel.rooms }}</z-sidebar-menu-badge>
                </li>
              } @empty {
                @for (placeholder of [1, 2, 3]; track placeholder) {
                  <li z-sidebar-menu-item>
                    <z-sidebar-menu-skeleton zShowIcon />
                  </li>
                }
              }
            </ul>
          </div>
        </div>
      </z-sidebar-content>

      <div z-sidebar-footer>
        <p class="text-muted-foreground px-2 text-xs">Date sintetice · ziua de business 5 nov. 2026</p>
      </div>
    </z-sidebar>
  `,
})
export class HotelSidebar {
  readonly hotels = input<readonly Hotel[]>([]);
  readonly current = input('all');
}
