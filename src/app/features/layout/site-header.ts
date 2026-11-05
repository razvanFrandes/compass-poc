import { Component, computed, inject, input } from '@angular/core';

import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMoon, lucideSun } from '@ng-icons/lucide';

import { ZardBadgeComponent } from '@/shared/components/badge/badge.component';
import { ZardButtonComponent } from '@/shared/components/button/button.component';
import { ZardSeparatorComponent } from '@/shared/components/separator/separator.component';
import { ZardSidebarImports } from '@/shared/components/sidebar/sidebar.imports';
import { EDarkModes, ZardDarkMode } from '@/shared/services/dark-mode';

/** The site header from the dashboard-01 block: sidebar trigger, page title, AI status and theme toggle. */
@Component({
  selector: 'app-site-header',
  imports: [...ZardSidebarImports, ZardSeparatorComponent, ZardButtonComponent, ZardBadgeComponent, NgIcon],
  viewProviders: [provideIcons({ lucideMoon, lucideSun })],
  host: { class: 'contents' },
  template: `
    <header
      class="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)"
    >
      <div class="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <button z-sidebar-trigger class="-ml-1" aria-label="Arată sau ascunde meniul"></button>

        <z-separator
          zOrientation="vertical"
          class="mx-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
        />

        <h1 class="text-base font-medium">{{ title() }}</h1>

        <div class="ml-auto flex items-center gap-2">
          @if (aiMode(); as mode) {
            <z-badge [zType]="mode === 'claude' ? 'secondary' : 'outline'">
              {{ mode === 'claude' ? 'AI: Claude Code' : 'AI: mod demo' }}
            </z-badge>
          }
          <button
            z-button
            zType="ghost"
            zSize="icon"
            (click)="toggleTheme()"
            [attr.aria-label]="isDark() ? 'Comută pe tema luminoasă' : 'Comută pe tema întunecată'"
          >
            <ng-icon [name]="isDark() ? 'lucideSun' : 'lucideMoon'" />
          </button>
        </div>
      </div>
    </header>
  `,
})
export class SiteHeader {
  readonly title = input.required<string>();
  readonly aiMode = input<'claude' | 'mock'>();

  private readonly darkMode = inject(ZardDarkMode);
  protected readonly isDark = computed(() => this.darkMode.themeMode() === EDarkModes.DARK);

  protected toggleTheme(): void {
    this.darkMode.toggleTheme(this.isDark() ? EDarkModes.LIGHT : EDarkModes.DARK);
  }
}
