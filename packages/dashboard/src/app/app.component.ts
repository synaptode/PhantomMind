import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgFor, NgIf, NgClass } from '@angular/common';
import { DashboardStore } from './dashboard.store';
import type { CostPeriod } from '@phantomind/contracts';
import { DashboardAuthService } from './dashboard.auth';
import { MetricCardComponent } from './metric-card.component';

@Component({
  selector: 'pm-root',
  standalone: true,
  imports: [NgFor, NgIf, NgClass, MetricCardComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  readonly store = inject(DashboardStore);
  readonly auth = inject(DashboardAuthService);
  readonly showTokenInput = signal(false);
  readonly tokenDraft = signal('');
  readonly periodOptions: Array<{ label: string; value: CostPeriod }> = [
    { label: 'Today', value: 'today' },
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
    { label: 'All', value: 'all' },
  ];

  readonly statusLabel = computed(() => {
    const state = this.store.state();
    if (state === 'loading') return 'Syncing';
    if (state === 'error') return 'Offline';
    return 'Live';
  });

  readonly statusHint = computed(() => {
    const updated = this.store.updatedAt();
    if (!updated) return 'Waiting for metrics';
    return `Updated ${updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  });

  readonly tokenStatus = computed(() => (this.auth.token() ? 'Token set' : 'Token not set'));

  constructor() {
    this.tokenDraft.set(this.auth.token() ?? '');
  }

  onRefresh(): void {
    void this.store.refresh();
  }

  onPeriodSelect(period: CostPeriod): void {
    this.store.setPeriod(period);
  }

  toggleTokenInput(): void {
    this.showTokenInput.set(!this.showTokenInput());
  }

  onTokenInput(value: string): void {
    this.tokenDraft.set(value);
  }

  saveToken(): void {
    this.auth.setToken(this.tokenDraft());
    void this.store.refresh();
  }

  clearToken(): void {
    this.auth.clearToken();
    this.tokenDraft.set('');
    void this.store.refresh();
  }

  trackByLabel(_: number, item: { label: string }): string {
    return item.label;
  }

  trackByString(_: number, item: string): string {
    return item;
  }

  trackById(_: number, item: { id: string }): string {
    return item.id;
  }
}
