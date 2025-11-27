import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
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
import { ReservationsService } from '../../core/services/reservations.service';
import { Reservation, ReservationFromBackend } from '../../core/models/ReservationResponse';
import { UpdateReservationDto } from '../../core/models/UpdateReservationDto';
import { Meta, Title } from '@angular/platform-browser';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.css']
})
export class PerfilComponent implements OnInit, OnDestroy {
  activeTab: 'profile' | 'orders' | 'addresses' | 'payment' | 'settings' | 'reservations' = 'profile';
  sidebarOpen = false;
  userProfile: UserProfile | null = null;
  orders: Order[] = [];
  addresses: Address[] = [];
  paymentMethods: PaymentMethod[] = [];
  recommendedDishes: MenuItem[] = [];
  favoriteDishes: MenuItem[] = [];
  reservations: Reservation[] = [];

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
  showEditReservationModal = false;
  editingReservation: Reservation | null = null;
  reservationForm: FormGroup;

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
    private orderService: OrderService,
    private reservationsService: ReservationsService,
    private title: Title,
    private meta: Meta
  ) {
    this.title.setTitle('Perfil - PRESTEZA');
    this.meta.updateTag({ name: 'description', content: 'Gestiona tu perfil, pedidos, direcciones y métodos de pago.' });
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
      cardNumber: ['', []],
      cardHolder: ['', []],
      expiryMonth: ['', []],
      expiryYear: ['', []],
      cvv: ['', []],
      brand: ['Visa', [Validators.required]],
      isDefault: [false]
    });

    this.reservationForm = this.fb.group({
      date: ['', [Validators.required]],
      time: ['', [Validators.required]],
      numberOfPeople: [2, [Validators.required, Validators.min(1), Validators.max(20)]],
      specialRequests: ['']
    });
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

  minDate: string = '';

  ngOnInit() {
    if (this.authService.isAdmin()) {
      this.router.navigate(['/admin']);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    this.minDate = today;

    this.loadUserProfile();
    this.loadOrders();
    this.loadReservations();
    setInterval(() => {
      if (this.activeTab === 'orders') {
        this.loadOrders();
      }
      if (this.activeTab === 'reservations') {
        this.loadReservations();
      }
    }, 10000);
    this.authService.userInfo$.pipe(takeUntil(this.destroy$)).subscribe(userInfo => {
      if (userInfo) {
        this.loadUserProfile();
        this.loadFavoriteDishes();
        this.loadAddresses();
      }
    });
    window.addEventListener('userInfoUpdated', () => {
      this.loadUserProfile();
      this.loadFavoriteDishes();
      this.loadAddresses();
      this.loadPaymentMethods();
    });
    
    // Suscribirse a cambios en el perfil del usuario
    this.userService.userProfile$.pipe(takeUntil(this.destroy$)).subscribe(profile => {
      if (profile) {
        this.userProfile = profile;
        this.cdr.detectChanges();
      }
    });
    window.addEventListener('productsUpdated', () => {
      this.loadRecommendedDishes();
      this.loadFavoriteDishes();
    });
    this.loadRecommendedDishes();
    this.loadFavoriteDishes();
    this.loadAddresses();
    this.setupFavoriteListener();
  }

  ngOnDestroy() {
    this.progressIntervals.forEach(interval => clearInterval(interval));
    this.progressIntervals.clear();

    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupFavoriteListener() {
    window.addEventListener('favoritesChanged', () => {
      this.loadFavoriteDishes();
    });
  }

private loadUserProfile() {
  const userInfo = this.authService.getUserInfo();
  if (!userInfo) return;

  const userId = userInfo.userId || userInfo.email;

  // Obtener la fecha de registro: NO crear una nueva fecha, solo usar la existente
  let registrationDate: Date | null = null;
  const profile = JSON.parse(localStorage.getItem(`userProfile_${userId}`) || 'null');
  const savedDate = profile?.memberSince;

  if (savedDate) {
    const parsed = new Date(savedDate);
    if (!isNaN(parsed.getTime())) {
      registrationDate = parsed; // Usar la fecha guardada si es válida
    }
  }
  
  // NO crear una nueva fecha aquí - esperar a que venga del backend o del perfil cargado

  // Intentar obtener el perfil del backend
  this.userService.getUserProfile().pipe(
    takeUntil(this.destroy$),
    catchError(() => {
      // Si falla, usar el perfil del localStorage
      const storedProfile = JSON.parse(localStorage.getItem(`userProfile_${userId}`) || 'null');
      if (storedProfile && (storedProfile.email === userInfo.email || storedProfile.id === userId)) {
        // Preservar la fecha de registro existente
        if (storedProfile.memberSince) {
          const savedDate = new Date(storedProfile.memberSince);
          if (!isNaN(savedDate.getTime())) {
            storedProfile.memberSince = savedDate;
          } else if (registrationDate) {
            storedProfile.memberSince = registrationDate;
          } else {
            storedProfile.memberSince = new Date(); // Solo si no hay ninguna fecha
          }
        } else if (registrationDate) {
          storedProfile.memberSince = registrationDate;
        } else {
          storedProfile.memberSince = new Date(); // Solo si no hay ninguna fecha
        }
        return of(storedProfile);
      }
      
      // Si no existe perfil, crear uno local con fecha actual (solo para usuarios nuevos)
      const phoneFromStorage = localStorage.getItem('userPhone') || '';
      const newUserProfile: UserProfile = {
        id: userId,
        fullName: userInfo.name || 'Usuario',
        email: userInfo.email || '',
        phone: phoneFromStorage,
        memberSince: registrationDate || new Date(), // Usar fecha guardada o fecha actual
        preferences: {
          notifications: true,
          emailNotifications: true,
          smsNotifications: false,
          favoriteCategories: []
        }
      };
      // Guardar el perfil con el teléfono si existe
      if (phoneFromStorage) {
        localStorage.setItem(`userProfile_${userId}`, JSON.stringify(newUserProfile));
      }
      return of(newUserProfile);
    })
  ).subscribe(profile => {
    if (profile) {
      // PRESERVAR SIEMPRE la fecha de registro original del backend o guardada
      // Prioridad: 1) Fecha del perfil (del backend), 2) Fecha guardada, 3) Fecha actual (solo si es nuevo)
      if (profile.memberSince && !isNaN(new Date(profile.memberSince).getTime())) {
        // El perfil ya tiene una fecha válida (del backend), preservarla
        profile.memberSince = new Date(profile.memberSince);
      } else if (registrationDate && !isNaN(registrationDate.getTime())) {
        // Usar la fecha guardada en localStorage
        profile.memberSince = registrationDate;
      } else {
        // Solo usar fecha actual si es un usuario completamente nuevo sin fecha previa
        profile.memberSince = new Date();
      }

      // Asegurar que el teléfono esté presente (buscar en múltiples lugares)
      if (!profile.phone || profile.phone === '' || profile.phone === 'No especificado') {
        const phoneFromStorage = localStorage.getItem('userPhone');
        if (phoneFromStorage) {
          profile.phone = phoneFromStorage;
          // Guardar el perfil actualizado con el teléfono
          const userId = userInfo.userId || userInfo.email;
          if (userId) {
            localStorage.setItem(`userProfile_${userId}`, JSON.stringify(profile));
          }
        }
      }

      this.userProfile = profile;
      this.profileForm.patchValue({
        fullName: profile.fullName,
        email: profile.email,
        phone: profile.phone || ''
      });
      
      // Forzar detección de cambios para asegurar que la vista se actualice
      this.cdr.detectChanges();

      // Si es un perfil nuevo, inicializarlo en el servicio
      if (!profile.id || profile.id === userId) {
        this.userService.initializeUserProfile(profile);
      }
    }
  });

  // Cargar datos secundarios
  this.loadOrders();
  this.loadAddresses();
  this.loadPaymentMethods();
}

  private loadRecommendedDishes() {
    this.userService.getOrders().pipe(takeUntil(this.destroy$)).subscribe(orders => {
      if (!orders || orders.length === 0) {
        this.loadFallbackRecommendedDishes();
        return;
      }
      const purchasedProductIds = new Set<string | number>();
      orders.forEach(order => {
        if (order.items && order.items.length > 0) {
          order.items.forEach(item => {
            // Filtrar IDs inválidos (0, null, undefined, strings vacíos)
            if (item.id !== null && item.id !== undefined) {
              // Convertir a string para comparar, luego verificar si es válido
              const idStr = String(item.id);
              if (idStr !== '0' && idStr !== '' && idStr !== 'null' && idStr !== 'undefined') {
                purchasedProductIds.add(item.id);
              }
            }
          });
        }
      });

      // Filtrar IDs inválidos antes de crear los observables
      const validProductIds = Array.from(purchasedProductIds).filter(id => {
        if (id === null || id === undefined) return false;
        if (id === 0 || id === '0') return false;
        if (typeof id === 'string' && id.trim() === '') return false;
        return true;
      });

      const productObservables = validProductIds.map(productId =>
        this.menuService.getItemById(productId).pipe(
          catchError(() => of(null))
        )
      );

      if (productObservables.length === 0) {
        this.loadFallbackRecommendedDishes();
        return;
      }
      forkJoin(productObservables).pipe(takeUntil(this.destroy$)).subscribe(products => {
        const validProducts = products.filter(p => p !== null && p !== undefined) as MenuItem[];
        const categoryFrequency = new Map<string, number>();

        validProducts.forEach(product => {
          if (product.categoryId) {
            const count = categoryFrequency.get(product.categoryId) || 0;
            categoryFrequency.set(product.categoryId, count + 1);
          }
        });

        this.generateRecommendationsFromOrders(purchasedProductIds, categoryFrequency);
      });
    });
  }

  private generateRecommendationsFromOrders(
    purchasedProductIds: Set<string | number>,
    categoryFrequency: Map<string, number>
  ) {
    const sortedCategories = Array.from(categoryFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);
    if (sortedCategories.length > 0) {
      this.getRecommendedProductsFromCategories(sortedCategories, purchasedProductIds);
    } else {
      this.loadFallbackRecommendedDishes();
    }
  }

  private getRecommendedProductsFromCategories(
    categoryIds: string[],
    purchasedProductIds: Set<string | number>
  ) {
    const recommendedProducts: MenuItem[] = [];
    const maxRecommendations = 4;
    const categoryObservables = categoryIds.map(categoryId =>
      this.menuService.getItemsByCategory(categoryId).pipe(
        catchError(() => {
          return of([]);
        })
      )
    );

    forkJoin(categoryObservables).pipe(takeUntil(this.destroy$)).subscribe(categoryProductsArrays => {
      const allProducts = categoryProductsArrays.flat();
      const newProducts = allProducts.filter(product => {
        if (!product || !product.available) return false;
        if (!product.id) return false;
        if (purchasedProductIds.has(product.id)) return false;
        const nameLower = product.name?.toLowerCase() || '';
        if (nameLower.includes('bbq') && nameLower.includes('doble')) return false;
        if (nameLower.includes('vegetariana') || nameLower.includes('veggie')) return false;
        return true;
      });
      const uniqueProducts = Array.from(
        new Map(newProducts.map(item => [item.id, item])).values()
      );
      recommendedProducts.push(...uniqueProducts.slice(0, maxRecommendations));
      if (recommendedProducts.length < maxRecommendations) {
        this.menuService.getFeaturedItems().pipe(takeUntil(this.destroy$)).subscribe(featuredItems => {
          const additionalProducts = featuredItems
            .filter(item => {
              if (!item || !item.available || !item.id) return false;
              if (purchasedProductIds.has(item.id)) return false;
              if (recommendedProducts.some(rec => rec.id === item.id)) return false;
              const nameLower = item.name?.toLowerCase() || '';
              if (nameLower.includes('bbq') && nameLower.includes('doble')) {
                return false;
              }
              if (nameLower.includes('vegetariana') || nameLower.includes('veggie')) {
                return false;
              }

              return true;
            })
            .slice(0, maxRecommendations - recommendedProducts.length);

          recommendedProducts.push(...additionalProducts);
          this.recommendedDishes = recommendedProducts
            .filter(item => item && item.id)
            .slice(0, maxRecommendations);
        });
      } else {
        this.recommendedDishes = recommendedProducts
          .filter(item => item && item.id)
          .slice(0, maxRecommendations);
      }
    });
  }

  private loadFallbackRecommendedDishes() {
    this.menuService.getFeaturedItems().pipe(takeUntil(this.destroy$)).subscribe(items => {
      this.recommendedDishes = items
        .filter(item => {
          if (!item || !item.available || !item.id) return false;
          const nameLower = item.name?.toLowerCase() || '';
          if (nameLower.includes('bbq') && nameLower.includes('doble')) return false;
          if (nameLower.includes('vegetariana') || nameLower.includes('veggie')) return false;
          return true;
        })
        .slice(0, 4);
      const hasHardcodedProducts = this.recommendedDishes.some(d => typeof d.id === 'number' && d.id < 100);
      if (hasHardcodedProducts) {
        this.recommendedDishes = this.recommendedDishes.filter(d =>
          typeof d.id === 'string' || (typeof d.id === 'number' && d.id >= 100)
        );
      }
    });
  }

  private loadFavoriteDishes() {
    this.userService.getFavoriteDishes().pipe(takeUntil(this.destroy$)).subscribe(favoriteIds => {
      if (favoriteIds && favoriteIds.length > 0) {
        // Filtrar IDs inválidos antes de hacer las peticiones
        const validFavoriteIds = favoriteIds.filter(id => {
          if (id === null || id === undefined) return false;
          if (id === 0 || id === '0') return false;
          if (typeof id === 'string' && id.trim() === '') return false;
          return true;
        });

        if (validFavoriteIds.length === 0) {
          this.favoriteDishes = [];
          return;
        }

        const favoriteObservables = validFavoriteIds.map(id =>
          this.menuService.getItemById(id).pipe(
            catchError(() => of(null))
          )
        );

        forkJoin(favoriteObservables).pipe(takeUntil(this.destroy$)).subscribe(items => {
          this.favoriteDishes = items.filter(item => item !== null && item !== undefined) as MenuItem[];
        });
      } else {
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

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  setActiveTab(tab: 'profile' | 'orders' | 'addresses' | 'payment' | 'settings' | 'reservations') {
    this.activeTab = tab;
    // Cerrar sidebar en móvil/tablet después de seleccionar una opción
    if (window.innerWidth <= 992) {
      this.sidebarOpen = false;
    }
    if (tab === 'reservations') {
      this.loadReservations();
    }
  }

  navigateToProductDetail(productId: number | string, categoryId?: string | null): void {
    if (!productId) {
      return;
    }
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
      this.userService.getOrders().subscribe(orders => {
        this.orders = orders.sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          if (dateB !== dateA) {
            return dateB - dateA;
          }
          return String(b.id).localeCompare(String(a.id));
        });
        this.setupOrders(this.orders);
      });
      return;
    }
    this.orderService.findByUser(userInfo.userId).pipe(
      takeUntil(this.destroy$),
      catchError(() => {
        return this.userService.getOrders();
      })
    ).subscribe(response => {
      let backendOrders: OrderFromBackend[] = [];
      if (response && 'orders' in response) {
        backendOrders = response.orders;
      } else if (Array.isArray(response)) {
        this.orders = response.sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          if (dateB !== dateA) {
            return dateB - dateA;
          }
          return String(b.id).localeCompare(String(a.id));
        });
        this.setupOrders(this.orders);
        return;
      }
      this.orders = backendOrders.map(backendOrder => this.mapBackendOrderToFrontend(backendOrder));
      this.orders.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateB !== dateA) {
          return dateB - dateA;
        }
        return String(b.id).localeCompare(String(a.id));
      });

      this.setupOrders(this.orders);
    });
  }

  private setupOrders(orders: Order[]): void {
    this.progressIntervals.forEach(interval => clearInterval(interval));
    this.progressIntervals.clear();
    orders.forEach(order => {
      if (order.status !== 'cancelled' && order.status !== 'delivered') {
        this.startAutoProgress(order);
      }
    });
    this.loadRecommendedDishes();
  }

  private mapBackendOrderToFrontend(backendOrder: OrderFromBackend): Order {
    const orderId = backendOrder._id || backendOrder.id || '';
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
    } catch {}
    
    // Mapear items del backend si no se encontró detailedOrder
    let orderItems: any[] = [];
    if (detailedOrder?.items && detailedOrder.items.length > 0) {
      orderItems = detailedOrder.items;
    } else if (backendOrder.products && Array.isArray(backendOrder.products) && backendOrder.products.length > 0) {
      // Si el backend tiene products, mapearlos a items
      const firstProduct = backendOrder.products[0];
      if (typeof firstProduct === 'object' && 'name' in firstProduct) {
        // Es un array de ProductOrderItem
        orderItems = (backendOrder.products as any[]).map((product: any) => {
          const selectedOptions = product.adds ? product.adds.map((add: any) => ({
            id: add.addId || '',
            name: add.name || '',
            price: add.price || 0,
            type: 'addon' as const
          })) : [];

          return {
            id: product.dishId || product.id || '',
            name: product.name || `Producto #${product.dishId || product.id}`,
            quantity: product.quantity || 1,
            price: product.unit_price || product.price || 0,
            selectedOptions: selectedOptions,
            unavailable: product.unavailable || false,
            unavailableReason: product.unavailableReason || product.unavailable_reason || ''
          };
        });
      } else if (typeof firstProduct === 'string') {
        // Es un array de IDs (legacy) - crear items básicos
        orderItems = (backendOrder.products as string[]).map((productId: string, index: number) => ({
          id: productId,
          name: `Producto #${productId.substring(0, 8)}`,
          quantity: 1,
          price: 0,
          selectedOptions: []
        }));
      }
    }
    
    const statusMap: Record<string, Order['status']> = {
      'pendiente': 'pending',
      'en_proceso': 'preparing',
      'completado': 'ready',
      'entregado': 'delivered',
      'cancelado': 'cancelled'
    };
    let mappedStatus = statusMap[backendOrder.status] || 'pending';
    if (backendOrder.status === 'completado' && detailedOrder?.status === 'delivered') {
      mappedStatus = 'delivered';
    }
    let orderDate: Date;
    if (backendOrder.createdAt) {
      orderDate = new Date(backendOrder.createdAt);
      if (isNaN(orderDate.getTime())) {
        orderDate = detailedOrder?.date ? new Date(detailedOrder.date) : new Date();
      }
    } else {
      orderDate = detailedOrder?.date ? new Date(detailedOrder.date) : new Date();
    }

    // Calcular subtotal si no existe
    let subtotal = detailedOrder?.subtotal;
    if (subtotal === undefined || subtotal === null) {
      const items = detailedOrder?.items || orderItems;
      subtotal = items.reduce((sum: number, item: any) => {
        const itemTotal = (item.price || 0) * (item.quantity || 1);
        const optionsTotal = (item.selectedOptions || []).reduce((optSum: number, opt: any) => 
          optSum + ((opt.price || 0) * (item.quantity || 1)), 0);
        return sum + itemTotal + optionsTotal;
      }, 0);
    }

    // Calcular additionalFees si no existe
    let additionalFees = detailedOrder?.additionalFees;
    if (additionalFees === undefined || additionalFees === null) {
      additionalFees = 0;
    }

    // Determinar orderType si no existe
    let orderType = detailedOrder?.orderType;
    if (!orderType) {
      orderType = detailedOrder?.deliveryAddress ? 'delivery' : 'pickup';
    }

    // Generar trackingCode si no existe
    let trackingCode = detailedOrder?.trackingCode;
    if (!trackingCode) {
      trackingCode = orderId.substring(0, 8).toUpperCase();
    }

    // Asegurar que siempre haya items
    const finalItems = (detailedOrder?.items && detailedOrder.items.length > 0) 
      ? detailedOrder.items 
      : (orderItems.length > 0 ? orderItems : []);

    return {
      id: orderId,
      date: orderDate,
      items: finalItems,
      total: backendOrder.total,
      status: mappedStatus,
      paymentMethod: backendOrder.payment_method || detailedOrder?.paymentMethod || 'cash',
      trackingCode: trackingCode,
      deliveryAddress: detailedOrder?.deliveryAddress,
      deliveryNeighborhood: detailedOrder?.deliveryNeighborhood,
      deliveryPhone: detailedOrder?.deliveryPhone,
      orderType: orderType,
      subtotal: subtotal,
      additionalFees: additionalFees,
      estimatedDeliveryTime: detailedOrder?.estimatedDeliveryTime,
      estimatedPrepTime: detailedOrder?.estimatedPrepTime,
      statusHistory: detailedOrder?.statusHistory,
      canCancel: detailedOrder?.canCancel,
      deliveryInstructions: detailedOrder?.deliveryInstructions
    };
  }

  private startAutoProgress(order: Order): void {
    if (this.progressIntervals.has(order.id)) {
      clearInterval(this.progressIntervals.get(order.id));
    }
    const updateProgress = () => {
      const orderIndex = this.orders.findIndex(o => o.id === order.id);
      if (orderIndex === -1) return;
      const currentOrder = this.orders[orderIndex];
      if (currentOrder.status === 'cancelled' || currentOrder.status === 'delivered') {
        if (this.progressIntervals.has(order.id)) {
          clearInterval(this.progressIntervals.get(order.id));
          this.progressIntervals.delete(order.id);
        }
        return;
      }
      // Usar setTimeout para evitar ExpressionChangedAfterItHasBeenCheckedError
      setTimeout(() => {
        this.cdr.markForCheck();
      }, 0);
    };
    updateProgress();
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
    const secondsElapsed = timeElapsed / 1000;
    const secondsPerState = 120;
    const statusOrder = ['pending', 'preparing', 'ready', 'delivered'];
    const currentStatusIndex = statusOrder.indexOf(order.status);
    if (currentStatusIndex === -1) return 0;
    const totalSeconds = secondsPerState * 3;
    let totalProgress = (secondsElapsed / totalSeconds) * 100;
    const maxProgressForState = (currentStatusIndex + 1) * 33.33;
    totalProgress = Math.min(totalProgress, maxProgressForState);
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
    const formValue = this.paymentMethodForm.value;
    if (formValue.type === 'card') {
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
        const updatedMethod: PaymentMethod = {
          ...this.editingPaymentMethod,
          type: formValue.type,
          last4: formValue.cardNumber ? formValue.cardNumber.replace(/\s/g, '').slice(-4) : undefined,
          brand: formValue.brand || 'Visa',
          isDefault: isDefault
        };

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
        const newMethod: PaymentMethod = {
          id: 'pm_' + Date.now(),
          type: formValue.type,
          last4: formValue.cardNumber ? formValue.cardNumber.replace(/\s/g, '').slice(-4) : undefined,
          brand: formValue.brand || 'Visa',
          isDefault: isDefault
        };
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
      this.userService.updateUserProfile(this.profileForm.value).subscribe({
        next: (updatedProfile: UserProfile) => {
          // Actualizar el perfil local inmediatamente
          this.userProfile = updatedProfile;
          this.profileForm.patchValue({
            fullName: updatedProfile.fullName,
            email: updatedProfile.email,
            phone: updatedProfile.phone
          });
          
          // Forzar detección de cambios
          this.cdr.detectChanges();
          
          this.notificationService.showSuccess('Perfil actualizado correctamente');
          this.submitted = false;
          this.showProfileModal = false;
          
          // Recargar el perfil para asegurar que todo esté sincronizado
          setTimeout(() => {
            this.loadUserProfile();
          }, 100);
        },
        error: (error: HttpErrorResponse) => {
          console.error('Error al actualizar perfil:', error);
          const errorMessage = error?.message || error?.error?.message || 'Error al actualizar el perfil';
          this.notificationService.showError(errorMessage);
          this.submitted = false;
        }
      });
    } else {
      this.notificationService.showError('Por favor, completa todos los campos correctamente');
    }
  }

  onAddressSubmit() {
    this.submitted = true;
    if (this.addressForm.valid) {
      const isDefault = this.addressForm.get('isDefault')?.value || false;

      this.userService.getAddresses().subscribe(addresses => {
        if (this.editingAddress) {
          const updatedAddress: Address = {
            ...this.editingAddress,
            ...this.addressForm.value,
            isDefault: isDefault
          };
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
          const newAddress: Address = {
            id: 'addr_' + Date.now(),
            ...this.addressForm.value,
            isDefault: isDefault || addresses.length === 0
          };
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
        this.loadAddresses();
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
      city: 'Manizales',
      postalCode: '170001',
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
      const updatedAddresses = addresses.map(a => {
        if (a.id === address.id) {
          return { ...a, isDefault: true };
        } else {
          return { ...a, isDefault: false };
        }
      });
      updatedAddresses.forEach(addr => {
        this.userService.updateAddress(addr);
      });
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
      } catch {
        this.notificationService.showError('Error al eliminar la dirección');
      }
    }
  }

  updateAddress(updatedAddress: Address) {
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
    if (!order || !order.items || order.items.length === 0) {
      this.notificationService.showError('No hay items para volver a pedir');
      return;
    }

    // Filtrar items que tengan al menos nombre y precio (mínimo requerido)
    const validItems = order.items.filter(item => {
      return item && item.name && item.price !== undefined && item.price !== null && item.quantity > 0;
    });

    if (validItems.length === 0) {
      this.notificationService.showError('No hay items válidos para volver a pedir');
      return;
    }

    // Separar items con ID válido de los que no lo tienen
    const itemsWithId = validItems.filter(item => {
      if (item.id === null || item.id === undefined) return false;
      const idStr = String(item.id);
      return idStr !== '0' && idStr !== '' && idStr !== 'null' && idStr !== 'undefined';
    });

    const itemsWithoutId = validItems.filter(item => {
      if (item.id === null || item.id === undefined) return true;
      const idStr = String(item.id);
      return idStr === '0' || idStr === '' || idStr === 'null' || idStr === 'undefined';
    });

    let totalItemsAdded = 0;
    let hasErrors = false;

    // Procesar items con ID válido (intentar obtener del menú)
    if (itemsWithId.length > 0) {
      const productObservables = itemsWithId.map(item =>
        this.menuService.getItemById(item.id).pipe(
          catchError(() => of(null))
        )
      );

      forkJoin(productObservables).pipe(
        takeUntil(this.destroy$)
      ).subscribe(products => {
        itemsWithId.forEach((item, index) => {
          const product = products[index];

          if (product) {
            // Producto encontrado, usar datos del producto
            const cartOptions = (item.selectedOptions || []).map((opt: OrderItemOption, index: number) => ({
              id: opt.id || `opt_${item.id}_${index}`,
              name: opt.name,
              price: opt.price
            }));

            // Agregar cada unidad al carrito
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
              totalItemsAdded++;
            }
          } else {
            // Producto no encontrado, usar datos del pedido como fallback
            this.addItemToCartFromOrder(item);
            totalItemsAdded += item.quantity;
            hasErrors = true;
          }
        });

        // Procesar items sin ID válido (usar datos del pedido directamente)
        itemsWithoutId.forEach(item => {
          this.addItemToCartFromOrder(item);
          totalItemsAdded += item.quantity;
          hasErrors = true;
        });

        // Mostrar mensaje y navegar
        this.finishReorder(totalItemsAdded, hasErrors);
      });
    } else {
      // Todos los items no tienen ID válido, usar datos del pedido directamente
      itemsWithoutId.forEach(item => {
        this.addItemToCartFromOrder(item);
        totalItemsAdded += item.quantity;
      });
      hasErrors = itemsWithoutId.length > 0;
      this.finishReorder(totalItemsAdded, hasErrors);
    }
  }

  private addItemToCartFromOrder(item: OrderItem): void {
    const cartOptions = (item.selectedOptions || []).map((opt: OrderItemOption, index: number) => ({
      id: opt.id || `opt_${item.id || 'unknown'}_${index}`,
      name: opt.name,
      price: opt.price
    }));

    // Usar el ID del item o generar uno temporal
    const productId = (item.id && item.id !== 0) ? item.id : `temp_${Date.now()}_${Math.random()}`;

    for (let i = 0; i < item.quantity; i++) {
      this.cartService.addItem({
        productId: productId,
        productName: item.name,
        productDescription: '',
        basePrice: item.price,
        selectedOptions: cartOptions,
        quantity: 1
      });
    }
  }

  private finishReorder(totalItemsAdded: number, hasErrors: boolean): void {
    if (totalItemsAdded > 0) {
      const message = hasErrors
        ? `Se agregaron ${totalItemsAdded} item(s) al carrito. Algunos productos pueden no estar disponibles.`
        : `Se agregaron ${totalItemsAdded} item(s) al carrito`;
      this.notificationService.showSuccess(message);
      setTimeout(() => {
        this.router.navigate(['/menu']);
      }, 1000);
    } else {
      this.notificationService.showError('No se pudieron agregar items al carrito');
    }
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
    // Cachear el progreso para evitar ExpressionChangedAfterItHasBeenCheckedError
    // El progreso se actualiza mediante los intervalos configurados
    const progress = this.calculateTimeBasedProgress(order);
    // Redondear para evitar cambios mínimos que causen el error
    return Math.round(progress * 100) / 100;
  }

  expandOrderDetails(order: Order): void {
    if (!this.expandedOrders) {
      this.expandedOrders = new Set<string>();
    }
    const orderId = String(order.id);
    if (this.expandedOrders.has(orderId)) {
      this.expandedOrders.delete(orderId);
    } else {
      this.expandedOrders.add(orderId);
    }
    this.cdr.detectChanges();
  }

  isOrderExpanded(order: Order): boolean {
    if (!this.expandedOrders || !order || !order.id) {
      return false;
    }
    return this.expandedOrders.has(String(order.id));
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
      this.authService.logout();
      this.router.navigate(['/']);
    }
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  getAvatarImage(): string {
    if (!this.userProfile) {
      return 'https://api.dicebear.com/7.x/avataaars/svg?seed=Usuario&backgroundColor=b6e3f4,c0aede';
    }

    const name = this.userProfile.fullName?.toLowerCase() || '';
    const email = this.userProfile.email?.toLowerCase() || '';
    const femaleNames = ['maria', 'maría', 'ana', 'carmen', 'laura', 'patricia', 'guadalupe', 'rosa', 'marta', 'andrea', 'fernanda', 'valentina', 'sofia', 'sofía', 'isabella', 'camila', 'valeria', 'daniela', 'natalia', 'paula', 'carolina', 'alejandra', 'diana', 'monica', 'mónica', 'claudia', 'juliana', 'lucia', 'lucía', 'elena', 'cristina', 'isabel', 'beatriz', 'adriana', 'gabriela', 'vanessa', 'jessica', 'karen', 'katherine', 'kathryn', 'liliana', 'mariana', 'michelle', 'nancy', 'olga', 'raquel', 'sandra', 'tania', 'veronica', 'verónica', 'yolanda', 'zulema'];
    const maleNames = ['juan', 'carlos', 'jose', 'josé', 'luis', 'miguel', 'antonio', 'francisco', 'manuel', 'pedro', 'david', 'javier', 'jorge', 'alejandro', 'roberto', 'fernando', 'ricardo', 'daniel', 'pablo', 'sergio', 'eduardo', 'mario', 'alberto', 'oscar', 'óscar', 'rafael', 'raul', 'raúl', 'victor', 'victor', 'andres', 'andrés', 'felipe', 'sebastian', 'sebastián', 'nicolas', 'nicolás', 'cristian', 'esteban', 'gabriel', 'hugo', 'ignacio', 'ivan', 'iván', 'leonardo', 'marcos', 'martin', 'martín', 'rodrigo', 'simon', 'simón', 'tomas', 'tomás'];
    const firstName = name.split(' ')[0];
    let isFemale = false;

    if (femaleNames.includes(firstName)) {
      isFemale = true;
    } else if (maleNames.includes(firstName)) {
      isFemale = false;
    } else {
      const femaleEndings = ['a', 'ia', 'ina', 'ela', 'ana', 'ina'];
      const maleEndings = ['o', 'io', 'in', 'el', 'an', 'on'];
      if (femaleEndings.some(ending => firstName.endsWith(ending))) {
        isFemale = true;
      } else if (maleEndings.some(ending => firstName.endsWith(ending))) {
        isFemale = false;
      } else {
        isFemale = firstName.endsWith('a') && !firstName.endsWith('ma') && !firstName.endsWith('pa');
      }
    }
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
    let hash = 0;
    const nameForHash = name || email || 'Usuario';
    for (let i = 0; i < nameForHash.length; i++) {
      hash = nameForHash.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % 8;
    if (isFemale) {
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

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const nameForHash = this.userProfile?.fullName || this.userProfile?.email || 'Usuario';
    img.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(nameForHash) + '&backgroundColor=b6e3f4,c0aede';
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

  // Métodos para Reservas
  loadReservations(): void {
    this.reservationsService.findMyReservations().subscribe({
      next: (reservations) => {
        this.reservations = reservations.map(r => this.reservationsService.mapBackendReservationToFrontend(r));
        this.reservations.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
      },
      error: (error: HttpErrorResponse) => {
        console.error('Error loading reservations:', error);
        this.reservations = [];
      }
    });
  }

  getReservationStatusClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'pending': 'status-pending',
      'confirmed': 'status-confirmed',
      'cancelled': 'status-cancelled',
      'completed': 'status-completed'
    };
    return statusClasses[status] || '';
  }

  getReservationStatusText(status: string): string {
    const statusTexts: { [key: string]: string } = {
      'pending': 'Pendiente',
      'confirmed': 'Confirmada',
      'cancelled': 'Cancelada',
      'completed': 'Completada'
    };
    return statusTexts[status] || status;
  }

  getReservationStatusIcon(status: string): string {
    const statusIcons: { [key: string]: string } = {
      'pending': 'bi-clock-history',
      'confirmed': 'bi-check-circle-fill',
      'cancelled': 'bi-x-circle',
      'completed': 'bi-check2-all'
    };
    return statusIcons[status] || 'bi-circle';
  }

  canEditReservation(reservation: Reservation): boolean {
    return reservation.status === 'pending' || reservation.status === 'confirmed';
  }

  canDeleteReservation(reservation: Reservation): boolean {
    return reservation.status === 'pending' || reservation.status === 'confirmed';
  }

  openEditReservationModal(reservation: Reservation): void {
    if (!this.canEditReservation(reservation)) {
      this.notificationService.showError('Solo puedes editar reservas pendientes o confirmadas');
      return;
    }

    this.editingReservation = reservation;

    // Convertir fecha de DD/MM/YYYY a YYYY-MM-DD para el input
    let formattedDate = '';
    try {
      const dateParts = reservation.date.split('/');
      if (dateParts.length === 3) {
        const [day, month, year] = dateParts;
        formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      } else {
        // Si ya está en formato YYYY-MM-DD, usarlo directamente
        formattedDate = reservation.date;
      }
    } catch (error) {
      const today = new Date().toISOString().split('T')[0];
      formattedDate = today;
    }

    // Convertir hora de HH:mm a. m./p. m. a HH:mm para el input
    let formattedTime = '';
    try {
      const timeMatch = reservation.time.match(/(\d+):(\d+)\s+(a\.\s*m\.|p\.\s*m\.)/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1], 10);
        const minutes = timeMatch[2];
        const period = timeMatch[3].toLowerCase();

        if (period.includes('p') && hours !== 12) {
          hours += 12;
        } else if (period.includes('a') && hours === 12) {
          hours = 0;
        }

        formattedTime = `${hours.toString().padStart(2, '0')}:${minutes}`;
      } else {
        // Si ya está en formato HH:mm, usarlo directamente
        formattedTime = reservation.time;
      }
    } catch (error) {
      formattedTime = '12:00';
    }

    this.reservationForm.patchValue({
      date: formattedDate,
      time: formattedTime,
      numberOfPeople: reservation.numberOfPeople,
      specialRequests: reservation.specialRequests || ''
    });

    this.showEditReservationModal = true;
  }

  closeEditReservationModal(): void {
    this.showEditReservationModal = false;
    this.editingReservation = null;
    this.reservationForm.reset();
    this.submitted = false;
  }

  onEditReservationSubmit(): void {
    this.submitted = true;

    if (this.reservationForm.invalid || !this.editingReservation) {
      return;
    }

    const formValue = this.reservationForm.value;

    // Transformar los datos al formato que espera el backend
    const updateReservationDto = {
      date: this.formatDateToDDMMYYYY(formValue.date),
      time: this.formatTimeToAMPM(formValue.time),
      numberOfPeople: formValue.numberOfPeople,
      specialRequests: formValue.specialRequests || undefined
    };

    this.reservationsService.update(this.editingReservation.id, updateReservationDto).subscribe({
      next: (updatedReservation) => {
        const index = this.reservations.findIndex(r => r.id === this.editingReservation!.id);
        if (index !== -1) {
          this.reservations[index] = this.reservationsService.mapBackendReservationToFrontend(updatedReservation);
        }
        this.notificationService.showSuccess('Reserva actualizada exitosamente');
        this.closeEditReservationModal();
      },
      error: (error: HttpErrorResponse) => {
        const errorMessage = error?.message || error?.error?.message || 'Error al actualizar la reserva';
        this.notificationService.showError(errorMessage);
      }
    });
  }

  async deleteReservation(reservation: Reservation): Promise<void> {
    if (!this.canDeleteReservation(reservation)) {
      this.notificationService.showError('Solo puedes eliminar reservas pendientes o confirmadas');
      return;
    }

    const confirmed = await this.notificationService.confirm(
      'Eliminar Reserva',
      `¿Estás seguro de que deseas eliminar la reserva para la mesa ${reservation.tableNumber} el ${reservation.date} a las ${reservation.time}?`
    );

    if (confirmed) {
      this.reservationsService.remove(reservation.id).subscribe({
        next: () => {
          this.reservations = this.reservations.filter(r => r.id !== reservation.id);
          this.notificationService.showSuccess('Reserva eliminada exitosamente');
        },
        error: (error: HttpErrorResponse) => {
          const errorMessage = error?.message || error?.error?.message || 'Error al eliminar la reserva';
          this.notificationService.showError(errorMessage);
        }
      });
    }
  }

  private formatDateToDDMMYYYY(dateString: string): string {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  }

  private formatTimeToAMPM(timeString: string): string {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const period = hour >= 12 ? 'p. m.' : 'a. m.';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  }
}

