import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input } from '@angular/core';

import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';

import { ZardButtonComponent } from '@/shared/components/button/button.component';
import { ZardCardImports } from '@/shared/components/card/card.imports';
import { ZardEmptyComponent } from '@/shared/components/empty/empty.component';
import { ZardSidebarImports } from '@/shared/components/sidebar/sidebar.imports';
import { ZardSkeletonComponent } from '@/shared/components/skeleton/skeleton.component';

import type { Dashboard, Health, Hotel } from '../../core/compass-api';
import { AiWidget } from '../assistant/ai-widget';
import { AssistantPanel } from '../assistant/assistant-panel';
import { PinnedWidgets } from '../assistant/pinned-widgets';
import { HotelSidebar } from '../layout/hotel-sidebar';
import { SiteHeader } from '../layout/site-header';
import { KpiCards } from './kpi-cards';
import { RevparChart } from './revpar-chart';
import { UpcomingTable } from './upcoming-table';

/** The dashboard-01 block layout: hotel sidebar, KPI cards, RevPAR chart, next nights and the assistant. */
@Component({
  selector: 'app-dashboard-page',
  imports: [
    ...ZardSidebarImports,
    ...ZardCardImports,
    ZardButtonComponent,
    ZardEmptyComponent,
    ZardSkeletonComponent,
    NgIcon,
    HotelSidebar,
    SiteHeader,
    KpiCards,
    RevparChart,
    UpcomingTable,
    AssistantPanel,
    AiWidget,
  ],
  viewProviders: [provideIcons({ lucideX })],
  templateUrl: './dashboard-page.html',
})
export default class DashboardPage {
  /** Route parameter `:hotel`: `all` or a hotel id. */
  readonly hotel = input.required<string>();

  protected readonly pinned = inject(PinnedWidgets);

  protected readonly hotels = httpResource<Hotel[]>(() => '/api/hotels', { defaultValue: [] });
  protected readonly health = httpResource<Health>(() => '/api/health');
  protected readonly dashboard = httpResource<Dashboard>(() => `/api/dashboard/${encodeURIComponent(this.hotel())}`);

  // A resource in error throws from value(), so the template and title read through these guards.
  protected readonly hotelList = computed(() => (this.hotels.hasValue() ? this.hotels.value() : []));
  protected readonly aiMode = computed(() => (this.health.hasValue() ? this.health.value().ai : undefined));

  protected readonly title = computed(() => {
    const id = this.hotel();
    if (id === 'all') return 'All hotels';
    return this.hotelList().find((h) => h.id === id)?.name ?? id;
  });
}
