import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { CartService } from '../../core/services/cart.service';
import { forkJoin, Subject, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { UserProfile } from '../../core/models/UserProfile';
import { Order } from '../../core/models/Order';
import { OrderItem, OrderItemOption } from '../../core/models/OrderItem';
import { Address } from '../../core/models/Address';
import { PaymentMethod } from '../../core/models/PaymentMethod';
import { MenuItem } from '../../core/models/MenuItem';
import { UserService } from '../../core/services/user.service';
import { MenuService } from '../../core/services/menu.service';
import { OrderService } from '../../core/services/order.service';
import { OrderFromBackend } from '../../core/models/OrderResponse';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.css']
})
export class PerfilComponent implements OnInit, OnDestroy {
  activeTab: 'profile' | 'orders' | 'addresses' | 'payment' | 'settings' = 'profile';
  userProfile: UserProfile | null = null;
  orders: Order[] = [];
  addresses: Address[] = [];
  paymentMethods: PaymentMethod[] = [];
  recommendedDishes: MenuItem[] = [];
  favoriteDishes: MenuItem[] = [];

  profileForm: FormGroup;
  addressForm: FormGroup;
  passwordForm: FormGroup;
  paymentMethodForm: FormGroup;

  showAddressModal = false;
  showPasswordModal = false;
  showProfileModal = false;
  showEditAddressModal = false;
  showPaymentMethodModal = false;
  editingAddress: Address | null = null;
  editingPaymentMethod: PaymentMethod | null = null;
  submitted = false;
  expandedOrders: Set<string> = new Set<string>();
  orderViewMode: 'list' | 'grid' = 'list';

  private destroy$ = new Subject<void>();
  private progressIntervals: Map<string, any> = new Map();

  constructor(
    private userService: UserService,
    public router: Router,
    private fb: FormBuilder,
    private menuService: MenuService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private cartService: CartService,
    private cdr: ChangeDetectorRef,
    private orderService: OrderService
  ) {
    this.profileForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]]
    });

    this.addressForm = this.fb.group({
      title: ['', [Validators.required]],
      address: ['', [Validators.required]],
      neighborhood: ['', [Validators.required]],
      city: ['Manizales', [Validators.required, this.cityValidator.bind(this)]],
      postalCode: ['170001', [Validators.required]],
      isDefault: [false]
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validator: this.passwordMatchValidator });

    this.paymentMethodForm = this.fb.group({
      type: ['card', [Validators.required]],
      cardNumber: ['', []], // Validación condicional
      cardHolder: ['', []], // Validación condicional
      expiryMonth: ['', []], // Validación condicional
      expiryYear: ['', []], // Validación condicional
      cvv: ['', []], // Validación condicional
      brand: ['Visa', [Validators.required]],
      isDefault: [false]
    });

    // Validación condicional: solo requerir campos de tarjeta si el tipo es 'card'
    this.paymentMethodForm.get('type')?.valueChanges.subscribe(type => {
      if (type === 'card') {
        this.paymentMethodForm.get('cardNumber')?.setValidators([Validators.required, Validators.pattern(/^[0-9\s]{13,19}$/)]);
        this.paymentMethodForm.get('cardHolder')?.setValidators([Validators.required]);
        this.paymentMethodForm.get('expiryMonth')?.setValidators([Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])$/)]);
        this.paymentMethodForm.get('expiryYear')?.setValidators([Validators.required, Validators.pattern(/^[0-9]{2}$/)]);
        this.paymentMethodForm.get('cvv')?.setValidators([Validators.required, Validators.pattern(/^[0-9]{3,4}$/)]);
      } else {
        this.paymentMethodForm.get('cardNumber')?.clearValidators();
        this.paymentMethodForm.get('cardHolder')?.clearValidators();
        this.paymentMethodForm.get('expiryMonth')?.clearValidators();
        this.paymentMethodForm.get('expiryYear')?.clearValidators();
        this.paymentMethodForm.get('cvv')?.clearValidators();
      }
      this.paymentMethodForm.get('cardNumber')?.updateValueAndValidity();
      this.paymentMethodForm.get('cardHolder')?.updateValueAndValidity();
      this.paymentMethodForm.get('expiryMonth')?.updateValueAndValidity();
      this.paymentMethodForm.get('expiryYear')?.updateValueAndValidity();
      this.paymentMethodForm.get('cvv')?.updateValueAndValidity();
    });
  }

  ngOnInit() {
    this.loadUserProfile();

    // Cargar pedidos inicialmente
    this.loadOrders();

    // Recargar pedidos cada 10 segundos para ver cambios del admin
    setInterval(() => {
      if (this.activeTab === 'orders') {
        this.loadOrders();
      }
    }, 10000);

    // Suscribirse a cambios en la información del usuario
    this.authService.userInfo$.pipe(takeUntil(this.destroy$)).subscribe(userInfo => {
      if (userInfo) {
        console.log('🔄 userInfo$ cambió, recargando perfil completo...');
        this.loadUserProfile();
        this.loadFavoriteDishes();
        this.loadAddresses();
      }
    });

    // Escuchar evento personalizado cuando el usuario inicia sesión
    window.addEventListener('userInfoUpdated', () => {
      console.log('🔄 userInfoUpdated en PerfilComponent, recargando datos...');
      this.loadUserProfile();
      this.loadFavoriteDishes();
      this.loadAddresses();
      this.loadPaymentMethods();
    });

    // Escuchar eventos de actualización de productos desde el admin
    window.addEventListener('productsUpdated', () => {
      console.log('🔄 Productos actualizados, recargando recomendaciones...');
      this.loadRecommendedDishes();
      this.loadFavoriteDishes();
    });

    // Cargar platos recomendados y favoritos
    this.loadRecommendedDishes();
    this.loadFavoriteDishes();
    this.loadAddresses();

    // Suscribirse a cambios en favoritos (revisar cada vez que cambie localStorage)
    this.setupFavoriteListener();
  }

  ngOnDestroy() {
    // Limpiar todos los intervalos de progreso
    this.progressIntervals.forEach(interval => clearInterval(interval));
    this.progressIntervals.clear();
    
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupFavoriteListener() {
    // Escuchar eventos personalizados cuando se agregan/eliminan favoritos
    window.addEventListener('favoritesChanged', () => {
      this.loadFavoriteDishes();
    });
  }

  private loadUserProfile() {
    // Obtener información del usuario autenticado directamente del token
    const userInfo = this.authService.getUserInfo();

    if (!userInfo) {
      // No hay usuario autenticado, no cargar datos
      // El usuario debería estar autenticado para ver el perfil
      return;
    }

    // Obtener fecha de registro guardada
    const userId = userInfo.userId || userInfo.email;
    let registrationDate: Date = new Date(); // Por defecto fecha actual

    // Intentar obtener la fecha de registro guardada
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

    // Usar SOLO los datos del token/UserInfo, no de localStorage que puede tener datos viejos
    const userProfile: UserProfile = {
      id: userInfo.userId || 'user_' + Date.now(),
      fullName: userInfo.name || 'Usuario',
      email: userInfo.email || '',
      phone: localStorage.getItem('userPhone') || '', // Solo el teléfono puede venir de localStorage
      memberSince: registrationDate, // Usar la fecha de registro guardada
      preferences: {
        notifications: true,
        emailNotifications: true,
        smsNotifications: false,
        favoriteCategories: []
      }
    };

    // Intentar obtener el perfil guardado del servicio, pero validar que sea del usuario actual
    this.userService.getUserProfile().subscribe(profile => {
      // Verificar que el perfil guardado pertenezca al usuario actual
      if (profile && (profile.email === userInfo.email || profile.id === userInfo.userId)) {
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
            console.error('Error al actualizar fecha de registro:', e);
          }
        }

        this.userProfile = profile;
        this.profileForm.patchValue({
          fullName: profile.fullName,
          email: profile.email,
          phone: profile.phone
        });
      } else {
        // Si no hay perfil o es de otro usuario, usar el perfil del token
        this.userProfile = userProfile;
        this.profileForm.patchValue({
          fullName: userProfile.fullName,
          email: userProfile.email,
          phone: userProfile.phone
        });
        // Inicializar el perfil en el servicio
        this.userService.initializeUserProfile(userProfile);
      }
    });

    this.loadOrders();
    this.loadAddresses();
    this.loadPaymentMethods();
  }

  private loadRecommendedDishes() {
    // Obtener órdenes del usuario para generar recomendaciones basadas en compras previas
    this.userService.getOrders().pipe(takeUntil(this.destroy$)).subscribe(orders => {
      if (!orders || orders.length === 0) {
        // Si no hay órdenes, mostrar productos destacados
        this.loadFallbackRecommendedDishes();
        return;
      }

      // Extraer IDs únicos de productos comprados
      const purchasedProductIds = new Set<string | number>();
      orders.forEach(order => {
        if (order.items && order.items.length > 0) {
          order.items.forEach(item => {
            purchasedProductIds.add(item.id);
          });
        }
      });

      // Obtener información completa de todos los productos comprados para conocer sus categorías
      const productObservables = Array.from(purchasedProductIds).map(productId =>
        this.menuService.getItemById(productId).pipe(
          catchError(() => of(null)) // Manejar errores si el producto ya no existe
        )
      );

      if (productObservables.length === 0) {
        this.loadFallbackRecommendedDishes();
        return;
      }

      forkJoin(productObservables).pipe(takeUntil(this.destroy$)).subscribe(products => {
        // Filtrar productos nulos y obtener sus categorías
        const validProducts = products.filter(p => p !== null && p !== undefined) as MenuItem[];
        const categoryFrequency = new Map<string, number>();

        validProducts.forEach(product => {
          if (product.categoryId) {
            const count = categoryFrequency.get(product.categoryId) || 0;
            categoryFrequency.set(product.categoryId, count + 1);
          }
        });

        // Generar recomendaciones basadas en las categorías más frecuentes
        this.generateRecommendationsFromOrders(purchasedProductIds, categoryFrequency);
      });
    });
  }

  private generateRecommendationsFromOrders(
    purchasedProductIds: Set<string | number>,
    categoryFrequency: Map<string, number>
  ) {
    // Ordenar categorías por frecuencia (más compradas primero)
    const sortedCategories = Array.from(categoryFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);

    // Si hay categorías compradas, obtener productos de esas categorías
    if (sortedCategories.length > 0) {
      this.getRecommendedProductsFromCategories(sortedCategories, purchasedProductIds);
    } else {
      // Si no hay categorías identificadas, usar fallback
      this.loadFallbackRecommendedDishes();
    }
  }

  private getRecommendedProductsFromCategories(
    categoryIds: string[],
    purchasedProductIds: Set<string | number>
  ) {
    const recommendedProducts: MenuItem[] = [];
    const maxRecommendations = 4;

    // Obtener productos de las categorías más frecuentes que el usuario NO haya comprado
    const categoryObservables = categoryIds.map(categoryId =>
      this.menuService.getItemsByCategory(categoryId).pipe(
        catchError(error => {
          console.error(`Error al obtener productos de categoría ${categoryId}:`, error);
          return of([]); // Retornar array vacío en caso de error
        })
      )
    );

    forkJoin(categoryObservables).pipe(takeUntil(this.destroy$)).subscribe(categoryProductsArrays => {
      // Combinar todos los productos de las categorías relevantes
      const allProducts = categoryProductsArrays.flat();

      // Filtrar productos que el usuario NO haya comprado y que estén disponibles
      // Solo productos que realmente existen en la base de datos (vienen del backend)
      const newProducts = allProducts.filter(product => {
        if (!product || !product.available) return false;
        if (!product.id) return false; // Debe tener ID válido
        if (purchasedProductIds.has(product.id)) return false;
        
        // Excluir productos específicos que no deben aparecer
        const nameLower = product.name?.toLowerCase() || '';
        
        // Excluir "Hamburguesa Doble BBQ"
        if (nameLower.includes('bbq') && nameLower.includes('doble')) {
          console.warn('⚠️ Producto con BBQ detectado, excluyendo:', product.name);
          return false;
        }
        
        // Excluir "Hamburguesa Vegetariana"
        if (nameLower.includes('vegetariana') || nameLower.includes('veggie')) {
          console.warn('⚠️ Producto vegetariano detectado, excluyendo:', product.name);
          return false;
        }
        
        return true;
      });

      // Eliminar duplicados por ID
      const uniqueProducts = Array.from(
        new Map(newProducts.map(item => [item.id, item])).values()
      );

      // Tomar hasta 4 productos
      recommendedProducts.push(...uniqueProducts.slice(0, maxRecommendations));

      // Si no hay suficientes recomendaciones, completar con productos destacados
      if (recommendedProducts.length < maxRecommendations) {
        this.menuService.getFeaturedItems().pipe(takeUntil(this.destroy$)).subscribe(featuredItems => {
          const additionalProducts = featuredItems
            .filter(item => {
              if (!item || !item.available || !item.id) return false;
              if (purchasedProductIds.has(item.id)) return false;
              if (recommendedProducts.some(rec => rec.id === item.id)) return false;
              
              // Excluir productos específicos que no deben aparecer
              const nameLower = item.name?.toLowerCase() || '';
              
              // Excluir "Hamburguesa Doble BBQ"
              if (nameLower.includes('bbq') && nameLower.includes('doble')) {
                return false;
              }
              
              // Excluir "Hamburguesa Vegetariana"
              if (nameLower.includes('vegetariana') || nameLower.includes('veggie')) {
                return false;
              }
              
              return true;
            })
            .slice(0, maxRecommendations - recommendedProducts.length);

          recommendedProducts.push(...additionalProducts);
          // Asegurar que solo productos con ID válido se muestren
          this.recommendedDishes = recommendedProducts
            .filter(item => item && item.id)
            .slice(0, maxRecommendations);
        });
      } else {
        // Asegurar que solo productos con ID válido se muestren
        this.recommendedDishes = recommendedProducts
          .filter(item => item && item.id)
          .slice(0, maxRecommendations);
      }
    });
  }

  private loadFallbackRecommendedDishes() {
    // Cargar productos destacados como recomendados cuando no hay historial de compras
    this.menuService.getFeaturedItems().pipe(takeUntil(this.destroy$)).subscribe(items => {
      // Filtrar solo productos disponibles y que existan en la base de datos
      // Solo productos que vienen del backend (tienen ID válido)
      this.recommendedDishes = items
        .filter(item => {
          if (!item || !item.available || !item.id) return false;
          // Excluir productos específicos que no deben aparecer
          const nameLower = item.name?.toLowerCase() || '';
          
          // Excluir "Hamburguesa Doble BBQ"
          if (nameLower.includes('bbq') && nameLower.includes('doble')) {
            console.warn('⚠️ Producto con BBQ detectado, excluyendo:', item.name);
            return false;
          }
          
          // Excluir "Hamburguesa Vegetariana"
          if (nameLower.includes('vegetariana') || nameLower.includes('veggie')) {
            console.warn('⚠️ Producto vegetariano detectado, excluyendo:', item.name);
            return false;
          }
          
          return true;
        })
        .slice(0, 4);
      
      console.log('✅ Productos recomendados cargados desde BD:', this.recommendedDishes.map(d => d.name));
      
      // Verificar que no haya productos hardcodeados (IDs numéricos pequeños)
      // Los productos de MongoDB tienen ObjectIds de 24 caracteres (strings)
      const hasHardcodedProducts = this.recommendedDishes.some(d => typeof d.id === 'number' && d.id < 100);
      if (hasHardcodedProducts) {
        console.warn('⚠️ Se detectaron productos con IDs numéricos pequeños (posiblemente hardcodeados). Filtrando...');
        // Filtrar productos con IDs numéricos pequeños (probablemente hardcodeados)
        this.recommendedDishes = this.recommendedDishes.filter(d => 
          typeof d.id === 'string' || (typeof d.id === 'number' && d.id >= 100)
        );
        console.log('✅ Productos recomendados después de filtrar hardcodeados:', this.recommendedDishes.map(d => d.name));
      }
    });
  }

  private loadFavoriteDishes() {
    // Cargar favoritos desde el servicio
    this.userService.getFavoriteDishes().pipe(takeUntil(this.destroy$)).subscribe(favoriteIds => {
      if (favoriteIds && favoriteIds.length > 0) {
        // Cargar todos los items de favoritos usando forkJoin para manejar múltiples suscripciones
        const favoriteObservables = favoriteIds.map(id =>
          this.menuService.getItemById(id)
        );

        forkJoin(favoriteObservables).pipe(takeUntil(this.destroy$)).subscribe(items => {
          // Filtrar items nulos/undefined y asegurarse de que solo incluya los que existen
          this.favoriteDishes = items.filter(item => item !== null && item !== undefined) as MenuItem[];
        });
      } else {
        // Si no hay favoritos guardados, mostrar array vacío
        this.favoriteDishes = [];
      }
    });
  }

  passwordMatchValidator(form: FormGroup) {
    return form.get('newPassword')?.value === form.get('confirmPassword')?.value
      ? null : { 'mismatch': true };
  }

  cityValidator(control: AbstractControl): ValidationErrors | null {
    const city = control.value;
    if (!city || city.trim().toLowerCase() !== 'manizales') {
      return { 'invalidCity': true };
    }
    return null;
  }

  setActiveTab(tab: 'profile' | 'orders' | 'addresses' | 'payment' | 'settings') {
    this.activeTab = tab;
  }

  navigateToProductDetail(productId: number | string, categoryId?: string | null): void {
    if (!productId) {
      console.error('❌ Intento de navegar a producto sin ID');
      return;
    }
    // Navegar al detalle del producto
    // Si tenemos categoryId, pasarlo como query param para poder volver a la categoría
    if (categoryId) {
      this.router.navigate(['/menu/producto', productId], {
        queryParams: { categoryId: categoryId }
      });
    } else {
      this.router.navigate(['/menu/producto', productId]);
    }
  }

  loadOrders() {
    const userInfo = this.authService.getUserInfo();
    if (!userInfo || !userInfo.userId) {
      // Fallback a localStorage si no hay usuario autenticado
      this.userService.getOrders().subscribe(orders => {
        // Ordenar por fecha descendente (más reciente primero)
        // Si las fechas son iguales, ordenar por ID (más reciente primero)
        this.orders = orders.sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          if (dateB !== dateA) {
            return dateB - dateA; // Orden descendente por fecha
          }
          // Si las fechas son iguales, ordenar por ID (más reciente primero)
          return String(b.id).localeCompare(String(a.id));
        });
        this.setupOrders(this.orders);
      });
      return;
    }

    // Obtener pedidos desde el backend
    this.orderService.findByUser(userInfo.userId).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error al cargar pedidos desde el backend:', error);
        // Fallback a localStorage si falla el backend
        return this.userService.getOrders();
      })
    ).subscribe(response => {
      let backendOrders: OrderFromBackend[] = [];
      
      // Manejar tanto la respuesta del backend como la de localStorage
      if (response && 'orders' in response) {
        backendOrders = response.orders;
      } else if (Array.isArray(response)) {
        // Si es un array directo (desde localStorage), ordenarlo por fecha descendente
        // Si las fechas son iguales, ordenar por ID (más reciente primero)
        this.orders = response.sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          if (dateB !== dateA) {
            return dateB - dateA; // Orden descendente por fecha
          }
          // Si las fechas son iguales, ordenar por ID (más reciente primero)
          return String(b.id).localeCompare(String(a.id));
        });
        this.setupOrders(this.orders);
        return;
      }

      // Mapear pedidos del backend al formato del frontend
      this.orders = backendOrders.map(backendOrder => this.mapBackendOrderToFrontend(backendOrder));
      
      // Ordenar por fecha descendente (más reciente primero)
      // Si las fechas son iguales, ordenar por ID (más reciente primero)
      this.orders.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateB !== dateA) {
          return dateB - dateA; // Orden descendente por fecha
        }
        // Si las fechas son iguales, ordenar por ID (más reciente primero)
        return String(b.id).localeCompare(String(a.id));
      });
      
      this.setupOrders(this.orders);
    });
  }

  private setupOrders(orders: Order[]): void {
    // Limpiar intervalos anteriores
    this.progressIntervals.forEach(interval => clearInterval(interval));
    this.progressIntervals.clear();
    
    // Iniciar progreso automático para cada pedido activo
    orders.forEach(order => {
      if (order.status !== 'cancelled' && order.status !== 'delivered') {
        this.startAutoProgress(order);
      }
    });
    
    // Recargar recomendaciones cuando se actualicen las órdenes
    this.loadRecommendedDishes();
  }

  private mapBackendOrderToFrontend(backendOrder: OrderFromBackend): Order {
    const orderId = backendOrder._id || backendOrder.id || '';

    // Intentar obtener el pedido detallado desde localStorage (donde se guardan los detalles completos)
    let detailedOrder: Order | null = null;
    try {
      const userInfo = this.authService.getUserInfo();
      if (userInfo) {
        const userId = userInfo.userId || userInfo.email;
        const storedOrders = localStorage.getItem(`userOrders_${userId}`);
        if (storedOrders) {
          const orders = JSON.parse(storedOrders);
          detailedOrder = orders.find((o: Order) => 
            o.id === orderId || 
            (typeof o.id === 'string' && typeof orderId === 'string' && o.id.includes(orderId.substring(0, 8))) ||
            (o.trackingCode && orderId.includes(o.trackingCode))
          );
        }
      }
    } catch (e) {
      console.warn('No se pudieron obtener detalles del pedido desde localStorage:', e);
    }

    // Si encontramos el pedido detallado, usar sus items y detalles
    // Si no hay items detallados, usar items básicos (los detalles completos vienen de localStorage)
    const orderItems = detailedOrder?.items || [];

    // Mapear estado del backend al frontend
    const statusMap: Record<string, Order['status']> = {
      'pendiente': 'pending',
      'en_proceso': 'preparing',
      'completado': 'ready',
      'entregado': 'delivered',
      'cancelado': 'cancelled'
    };

    // Si el backend devuelve "completado", verificar si el pedido detallado tiene "delivered"
    let mappedStatus = statusMap[backendOrder.status] || 'pending';
    if (backendOrder.status === 'completado' && detailedOrder?.status === 'delivered') {
      mappedStatus = 'delivered'; // Mantener "delivered" si estaba guardado así
    }

    // Asegurar que la fecha sea correcta y consistente
    let orderDate: Date;
    if (backendOrder.createdAt) {
      orderDate = new Date(backendOrder.createdAt);
      // Validar que la fecha sea válida
      if (isNaN(orderDate.getTime())) {
        orderDate = detailedOrder?.date ? new Date(detailedOrder.date) : new Date();
      }
    } else {
      orderDate = detailedOrder?.date ? new Date(detailedOrder.date) : new Date();
    }

    return {
      id: orderId,
      date: orderDate,
      items: detailedOrder?.items || orderItems,
      total: backendOrder.total,
      status: mappedStatus,
      paymentMethod: backendOrder.payment_method,
      trackingCode: detailedOrder?.trackingCode || orderId.substring(0, 8).toUpperCase(),
      // Información adicional del pedido detallado
      deliveryAddress: detailedOrder?.deliveryAddress,
      deliveryNeighborhood: detailedOrder?.deliveryNeighborhood,
      deliveryPhone: detailedOrder?.deliveryPhone,
      orderType: detailedOrder?.orderType,
      subtotal: detailedOrder?.subtotal,
      additionalFees: detailedOrder?.additionalFees,
      estimatedDeliveryTime: detailedOrder?.estimatedDeliveryTime,
      estimatedPrepTime: detailedOrder?.estimatedPrepTime,
      statusHistory: detailedOrder?.statusHistory,
      canCancel: detailedOrder?.canCancel
    };
  }

  private startAutoProgress(order: Order): void {
    // Limpiar intervalo anterior si existe
    if (this.progressIntervals.has(order.id)) {
      clearInterval(this.progressIntervals.get(order.id));
    }

    // Actualizar solo el progreso visual (el estado viene del backend)
    const updateProgress = () => {
      // Buscar el pedido actualizado en el array
      const orderIndex = this.orders.findIndex(o => o.id === order.id);
      if (orderIndex === -1) return;
      
      const currentOrder = this.orders[orderIndex];
      if (currentOrder.status === 'cancelled' || currentOrder.status === 'delivered') {
        return; // No actualizar si está cancelado o entregado
      }

      // Solo actualizar el progreso visual, no el estado
      // El estado se actualiza desde el backend cada 10 segundos en loadOrders()
      this.cdr.markForCheck();
    };

    // Actualizar inmediatamente
    updateProgress();

    // Actualizar cada 5 segundos para verificar cambios de estado
    const interval = setInterval(updateProgress, 5000);
    this.progressIntervals.set(order.id, interval);
  }

  private calculateTimeBasedProgress(order: Order): number {
    if (order.status === 'cancelled') {
      return 0;
    }

    const now = new Date();
    const orderDate = new Date(order.date);
    const timeElapsed = now.getTime() - orderDate.getTime();
    const secondsElapsed = timeElapsed / 1000; // Convertir a segundos

    // Cada estado toma 2 minutos (120 segundos)
    const secondsPerState = 120;
    
    const statusOrder = ['pending', 'preparing', 'ready', 'delivered'];
    const currentStatusIndex = statusOrder.indexOf(order.status);
    
    if (currentStatusIndex === -1) return 0;
    
    // Calcular el progreso total basado en el tiempo transcurrido
    // Hay 3 segmentos entre 4 puntos (0% -> 33.33% -> 66.66% -> 100%)
    const totalSeconds = secondsPerState * 3; // 3 segundos totales
    
    // Calcular el progreso total (0-100%)
    let totalProgress = (secondsElapsed / totalSeconds) * 100;
    
    // Asegurar que no exceda el progreso máximo según el estado actual
    const maxProgressForState = (currentStatusIndex + 1) * 33.33;
    totalProgress = Math.min(totalProgress, maxProgressForState);
    
    // Asegurar que no sea menor que el progreso mínimo del estado actual
    const minProgressForState = currentStatusIndex * 33.33;
    totalProgress = Math.max(totalProgress, minProgressForState);
    
    return Math.min(Math.max(totalProgress, 0), 100);
  }

  loadAddresses() {
    this.userService.getAddresses().subscribe(addresses => {
      this.addresses = addresses;
    });
  }

  loadPaymentMethods() {
    this.userService.getPaymentMethods().subscribe(methods => {
      this.paymentMethods = methods;
    });
  }

  openPaymentMethodModal() {
    this.showPaymentMethodModal = true;
    this.editingPaymentMethod = null;
    this.paymentMethodForm.reset();
    this.paymentMethodForm.patchValue({
      type: 'card',
      isDefault: this.paymentMethods.length === 0
    });
  }

  closePaymentMethodModal() {
    this.showPaymentMethodModal = false;
    this.editingPaymentMethod = null;
    this.paymentMethodForm.reset();
    this.submitted = false;
  }

  onPaymentMethodSubmit() {
    this.submitted = true;

    // Validar según el tipo de método
    const formValue = this.paymentMethodForm.value;
    if (formValue.type === 'card') {
      // Validar campos de tarjeta
      if (!this.paymentMethodForm.get('cardNumber')?.valid ||
          !this.paymentMethodForm.get('cardHolder')?.valid ||
          !this.paymentMethodForm.get('expiryMonth')?.valid ||
          !this.paymentMethodForm.get('expiryYear')?.valid ||
          !this.paymentMethodForm.get('cvv')?.valid) {
        this.notificationService.showError('Por favor, completa todos los campos de la tarjeta correctamente');
        return;
      }
    }

    if (this.paymentMethodForm.valid || formValue.type === 'cash') {
      const isDefault = formValue.isDefault || this.paymentMethods.length === 0;

      if (this.editingPaymentMethod) {
        // Editar método existente
        const updatedMethod: PaymentMethod = {
          ...this.editingPaymentMethod,
          type: formValue.type,
          last4: formValue.cardNumber ? formValue.cardNumber.replace(/\s/g, '').slice(-4) : undefined,
          brand: formValue.brand || 'Visa',
          isDefault: isDefault
        };

        // Si se marca como principal, quitar el estado de los demás
        if (isDefault) {
          this.paymentMethods.forEach(m => {
            if (m.id !== updatedMethod.id && m.isDefault) {
              const nonDefaultMethod = { ...m, isDefault: false };
              this.userService.updatePaymentMethod(nonDefaultMethod);
            }
          });
        }

        this.userService.updatePaymentMethod(updatedMethod);
        this.notificationService.showSuccess('Método de pago actualizado correctamente');
      } else {
        // Crear nuevo método
        const newMethod: PaymentMethod = {
          id: 'pm_' + Date.now(),
          type: formValue.type,
          last4: formValue.cardNumber ? formValue.cardNumber.replace(/\s/g, '').slice(-4) : undefined,
          brand: formValue.brand || 'Visa',
          isDefault: isDefault
        };

        // Si se marca como principal, quitar el estado de los demás
        if (isDefault) {
          this.paymentMethods.forEach(m => {
            if (m.isDefault) {
              const nonDefaultMethod = { ...m, isDefault: false };
              this.userService.updatePaymentMethod(nonDefaultMethod);
            }
          });
        }

        this.userService.savePaymentMethod(newMethod);
        this.notificationService.showSuccess('Método de pago agregado correctamente');
      }

      this.loadPaymentMethods();
      this.closePaymentMethodModal();
    } else {
      this.notificationService.showError('Por favor, completa todos los campos correctamente');
    }
  }

  editPaymentMethod(method: PaymentMethod) {
    this.editingPaymentMethod = method;
    this.showPaymentMethodModal = true;
    this.paymentMethodForm.patchValue({
      type: method.type,
      cardNumber: method.last4 ? '**** **** **** ' + method.last4 : '',
      brand: method.brand || 'Visa',
      isDefault: method.isDefault
    });
  }

  deletePaymentMethod(method: PaymentMethod) {
    this.notificationService.confirm(
      'Eliminar Método de Pago',
      `¿Estás seguro de que deseas eliminar este método de pago?`,
      'Eliminar',
      'Cancelar'
    ).then(confirmed => {
      if (confirmed) {
        this.userService.deletePaymentMethod(method.id);
        this.loadPaymentMethods();
        this.notificationService.showSuccess('Método de pago eliminado correctamente');
      }
    });
  }

  formatCardNumber(event: Event) {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\s/g, '').replace(/[^0-9]/gi, '');
    const formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
    this.paymentMethodForm.patchValue({ cardNumber: formattedValue }, { emitEvent: false });
  }

  onProfileSubmit() {
    this.submitted = true;
    if (this.profileForm.valid) {
      // Actualizar el perfil en el servicio
      this.userService.updateUserProfile(this.profileForm.value);

      // Actualizar el perfil local también
      this.userService.getUserProfile().subscribe(updatedProfile => {
        if (updatedProfile) {
          this.userProfile = updatedProfile;
          // Actualizar el formulario con los valores guardados
          this.profileForm.patchValue({
            fullName: updatedProfile.fullName,
            email: updatedProfile.email,
            phone: updatedProfile.phone
          });
        }
      });

      this.notificationService.showSuccess('Perfil actualizado correctamente');
      this.submitted = false;
      this.showProfileModal = false;
    } else {
      // Mostrar errores de validación
      this.notificationService.showError('Por favor, completa todos los campos correctamente');
    }
  }

  onAddressSubmit() {
    this.submitted = true;
    if (this.addressForm.valid) {
      const isDefault = this.addressForm.get('isDefault')?.value || false;

      this.userService.getAddresses().subscribe(addresses => {
        if (this.editingAddress) {
          // Editar dirección existente
          const updatedAddress: Address = {
            ...this.editingAddress,
            ...this.addressForm.value,
            isDefault: isDefault
          };

          // Si se marca como principal, quitar el estado de las demás
          if (isDefault) {
            addresses.forEach(addr => {
              if (addr.id !== updatedAddress.id && addr.isDefault) {
                const nonDefaultAddr = { ...addr, isDefault: false };
                this.userService.updateAddress(nonDefaultAddr);
              }
            });
          }
          this.updateAddress(updatedAddress);
        } else {
          // Crear nueva dirección
          const newAddress: Address = {
            id: 'addr_' + Date.now(),
            ...this.addressForm.value,
            isDefault: isDefault || addresses.length === 0 // Si no hay direcciones, esta será la principal
          };

          // Si se marca como principal, quitar el estado de las demás
          if (isDefault) {
            addresses.forEach(addr => {
              if (addr.isDefault) {
                const nonDefaultAddr = { ...addr, isDefault: false };
                this.userService.updateAddress(nonDefaultAddr);
              }
            });
          }
          this.userService.saveAddress(newAddress);
        }

        // Recargar direcciones después de guardar
        this.loadAddresses();

        // Cerrar modal y limpiar formulario
        this.addressForm.reset();
        this.addressForm.patchValue({
          city: 'Manizales',
          postalCode: '170001',
          isDefault: false
        });
        this.showAddressModal = false;
        this.showEditAddressModal = false;
        this.editingAddress = null;
        this.submitted = false;
        this.notificationService.showSuccess('Dirección guardada correctamente');
      });
    }
  }

  editAddress(address: Address) {
    this.editingAddress = address;
    this.addressForm.patchValue({
      title: address.title,
      address: address.address,
      neighborhood: address.neighborhood || '',
      city: 'Manizales', // Forzar Manizales al editar
      postalCode: '170001', // Forzar código postal al editar
      isDefault: address.isDefault || false
    });
    this.showEditAddressModal = true;
  }

  closeAddressModal() {
    this.addressForm.reset();
    this.addressForm.patchValue({
      city: 'Manizales',
      postalCode: '170001',
      isDefault: false
    });
    this.showAddressModal = false;
    this.showEditAddressModal = false;
    this.editingAddress = null;
    this.submitted = false;
  }

  setDefaultAddress(address: Address) {
    this.userService.getAddresses().subscribe(addresses => {
      // Actualizar todas las direcciones: quitar principal de todas y ponerla solo en la seleccionada
      const updatedAddresses = addresses.map(a => {
        if (a.id === address.id) {
          return { ...a, isDefault: true };
        } else {
          return { ...a, isDefault: false };
        }
      });

      // Guardar usando el servicio que ya maneja el userId
      updatedAddresses.forEach(addr => {
        this.userService.updateAddress(addr);
      });

      // Recargar las direcciones para actualizar la vista
      this.loadAddresses();
      this.notificationService.showSuccess('Dirección principal actualizada');
    });
  }

  async deleteAddress(address: Address) {
    const confirmed = await this.notificationService.confirm(
      'Eliminar Dirección',
      '¿Estás seguro de que deseas eliminar esta dirección?'
    );

    if (confirmed) {
      // Obtener userId del usuario actual
      const userInfoStr = localStorage.getItem('userInfo');
      if (!userInfoStr) {
        this.notificationService.showError('Error: No se encontró información del usuario');
        return;
      }

      try {
        const userInfo = JSON.parse(userInfoStr);
        const userId = userInfo.userId || userInfo.email;

        this.userService.getAddresses().subscribe(addresses => {
          const updatedAddresses = addresses.filter(a => a.id !== address.id);
          localStorage.setItem(`userAddresses_${userId}`, JSON.stringify(updatedAddresses));
          this.loadAddresses();
          this.notificationService.showSuccess('Dirección eliminada correctamente');
        });
      } catch (e) {
        console.error('Error al eliminar dirección:', e);
        this.notificationService.showError('Error al eliminar la dirección');
      }
    }
  }

  updateAddress(updatedAddress: Address) {
    // Usar el método del servicio que ya maneja el userId
    this.userService.updateAddress(updatedAddress);
  }

  openProfileEdit() {
    if (this.userProfile) {
      this.profileForm.patchValue({
        fullName: this.userProfile.fullName,
        email: this.userProfile.email,
        phone: this.userProfile.phone
      });
    }
    this.showProfileModal = true;
  }

  closeProfileEdit() {
    this.showProfileModal = false;
    this.submitted = false;
    this.profileForm.reset();
    if (this.userProfile) {
      this.profileForm.patchValue({
        fullName: this.userProfile.fullName,
        email: this.userProfile.email,
        phone: this.userProfile.phone
      });
    }
  }

  onPasswordSubmit() {
    this.submitted = true;
    if (this.passwordForm.valid) {
      // Aquí iría la lógica de cambio de contraseña
      this.notificationService.showSuccess('Contraseña actualizada correctamente');
      this.passwordForm.reset();
      this.showPasswordModal = false;
      this.submitted = false;
    }
  }

  getOrderStatusClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'pending': 'status-pending',
      'preparing': 'status-preparing',
      'ready': 'status-ready',
      'delivered': 'status-delivered',
      'cancelled': 'status-cancelled'
    };
    return statusClasses[status] || '';
  }

  getOrderStatusText(status: string): string {
    const statusTexts: { [key: string]: string } = {
      'pending': 'Pendiente',
      'preparing': 'Preparando',
      'ready': 'Listo',
      'delivered': 'Entregado',
      'cancelled': 'Cancelado'
    };
    return statusTexts[status] || status;
  }

  getOrderStatusIcon(status: string): string {
    const statusIcons: { [key: string]: string } = {
      'pending': 'bi-clock-history',
      'preparing': 'bi-hourglass-split',
      'ready': 'bi-check-circle',
      'delivered': 'bi-truck',
      'cancelled': 'bi-x-circle'
    };
    return statusIcons[status] || 'bi-circle';
  }

  formatEstimatedTime(order: Order): string {
    if (!order.estimatedDeliveryTime) return '';
    const now = new Date();
    const estimated = new Date(order.estimatedDeliveryTime);
    const diffMs = estimated.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));

    if (diffMins <= 0) {
      return 'Tiempo estimado cumplido';
    } else if (diffMins < 60) {
      return `Aprox. ${diffMins} min`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `Aprox. ${hours}h ${mins}min`;
    }
  }

  getTrackingCode(order: Order): string {
    return order.trackingCode || order.id.slice(-8).toUpperCase();
  }

  cancelOrder(order: Order): void {
    this.notificationService.confirm(
      'Cancelar Pedido',
      `¿Estás seguro de que deseas cancelar este pedido? Esta acción no se puede deshacer.`,
      'Cancelar Pedido',
      'Volver'
    ).then(confirmed => {
      if (confirmed) {
        this.userService.cancelOrder(order.id).subscribe(success => {
          if (success) {
            this.notificationService.showSuccess('Pedido cancelado exitosamente');
            this.loadOrders();
          } else {
            this.notificationService.showError('No se pudo cancelar el pedido. El tiempo límite ha expirado o el pedido ya está en preparación.');
          }
        });
      }
    });
  }

  reorder(order: Order): void {
    // Agregar todos los items del pedido al carrito
    let itemsAdded = 0;
    const totalItems = order.items.reduce((sum, it) => sum + it.quantity, 0);

    order.items.forEach(item => {
      // Buscar el producto en el menú
      this.menuService.getItemById(item.id).subscribe(product => {
        if (product) {
          // Mapear las opciones para incluir el id requerido por CartItemOption
          const cartOptions = (item.selectedOptions || []).map((opt: OrderItemOption, index: number) => ({
            id: opt.id || `opt_${item.id}_${index}`,
            name: opt.name,
            price: opt.price
          }));

          for (let i = 0; i < item.quantity; i++) {
            this.cartService.addItem({
              productId: product.id,
              productName: product.name,
              productDescription: product.description || '',
              basePrice: product.price,
              selectedOptions: cartOptions,
              quantity: 1,
              imageUrl: product.imageUrl
            });
            itemsAdded++;
          }
          if (itemsAdded === totalItems) {
            this.notificationService.showSuccess(`Se agregaron ${itemsAdded} item(s) al carrito`);
            setTimeout(() => {
              this.router.navigate(['/menu']);
            }, 1000);
          }
        } else {
          // Si no se encuentra el producto, usar la información del pedido
          // Mapear las opciones para incluir el id requerido por CartItemOption
          const cartOptions = (item.selectedOptions || []).map((opt: OrderItemOption, index: number) => ({
            id: opt.id || `opt_${item.id}_${index}`,
            name: opt.name,
            price: opt.price
          }));

          for (let i = 0; i < item.quantity; i++) {
            this.cartService.addItem({
              productId: item.id,
              productName: item.name,
              productDescription: '',
              basePrice: item.price,
              selectedOptions: cartOptions,
              quantity: 1
            });
            itemsAdded++;
          }
          if (itemsAdded === totalItems) {
            this.notificationService.showSuccess(`Se agregaron ${itemsAdded} item(s) al carrito`);
            setTimeout(() => {
              this.router.navigate(['/menu']);
            }, 1000);
          }
        }
      });
    });
  }

  getOrderStatusSteps(order: Order): Array<{status: string, label: string, icon: string, completed: boolean, current: boolean}> {
    const steps = [
      { status: 'pending', label: 'Confirmado', icon: 'bi-check-circle', completed: true, current: false },
      { status: 'preparing', label: 'Preparando', icon: 'bi-hourglass-split', completed: false, current: false },
      { status: 'ready', label: 'Listo', icon: 'bi-check-circle', completed: false, current: false },
      { status: 'delivered', label: 'Entregado', icon: 'bi-truck', completed: false, current: false }
    ];

    const statusOrder = ['pending', 'preparing', 'ready', 'delivered'];
    const currentIndex = statusOrder.indexOf(order.status);

    steps.forEach((step, index) => {
      if (index <= currentIndex) {
        step.completed = true;
      }
      if (index === currentIndex) {
        step.current = true;
      }
    });

    if (order.status === 'cancelled') {
      return steps.map(s => ({ ...s, completed: false, current: false }));
    }

    return steps;
  }

  trackByOrderId(index: number, order: Order): string {
    return order.id;
  }

  getOrderProgress(order: Order): number {
    // Usar el cálculo basado en tiempo para progreso automático
    return this.calculateTimeBasedProgress(order);
  }

  expandOrderDetails(order: Order): void {
    // Toggle para expandir/colapsar detalles del pedido
    if (!this.expandedOrders) {
      this.expandedOrders = new Set<string>();
    }
    if (this.expandedOrders.has(order.id)) {
      this.expandedOrders.delete(order.id);
    } else {
      this.expandedOrders.add(order.id);
    }
  }

  isOrderExpanded(order: Order): boolean {
    return this.expandedOrders?.has(order.id) || false;
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  async logout() {
    const confirmed = await this.notificationService.confirm(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas cerrar sesión?'
    );

    if (confirmed) {
      // Usar authService.logout() que limpia todo correctamente y actualiza los observables
      this.authService.logout();
    }
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  getAvatarImage(): string {
    if (!this.userProfile) {
      return 'https://i.pravatar.cc/150?img=1';
    }
    
    const name = this.userProfile.fullName?.toLowerCase() || '';
    const email = this.userProfile.email?.toLowerCase() || '';
    
    // Nombres comunes de mujer en español
    const femaleNames = ['maria', 'maría', 'ana', 'carmen', 'laura', 'patricia', 'guadalupe', 'rosa', 'marta', 'andrea', 'fernanda', 'valentina', 'sofia', 'sofía', 'isabella', 'camila', 'valeria', 'daniela', 'natalia', 'paula', 'carolina', 'alejandra', 'diana', 'monica', 'mónica', 'claudia', 'juliana', 'lucia', 'lucía', 'elena', 'cristina', 'isabel', 'beatriz', 'adriana', 'gabriela', 'vanessa', 'jessica', 'karen', 'katherine', 'kathryn', 'liliana', 'mariana', 'michelle', 'nancy', 'olga', 'raquel', 'sandra', 'tania', 'veronica', 'verónica', 'yolanda', 'zulema'];
    
    // Nombres comunes de hombre en español
    const maleNames = ['juan', 'carlos', 'jose', 'josé', 'luis', 'miguel', 'antonio', 'francisco', 'manuel', 'pedro', 'david', 'javier', 'jorge', 'alejandro', 'roberto', 'fernando', 'ricardo', 'daniel', 'pablo', 'sergio', 'eduardo', 'mario', 'alberto', 'oscar', 'óscar', 'rafael', 'raul', 'raúl', 'victor', 'victor', 'andres', 'andrés', 'felipe', 'sebastian', 'sebastián', 'nicolas', 'nicolás', 'cristian', 'esteban', 'gabriel', 'hugo', 'ignacio', 'ivan', 'iván', 'leonardo', 'marcos', 'martin', 'martín', 'rodrigo', 'simon', 'simón', 'tomas', 'tomás'];
    
    // Detectar género por nombre
    const firstName = name.split(' ')[0];
    let isFemale = false;
    
    if (femaleNames.includes(firstName)) {
      isFemale = true;
    } else if (maleNames.includes(firstName)) {
      isFemale = false;
    } else {
      // Si no se encuentra en las listas, intentar detectar por terminaciones comunes
      const femaleEndings = ['a', 'ia', 'ina', 'ela', 'ana', 'ina'];
      const maleEndings = ['o', 'io', 'in', 'el', 'an', 'on'];
      
      if (femaleEndings.some(ending => firstName.endsWith(ending))) {
        isFemale = true;
      } else if (maleEndings.some(ending => firstName.endsWith(ending))) {
        isFemale = false;
      } else {
        // Por defecto, si el nombre termina en 'a' es probablemente mujer
        isFemale = firstName.endsWith('a') && !firstName.endsWith('ma') && !firstName.endsWith('pa');
      }
    }
    
    // Si no se puede determinar por nombre, intentar por email
    if (!firstName || firstName.length < 2) {
      const emailName = email.split('@')[0]?.toLowerCase() || '';
      if (emailName) {
        if (femaleNames.some(n => emailName.includes(n))) {
          isFemale = true;
        } else if (maleNames.some(n => emailName.includes(n))) {
          isFemale = false;
        }
      }
    }
    
    // URLs de avatares de muñecas animadas - determinístico basado en el nombre
    // Usar el hash del nombre para seleccionar siempre el mismo avatar
    let hash = 0;
    const nameForHash = name || email;
    for (let i = 0; i < nameForHash.length; i++) {
      hash = nameForHash.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % 8;
    
    if (isFemale) {
      // Muñecas animadas de niña - usando diferentes estilos
      const girlAvatars = [
        'https://api.dicebear.com/7.x/adventurer/svg?seed=' + encodeURIComponent(nameForHash) + '&backgroundColor=b6e3f4,c0aede,ffd5dc,ffdfbf',
        'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(nameForHash) + '&backgroundColor=b6e3f4,c0aede,ffd5dc',
        'https://api.dicebear.com/7.x/big-smile/svg?seed=' + encodeURIComponent(nameForHash) + '&backgroundColor=ffd5dc,b6e3f4',
        'https://api.dicebear.com/7.x/notionists/svg?seed=' + encodeURIComponent(nameForHash) + '&backgroundColor=ffd5dc,c0aede',
        'https://api.dicebear.com/7.x/personas/svg?seed=' + encodeURIComponent(nameForHash) + '&backgroundColor=b6e3f4,ffd5dc',
        'https://api.dicebear.com/7.x/fun-emoji/svg?seed=' + encodeURIComponent(nameForHash) + '&backgroundColor=ffd5dc',
        'https://api.dicebear.com/7.x/lorelei/svg?seed=' + encodeURIComponent(nameForHash) + '&backgroundColor=b6e3f4,c0aede',
        'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(nameForHash) + '&backgroundColor=ffd5dc'
      ];
      return girlAvatars[index];
    } else {
      // Muñecas animadas de niño - usando diferentes estilos
      const boyAvatars = [
        'https://api.dicebear.com/7.x/adventurer/svg?seed=' + encodeURIComponent(nameForHash) + '&backgroundColor=b6e3f4,c0aede,ffdfbf',
        'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(nameForHash) + '&backgroundColor=b6e3f4,c0aede',
        'https://api.dicebear.com/7.x/big-smile/svg?seed=' + encodeURIComponent(nameForHash) + '&backgroundColor=b6e3f4,ffdfbf',
        'https://api.dicebear.com/7.x/notionists/svg?seed=' + encodeURIComponent(nameForHash) + '&backgroundColor=b6e3f4,c0aede',
        'https://api.dicebear.com/7.x/personas/svg?seed=' + encodeURIComponent(nameForHash) + '&backgroundColor=b6e3f4,ffdfbf',
        'https://api.dicebear.com/7.x/fun-emoji/svg?seed=' + encodeURIComponent(nameForHash) + '&backgroundColor=b6e3f4',
        'https://api.dicebear.com/7.x/lorelei/svg?seed=' + encodeURIComponent(nameForHash) + '&backgroundColor=b6e3f4,c0aede',
        'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(nameForHash) + '&backgroundColor=b6e3f4'
      ];
      return boyAvatars[index];
    }
  }

  getPaymentMethodName(method: string): string {
    const methods: { [key: string]: string } = {
      'card': 'Tarjeta',
      'cash': 'Efectivo',
      'nequi': 'Nequi',
      'daviplata': 'Daviplata',
      'transfer': 'Transferencia Bancaria'
    };
    return methods[method] || method;
  }
}

