import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch } from '@angular/common/http';
import localeRo from '@angular/common/locales/ro';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { provideZardCharts } from '@/shared/components/chart/chart-echarts.provider';
import { provideZard } from '@/shared/core/provider/providezard';

import { routes } from './app.routes';

// Number, currency and date pipes format the Romanian way: 1.234,5 · 99,31 € · joi, 5 nov.
registerLocaleData(localeRo);

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'ro' },
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch()),
    provideRouter(routes, withComponentInputBinding()),
    provideZard(),
    provideZardCharts(),
  ],
};
