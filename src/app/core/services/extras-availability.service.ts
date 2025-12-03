import { Injectable } from '@angular/core';

export interface ExtraAvailability {
  id: string;
  name: string;
  price: number;
  available: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ExtrasAvailabilityService {
  private readonly STORAGE_KEY = 'extras_availability';

  getAllExtras(): ExtraAvailability[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Error parsing extras from localStorage:', e);
        return this.initializeDefaults();
      }
    }
    return this.initializeDefaults();
  }

  isExtraAvailable(extraId: string): boolean {
    const extra = this.getExtraById(extraId);
    return extra ? extra.available === true : false;
  }

  getExtraPrice(extraId: string): number {
    const extra = this.getExtraById(extraId);
    return extra ? extra.price : 0;
  }

  getExtraById(extraId: string): ExtraAvailability | undefined {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const extras: ExtraAvailability[] = JSON.parse(stored);
        return extras.find(e => e.id === extraId);
      } catch (e) {
        console.error('Error parsing extras from localStorage:', e);
        return undefined;
      }
    }
    const defaultExtras = this.initializeDefaults();
    return defaultExtras.find(e => e.id === extraId);
  }

  updateExtraAvailability(extraId: string, available: boolean): void {
    const extras = this.getAllExtras();
    const index = extras.findIndex(e => e.id === extraId);

    if (index !== -1) {
      extras[index].available = available;
      this.saveExtras(extras);
    } else {
      const defaultExtra = this.getDefaultExtras().find(e => e.id === extraId);
      if (defaultExtra) {
        extras.push({ ...defaultExtra, available });
        this.saveExtras(extras);
      }
    }
  }

  updateAllExtras(extras: ExtraAvailability[]): void {
    this.saveExtras(extras);
  }

  updateExtra(extraId: string, updates: Partial<ExtraAvailability>): void {
    const extras = this.getAllExtras();
    const index = extras.findIndex(e => e.id === extraId);

    if (index !== -1) {
      extras[index] = { ...extras[index], ...updates };
      this.saveExtras(extras);
    } else {
      const defaultExtra = this.getDefaultExtras().find(e => e.id === extraId);
      if (defaultExtra) {
        extras.push({ ...defaultExtra, ...updates });
        this.saveExtras(extras);
      }
    }
  }

  createExtra(extra: Omit<ExtraAvailability, 'id'>): ExtraAvailability {
    const newExtra: ExtraAvailability = {
      id: this.generateExtraId(),
      ...extra
    };
    const extras = this.getAllExtras();
    extras.push(newExtra);
    this.saveExtras(extras);
    return newExtra;
  }

  deleteExtra(extraId: string): void {
    const extras = this.getAllExtras();
    const filtered = extras.filter(e => e.id !== extraId);
    this.saveExtras(filtered);
  }

  resetToDefaults(): void {
    this.saveExtras(this.getDefaultExtras());
  }

  private initializeDefaults(): ExtraAvailability[] {
    const defaultExtras = this.getDefaultExtras();
    this.saveExtras(defaultExtras);
    return defaultExtras;
  }

  private saveExtras(extras: ExtraAvailability[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(extras));
    } catch (e) {
      console.error('Error saving extras to localStorage:', e);
    }
  }

  private generateExtraId(): string {
    return `addon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDefaultExtras(): ExtraAvailability[] {
    return [];
  }
}
