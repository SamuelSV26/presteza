import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { UserProfile } from '../models/UserProfile';
import { Order } from '../models/Order';
import { OrderItem } from '../models/OrderItem';
import { Address } from '../models/Address';
import { PaymentMethod } from '../models/PaymentMethod';
import { MenuItem } from '../models/MenuItem';
import { environment } from '../../../environments/environment';
import { ErrorHandlerService } from './error-handler.service';
export { Order, OrderItem, Address, PaymentMethod };
@Injectable({
  providedIn: 'root'
})

export class UserService {
  private userProfileSubject = new BehaviorSubject<UserProfile | null>(null);
  userProfile$ = this.userProfileSubject.asObservable();
  private apiUrl = `${environment.apiUrl}/users`;

  // Obtener todos los usuarios (solo para admins)
  getAllUsers(): Observable<any> {
    return this.http.get<any>(this.apiUrl).pipe(
      map((response: any) => {
        // Manejar diferentes formatos de respuesta del backend
        if (Array.isArray(response)) {
          return response;
        } else if (response && Array.isArray(response.users)) {
          return response.users;
        } else if (response && Array.isArray(response.data)) {
          return response.data;
        } else {
          console.warn('Formato de respuesta inesperado:', response);
          return [];
        }
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Error al obtener usuarios:', error);
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  constructor(
    private http: HttpClient,
    private errorHandler: ErrorHandlerService
  ) {
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

      const storedProfile = JSON.parse(localStorage.getItem(`userProfile_${userId}`) || 'null');
      if (storedProfile) {
        storedProfile.memberSince = new Date(storedProfile.memberSince);
        if (storedProfile.email === userInfo.email || storedProfile.id === userId) {
          const savedDateStr = storedProfile.memberSince;
          if (savedDateStr) {
            try {
              const savedDate = new Date(savedDateStr);
              if (!isNaN(savedDate.getTime())) {
                storedProfile.memberSince = savedDate;
              }
            } catch (e) {
              console.error('Error al actualizar fecha de registro en perfil guardado:', e);
            }
          }

          // Asegurar que el teléfono esté presente (buscar en userPhone si no está en el perfil)
          // Priorizar el teléfono del token sobre el del perfil guardado
          const phoneFromStorage = localStorage.getItem('userPhone');
          if (phoneFromStorage && (!storedProfile.phone || storedProfile.phone === '' || storedProfile.phone === 'No especificado')) {
            storedProfile.phone = phoneFromStorage;
            // Guardar el perfil actualizado con el teléfono
            localStorage.setItem(`userProfile_${userId}`, JSON.stringify(storedProfile));
          } else if (phoneFromStorage && storedProfile.phone !== phoneFromStorage) {
            // Si el teléfono del token es diferente, actualizarlo (el token es la fuente de verdad)
            storedProfile.phone = phoneFromStorage;
            localStorage.setItem(`userProfile_${userId}`, JSON.stringify(storedProfile));
          }

          this.userProfileSubject.next( storedProfile );
          return;
        }
      }

      // Obtener la fecha de registro: usar la fecha guardada si existe, nunca crear una nueva
      // La fecha de registro debe venir del backend (createdAt) cuando se obtiene el perfil
      let registrationDate: Date | null = null;
      if (storedProfile?.memberSince) {
        try {
          const parsedDate = new Date(storedProfile.memberSince);
          if (!isNaN(parsedDate.getTime())) {
            registrationDate = parsedDate; // Usar la fecha guardada si es válida
          }
        } catch (e) {
          console.error('Error al parsear fecha de registro:', e);
        }
      }

      // Si no hay fecha guardada, será null y se establecerá cuando se obtenga del backend
      // o cuando se cree el perfil por primera vez

      // Obtener el teléfono del token (prioridad sobre cualquier otro valor)
      const phoneFromToken = localStorage.getItem('userPhone') || '';
      
      const defaultProfile: UserProfile = {
        id: userId,
        fullName: userInfo.name || 'Usuario',
        email: userInfo.email || '',
        phone: phoneFromToken,
        memberSince: registrationDate || new Date(), // Usar fecha guardada o fecha actual (solo para usuarios nuevos)
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
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) {
      return this.userProfile$;
    }

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      if (!userId) {
        return this.userProfile$;
      }

      // Intentar obtener el perfil del backend usando el ID del usuario
      return this.http.get<any>(`${this.apiUrl}/${userId}`).pipe(
        map((response: any) => {
          // Obtener la fecha de registro: SIEMPRE usar createdAt del backend (fecha de registro real)
          // El backend debe tener createdAt con la fecha exacta de cuando se registró el usuario
          let registrationDate: Date;
          const storedProfile = JSON.parse(localStorage.getItem(`userProfile_${userId}`) || 'null');

          if (response.createdAt) {
            // PRIORIDAD 1: Usar la fecha de creación del backend (fecha exacta de registro)
            registrationDate = new Date(response.createdAt);
            if (isNaN(registrationDate.getTime())) {
              // Si la fecha del backend es inválida, intentar con la guardada
              if (storedProfile?.memberSince) {
                registrationDate = new Date(storedProfile.memberSince);
                if (isNaN(registrationDate.getTime())) {
                  registrationDate = new Date(); // Solo como último recurso
                }
              } else {
                registrationDate = new Date(); // Solo como último recurso
              }
            }
          } else if (storedProfile?.memberSince) {
            // PRIORIDAD 2: Usar la fecha guardada en localStorage (si el backend no tiene createdAt)
            registrationDate = new Date(storedProfile.memberSince);
            if (isNaN(registrationDate.getTime())) {
              registrationDate = new Date(); // Solo como último recurso
            }
          } else {
            // PRIORIDAD 3: Solo usar fecha actual si es un usuario completamente nuevo sin fecha previa
            // Esto solo debería pasar en casos excepcionales
            registrationDate = new Date();
          }

          // Mapear la respuesta del backend al formato UserProfile
          // Obtener el teléfono del backend con múltiples posibles campos
          const backendPhone = response.phone_number || response.phone || response.phoneNumber || response.telefono || '';
          // Si el backend no tiene teléfono, intentar obtenerlo de localStorage
          const phoneFromStorage = localStorage.getItem('userPhone') || '';
          // Priorizar el teléfono del backend, pero usar el de localStorage si el backend no lo tiene
          const finalPhone = backendPhone || phoneFromStorage;
          
          // SIEMPRE guardar el teléfono en localStorage si existe (para persistencia)
          if (finalPhone) {
            localStorage.setItem('userPhone', finalPhone);
          }

          const backendProfile: UserProfile = {
            id: response._id || response.id || userId,
            fullName: response.complete_name || response.fullName || response.name || userInfo.name || 'Usuario',
            email: response.email || userInfo.email || '',
            phone: finalPhone,
            memberSince: registrationDate, // SIEMPRE usar la fecha de registro original
            preferences: {
              notifications: response.preferences?.notifications ?? true,
              emailNotifications: response.preferences?.emailNotifications ?? true,
              smsNotifications: response.preferences?.smsNotifications ?? false,
              favoriteCategories: response.preferences?.favoriteCategories || []
            }
          };

          // Guardar en localStorage y actualizar el subject
          this.saveUserProfile(backendProfile);
          this.userProfileSubject.next(backendProfile);
          return backendProfile;
        }),
        catchError((error: HttpErrorResponse) => {
          // Si falla, usar el perfil del localStorage
          console.warn('No se pudo obtener el perfil del backend, usando perfil local:', error);

          // Obtener perfil del localStorage como fallback
          const storedProfile = JSON.parse(localStorage.getItem(`userProfile_${userId}`) || 'null');
          if (storedProfile && (storedProfile.email === userInfo.email || storedProfile.id === userId)) {
            // Preservar la fecha de registro original
            if (storedProfile.memberSince) {
              const savedDate = new Date(storedProfile.memberSince);
              storedProfile.memberSince = isNaN(savedDate.getTime()) ? new Date() : savedDate;
            } else {
              // Si no hay fecha guardada, usar la fecha actual (solo para usuarios nuevos)
              storedProfile.memberSince = new Date();
            }
            
            // Asegurar que el teléfono esté presente (buscar en userPhone si no está en el perfil)
            if (!storedProfile.phone || storedProfile.phone === '') {
              const phoneFromStorage = localStorage.getItem('userPhone');
              if (phoneFromStorage) {
                storedProfile.phone = phoneFromStorage;
                // Guardar el perfil actualizado con el teléfono
                localStorage.setItem(`userProfile_${userId}`, JSON.stringify(storedProfile));
              }
            }
            
            this.userProfileSubject.next(storedProfile);
            return of(storedProfile);
          }

          // Si no hay perfil guardado, usar el del subject o crear uno por defecto
          const currentProfile = this.userProfileSubject.value;
          if (currentProfile) {
            return of(currentProfile);
          }

          // Crear perfil por defecto (solo para usuarios nuevos sin perfil)
          const defaultProfile: UserProfile = {
            id: userId,
            fullName: userInfo.name || 'Usuario',
            email: userInfo.email || '',
            phone: localStorage.getItem('userPhone') || '',
            memberSince: new Date(), // Fecha de creación del perfil
            preferences: {
              notifications: true,
              emailNotifications: true,
              smsNotifications: false,
              favoriteCategories: []
            }
          };
          this.saveUserProfile(defaultProfile);
          this.userProfileSubject.next(defaultProfile);
          return of(defaultProfile);
        })
      );
    } catch (e) {
      console.error('Error al obtener perfil:', e);
      const currentProfile = this.userProfileSubject.value;
      return currentProfile ? of(currentProfile) : this.userProfile$;
    }
  }

  initializeUserProfile(profile: UserProfile): void {
    this.saveUserProfile(profile);
    this.userProfileSubject.next(profile);
  }

  updateUserProfile(updates: Partial<UserProfile>): Observable<UserProfile> {
    let currentProfile = this.userProfileSubject.value;

    if (!currentProfile) {
      const userInfoStr = localStorage.getItem('userInfo');
      let userId: string | null = null;
      let registrationDate: Date = new Date();

      if (userInfoStr) {
        try {
          const userInfo = JSON.parse(userInfoStr);
          userId = userInfo.userId || userInfo.email;
          const storedProfile = JSON.parse(localStorage.getItem(`userProfile_${userId}`) || 'null');
          if (storedProfile.memberSince) {
            try {
              registrationDate = new Date(storedProfile.memberSince);
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

      const user = JSON.parse(localStorage.getItem('userInfo') || 'null');
      currentProfile = {
        id: userId || 'user_' + Date.now(),
        fullName: updates.fullName || user?.name ,
        email: updates.email || user?.email || '',
        phone: updates.phone || user?.phone || '',
        memberSince: registrationDate,
        preferences: {
          notifications: true,
          emailNotifications: true,
          smsNotifications: false,
          favoriteCategories: []
        }
      };
    }

    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) {
      return throwError(() => new Error('No se encontró información del usuario'));
    }

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      if (!userId) {
        return throwError(() => new Error('ID de usuario no encontrado'));
      }

      // Preparar los datos para enviar al backend
      const updateData: any = {};
      if (updates.fullName) updateData.complete_name = updates.fullName;
      if (updates.email) updateData.email = updates.email;
      // IMPORTANTE: Siempre enviar phone_number si existe, incluso si es una cadena vacía
      if (updates.phone !== undefined && updates.phone !== null) {
        updateData.phone_number = updates.phone;
      }
      if (updates.preferences) updateData.preferences = updates.preferences;
      
      // Guardar el teléfono en localStorage ANTES de enviar al backend (para tenerlo disponible)
      if (updates.phone) {
        localStorage.setItem('userPhone', updates.phone);
      }

      // Hacer la petición al backend usando el ID del usuario
      return this.http.patch<any>(`${this.apiUrl}/${userId}`, updateData).pipe(
        map((response: any) => {
          // Mapear la respuesta del backend al formato UserProfile
          let currentProfile = this.userProfileSubject.value;

          // PRESERVAR SIEMPRE la fecha de registro original
          let registrationDate: Date;
          const storedProfile = JSON.parse(localStorage.getItem(`userProfile_${userId}`) || 'null');

          // Prioridad: 1) Fecha del perfil actual, 2) Fecha guardada en localStorage, 3) createdAt del backend, 4) Fecha actual (solo si es nuevo usuario)
          if (currentProfile?.memberSince) {
            registrationDate = new Date(currentProfile.memberSince);
          } else if (storedProfile?.memberSince) {
            registrationDate = new Date(storedProfile.memberSince);
            if (isNaN(registrationDate.getTime())) {
              // Si la fecha guardada es inválida, intentar usar createdAt del backend
              registrationDate = response.createdAt ? new Date(response.createdAt) : new Date();
            }
          } else if (response.createdAt) {
            registrationDate = new Date(response.createdAt);
          } else {
            registrationDate = new Date();
          }

          // Obtener el teléfono con prioridad: actualización > respuesta del backend > perfil actual > localStorage
          // IMPORTANTE: Si el usuario está actualizando, priorizar el teléfono que está enviando
          const updatePhone = updates.phone || '';
          const backendPhone = response.phone_number || response.phone || response.phoneNumber || response.telefono || '';
          const currentPhone = currentProfile?.phone || '';
          const storagePhone = localStorage.getItem('userPhone') || '';
          
          // Prioridad: update (lo que el usuario está enviando) > backend > current > storage
          // Si el usuario envió un teléfono, usarlo siempre (incluso si el backend no lo devuelve)
          const finalPhone = updatePhone || backendPhone || currentPhone || storagePhone;
          
          // SIEMPRE guardar el teléfono en localStorage si existe (para persistencia)
          // Priorizar el teléfono que el usuario está enviando
          if (updatePhone) {
            localStorage.setItem('userPhone', updatePhone);
          } else if (finalPhone) {
            localStorage.setItem('userPhone', finalPhone);
          }

          const updatedProfile: UserProfile = {
            id: response._id || response.id || userId,
            fullName: response.complete_name || response.fullName || response.name || updates.fullName || currentProfile?.fullName || 'Usuario',
            email: response.email || updates.email || currentProfile?.email || userInfo.email || '',
            phone: finalPhone,
            memberSince: registrationDate,
            preferences: response.preferences || updates.preferences || currentProfile?.preferences || {
              notifications: true,
              emailNotifications: true,
              smsNotifications: false,
              favoriteCategories: []
            }
          };

          // Actualizar localStorage y el subject
          this.saveUserProfile(updatedProfile);
          this.userProfileSubject.next(updatedProfile);

          // Guardar el teléfono en localStorage siempre que se actualice
          if (updatedProfile.phone) {
            localStorage.setItem('userPhone', updatedProfile.phone);
          }

          // Actualizar userInfo en localStorage si cambió el nombre, email o teléfono
          const userInfoStr = localStorage.getItem('userInfo');
          if (userInfoStr) {
            try {
              const currentUserInfo = JSON.parse(userInfoStr);
              const needsUpdate = 
                updatedProfile.fullName !== currentUserInfo.name || 
                updatedProfile.email !== currentUserInfo.email ||
                (updatedProfile.phone && updatedProfile.phone !== currentUserInfo.phone);
              
              if (needsUpdate) {
                const updatedUserInfo = {
                  ...currentUserInfo,
                  name: updatedProfile.fullName,
                  email: updatedProfile.email
                };
                if (updatedProfile.phone) {
                  updatedUserInfo.phone = updatedProfile.phone;
                }
                localStorage.setItem('userInfo', JSON.stringify(updatedUserInfo));
              }
            } catch (e) {
              console.error('Error al actualizar userInfo:', e);
            }
          }
          
          // Disparar evento para actualizar la UI
          window.dispatchEvent(new CustomEvent('userInfoUpdated'));

          return updatedProfile;
        }),
        catchError((error: HttpErrorResponse) => {
          // Si falla la petición al backend, actualizar solo en localStorage como fallback
          console.warn('Error al actualizar perfil en el backend, actualizando solo en localStorage:', error);

          let currentProfile = this.userProfileSubject.value;
          if (!currentProfile) {
            const user = JSON.parse(localStorage.getItem('userInfo') || 'null');
            currentProfile = {
              id: userId || 'user_' + Date.now(),
              fullName: updates.fullName || user?.name || 'Usuario',
              email: updates.email || user?.email || '',
              phone: updates.phone || user?.phone || '',
              memberSince: new Date(),
              preferences: {
                notifications: true,
                emailNotifications: true,
                smsNotifications: false,
                favoriteCategories: []
              }
            };
          }

          // PRESERVAR SIEMPRE la fecha de registro original
          let preservedDate: Date;
          if (currentProfile?.memberSince) {
            preservedDate = new Date(currentProfile.memberSince);
            if (isNaN(preservedDate.getTime())) {
              preservedDate = new Date();
            }
          } else {
            // Si no hay fecha en el perfil actual, intentar obtenerla del localStorage
            const storedProfile = JSON.parse(localStorage.getItem(`userProfile_${userId}`) || 'null');
            if (storedProfile?.memberSince) {
              preservedDate = new Date(storedProfile.memberSince);
              if (isNaN(preservedDate.getTime())) {
                preservedDate = new Date();
              }
            } else {
              preservedDate = new Date();
            }
          }

          const updatedProfile = {
            ...currentProfile,
            ...updates,
            memberSince: preservedDate // NUNCA cambiar la fecha de registro
          };
          this.saveUserProfile(updatedProfile);
          this.userProfileSubject.next(updatedProfile);

          // Guardar el teléfono en localStorage también en el fallback
          if (updatedProfile.phone) {
            localStorage.setItem('userPhone', updatedProfile.phone);
            // También actualizar en userInfo si existe
            const userInfoStr = localStorage.getItem('userInfo');
            if (userInfoStr) {
              try {
                const currentUserInfo = JSON.parse(userInfoStr);
                const updatedUserInfo = {
                  ...currentUserInfo,
                  phone: updatedProfile.phone
                };
                localStorage.setItem('userInfo', JSON.stringify(updatedUserInfo));
              } catch (e) {
                console.error('Error al actualizar userInfo con teléfono:', e);
              }
            }
          }

          // Disparar evento para actualizar la UI
          window.dispatchEvent(new CustomEvent('userInfoUpdated'));

          return throwError(() => this.errorHandler.handleHttpError(error));
        })
      );
    } catch (e) {
      console.error('Error al actualizar perfil:', e);
      return throwError(() => new Error('Error al procesar la actualización del perfil'));
    }
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
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) {
      return of([]);
    }

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      // Obtener direcciones del backend (el apiUrl ya incluye /users)
      return this.http.get<any>(`${this.apiUrl}/${userId}`).pipe(
        map(response => {
          // El backend puede devolver diferentes formatos
          let backendAddresses: any[] = [];

          if (Array.isArray(response)) {
            // Si la respuesta es directamente un array (no debería pasar, pero por si acaso)
            backendAddresses = response;
          } else if (response.addresses && Array.isArray(response.addresses)) {
            // Formato: { addresses: [...] }
            backendAddresses = response.addresses;
          } else if (response.data?.addresses && Array.isArray(response.data.addresses)) {
            // Formato: { data: { addresses: [...] } }
            backendAddresses = response.data.addresses;
          } else if (response.user?.addresses && Array.isArray(response.user.addresses)) {
            // Formato: { user: { addresses: [...] } }
            backendAddresses = response.user.addresses;
          } else {
            console.warn('Formato de respuesta inesperado al obtener direcciones:', response);
            backendAddresses = [];
          }
          
          // Mapear direcciones del backend al formato del frontend
          const mappedAddresses = backendAddresses.map((addr: any, index: number) => {
            try {
              return this.mapBackendAddressToFrontend(addr, index);
            } catch (error) {
              console.error(`Error al mapear dirección en índice ${index}:`, error, addr);
              // Retornar una dirección por defecto para evitar romper la lista
              return {
                id: `${index}`,
                title: `Dirección ${index + 1}`,
                name: `Dirección ${index + 1}`,
                address: addr.address || '',
                neighborhood: addr.neighborhood || '',
                city: addr.city || '',
                postalCode: addr.postal_code || addr.postalCode || '',
                postal_code: addr.postal_code || addr.postalCode || '',
                isDefault: addr.is_primary || false,
                is_primary: addr.is_primary || false
              };
            }
          });

          // Guardar en localStorage como caché
          try {
            localStorage.setItem(`userAddresses_${userId}`, JSON.stringify(mappedAddresses));
          } catch (e) {
            console.error('Error al guardar direcciones en localStorage:', e);
          }

          return mappedAddresses;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error al obtener direcciones del backend:', error);
          // Fallback: intentar obtener de localStorage
          const storedAddresses = localStorage.getItem(`userAddresses_${userId}`);
          if (storedAddresses) {
            try {
              const parsed = JSON.parse(storedAddresses);
              if (Array.isArray(parsed)) {
                return of(parsed);
              }
            } catch (e) {
              console.error('Error al parsear direcciones de localStorage:', e);
            }
          }
          return of([]);
        })
      );
    } catch (e) {
      console.error('Error al obtener direcciones:', e);
      return of([]);
    }
  }

  // Mapear dirección del backend al formato del frontend
  private mapBackendAddressToFrontend(backendAddr: any, index: number): Address {
    return {
      id: `${index}`, // Usar índice como ID temporal
      title: backendAddr.name || backendAddr.title || `Dirección ${index + 1}`,
      name: backendAddr.name,
      address: backendAddr.address || '',
      neighborhood: backendAddr.neighborhood || '',
      city: backendAddr.city || '',
      postalCode: backendAddr.postal_code || backendAddr.postalCode || '',
      postal_code: backendAddr.postal_code || backendAddr.postalCode || '',
      isDefault: backendAddr.is_primary || backendAddr.isDefault || false,
      is_primary: backendAddr.is_primary || backendAddr.isDefault || false
    };
  }

  // Mapear dirección del frontend al formato del backend
  private mapFrontendAddressToBackend(frontendAddr: Address): any {
    return {
      name: frontendAddr.name || frontendAddr.title || 'Dirección',
      address: frontendAddr.address,
      neighborhood: frontendAddr.neighborhood || '',
      city: frontendAddr.city,
      postal_code: frontendAddr.postal_code || frontendAddr.postalCode || '',
      is_primary: frontendAddr.is_primary !== undefined ? frontendAddr.is_primary : (frontendAddr.isDefault || false)
    };
  }

  addAddress(address: Address): Observable<Address> {
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) {
      return throwError(() => new Error('Usuario no autenticado'));
    }

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      // Mapear al formato del backend
      const addressDto = this.mapFrontendAddressToBackend(address);

      return this.http.post<any>(`${this.apiUrl}/${userId}/addresses`, addressDto).pipe(
        switchMap(response => {
          // El backend puede devolver diferentes formatos:
          // 1. El usuario completo con addresses
          // 2. Solo la dirección nueva
          // 3. Un objeto con data.addresses
          let addresses: any[] = [];
          let newAddress: any = null;

          if (response.addresses && Array.isArray(response.addresses)) {
            // Formato: { addresses: [...] }
            addresses = response.addresses;
            newAddress = addresses[addresses.length - 1];
          } else if (response.data?.addresses && Array.isArray(response.data.addresses)) {
            // Formato: { data: { addresses: [...] } }
            addresses = response.data.addresses;
            newAddress = addresses[addresses.length - 1];
          } else if (response.name || response.address) {
            // El backend devolvió directamente la dirección nueva
            newAddress = response;
            // Necesitamos obtener todas las direcciones para saber el índice
            // Por ahora usamos índice 0 temporalmente
            addresses = [newAddress];
          } else {
            console.warn('Formato de respuesta inesperado del backend:', response);
            // Intentar obtener direcciones del usuario completo
            if (response._id || response.id) {
              // Es el usuario completo, buscar addresses
              addresses = response.addresses || [];
              newAddress = addresses[addresses.length - 1];
            }
          }

          // Si no se pudo parsear la respuesta, intentar obtener las direcciones del servidor
          // para verificar si la operación fue exitosa
          if (!newAddress) {
            console.warn('No se pudo parsear la respuesta, verificando en el servidor...');
            return this.getAddresses().pipe(
              map(allAddresses => {
                // Buscar la dirección recién creada comparando los campos
                const foundAddress = allAddresses.find(addr => 
                  addr.address === address.address &&
                  addr.neighborhood === address.neighborhood &&
                  addr.city === address.city
                );
                
                if (foundAddress) {
                  // La operación fue exitosa, retornar la dirección encontrada
                  return foundAddress;
                } else {
                  // Si no se encuentra, usar la última dirección (probablemente la nueva)
                  if (allAddresses.length > 0) {
                    return allAddresses[allAddresses.length - 1];
                  }
                  // Si no hay direcciones, crear una dirección temporal con los datos enviados
                  return this.mapBackendAddressToFrontend({
                    name: address.name || address.title || 'Dirección',
                    address: address.address,
                    neighborhood: address.neighborhood || '',
                    city: address.city,
                    postal_code: address.postal_code || address.postalCode || '',
                    is_primary: address.is_primary !== undefined ? address.is_primary : (address.isDefault || false)
                  }, allAddresses.length);
                }
              })
            );
          }

          // Mapear y retornar
          const addressIndex = addresses.length - 1;
          const mappedAddress = this.mapBackendAddressToFrontend(newAddress, addressIndex);
          
          // Actualizar localStorage como caché - recargar todas las direcciones
          setTimeout(() => {
            this.getAddresses().subscribe({
              next: (addrs) => {
                localStorage.setItem(`userAddresses_${userId}`, JSON.stringify(addrs));
              },
              error: (err) => {
                console.error('Error al actualizar caché de direcciones:', err);
              }
            });
          }, 100);
          
          return of(mappedAddress);
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error completo al agregar dirección:', error);
          const appError = this.errorHandler.handleHttpError(error);
          return throwError(() => appError);
        })
      );
    } catch (e) {
      console.error('Error al agregar dirección:', e);
      return throwError(() => new Error('Error al agregar dirección'));
    }
  }

  // Mantener compatibilidad con código existente
  saveAddress(address: Address): void {
    this.addAddress(address).subscribe({
      next: () => {},
      error: (error) => {
        console.error('Error al guardar dirección:', error);
      }
    });
  }

  updateAddress(address: Address, addressIndex: number): Observable<Address> {
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) {
      return throwError(() => new Error('Usuario no autenticado'));
    }

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      // Mapear al formato del backend
      const addressDto = this.mapFrontendAddressToBackend(address);

      return this.http.patch<any>(`${this.apiUrl}/${userId}/addresses/${addressIndex}`, addressDto).pipe(
        switchMap(response => {
          // El backend puede devolver diferentes formatos
          let addresses: any[] = [];
          let updatedAddress: any = null;

          if (response.addresses && Array.isArray(response.addresses)) {
            addresses = response.addresses;
            updatedAddress = addresses[addressIndex];
          } else if (response.data?.addresses && Array.isArray(response.data.addresses)) {
            addresses = response.data.addresses;
            updatedAddress = addresses[addressIndex];
          } else if (response.name || response.address) {
            // El backend devolvió directamente la dirección actualizada
            updatedAddress = response;
            addresses = [updatedAddress];
          } else {
            console.warn('Formato de respuesta inesperado al actualizar:', response);
            if (response._id || response.id) {
              addresses = response.addresses || [];
              updatedAddress = addresses[addressIndex];
            }
          }

          // Si no se pudo parsear la respuesta, intentar obtener las direcciones del servidor
          // para verificar si la operación fue exitosa
          if (!updatedAddress) {
            console.warn('No se pudo parsear la respuesta, verificando en el servidor...');
            return this.getAddresses().pipe(
              map(allAddresses => {
                // Verificar que el índice sea válido
                if (addressIndex >= 0 && addressIndex < allAddresses.length) {
                  // La operación fue exitosa, retornar la dirección actualizada
                  return allAddresses[addressIndex];
                } else {
                  // Si el índice no es válido, buscar la dirección por sus campos
                  const foundAddress = allAddresses.find(addr => 
                    addr.address === address.address &&
                    addr.neighborhood === address.neighborhood &&
                    addr.city === address.city
                  );
                  
                  if (foundAddress) {
                    return foundAddress;
                  }
                  
                  // Si no se encuentra, usar la dirección en el índice original si existe
                  if (allAddresses.length > 0 && addressIndex < allAddresses.length) {
                    return allAddresses[addressIndex];
                  }
                  
                  // Último recurso: crear una dirección temporal con los datos enviados
                  return this.mapBackendAddressToFrontend({
                    name: address.name || address.title || 'Dirección',
                    address: address.address,
                    neighborhood: address.neighborhood || '',
                    city: address.city,
                    postal_code: address.postal_code || address.postalCode || '',
                    is_primary: address.is_primary !== undefined ? address.is_primary : (address.isDefault || false)
                  }, addressIndex);
                }
              })
            );
          }

          // Mapear y retornar
          const mappedAddress = this.mapBackendAddressToFrontend(updatedAddress, addressIndex);
          
          // Actualizar localStorage como caché - recargar todas las direcciones
          setTimeout(() => {
            this.getAddresses().subscribe({
              next: (addrs) => {
                localStorage.setItem(`userAddresses_${userId}`, JSON.stringify(addrs));
              },
              error: (err) => {
                console.error('Error al actualizar caché de direcciones:', err);
              }
            });
          }, 100);
          
          return of(mappedAddress);
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error completo al actualizar dirección:', error);
          const appError = this.errorHandler.handleHttpError(error);
          return throwError(() => appError);
        })
      );
    } catch (e) {
      console.error('Error al actualizar dirección:', e);
      return throwError(() => new Error('Error al actualizar dirección'));
    }
  }

  removeAddress(addressIndex: number): Observable<void> {
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) {
      return throwError(() => new Error('Usuario no autenticado'));
    }

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      return this.http.delete<void>(`${this.apiUrl}/${userId}/addresses/${addressIndex}`).pipe(
        tap(() => {
          // Actualizar localStorage como caché
          this.getAddresses().subscribe(addrs => {
            localStorage.setItem(`userAddresses_${userId}`, JSON.stringify(addrs));
          });
        }),
        catchError((error: HttpErrorResponse) => {
          const appError = this.errorHandler.handleHttpError(error);
          return throwError(() => appError);
        })
      );
    } catch (e) {
      console.error('Error al eliminar dirección:', e);
      return throwError(() => new Error('Error al eliminar dirección'));
    }
  }

  setPrimaryAddress(addressIndex: number): Observable<Address> {
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) {
      return throwError(() => new Error('Usuario no autenticado'));
    }

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      return this.http.patch<any>(`${this.apiUrl}/${userId}/addresses/${addressIndex}/primary`, {}).pipe(
        switchMap(response => {
          // El backend devuelve el usuario actualizado
          const addresses = response.addresses || response.data?.addresses || [];
          const primaryAddress = addresses[addressIndex];
          
          // Si no se pudo obtener la dirección principal de la respuesta, intentar obtener del servidor
          if (!primaryAddress) {
            console.warn('No se pudo parsear la respuesta, verificando en el servidor...');
            return this.getAddresses().pipe(
              map(allAddresses => {
                // Verificar que el índice sea válido
                if (addressIndex >= 0 && addressIndex < allAddresses.length) {
                  // La operación fue exitosa, retornar la dirección en el índice
                  return allAddresses[addressIndex];
                } else {
                  // Si el índice no es válido, buscar la dirección principal
                  const foundPrimary = allAddresses.find(addr => addr.isDefault || addr.is_primary);
                  if (foundPrimary) {
                    return foundPrimary;
                  }
                  // Último recurso: retornar la primera dirección si existe
                  if (allAddresses.length > 0) {
                    return allAddresses[0];
                  }
                  // Si no hay direcciones, lanzar error
                  throw new Error('No se encontró la dirección principal');
                }
              })
            );
          }
          
          // Mapear y retornar
          const mappedAddress = this.mapBackendAddressToFrontend(primaryAddress, addressIndex);
          
          // Actualizar localStorage como caché
          setTimeout(() => {
            this.getAddresses().subscribe({
              next: (addrs) => {
                localStorage.setItem(`userAddresses_${userId}`, JSON.stringify(addrs));
              },
              error: (err) => {
                console.error('Error al actualizar caché de direcciones:', err);
              }
            });
          }, 100);
          
          return of(mappedAddress);
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error completo al marcar dirección como principal:', error);
          const appError = this.errorHandler.handleHttpError(error);
          return throwError(() => appError);
        })
      );
    } catch (e) {
      console.error('Error al marcar dirección como principal:', e);
      return throwError(() => new Error('Error al marcar dirección como principal'));
    }
  }

  getPaymentMethods(): Observable<PaymentMethod[]> {
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) {
      return of([]);
    }

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      if (!userId) {
        return of([]);
      }

      // Llamar al endpoint específico del backend para obtener tarjetas de pago
      const url = `${this.apiUrl}/${userId}/payment-cards`;
      console.log(`📥 Obteniendo tarjetas de pago desde: ${url}`);
      
      return this.http.get<any>(url).pipe(
        tap((response) => {
          console.log('📦 Respuesta completa del backend (tarjetas):', response);
        }),
        map((response: any) => {
          // El backend devuelve { message, paymentCards, count }
          const paymentCards = response.paymentCards || response.payment_cards || [];
          if (!Array.isArray(paymentCards)) {
            console.warn('⚠️ La respuesta no contiene un array de tarjetas:', response);
            return [];
          }

          console.log(`✅ Se encontraron ${paymentCards.length} tarjetas`);

          // Mapear las tarjetas del backend al formato PaymentMethod
          const mappedCards = paymentCards.map((card: any, index: number) => {
            const mapped: PaymentMethod = {
              id: `card_${index}`, // ID temporal basado en índice
              name: card.name || `${card.brand} ${card.type}`,
              cardholder_name: card.cardholder_name || card.cardholderName || '',
              last_four_digits: card.last_four_digits || card.lastFourDigits || '',
              last4: card.last_four_digits || card.lastFourDigits || '', // Alias para compatibilidad
              type: card.type === 'debit' || card.type === 'credit' ? card.type : 'credit',
              brand: card.brand || 'visa',
              expiry_date: card.expiry_date || card.expiryDate || '',
              is_primary: card.is_primary || card.isPrimary || false,
              isDefault: card.is_primary || card.isPrimary || false // Alias para compatibilidad
            };
            console.log(`💳 Tarjeta ${index} mapeada:`, mapped);
            return mapped;
          });
          
          return mappedCards;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error al obtener tarjetas de pago del backend:', error);
          console.error('URL:', `${this.apiUrl}/${userId}/payment-cards`);
          // Fallback: intentar obtener de localStorage
          const storedMethods = localStorage.getItem(`userPaymentMethods_${userId}`);
          if (storedMethods) {
            try {
              return of(JSON.parse(storedMethods));
            } catch (e) {
              return of([]);
            }
          }
          return of([]);
        })
      );
    } catch (e) {
      console.error('Error al obtener métodos de pago:', e);
      return of([]);
    }
  }

  addPaymentCard(cardData: {
    name?: string;
    cardholder_name: string;
    cardNumber: string;
    type: 'debit' | 'credit';
    brand: string;
    expiryMonth: string;
    expiryYear: string;
    is_primary?: boolean;
  }): Observable<PaymentMethod[]> {
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) {
      return throwError(() => new Error('Usuario no autenticado'));
    }

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      if (!userId) {
        return throwError(() => new Error('ID de usuario no encontrado'));
      }

      // Extraer últimos 4 dígitos del número de tarjeta
      const cardNumber = cardData.cardNumber.replace(/\s/g, '');
      const lastFourDigits = cardNumber.slice(-4);

      // Formatear fecha de expiración como MM/YY
      const expiryDate = `${cardData.expiryMonth}/${cardData.expiryYear}`;

      // Preparar datos para el backend
      const cardDto = {
        name: cardData.name || `${cardData.brand} ${cardData.type}`,
        cardholder_name: cardData.cardholder_name,
        last_four_digits: lastFourDigits,
        type: cardData.type,
        brand: cardData.brand.toLowerCase(),
        expiry_date: expiryDate,
        is_primary: cardData.is_primary || false
      };

      console.log('Agregando tarjeta de pago:', cardDto);

      // Llamar al endpoint del backend
      return this.http.post<any>(`${this.apiUrl}/${userId}/payment-cards`, cardDto).pipe(
        switchMap(() => {
          // Después de agregar, obtener la lista actualizada
          return this.getPaymentMethods();
        }),
        tap((cards) => {
          console.log('Tarjetas actualizadas:', cards);
          // Disparar evento para notificar cambios
          window.dispatchEvent(new CustomEvent('paymentMethodsChanged'));
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error al agregar tarjeta:', error);
          const appError = this.errorHandler.handleHttpError(error);
          return throwError(() => appError);
        })
      );
    } catch (e) {
      console.error('Error al agregar tarjeta:', e);
      return throwError(() => new Error('Error al agregar tarjeta'));
    }
  }

  // Método de compatibilidad con código existente
  savePaymentMethod(method: PaymentMethod): Observable<PaymentMethod[]> {
    // Si es efectivo, no se puede guardar como tarjeta
    if (method.type === 'cash') {
      return of([]);
    }

    // Convertir PaymentMethod al formato esperado por addPaymentCard
    if (!method.cardNumber || !method.expiryMonth || !method.expiryYear) {
      return throwError(() => new Error('Datos de tarjeta incompletos'));
    }

    return this.addPaymentCard({
      name: method.name,
      cardholder_name: method.cardholder_name,
      cardNumber: method.cardNumber,
      type: method.type as 'debit' | 'credit',
      brand: method.brand,
      expiryMonth: method.expiryMonth,
      expiryYear: method.expiryYear,
      is_primary: method.is_primary || method.isDefault
    });
  }

  updatePaymentCard(cardIndex: number, cardData: {
    name?: string;
    cardholder_name?: string;
    type?: 'debit' | 'credit';
    brand?: string;
    expiryMonth?: string;
    expiryYear?: string;
    is_primary?: boolean;
  }): Observable<PaymentMethod[]> {
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) {
      return throwError(() => new Error('Usuario no autenticado'));
    }

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      if (!userId) {
        return throwError(() => new Error('ID de usuario no encontrado'));
      }

      // Preparar datos para actualizar (solo enviar campos que se actualizan)
      const updateDto: any = {};
      if (cardData.name !== undefined) updateDto.name = cardData.name;
      if (cardData.cardholder_name !== undefined) updateDto.cardholder_name = cardData.cardholder_name;
      if (cardData.type !== undefined) updateDto.type = cardData.type;
      if (cardData.brand !== undefined) updateDto.brand = cardData.brand.toLowerCase();
      if (cardData.expiryMonth && cardData.expiryYear) {
        updateDto.expiry_date = `${cardData.expiryMonth}/${cardData.expiryYear}`;
      }
      if (cardData.is_primary !== undefined) updateDto.is_primary = cardData.is_primary;

      console.log(`Actualizando tarjeta en índice ${cardIndex}:`, updateDto);

      // Llamar al endpoint del backend
      return this.http.patch<any>(`${this.apiUrl}/${userId}/payment-cards/${cardIndex}`, updateDto).pipe(
        switchMap(() => {
          // Después de actualizar, obtener la lista actualizada
          return this.getPaymentMethods();
        }),
        tap((cards) => {
          console.log('Tarjetas actualizadas:', cards);
          window.dispatchEvent(new CustomEvent('paymentMethodsChanged'));
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error al actualizar tarjeta:', error);
          const appError = this.errorHandler.handleHttpError(error);
          return throwError(() => appError);
        })
      );
    } catch (e) {
      console.error('Error al actualizar tarjeta:', e);
      return throwError(() => new Error('Error al actualizar tarjeta'));
    }
  }

  // Método de compatibilidad
  updatePaymentMethod(method: PaymentMethod): Observable<PaymentMethod[]> {
    // Obtener el índice de la tarjeta
    return this.getPaymentMethods().pipe(
      switchMap((methods) => {
        const index = methods.findIndex(m => m.id === method.id);
        if (index === -1) {
          return throwError(() => new Error('Tarjeta no encontrada'));
        }

        return this.updatePaymentCard(index, {
          name: method.name,
          cardholder_name: method.cardholder_name,
          type: method.type as 'debit' | 'credit',
          brand: method.brand,
          expiryMonth: method.expiryMonth,
          expiryYear: method.expiryYear,
          is_primary: method.is_primary || method.isDefault
        });
      })
    );
  }

  removePaymentCard(cardIndex: number): Observable<PaymentMethod[]> {
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) {
      return throwError(() => new Error('Usuario no autenticado'));
    }

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      if (!userId) {
        return throwError(() => new Error('ID de usuario no encontrado'));
      }

      console.log(`🗑️ Eliminando tarjeta en índice ${cardIndex}`);
      const url = `${this.apiUrl}/${userId}/payment-cards/${cardIndex}`;
      console.log(`   URL: ${url}`);

      // Llamar al endpoint del backend
      return this.http.delete<any>(url).pipe(
        tap((response) => {
          console.log('📦 Respuesta del backend al eliminar:', response);
        }),
        switchMap(() => {
          // Después de eliminar, obtener la lista actualizada
          return this.getPaymentMethods();
        }),
        tap((cards) => {
          console.log('Tarjetas actualizadas:', cards);
          window.dispatchEvent(new CustomEvent('paymentMethodsChanged'));
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error al eliminar tarjeta:', error);
          const appError = this.errorHandler.handleHttpError(error);
          return throwError(() => appError);
        })
      );
    } catch (e) {
      console.error('Error al eliminar tarjeta:', e);
      return throwError(() => new Error('Error al eliminar tarjeta'));
    }
  }

  setPrimaryPaymentCard(cardIndex: number): Observable<PaymentMethod[]> {
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) {
      return throwError(() => new Error('Usuario no autenticado'));
    }

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      if (!userId) {
        return throwError(() => new Error('ID de usuario no encontrado'));
      }

      console.log(`Estableciendo tarjeta principal en índice ${cardIndex}`);

      // Llamar al endpoint del backend
      return this.http.patch<any>(`${this.apiUrl}/${userId}/payment-cards/${cardIndex}/primary`, {}).pipe(
        switchMap(() => {
          // Después de establecer como principal, obtener la lista actualizada
          return this.getPaymentMethods();
        }),
        tap((cards) => {
          console.log('Tarjetas actualizadas:', cards);
          window.dispatchEvent(new CustomEvent('paymentMethodsChanged'));
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error al establecer tarjeta principal:', error);
          const appError = this.errorHandler.handleHttpError(error);
          return throwError(() => appError);
        })
      );
    } catch (e) {
      console.error('Error al establecer tarjeta principal:', e);
      return throwError(() => new Error('Error al establecer tarjeta principal'));
    }
  }

  // Método de compatibilidad
  deletePaymentMethod(methodId: string): Observable<PaymentMethod[]> {
    // Obtener el índice de la tarjeta
    return this.getPaymentMethods().pipe(
      switchMap((methods) => {
        const index = methods.findIndex(m => m.id === methodId);
        if (index === -1) {
          return throwError(() => new Error('Tarjeta no encontrada'));
        }
        return this.removePaymentCard(index);
      })
    );
  }

  private generateId(): string {
    return 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  getFavoriteDishes(): Observable<MenuItem[]> {
    // Obtener el userId del usuario actual desde localStorage
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) {
      return of([]);
    }

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      if (!userId) {
        return of([]);
      }

      // Llamar al endpoint del backend para obtener favoritos con detalles
      const url = `${this.apiUrl}/${userId}/favorites`;
      console.log(`📥 Obteniendo favoritos desde: ${url}`);
      
      return this.http.get<any>(url).pipe(
        tap((response) => {
          console.log('📦 Respuesta completa del backend:', response);
        }),
        map((response: any) => {
          // El backend devuelve los platos completos
          // Puede venir como: { favorites: [...] }, { dishes: [...] }, o directamente como array
          const dishes = response.favorites || response.dishes || (Array.isArray(response) ? response : []) || [];
          console.log('🍽️ Platos extraídos:', dishes);
          if (!Array.isArray(dishes)) {
            console.warn('⚠️ La respuesta no es un array:', dishes);
            return [];
          }

          // Mapear los platos del backend al formato MenuItem
          const menuItems = dishes
            .map((dish: any) => {
              try {
                return this.mapDishToMenuItem(dish);
              } catch (error) {
                console.error('Error al mapear plato favorito:', error, dish);
                return null;
              }
            })
            .filter((item: MenuItem | null) => item !== null) as MenuItem[];

          return menuItems;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error al obtener favoritos del backend:', error);
          // Fallback: intentar obtener de localStorage (solo IDs)
          const storedFavorites = localStorage.getItem(`userFavoriteDishes_${userId}`);
          if (storedFavorites) {
            try {
              const favoriteIds = JSON.parse(storedFavorites);
              // Si hay IDs guardados, devolver array vacío (no podemos obtener detalles sin backend)
              return of([]);
            } catch (e) {
              return of([]);
            }
          }
          return of([]);
        })
      );
    } catch (e) {
      console.error('Error al obtener favoritos:', e);
      return of([]);
    }
  }

  // Método auxiliar para mapear platos (similar al de MenuService)
  private mapDishToMenuItem(dish: any): MenuItem {
    if (!dish || typeof dish !== 'object') {
      throw new Error('Dish data is invalid');
    }
    const dishId = dish.id || dish._id;
    let finalId: number | string;
    if (!dishId) {
      finalId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    } else if (typeof dishId === 'string' && dishId.length === 24 && /^[0-9a-fA-F]{24}$/.test(dishId)) {
      finalId = dishId;
    } else if (typeof dishId === 'string' && !isNaN(parseInt(dishId, 10)) && dishId.length < 10) {
      finalId = parseInt(dishId, 10);
    } else if (typeof dishId === 'number') {
      finalId = dishId;
    } else {
      finalId = String(dishId);
    }
    let categoryId = '';
    if (dish.categoryId) {
      categoryId = String(dish.categoryId);
    } else if (dish.category?.id) {
      categoryId = String(dish.category.id);
    } else if (dish.categoria?.id) {
      categoryId = String(dish.categoria.id);
    } else if (dish.categoriaId) {
      categoryId = String(dish.categoriaId);
    }
    
    // Mapear opciones
    let options: any[] = [];
    if (Array.isArray(dish.options)) {
      options = dish.options;
    } else if (Array.isArray(dish.opciones)) {
      options = dish.opciones;
    }
    const mappedOptions = options.map((opt: any, index: number) => ({
      id: opt.id || opt._id || `opt_${index}`,
      name: opt.name || opt.nombre || '',
      price: typeof opt.price === 'number' ? opt.price : (typeof opt.precio === 'number' ? opt.precio : 0),
      type: opt.type || opt.tipo || 'extra'
    }));
    
    // Mapear supplies si existen
    let supplies: any[] | undefined;
    if (dish.supplies && Array.isArray(dish.supplies)) {
      supplies = dish.supplies.map((s: any) => ({
        supplyId: s.supplyId || s.supply_id || s._id || s.id,
        quantityRequired: s.quantityRequired || s.quantity_required || s.quantity || 1
      }));
    }
    
    return {
      id: finalId,
      name: dish.name || dish.nombre || '',
      description: dish.description || dish.descripcion || '',
      price: typeof dish.price === 'number' ? dish.price : (typeof dish.precio === 'number' ? dish.precio : 0),
      imageUrl: dish.image || dish.imageUrl || dish.imagen || '',
      available: dish.available !== undefined ? Boolean(dish.available) : (dish.disponible !== undefined ? Boolean(dish.disponible) : true),
      categoryId: categoryId,
      options: mappedOptions,
      supplies: supplies
    };
  }

  addFavoriteDish(dishId: number | string): Observable<MenuItem[]> {
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) {
      console.error('❌ No se encontró userInfo en localStorage');
      return throwError(() => new Error('Usuario no autenticado'));
    }

    try {
      const userInfo = JSON.parse(userInfoStr);
      console.log('📋 userInfo obtenido:', userInfo);
      const userId = userInfo.userId || userInfo.email || userInfo.id;

      if (!userId) {
        console.error('❌ No se pudo obtener userId de userInfo:', userInfo);
        return throwError(() => new Error('ID de usuario no encontrado'));
      }

      const dishIdString = typeof dishId === 'string' ? dishId : dishId.toString();
      const url = `${this.apiUrl}/${userId}/favorites/${dishIdString}`;

      // Llamar al endpoint del backend para agregar favorito
      console.log(`➕ Agregando favorito:`);
      console.log(`   - userId: ${userId}`);
      console.log(`   - dishId: ${dishIdString}`);
      console.log(`   - URL: ${url}`);
      console.log(`   - apiUrl base: ${this.apiUrl}`);
      
      return this.http.post<any>(url, {}).pipe(
        tap((response) => {
          console.log('Respuesta al agregar favorito:', response);
        }),
        switchMap(() => {
          // Después de agregar, obtener la lista actualizada de favoritos
          return this.getFavoriteDishes();
        }),
        tap((favorites) => {
          console.log('Favoritos actualizados después de agregar:', favorites);
          // Disparar evento personalizado para notificar cambios
          window.dispatchEvent(new CustomEvent('favoritesChanged'));
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error al agregar favorito:', error);
          console.error('URL:', `${this.apiUrl}/${userId}/favorites/${dishIdString}`);
          console.error('Error completo:', error.error || error.message);
          const appError = this.errorHandler.handleHttpError(error);
          return throwError(() => appError);
        })
      );
    } catch (e) {
      console.error('Error al agregar favorito:', e);
      return throwError(() => new Error('Error al agregar favorito'));
    }
  }

  removeFavoriteDish(dishId: number | string): Observable<MenuItem[]> {
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) {
      return throwError(() => new Error('Usuario no autenticado'));
    }

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      if (!userId) {
        return throwError(() => new Error('ID de usuario no encontrado'));
      }

      const dishIdString = typeof dishId === 'string' ? dishId : dishId.toString();
      const url = `${this.apiUrl}/${userId}/favorites/${dishIdString}`;

      // Llamar al endpoint del backend para eliminar favorito
      console.log(`➖ Eliminando favorito:`);
      console.log(`   - userId: ${userId}`);
      console.log(`   - dishId: ${dishIdString}`);
      console.log(`   - URL: ${url}`);
      
      return this.http.delete<any>(url).pipe(
        tap((response) => {
          console.log('Respuesta al eliminar favorito:', response);
        }),
        switchMap(() => {
          // Después de eliminar, obtener la lista actualizada de favoritos
          return this.getFavoriteDishes();
        }),
        tap((favorites) => {
          console.log('Favoritos actualizados después de eliminar:', favorites);
          // Disparar evento personalizado para notificar cambios
          window.dispatchEvent(new CustomEvent('favoritesChanged'));
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error al eliminar favorito:', error);
          console.error('URL:', `${this.apiUrl}/${userId}/favorites/${dishIdString}`);
          console.error('Error completo:', error.error || error.message);
          const appError = this.errorHandler.handleHttpError(error);
          return throwError(() => appError);
        })
      );
    } catch (e) {
      console.error('Error al eliminar favorito:', e);
      return throwError(() => new Error('Error al eliminar favorito'));
    }
  }

  isFavorite(dishId: number | string): Observable<boolean> {
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) {
      return of(false);
    }

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.userId || userInfo.email;

      if (!userId) {
        return of(false);
      }

      const dishIdString = typeof dishId === 'string' ? dishId : dishId.toString();

      // Llamar al endpoint del backend para verificar si es favorito
      return this.http.get<{ isFavorite: boolean }>(`${this.apiUrl}/${userId}/favorites/${dishIdString}/check`).pipe(
        map((response: any) => {
          // El backend puede devolver { isFavorite: true/false } o directamente true/false
          if (typeof response === 'boolean') {
            return response;
          }
          return response.isFavorite === true || response.favorite === true;
        }),
        catchError((error: HttpErrorResponse) => {
          // Si falla, intentar verificar localmente como fallback
          console.warn('Error al verificar favorito en backend, usando fallback:', error);
          return this.getFavoriteDishes().pipe(
            map((favorites: MenuItem[]) => favorites.some(fav => String(fav.id) === dishIdString))
          );
        })
      );
    } catch (e) {
      console.error('Error al verificar favorito:', e);
      return of(false);
    }
  }

  toggleFavorite(dishId: number | string): Observable<MenuItem[]> {
    // Primero verificar si es favorito
    return this.isFavorite(dishId).pipe(
      switchMap((isFav: boolean) => {
        if (isFav) {
          return this.removeFavoriteDish(dishId);
        } else {
          return this.addFavoriteDish(dishId);
        }
      }),
      catchError((error) => {
        console.error('Error al alternar favorito:', error);
        return throwError(() => error);
      })
    );
  }
  reloadUserProfile(): void {
    this.loadUserProfile();
  }
}
