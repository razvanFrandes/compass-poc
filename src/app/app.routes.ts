import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'all' },
  {
    // `all` or a hotel id (CLJ, BUC, BRV); bound to the page's `hotel` input.
    path: ':hotel',
    loadComponent: () => import('./features/dashboard/dashboard-page'),
  },
];
