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
      return JSON.parse(stored);
    }
    // Si no hay datos guardados, inicializar con valores por defecto y guardarlos
    const defaultExtras = this.getDefaultExtras();
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(defaultExtras));
    return defaultExtras;
  }

  getDefaultExtras(): ExtraAvailability[] {
    return [
      { id: 'addon-queso', name: 'Queso extra', price: 2000, available: true },
      { id: 'addon-tocino', name: 'Tocino extra', price: 3000, available: true },
      { id: 'addon-huevo', name: 'Huevo extra', price: 1500, available: true },
      { id: 'addon-aguacate', name: 'Aguacate extra', price: 2000, available: true },
      { id: 'addon-papa', name: 'Papas extra', price: 3000, available: true },
      { id: 'addon-carne', name: 'Carne extra', price: 5000, available: true },
      { id: 'addon-pollo', name: 'Pollo extra', price: 4000, available: true },
      { id: 'addon-cebolla', name: 'Cebolla extra', price: 1000, available: true },
      { id: 'addon-tomate', name: 'Tomate extra', price: 1000, available: true },
      { id: 'addon-lechuga', name: 'Lechuga extra', price: 1000, available: true },
      { id: 'addon-salsa', name: 'Salsa extra', price: 1500, available: true },
      { id: 'addon-mayonesa', name: 'Mayonesa extra', price: 1000, available: true },
      { id: 'addon-mostaza', name: 'Mostaza extra', price: 1000, available: true },
      { id: 'addon-pepinillos', name: 'Pepinillos extra', price: 1500, available: true },
      { id: 'addon-pescado', name: 'Pescado extra', price: 6000, available: true },
      { id: 'addon-mariscos', name: 'Mariscos extra', price: 7000, available: true },
      { id: 'addon-frijoles', name: 'Frijoles extra', price: 2000, available: true },
      { id: 'addon-arroz', name: 'Arroz extra', price: 2000, available: true },
      { id: 'addon-plátano', name: 'Plátano extra', price: 2000, available: true }
    ];
  }

  isExtraAvailable(extraId: string): boolean {
    // Leer directamente desde localStorage para asegurar datos frescos
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const extras: ExtraAvailability[] = JSON.parse(stored);
        const extra = extras.find(e => e.id === extraId);
        // Solo devolver true si existe Y está explícitamente disponible
        return extra ? extra.available === true : false;
      } catch (e) {
        console.error('Error parsing extras from localStorage:', e);
        return false;
      }
    }
    // Si no hay datos guardados, inicializar con valores por defecto
    const defaultExtras = this.getDefaultExtras();
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(defaultExtras));
    const defaultExtra = defaultExtras.find(e => e.id === extraId);
    return defaultExtra ? defaultExtra.available === true : false;
  }

  getExtraPrice(extraId: string): number {
    const extras = this.getAllExtras();
    const extra = extras.find(e => e.id === extraId);
    if (extra) {
      return extra.price;
    }
    // Si no existe en el servicio, verificar si existe en los valores por defecto
    const defaultExtras = this.getDefaultExtras();
    const defaultExtra = defaultExtras.find(e => e.id === extraId);
    return defaultExtra ? defaultExtra.price : 0;
  }

  updateExtraAvailability(extraId: string, available: boolean): void {
    // Leer directamente desde localStorage para asegurar datos frescos
    const stored = localStorage.getItem(this.STORAGE_KEY);
    let extras: ExtraAvailability[];
    
    if (stored) {
      try {
        extras = JSON.parse(stored);
      } catch (e) {
        console.error('Error parsing extras from localStorage:', e);
        extras = this.getDefaultExtras();
      }
    } else {
      extras = this.getDefaultExtras();
    }
    
    const index = extras.findIndex(e => e.id === extraId);
    if (index !== -1) {
      extras[index].available = available;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(extras));
    } else {
      // Si no existe, buscar en los valores por defecto y agregarlo
      const defaultExtras = this.getDefaultExtras();
      const defaultExtra = defaultExtras.find(e => e.id === extraId);
      if (defaultExtra) {
        extras.push({ ...defaultExtra, available });
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(extras));
      }
    }
  }

  updateAllExtras(extras: ExtraAvailability[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(extras));
  }

  resetToDefaults(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.getDefaultExtras()));
  }

  createExtra(extra: Omit<ExtraAvailability, 'id'>): ExtraAvailability {
    const newExtra: ExtraAvailability = {
      id: `addon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...extra
    };
    const extras = this.getAllExtras();
    extras.push(newExtra);
    this.updateAllExtras(extras);
    return newExtra;
  }

  updateExtra(extraId: string, updates: Partial<ExtraAvailability>): void {
    const extras = this.getAllExtras();
    const index = extras.findIndex(e => e.id === extraId);
    if (index !== -1) {
      extras[index] = { ...extras[index], ...updates };
      this.updateAllExtras(extras);
    } else {
      // Si no existe, buscar en los valores por defecto y agregarlo con las actualizaciones
      const defaultExtras = this.getDefaultExtras();
      const defaultExtra = defaultExtras.find(e => e.id === extraId);
      if (defaultExtra) {
        extras.push({ ...defaultExtra, ...updates });
        this.updateAllExtras(extras);
      }
    }
  }

  deleteExtra(extraId: string): void {
    const extras = this.getAllExtras();
    const filtered = extras.filter(e => e.id !== extraId);
    this.updateAllExtras(filtered);
  }

  getExtraById(extraId: string): ExtraAvailability | undefined {
    // Leer directamente desde localStorage para asegurar datos frescos
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
    // Si no hay datos guardados, inicializar con valores por defecto
    const defaultExtras = this.getDefaultExtras();
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(defaultExtras));
    return defaultExtras.find(e => e.id === extraId);
  }
}

