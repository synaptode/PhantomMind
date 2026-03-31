import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { DASHBOARD_API, DASHBOARD_CONFIG } from './dashboard.tokens';
import { HttpDashboardApi } from './dashboard.http-api';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    {
      provide: DASHBOARD_CONFIG,
      useValue: {
        apiBaseUrl: '',
        refreshMs: 5000,
        auditLimit: 12,
        defaultPeriod: 'today',
      },
    },
    {
      provide: DASHBOARD_API,
      useClass: HttpDashboardApi,
    },
  ],
};
