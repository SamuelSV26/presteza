import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  avatar?: string;
  memberSince: Date;
  preferences: UserPreferences;
}

export interface UserPreferences {
  notifications: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  favoriteCategories: string[];
}

export interface Order {
  id: string;
  date: Date;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  deliveryAddress?: string;
}

export interface OrderItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

export interface Address {
  id: string;
  title: string;
  address: string;
  city: string;
  postalCode: string;
  isDefault: boolean;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'cash';
  last4?: string;
  brand?: string;
  isDefault: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private userProfileSubject = new BehaviorSubject<UserProfile | null>(null);
  userProfile$ = this.userProfileSubject.asObservable();

  constructor() {
    this.loadUserProfile();
  }

  private loadUserProfile(): void {
    const userName = localStorage.getItem('userName');
    if (userName) {
      // Cargar perfil desde localStorage o crear uno por defecto
      const storedProfile = localStorage.getItem('userProfile');
      if (storedProfile) {
        const profile = JSON.parse(storedProfile);
        profile.memberSince = new Date(profile.memberSince);
        this.userProfileSubject.next(profile);
      } else {
        // Crear perfil por defecto
        const defaultProfile: UserProfile = {
          id: this.generateId(),
          fullName: userName,
          email: localStorage.getItem('userEmail') || `${userName}@email.com`,
          phone: localStorage.getItem('userPhone') || '',
          memberSince: new Date(),
          preferences: {
            notifications: true,
            emailNotifications: true,
            smsNotifications: false,
            favoriteCategories: []
          }
        };
        this.saveUserProfile(defaultProfile);
        this.userProfileSubject.next(defaultProfile);
      }
    }
  }

  getUserProfile(): Observable<UserProfile | null> {
    return this.userProfile$;
  }

  updateUserProfile(updates: Partial<UserProfile>): void {
    const currentProfile = this.userProfileSubject.value;
    if (currentProfile) {
      const updatedProfile = { ...currentProfile, ...updates };
      this.saveUserProfile(updatedProfile);
      this.userProfileSubject.next(updatedProfile);
    }
  }

  private saveUserProfile(profile: UserProfile): void {
    localStorage.setItem('userProfile', JSON.stringify(profile));
    localStorage.setItem('userName', profile.fullName);
    if (profile.email) {
      localStorage.setItem('userEmail', profile.email);
    }
    if (profile.phone) {
      localStorage.setItem('userPhone', profile.phone);
    }
  }

  getOrders(): Observable<Order[]> {
    // Simular historial de pedidos
    const storedOrders = localStorage.getItem('userOrders');
    if (storedOrders) {
      const orders = JSON.parse(storedOrders);
      orders.forEach((order: any) => {
        order.date = new Date(order.date);
      });
      return of(orders);
    }
    return of([]);
  }

  saveOrder(order: Order): void {
    this.getOrders().subscribe(orders => {
      const updatedOrders = [order, ...orders];
      localStorage.setItem('userOrders', JSON.stringify(updatedOrders));
    });
  }

  getAddresses(): Observable<Address[]> {
    const storedAddresses = localStorage.getItem('userAddresses');
    if (storedAddresses) {
      return of(JSON.parse(storedAddresses));
    }
    return of([]);
  }

  saveAddress(address: Address): void {
    this.getAddresses().subscribe(addresses => {
      const updatedAddresses = [...addresses, address];
      localStorage.setItem('userAddresses', JSON.stringify(updatedAddresses));
    });
  }

  updateAddress(address: Address): void {
    this.getAddresses().subscribe(addresses => {
      const index = addresses.findIndex(a => a.id === address.id);
      if (index !== -1) {
        addresses[index] = address;
        localStorage.setItem('userAddresses', JSON.stringify(addresses));
      }
    });
  }

  getPaymentMethods(): Observable<PaymentMethod[]> {
    const storedMethods = localStorage.getItem('userPaymentMethods');
    if (storedMethods) {
      return of(JSON.parse(storedMethods));
    }
    return of([]);
  }

  savePaymentMethod(method: PaymentMethod): void {
    this.getPaymentMethods().subscribe(methods => {
      const updatedMethods = [...methods, method];
      localStorage.setItem('userPaymentMethods', JSON.stringify(updatedMethods));
    });
  }

  private generateId(): string {
    return 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  getFavoriteDishes(): Observable<number[]> {
    // Retornar IDs de platos favoritos
    const storedFavorites = localStorage.getItem('userFavoriteDishes');
    if (storedFavorites) {
      return of(JSON.parse(storedFavorites));
    }
    return of([]);
  }

  addFavoriteDish(dishId: number): void {
    this.getFavoriteDishes().subscribe(favorites => {
      if (!favorites.includes(dishId)) {
        const updatedFavorites = [...favorites, dishId];
        localStorage.setItem('userFavoriteDishes', JSON.stringify(updatedFavorites));
      }
    });
  }

  removeFavoriteDish(dishId: number): void {
    this.getFavoriteDishes().subscribe(favorites => {
      const updatedFavorites = favorites.filter(id => id !== dishId);
      localStorage.setItem('userFavoriteDishes', JSON.stringify(updatedFavorites));
    });
  }

  /**
   * Verifica si un plato está en la lista de favoritos del usuario
   * @param dishId ID del plato a verificar
   * @returns Observable que emite true si el plato es favorito, false en caso contrario
   */
  isFavorite(dishId: number): Observable<boolean> {
    return this.getFavoriteDishes().pipe(
      map((favorites: number[]) => favorites.includes(dishId))
    );
  }

  toggleFavorite(dishId: number): void {
    this.getFavoriteDishes().subscribe(favorites => {
      if (favorites.includes(dishId)) {
        this.removeFavoriteDish(dishId);
      } else {
        this.addFavoriteDish(dishId);
      }
    });
  }

  logout(): void {
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userPhone');
    localStorage.removeItem('userProfile');
    this.userProfileSubject.next(null);
  }
}
