import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { AuditEntry, CostPeriod, CostReport, DashboardMetrics } from '@phantomind/contracts';
import { DASHBOARD_CONFIG, type DashboardApi } from './dashboard.tokens';
import { DashboardAuthService } from './dashboard.auth';

@Injectable()
export class HttpDashboardApi implements DashboardApi {
  private http = inject(HttpClient);
  private config = inject(DASHBOARD_CONFIG);
  private auth = inject(DashboardAuthService);

  getMetrics(period: CostPeriod): Promise<DashboardMetrics> {
    return firstValueFrom(
      this.http.get<DashboardMetrics>(`${this.baseUrl()}/api/metrics`, {
        params: { period },
        headers: this.buildHeaders(),
      }),
    );
  }

  getAudit(limit: number): Promise<AuditEntry[]> {
    return firstValueFrom(
      this.http.get<AuditEntry[]>(`${this.baseUrl()}/api/audit`, {
        params: { limit: String(limit) },
        headers: this.buildHeaders(),
      }),
    );
  }

  getCosts(period: CostPeriod): Promise<CostReport> {
    return firstValueFrom(
      this.http.get<CostReport>(`${this.baseUrl()}/api/costs`, {
        params: { period },
        headers: this.buildHeaders(),
      }),
    );
  }

  private baseUrl(): string {
    return this.config.apiBaseUrl.replace(/\/$/, '');
  }

  private buildHeaders(): Record<string, string> | undefined {
    const token = this.auth.token();
    if (!token) return undefined;
    return { Authorization: `Bearer ${token}` };
  }
}
