import { Injectable, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DashboardAuthService {
  private platformId = inject(PLATFORM_ID);
  private storageKey = 'pm.dashboard.token';
  readonly token = signal<string | null>(this.readToken());

  setToken(value: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      localStorage.removeItem(this.storageKey);
      this.token.set(null);
      return;
    }
    localStorage.setItem(this.storageKey, trimmed);
    this.token.set(trimmed);
  }

  clearToken(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.removeItem(this.storageKey);
    this.token.set(null);
  }

  private readToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return localStorage.getItem(this.storageKey);
  }
}
