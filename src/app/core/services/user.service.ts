import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { UserProfile } from '../models/UserProfile';
import { Order } from '../models/Order';
import { OrderItem } from '../models/OrderItem';
import { Address } from '../models/Address';
import { PaymentMethod } from '../models/PaymentMethod';
export { Order, OrderItem, Address, PaymentMethod };
@Injectable({
  providedIn: 'root'
})

export class UserService {
  private userProfileSubject = new BehaviorSubject<UserProfile | null>(null);
  userProfile$ = this.userProfileSubject.asObservable();

  constructor() {
    this.loadUserProfile();

    const userInfoStr = localStorage.getItem('userInfo');
    if (userInfoStr) {
      try {
        const userInfo = JSON.parse(userInfoStr);
        if (userInfo) {
          this.loadUserProfile();
        }
      } catch (e) {
        console.error('Error al verificar userInfo en constructor:', e);
      }
    }

    window.addEventListener('userInfoUpdated', () => {
      this.loadUserProfile();
    });

    window.addEventListener('storage', (e) => {
      if (e.key === 'userInfo' && e.newValue) {
        this.loadUserProfile();
      }
    });
  }

  private loadUserProfile(): void {
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) {
      this.userProfileSubject.next(null);
      return;
    }

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      const storedProfile = localStorage.getItem(`userProfile_${userId}`);
      if (storedProfile) {
        const profile = JSON.parse(storedProfile);
        profile.memberSince = new Date(profile.memberSince);
        // Validar que el perfil pertenezca al usuario actual
        if (profile.email === userInfo.email || profile.id === userId) {
          // Asegurar que la fecha de registro se preserve desde localStorage
          const savedDateStr = localStorage.getItem(`userRegistrationDate_${userId}`) ||
                               localStorage.getItem(`userRegistrationDate_${userInfo.email}`);
          if (savedDateStr) {
            try {
              const savedDate = new Date(savedDateStr);
              if (!isNaN(savedDate.getTime())) {
                profile.memberSince = savedDate;
              }
            } catch (e) {
              console.error('Error al actualizar fecha de registro en perfil guardado:', e);
            }
          }

          this.userProfileSubject.next(profile);
          return;
        }
      }

      // Obtener fecha de registro guardada
      let registrationDate: Date = new Date(); // Por defecto fecha actual
      const savedDateStr = localStorage.getItem(`userRegistrationDate_${userId}`) ||
                           localStorage.getItem(`userRegistrationDate_${userInfo.email}`);

      if (savedDateStr) {
        try {
          registrationDate = new Date(savedDateStr);
          // Validar que la fecha sea válida
          if (isNaN(registrationDate.getTime())) {
            registrationDate = new Date();
          }
        } catch (e) {
          console.error('Error al parsear fecha de registro:', e);
          registrationDate = new Date();
        }
      } else {
        // Si no hay fecha guardada, guardar la fecha actual como fecha de registro
        localStorage.setItem(`userRegistrationDate_${userId}`, registrationDate.toISOString());
        localStorage.setItem(`userRegistrationDate_${userInfo.email}`, registrationDate.toISOString());
      }

      // Si no hay perfil guardado, crear uno por defecto con datos del token
      const defaultProfile: UserProfile = {
        id: userId,
        fullName: userInfo.name || 'Usuario',
        email: userInfo.email || '',
        phone: localStorage.getItem('userPhone') || '',
        memberSince: registrationDate, // Usar la fecha de registro guardada
        preferences: {
          notifications: true,
          emailNotifications: true,
          smsNotifications: false,
          favoriteCategories: []
        }
      };
      this.saveUserProfile(defaultProfile);
      this.userProfileSubject.next(defaultProfile);
    } catch (e) {
      console.error('Error al cargar perfil del usuario:', e);
      this.userProfileSubject.next(null);
    }
  }

  getUserProfile(): Observable<UserProfile | null> {
    return this.userProfile$;
  }

  /**
   * Inicializa el perfil del usuario en el servicio
   * Útil cuando el componente tiene datos del perfil que aún no están en el servicio
   */
  initializeUserProfile(profile: UserProfile): void {
    this.saveUserProfile(profile);
    this.userProfileSubject.next(profile);
  }

  updateUserProfile(updates: Partial<UserProfile>): void {
    let currentProfile = this.userProfileSubject.value;

    // Si no existe un perfil, crear uno nuevo con los datos proporcionados
    if (!currentProfile) {
      const userInfoStr = localStorage.getItem('userInfo');
      let userId: string | null = null;
      let registrationDate: Date = new Date();

      if (userInfoStr) {
        try {
          const userInfo = JSON.parse(userInfoStr);
          userId = userInfo.userId || userInfo.email;
          // Intentar obtener fecha de registro guardada
          const savedDateStr = localStorage.getItem(`userRegistrationDate_${userId}`) ||
                               localStorage.getItem(`userRegistrationDate_${userInfo.email}`);
          if (savedDateStr) {
            try {
              registrationDate = new Date(savedDateStr);
              if (isNaN(registrationDate.getTime())) {
                registrationDate = new Date();
              }
            } catch (e) {
              registrationDate = new Date();
            }
          }
        } catch (e) {
          console.error('Error al obtener userId:', e);
        }
      }

      const userName = localStorage.getItem('userInfo');
      const userEmail = localStorage.getItem('userEmail');
      const userPhone = localStorage.getItem('userPhone');

      currentProfile = {
        id: userId || 'user_' + Date.now(),
        fullName: updates.fullName || userName || 'Usuario',
        email: updates.email || userEmail || '',
        phone: updates.phone || userPhone || '',
        memberSince: registrationDate, // Usar la fecha de registro guardada
        preferences: {
          notifications: true,
          emailNotifications: true,
          smsNotifications: false,
          favoriteCategories: []
        }
      };
    }

    // Actualizar el perfil con los nuevos datos, pero preservar la fecha de registro original
    const updatedProfile = {
      ...currentProfile,
      ...updates,
      memberSince: currentProfile.memberSince // Preservar la fecha de registro original
    };
    this.saveUserProfile(updatedProfile);
    this.userProfileSubject.next(updatedProfile);
  }

  private saveUserProfile(profile: UserProfile): void {
    const userInfoStr = localStorage.getItem('userInfo');
    let userId: string | null = null;

    if (userInfoStr) {
      try {
        const userInfo = JSON.parse(userInfoStr);
        userId = userInfo.userId || userInfo.email || profile.id;
      } catch (e) {
        console.error('Error al obtener userId:', e);
      }
    }

    if (userId) {
      // Guardar perfil asociado al userId del usuario actual
      localStorage.setItem(`userProfile_${userId}`, JSON.stringify(profile));
    } else {
      // Fallback: guardar sin userId (compatibilidad)
      localStorage.setItem('userProfile', JSON.stringify(profile));
    }
  }

  getOrders(): Observable<Order[]> {
    // Obtener el userId del usuario actual
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) {
      return of([]);
    }

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      const storedOrders = localStorage.getItem(`userOrders_${userId}`);
      if (storedOrders) {
        const orders = JSON.parse(storedOrders);
        orders.forEach((order: any) => {
          order.date = new Date(order.date);
          if (order.estimatedDeliveryTime) {
            order.estimatedDeliveryTime = new Date(order.estimatedDeliveryTime);
          }
          if (order.statusHistory) {
            order.statusHistory.forEach((update: any) => {
              update.timestamp = new Date(update.timestamp);
            });
          }

          // Valores por defecto para pedidos antiguos que no tienen estas propiedades
          if (order.subtotal === undefined) {
            // Calcular subtotal desde los items si no existe
            order.subtotal = order.items.reduce((sum: number, item: OrderItem) =>
              sum + (item.price * item.quantity), 0);
          }
          if (order.additionalFees === undefined) {
            order.additionalFees = 0;
          }
          if (order.orderType === undefined) {
            // Si tiene dirección, asumimos que es delivery, sino pickup
            order.orderType = order.deliveryAddress ? 'delivery' : 'pickup';
          }
          if (order.paymentMethod === undefined) {
            order.paymentMethod = 'cash'; // Valor por defecto
          }

          // Verificar si puede cancelarse (primeros 5 minutos)
          if (order.canCancel !== undefined && order.date) {
            const now = new Date();
            const orderTime = new Date(order.date);
            const minutesDiff = (now.getTime() - orderTime.getTime()) / (1000 * 60);
            order.canCancel = minutesDiff <= 5 && order.status === 'pending';
          }
        });
        return of(orders);
      }
    } catch (e) {
      console.error('Error al obtener pedidos:', e);
    }

    return of([]);
  }

  saveOrder(order: Order): void {
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) return;

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      this.getOrders().subscribe(orders => {
        const updatedOrders = [order, ...orders];
        localStorage.setItem(`userOrders_${userId}`, JSON.stringify(updatedOrders));
      });
    } catch (e) {
      console.error('Error al guardar pedido:', e);
    }
  }

  updateOrderStatus(orderId: string, newStatus: Order['status'], message?: string): void {
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) return;

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      this.getOrders().subscribe(orders => {
        const orderIndex = orders.findIndex(o => o.id === orderId);
        if (orderIndex !== -1) {
          const order = orders[orderIndex];
          order.status = newStatus;

          // Agregar al historial
          if (!order.statusHistory) {
            order.statusHistory = [];
          }
          order.statusHistory.push({
            status: newStatus,
            timestamp: new Date(),
            message: message
          });

          // Actualizar canCancel
          if (newStatus !== 'pending' && newStatus !== 'cancelled') {
            order.canCancel = false;
          }

          localStorage.setItem(`userOrders_${userId}`, JSON.stringify(orders));
        }
      });
    } catch (e) {
      console.error('Error al actualizar estado del pedido:', e);
    }
  }

  cancelOrder(orderId: string): Observable<boolean> {
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) {
      return of(false);
    }

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      return this.getOrders().pipe(
        map(orders => {
          const orderIndex = orders.findIndex(o => o.id === orderId);
          if (orderIndex !== -1) {
            const order = orders[orderIndex];
            if (order.canCancel && order.status === 'pending') {
              order.status = 'cancelled';
              if (!order.statusHistory) {
                order.statusHistory = [];
              }
              order.statusHistory.push({
                status: 'cancelled',
                timestamp: new Date(),
                message: 'Pedido cancelado por el cliente'
              });
              order.canCancel = false;

              localStorage.setItem(`userOrders_${userId}`, JSON.stringify(orders));
              return true;
            }
          }
          return false;
        })
      );
    } catch (e) {
      console.error('Error al cancelar pedido:', e);
      return of(false);
    }
  }

  getAddresses(): Observable<Address[]> {
    // Obtener el userId del usuario actual
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) {
      return of([]);
    }

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      // Retornar direcciones asociadas al usuario actual
      const storedAddresses = localStorage.getItem(`userAddresses_${userId}`);
      if (storedAddresses) {
        return of(JSON.parse(storedAddresses));
      }
    } catch (e) {
      console.error('Error al obtener direcciones del usuario:', e);
    }

    return of([]);
  }

  saveAddress(address: Address): void {
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) return;

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      this.getAddresses().subscribe(addresses => {
        const updatedAddresses = [...addresses, address];
        localStorage.setItem(`userAddresses_${userId}`, JSON.stringify(updatedAddresses));
      });
    } catch (e) {
      console.error('Error al guardar dirección:', e);
    }
  }

  updateAddress(address: Address): void {
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) return;

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      this.getAddresses().subscribe(addresses => {
        const index = addresses.findIndex(a => a.id === address.id);
        if (index !== -1) {
          addresses[index] = address;
          localStorage.setItem(`userAddresses_${userId}`, JSON.stringify(addresses));
        }
      });
    } catch (e) {
      console.error('Error al actualizar dirección:', e);
    }
  }

  getPaymentMethods(): Observable<PaymentMethod[]> {
    // Obtener el userId del usuario actual
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) {
      return of([]);
    }

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      // Retornar métodos de pago asociados al usuario actual
      const storedMethods = localStorage.getItem(`userPaymentMethods_${userId}`);
      if (storedMethods) {
        return of(JSON.parse(storedMethods));
      }
    } catch (e) {
      console.error('Error al obtener métodos de pago:', e);
    }

    return of([]);
  }

  savePaymentMethod(method: PaymentMethod): void {
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) return;

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      this.getPaymentMethods().subscribe(methods => {
        // Si se marca como principal, quitar el estado de los demás
        if (method.isDefault) {
          methods = methods.map(m => ({ ...m, isDefault: false }));
        }

        const updatedMethods = [...methods, method];
        localStorage.setItem(`userPaymentMethods_${userId}`, JSON.stringify(updatedMethods));
      });
    } catch (e) {
      console.error('Error al guardar método de pago:', e);
    }
  }

  updatePaymentMethod(method: PaymentMethod): void {
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) return;

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      this.getPaymentMethods().subscribe(methods => {
        // Si se marca como principal, quitar el estado de los demás
        if (method.isDefault) {
          methods = methods.map(m => m.id !== method.id ? { ...m, isDefault: false } : m);
        }

        const index = methods.findIndex(m => m.id === method.id);
        if (index !== -1) {
          methods[index] = method;
          localStorage.setItem(`userPaymentMethods_${userId}`, JSON.stringify(methods));
        }
      });
    } catch (e) {
      console.error('Error al actualizar método de pago:', e);
    }
  }

  deletePaymentMethod(methodId: string): void {
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) return;

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      this.getPaymentMethods().subscribe(methods => {
        const updatedMethods = methods.filter(m => m.id !== methodId);
        localStorage.setItem(`userPaymentMethods_${userId}`, JSON.stringify(updatedMethods));
      });
    } catch (e) {
      console.error('Error al eliminar método de pago:', e);
    }
  }

  private generateId(): string {
    return 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  getFavoriteDishes(): Observable<(number | string)[]> {
    // Obtener el userId del usuario actual desde localStorage
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) {
      return of([]);
    }

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email; // Usar userId o email como identificador

      // Retornar IDs de platos favoritos asociados al usuario actual
      const storedFavorites = localStorage.getItem(`userFavoriteDishes_${userId}`);
      if (storedFavorites) {
        return of(JSON.parse(storedFavorites));
      }
    } catch (e) {
      console.error('Error al obtener favoritos del usuario:', e);
    }

    return of([]);
  }

  addFavoriteDish(dishId: number | string): void {
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) return;

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      this.getFavoriteDishes().subscribe(favorites => {
        if (!favorites.includes(dishId)) {
          const updatedFavorites = [...favorites, dishId];
          localStorage.setItem(`userFavoriteDishes_${userId}`, JSON.stringify(updatedFavorites));
          // Disparar evento personalizado para notificar cambios
          window.dispatchEvent(new CustomEvent('favoritesChanged'));
        }
      });
    } catch (e) {
      console.error('Error al agregar favorito:', e);
    }
  }

  removeFavoriteDish(dishId: number | string): void {
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) return;

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      this.getFavoriteDishes().subscribe(favorites => {
        const updatedFavorites = favorites.filter(id => id !== dishId);
        localStorage.setItem(`userFavoriteDishes_${userId}`, JSON.stringify(updatedFavorites));
        // Disparar evento personalizado para notificar cambios
        window.dispatchEvent(new CustomEvent('favoritesChanged'));
      });
    } catch (e) {
      console.error('Error al eliminar favorito:', e);
    }
  }

  /**
   * Verifica si un plato está en la lista de favoritos del usuario
   * @param dishId ID del plato a verificar
   * @returns Observable que emite true si el plato es favorito, false en caso contrario
   */
  isFavorite(dishId: number | string): Observable<boolean> {
    return this.getFavoriteDishes().pipe(
      map((favorites: (number | string)[]) => favorites.includes(dishId))
    );
  }

  toggleFavorite(dishId: number | string): void {
    this.getFavoriteDishes().subscribe(favorites => {
      if (favorites.includes(dishId)) {
        this.removeFavoriteDish(dishId);
      } else {
        this.addFavoriteDish(dishId);
      }
    });
  }
  reloadUserProfile(): void {
    this.loadUserProfile();
  }
}
