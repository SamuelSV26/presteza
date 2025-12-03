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
import { Reservation } from '../../core/models/ReservationResponse';
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
  private progressIntervals = new Map<string, any>();
  private ordersRefreshInterval: any = null;

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
      type: ['credit', [Validators.required]],
      cardNumber: ['', []],
      cardHolder: ['', []],
      expiryMonth: ['', []],
      expiryYear: ['', []],
      cvv: ['', []],
      brand: ['visa', [Validators.required]],
      isDefault: [false]
    });

    this.reservationForm = this.fb.group({
      date: ['', [Validators.required]],
      time: ['', [Validators.required]],
      numberOfPeople: [2, [Validators.required, Validators.min(1), Validators.max(20)]],
      specialRequests: ['']
    });
    this.paymentMethodForm.get('cardNumber')?.setValidators([Validators.required, Validators.pattern(/^[0-9\s]{13,19}$/)]);
    this.paymentMethodForm.get('cardHolder')?.setValidators([Validators.required]);
    this.paymentMethodForm.get('expiryMonth')?.setValidators([Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])$/)]);
    this.paymentMethodForm.get('expiryYear')?.setValidators([Validators.required, Validators.pattern(/^[0-9]{2}$/)]);
    this.paymentMethodForm.get('cvv')?.setValidators([Validators.required, Validators.pattern(/^[0-9]{3,4}$/)]);
  }

  minDate = '';

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
    
    this.startOrdersRefresh();
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
    
    window.addEventListener('paymentMethodsChanged', () => {
      this.loadPaymentMethods();
    });

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
    
    if (this.ordersRefreshInterval) {
      clearInterval(this.ordersRefreshInterval);
      this.ordersRefreshInterval = null;
    }

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

  let registrationDate: Date | null = null;
  const profile = JSON.parse(localStorage.getItem(`userProfile_${userId}`) || 'null');
  const savedDate = profile?.memberSince;

  if (savedDate) {
    const parsed = new Date(savedDate);
    if (!isNaN(parsed.getTime())) {
      registrationDate = parsed;
    }
  }

  this.userService.getUserProfile().pipe(
    takeUntil(this.destroy$),
    catchError(() => {
      const storedProfile = JSON.parse(localStorage.getItem(`userProfile_${userId}`) || 'null');
      if (storedProfile && (storedProfile.email === userInfo.email || storedProfile.id === userId)) {
        if (storedProfile.memberSince) {
          const savedDate = new Date(storedProfile.memberSince);
          if (!isNaN(savedDate.getTime())) {
            storedProfile.memberSince = savedDate;
          } else if (registrationDate) {
            storedProfile.memberSince = registrationDate;
          } else {
            storedProfile.memberSince = new Date();
          }
        } else if (registrationDate) {
          storedProfile.memberSince = registrationDate;
        } else {
          storedProfile.memberSince = new Date();
        }
        return of(storedProfile);
      }

      const phoneFromStorage = localStorage.getItem('userPhone') || '';
      const newUserProfile: UserProfile = {
        id: userId,
        fullName: userInfo.name || 'Usuario',
        email: userInfo.email || '',
        phone: phoneFromStorage,
        memberSince: registrationDate || new Date(),
        preferences: {
          notifications: true,
          emailNotifications: true,
          smsNotifications: false,
          favoriteCategories: []
        }
      };
      if (phoneFromStorage) {
        localStorage.setItem(`userProfile_${userId}`, JSON.stringify(newUserProfile));
      }
      return of(newUserProfile);
    })
  ).subscribe(profile => {
    if (profile) {
      if (profile.memberSince && !isNaN(new Date(profile.memberSince).getTime())) {
        profile.memberSince = new Date(profile.memberSince);
      } else if (registrationDate && !isNaN(registrationDate.getTime())) {
        profile.memberSince = registrationDate;
      } else {
        profile.memberSince = new Date();
      }

      const phoneFromToken = localStorage.getItem('userPhone');
      if (phoneFromToken) {
        if (!profile.phone || profile.phone === '' || profile.phone === 'No especificado' || profile.phone !== phoneFromToken) {
          profile.phone = phoneFromToken;
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

      this.cdr.detectChanges();

      if (!profile.id || profile.id === userId) {
        this.userService.initializeUserProfile(profile);
      }
    }
  });

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
            if (item.id !== null && item.id !== undefined) {
              const idStr = String(item.id);
              if (idStr !== '0' && idStr !== '' && idStr !== 'null' && idStr !== 'undefined') {
                purchasedProductIds.add(item.id);
              }
            }
          });
        }
      });

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
    this.userService.getFavoriteDishes().pipe(takeUntil(this.destroy$)).subscribe(dishes => {
      if (dishes && Array.isArray(dishes) && dishes.length > 0) {
        this.favoriteDishes = dishes.filter(dish => dish !== null && dish !== undefined) as MenuItem[];
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
    if (window.innerWidth <= 992) {
      this.sidebarOpen = false;
    }
    if (tab === 'reservations') {
      this.loadReservations();
    } else if (tab === 'orders') {
      this.loadOrders();
      this.startOrdersRefresh();
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
    this.startOrdersRefresh();
  }

  private startOrdersRefresh(): void {
    if (this.ordersRefreshInterval) {
      clearInterval(this.ordersRefreshInterval);
    }

    this.ordersRefreshInterval = setInterval(() => {
      if (this.activeTab === 'orders') {
        const hasActiveOrders = this.orders.some(order => 
          order.status !== 'cancelled' && order.status !== 'delivered'
        );
        
        if (hasActiveOrders) {
          this.refreshActiveOrders();
        }
      }
    }, 15000);
  }

  private refreshActiveOrders(): void {
    const userInfo = this.authService.getUserInfo();
    if (!userInfo || !userInfo.userId) {
      return;
    }

    const activeOrderIds = this.orders
      .filter(order => order.status !== 'cancelled' && order.status !== 'delivered')
      .map(order => order.id);

    if (activeOrderIds.length === 0) {
      return;
    }

    this.orderService.findByUser(userInfo.userId).pipe(
      takeUntil(this.destroy$),
      catchError(() => of(null))
    ).subscribe(response => {
      if (!response) return;

      let backendOrders: OrderFromBackend[] = [];
      if (response && 'orders' in response) {
        backendOrders = response.orders;
      } else if (Array.isArray(response)) {
        backendOrders = response;
      }

      const backendOrdersMap = new Map<string, OrderFromBackend>();
      backendOrders.forEach(backendOrder => {
        const orderId = backendOrder._id || backendOrder.id || '';
        backendOrdersMap.set(orderId, backendOrder);
      });

      let hasChanges = false;
      this.orders.forEach((order, index) => {
        if (activeOrderIds.includes(order.id)) {
          const backendOrder = backendOrdersMap.get(order.id);
          if (backendOrder) {
            const newStatus = this.mapBackendStatusToFrontend(backendOrder.status);
                        if (order.status !== newStatus) {
              console.log(`🔄 Estado del pedido ${order.id} cambió de ${order.status} a ${newStatus}`);
                            const updatedOrder = this.mapBackendOrderToFrontend(backendOrder);
                            updatedOrder.trackingCode = order.trackingCode || updatedOrder.trackingCode;
              updatedOrder.estimatedPrepTime = order.estimatedPrepTime || updatedOrder.estimatedPrepTime;
              updatedOrder.estimatedDeliveryTime = order.estimatedDeliveryTime || updatedOrder.estimatedDeliveryTime;
                            updatedOrder.statusChangedByAdmin = true;
              updatedOrder.lastStatusChangeTime = new Date();
                            this.orders[index] = updatedOrder;
              hasChanges = true;

              if (newStatus === 'ready') {
                this.notificationService.showSuccess('¡Tu pedido está listo!', 'Pedido Listo');
              } else if (newStatus === 'delivered') {
                this.notificationService.showSuccess('¡Tu pedido ha sido entregado!', 'Pedido Entregado');
              } else if (newStatus === 'preparing') {
                this.notificationService.showInfo('Tu pedido está en preparación', 'En Preparación');
              }

              if (newStatus !== 'cancelled' && newStatus !== 'delivered' && !updatedOrder.statusChangedByAdmin) {
                this.startAutoProgress(updatedOrder);
              }
            }
          }
        }
      });

      if (hasChanges) {
        this.orders.sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          if (dateB !== dateA) {
            return dateB - dateA;
          }
          return String(b.id).localeCompare(String(a.id));
        });
        this.cdr.detectChanges();
      }
    });
  }

  private mapBackendStatusToFrontend(backendStatus: string): Order['status'] {
    const statusMap: Record<string, Order['status']> = {
      'pendiente': 'pending',
      'Preparando': 'preparing',
      'preparando': 'preparing',
      'en_proceso': 'preparing',
      'listo': 'ready',
      'Listo': 'ready',
      'completado': 'ready',
      'entregado': 'delivered',
      'Entregado': 'delivered',
      'cancelado': 'cancelled',
      'Cancelado': 'cancelled'
    };
    return statusMap[backendStatus] || 'pending';
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

    let orderItems: any[] = [];
    if (detailedOrder?.items && detailedOrder.items.length > 0) {
      orderItems = detailedOrder.items;
    } else if (backendOrder.products && Array.isArray(backendOrder.products) && backendOrder.products.length > 0) {
      const firstProduct = backendOrder.products[0];
      if (typeof firstProduct === 'object' && 'name' in firstProduct) {
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

    let additionalFees = detailedOrder?.additionalFees;
    if (additionalFees === undefined || additionalFees === null) {
      additionalFees = 0;
    }

    let orderType = detailedOrder?.orderType;
    if (!orderType) {
      orderType = detailedOrder?.deliveryAddress ? 'delivery' : 'pickup';
    }

    let trackingCode = detailedOrder?.trackingCode;
    if (!trackingCode) {
      trackingCode = orderId.substring(0, 8).toUpperCase();
    }

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

    const statusOrder = ['pending', 'preparing', 'ready', 'delivered'];
    const currentStatusIndex = statusOrder.indexOf(order.status);
    if (currentStatusIndex === -1) return 0;

    if (order.statusChangedByAdmin && order.lastStatusChangeTime) {
      const now = new Date();
      const statusChangeTime = new Date(order.lastStatusChangeTime);
      const timeSinceStatusChange = (now.getTime() - statusChangeTime.getTime()) / 1000;
      
      if (timeSinceStatusChange > 5) {
        const baseProgress = (currentStatusIndex + 1) * 25;
        return Math.min(baseProgress, 100);
      } else {
        const animationProgress = (timeSinceStatusChange / 5) * 25;
        const baseProgress = (currentStatusIndex + 1) * 25;
        return Math.min(baseProgress + animationProgress, 100);
      }
    }

    const now = new Date();
    const orderDate = new Date(order.date);
    const timeElapsed = now.getTime() - orderDate.getTime();
    const secondsElapsed = timeElapsed / 1000;
    const secondsPerState = 120;
    const totalSeconds = secondsPerState * 3;
    
    let totalProgress = (secondsElapsed / totalSeconds) * 100;
    
    const stateProgress = 25;
    const maxProgressForState = (currentStatusIndex * stateProgress) + (stateProgress * 0.5);
    totalProgress = Math.min(totalProgress, maxProgressForState);
    
    const minProgressForState = currentStatusIndex * stateProgress;
    totalProgress = Math.max(totalProgress, minProgressForState);

    return Math.min(Math.max(totalProgress, 0), 100);
  }

  loadAddresses() {
    this.userService.getAddresses().subscribe({
      next: (addresses) => {
        console.log('Direcciones cargadas:', addresses);
        this.addresses = addresses || [];
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error al cargar direcciones:', error);
        this.addresses = [];
      }
    });
  }

  loadPaymentMethods() {
    this.userService.getPaymentMethods().pipe(takeUntil(this.destroy$)).subscribe({
      next: (methods) => {
        this.paymentMethods = methods;
      },
      error: (error) => {
        console.error('Error al cargar métodos de pago:', error);
      }
    });
  }

  openPaymentMethodModal() {
    this.showPaymentMethodModal = true;
    this.editingPaymentMethod = null;
    this.paymentMethodForm.reset();
    this.paymentMethodForm.patchValue({
      type: 'credit',
      brand: 'visa',
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

    if (!this.paymentMethodForm.get('cardNumber')?.valid ||
        !this.paymentMethodForm.get('cardHolder')?.valid ||
        !this.paymentMethodForm.get('expiryMonth')?.valid ||
        !this.paymentMethodForm.get('expiryYear')?.valid ||
        !this.paymentMethodForm.get('cvv')?.valid) {
      this.notificationService.showError('Por favor, completa todos los campos de la tarjeta correctamente');
      return;
    }

    if (this.paymentMethodForm.valid) {
      const isPrimary = formValue.isDefault || this.paymentMethods.length === 0;

      if (this.editingPaymentMethod) {
        const cardIndex = this.paymentMethods.findIndex(m => m.id === this.editingPaymentMethod?.id);
        if (cardIndex !== -1) {
          this.userService.updatePaymentCard(cardIndex, {
            cardholder_name: formValue.cardHolder,
            type: formValue.type as 'debit' | 'credit',
            brand: formValue.brand,
            expiryMonth: formValue.expiryMonth,
            expiryYear: formValue.expiryYear,
            is_primary: isPrimary
          }).pipe(takeUntil(this.destroy$)).subscribe({
            next: () => {
              this.notificationService.showSuccess('Tarjeta actualizada correctamente');
              this.loadPaymentMethods();
              this.closePaymentMethodModal();
            },
            error: (error) => {
              console.error('Error al actualizar tarjeta:', error);
              this.notificationService.showError('Error al actualizar la tarjeta. Por favor, intenta nuevamente.');
            }
          });
        }
      } else {
        this.userService.addPaymentCard({
          cardholder_name: formValue.cardHolder,
          cardNumber: formValue.cardNumber,
          type: formValue.type as 'debit' | 'credit',
          brand: formValue.brand,
          expiryMonth: formValue.expiryMonth,
          expiryYear: formValue.expiryYear,
          is_primary: isPrimary
        }).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => {
            this.notificationService.showSuccess('Tarjeta agregada correctamente');
            this.loadPaymentMethods();
            this.closePaymentMethodModal();
          },
          error: (error) => {
            console.error('Error al agregar tarjeta:', error);
            this.notificationService.showError('Error al agregar la tarjeta. Por favor, intenta nuevamente.');
          }
        });
      }
    } else {
      this.notificationService.showError('Por favor, completa todos los campos correctamente');
    }
  }

  editPaymentMethod(method: PaymentMethod) {
    this.editingPaymentMethod = method;
    this.showPaymentMethodModal = true;
        let expiryMonth = '';
    let expiryYear = '';
    if (method.expiry_date) {
      const parts = method.expiry_date.split('/');
      if (parts.length === 2) {
        expiryMonth = parts[0];
        expiryYear = parts[1];
      }
    }

    this.paymentMethodForm.patchValue({
      type: method.type === 'cash' ? 'credit' : method.type, // Si es cash, mostrar como credit por defecto
      cardNumber: method.last_four_digits ? '**** **** **** ' + method.last_four_digits : '',
      cardHolder: method.cardholder_name || '',
      expiryMonth: expiryMonth,
      expiryYear: expiryYear,
      brand: method.brand || 'visa',
      isDefault: method.is_primary || method.isDefault || false
    });
  }

  deletePaymentMethod(method: PaymentMethod, event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    console.log('🗑️ deletePaymentMethod llamado para:', method);
    if (!method.id) {
      console.error('❌ El método no tiene ID');
      this.notificationService.showError('Error: La tarjeta no tiene un ID válido.');
      return;
    }

    const cardInfo = method.type === 'cash' 
      ? 'este método de pago' 
      : `${method.brand} •••• ${method.last_four_digits}`;
    
    const isPrimary = method.is_primary || method.isDefault;
    const hasOtherCards = this.paymentMethods.length > 1;
    
    let warningMessage = '';
    if (isPrimary && hasOtherCards) {
      warningMessage = `¿Estás seguro de que deseas eliminar tu tarjeta principal (${cardInfo})? Si tienes otras tarjetas, se marcará automáticamente una como principal.`;
    } else if (isPrimary && !hasOtherCards) {
      warningMessage = `¿Estás seguro de que deseas eliminar tu única tarjeta (${cardInfo})? No tendrás métodos de pago guardados después de esta acción.`;
    } else {
      warningMessage = `¿Estás seguro de que deseas eliminar la tarjeta ${cardInfo}? Esta acción no se puede deshacer.`;
    }

    console.log('📋 Mostrando diálogo de confirmación personalizado...');
    
    this.notificationService.confirm(
      'Eliminar Tarjeta de Pago',
      warningMessage,
      'Eliminar',
      'Cancelar'
    ).then(confirmed => {
      console.log('✅ Respuesta del diálogo de confirmación:', confirmed);
      
      if (!confirmed) {
        console.log('❌ Usuario canceló la eliminación');
        return;
      }
      
      const cardIndex = this.paymentMethods.findIndex(m => m.id === method.id);
      console.log('🔍 Índice de tarjeta encontrado:', cardIndex);
      
      if (cardIndex === -1) {
        console.warn('⚠️ No se encontró el índice de la tarjeta a eliminar');
        this.notificationService.showError('No se pudo encontrar la tarjeta para eliminar. Por favor, recarga la página.');
        return;
      }
      
      console.log(`🗑️ Eliminando tarjeta en índice ${cardIndex}:`, method);
      this.userService.removePaymentCard(cardIndex).pipe(takeUntil(this.destroy$)).subscribe({
        next: (updatedCards) => {
          console.log('✅ Tarjeta eliminada exitosamente. Tarjetas actualizadas:', updatedCards);
          this.notificationService.showSuccess('Tarjeta eliminada correctamente');
          this.loadPaymentMethods();
        },
        error: (error) => {
          console.error('❌ Error al eliminar tarjeta:', error);
          let errorMessage = 'Error al eliminar la tarjeta. Por favor, intenta nuevamente.';
          if (error.status === 404) {
            errorMessage = 'La tarjeta no fue encontrada. Puede que ya haya sido eliminada.';
          } else if (error.status === 403) {
            errorMessage = 'No tienes permiso para eliminar esta tarjeta.';
          } else if (error.status === 401) {
            errorMessage = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
          }
          this.notificationService.showError(errorMessage);
        }
      });
    }).catch(error => {
      console.error('❌ Error en el diálogo de confirmación:', error);
    });
  }

  setPrimaryPaymentMethod(method: PaymentMethod) {
    if (!method.id) return;
    
    const cardIndex = this.paymentMethods.findIndex(m => m.id === method.id);
    if (cardIndex !== -1) {
      this.userService.setPrimaryPaymentCard(cardIndex).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.notificationService.showSuccess('Tarjeta principal actualizada');
          this.loadPaymentMethods();
        },
        error: (error) => {
          console.error('Error al establecer tarjeta principal:', error);
          this.notificationService.showError('Error al establecer la tarjeta principal.');
        }
      });
    }
  }

  formatCardNumber(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\s/g, '').replace(/[^0-9]/gi, '');
    const formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
    this.paymentMethodForm.patchValue({ cardNumber: formattedValue }, { emitEvent: false });
  }

  onProfileSubmit() {
    this.submitted = true;
    if (this.profileForm.valid) {
      this.userService.updateUserProfile(this.profileForm.value).subscribe({
        next: (updatedProfile: UserProfile) => {
          this.userProfile = updatedProfile;
          this.profileForm.patchValue({
            fullName: updatedProfile.fullName,
            email: updatedProfile.email,
            phone: updatedProfile.phone
          });

          this.cdr.detectChanges();

          this.notificationService.showSuccess('Perfil actualizado correctamente');
          this.submitted = false;
          this.showProfileModal = false;

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
      const formValue = this.addressForm.value;

      this.userService.getAddresses().subscribe(addresses => {
        if (this.editingAddress) {
          const addressIndex = addresses.findIndex(addr =>
            addr.id === this.editingAddress?.id ||
            addr.title === this.editingAddress?.title
          );

          if (addressIndex === -1) {
            this.notificationService.showError('Error: No se encontró la dirección a actualizar');
            return;
          }

          const updatedAddress: Address = {
            ...this.editingAddress,
            title: formValue.title,
            name: formValue.title,
            address: formValue.address,
            neighborhood: formValue.neighborhood,
            city: formValue.city,
            postalCode: formValue.postalCode,
            postal_code: formValue.postalCode,
            isDefault: isDefault,
            is_primary: isDefault
          };

          if (isDefault) {
            this.userService.setPrimaryAddress(addressIndex).subscribe({
              next: () => {
                this.userService.updateAddress(updatedAddress, addressIndex).subscribe({
                  next: () => {
                    this.loadAddresses();
                    this.resetAddressForm();
                    this.notificationService.showSuccess('Dirección actualizada correctamente');
                  },
                  error: (error) => {
                    console.error('Error al actualizar dirección:', error);
                    const errorMessage = this.getErrorMessage(error, 'Error al actualizar la dirección');
                    this.notificationService.showError(errorMessage);
                  }
                });
              },
              error: (error) => {
                console.error('Error al marcar dirección como principal:', error);
                this.userService.updateAddress(updatedAddress, addressIndex).subscribe({
                  next: () => {
                    this.loadAddresses();
                    this.resetAddressForm();
                    this.notificationService.showSuccess('Dirección actualizada correctamente');
                  },
                  error: (err) => {
                    const errorMessage = this.getErrorMessage(err, 'Error al actualizar la dirección');
                    this.notificationService.showError(errorMessage);
                  }
                });
              }
            });
          } else {
            this.userService.updateAddress(updatedAddress, addressIndex).subscribe({
              next: () => {
                this.loadAddresses();
                this.resetAddressForm();
                this.notificationService.showSuccess('Dirección actualizada correctamente');
              },
              error: (error) => {
                console.error('Error al actualizar dirección:', error);
                const errorMessage = this.getErrorMessage(error, 'Error al actualizar la dirección');
                this.notificationService.showError(errorMessage);
              }
            });
          }
        } else {
          const newAddress: Address = {
            title: formValue.title,
            name: formValue.title,
            address: formValue.address,
            neighborhood: formValue.neighborhood,
            city: formValue.city,
            postalCode: formValue.postalCode,
            postal_code: formValue.postalCode,
            isDefault: isDefault || addresses.length === 0,
            is_primary: isDefault || addresses.length === 0
          };

          this.userService.addAddress(newAddress).subscribe({
            next: (savedAddress) => {
              console.log('Dirección guardada exitosamente:', savedAddress);
              setTimeout(() => {
                this.loadAddresses();
              }, 200);
              this.resetAddressForm();
              this.notificationService.showSuccess('Dirección agregada correctamente');
            },
            error: (error) => {
              console.error('Error completo al agregar dirección:', error);
              const errorMessage = this.getErrorMessage(error, 'Error al agregar la dirección');
              this.notificationService.showError(errorMessage);
            }
          });
        }
      });
    }
  }

  private getErrorMessage(error: any, defaultMessage: string): string {
    if (!error) {
      return defaultMessage;
    }

    if (typeof error === 'string' && error !== 'undefined') {
      return error;
    }

    if (error.message && typeof error.message === 'string' && error.message !== 'undefined') {
      return error.message;
    }

    if (error.error) {
      if (typeof error.error === 'string' && error.error !== 'undefined') {
        return error.error;
      }
      if (error.error?.message && typeof error.error.message === 'string' && error.error.message !== 'undefined') {
        return error.error.message;
      }
    }

    return defaultMessage;
  }

  private resetAddressForm(): void {
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

  editAddress(address: Address) {
    this.editingAddress = address;
    this.addressForm.patchValue({
      title: address.title || address.name || '',
      address: address.address,
      neighborhood: address.neighborhood || '',
      city: address.city || 'Manizales',
      postalCode: address.postalCode || address.postal_code || '170001',
      isDefault: address.isDefault || address.is_primary || false
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
    const addressIndex = this.addresses.findIndex(addr =>
      addr.id === address.id ||
      addr.title === address.title ||
      (addr.name && address.name && addr.name === address.name)
    );

    if (addressIndex === -1) {
      this.notificationService.showError('Error: No se encontró la dirección');
      return;
    }

    this.userService.setPrimaryAddress(addressIndex).subscribe({
      next: () => {
        this.loadAddresses();
        this.notificationService.showSuccess('Dirección principal actualizada');
      },
      error: (error) => {
        console.error('Error al marcar dirección como principal:', error);
        const errorMessage = this.getErrorMessage(error, 'Error al actualizar la dirección principal');
        this.notificationService.showError(errorMessage);
      }
    });
  }

  async deleteAddress(address: Address) {
    const confirmed = await this.notificationService.confirm(
      'Eliminar Dirección',
      '¿Estás seguro de que deseas eliminar esta dirección?'
    );

    if (confirmed) {
      const addressIndex = this.addresses.findIndex(addr =>
        addr.id === address.id ||
        addr.title === address.title ||
        (addr.name && address.name && addr.name === address.name)
      );

      if (addressIndex === -1) {
        this.notificationService.showError('Error: No se encontró la dirección a eliminar');
        return;
      }

      this.userService.removeAddress(addressIndex).subscribe({
        next: () => {
          this.loadAddresses();
          this.notificationService.showSuccess('Dirección eliminada correctamente');
        },
        error: (error) => {
          console.error('Error al eliminar dirección:', error);
          const errorMessage = error?.message || 'Error al eliminar la dirección';
          this.notificationService.showError(errorMessage);
        }
      });
    }
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
    const statusClasses: Record<string, string> = {
      'pending': 'status-pending',
      'preparing': 'status-preparing',
      'ready': 'status-ready',
      'delivered': 'status-delivered',
      'cancelled': 'status-cancelled'
    };
    return statusClasses[status] || '';
  }

  getOrderStatusText(status: string): string {
    const statusTexts: Record<string, string> = {
      'pending': 'Pendiente',
      'preparing': 'Preparando',
      'ready': 'Listo',
      'delivered': 'Entregado',
      'cancelled': 'Cancelado'
    };
    return statusTexts[status] || status;
  }

  getOrderStatusIcon(status: string): string {
    const statusIcons: Record<string, string> = {
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

  confirmReception(order: Order): void {
    if (order.status !== 'ready') {
      this.notificationService.showError('Solo puedes confirmar la recepción de pedidos que están listos');
      return;
    }

    this.notificationService.confirm(
      'Confirmar Recepción',
      `¿Confirmas que recibiste el pedido #${order.id.slice(-8)}?`,
      'Confirmar',
      'Cancelar'
    ).then(confirmed => {
      if (confirmed) {
        const statusForEndpoint = this.orderService.mapFrontendStatusToStatusEndpoint('delivered');
        this.orderService.updateStatus(order.id, statusForEndpoint).pipe(
          takeUntil(this.destroy$),
          catchError((error: HttpErrorResponse) => {
            const errorMessage = error?.error?.message || error?.message || 'Error al confirmar la recepción del pedido';
            this.notificationService.showError(errorMessage);
            return of(null);
          })
        ).subscribe(response => {
          if (response) {
            const orderIndex = this.orders.findIndex(o => o.id === order.id);
            if (orderIndex !== -1) {
              this.orders[orderIndex].status = 'delivered';
              this.orders[orderIndex].statusChangedByAdmin = true;
              this.orders[orderIndex].lastStatusChangeTime = new Date();
              if (!this.orders[orderIndex].statusHistory) {
                this.orders[orderIndex].statusHistory = [];
              }
              this.orders[orderIndex].statusHistory!.push({
                status: 'delivered',
                timestamp: new Date(),
                message: 'Recepción confirmada por el usuario'
              });
              if (this.progressIntervals.has(order.id)) {
                clearInterval(this.progressIntervals.get(order.id));
                this.progressIntervals.delete(order.id);
              }
            }
            this.notificationService.showSuccess('¡Recepción confirmada! Gracias por tu compra.', 'Pedido Recibido');
            this.cdr.detectChanges();
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

    const validItems = order.items.filter(item => {
      return item && item.name && item.price !== undefined && item.price !== null && item.quantity > 0;
    });

    if (validItems.length === 0) {
      this.notificationService.showError('No hay items válidos para volver a pedir');
      return;
    }

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
              totalItemsAdded++;
            }
          } else {
            this.addItemToCartFromOrder(item);
            totalItemsAdded += item.quantity;
            hasErrors = true;
          }
        });

        itemsWithoutId.forEach(item => {
          this.addItemToCartFromOrder(item);
          totalItemsAdded += item.quantity;
          hasErrors = true;
        });

        this.finishReorder(totalItemsAdded, hasErrors);
      });
    } else {
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

  getOrderStatusSteps(order: Order): {status: string, label: string, icon: string, completed: boolean, current: boolean}[] {
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
    const progress = this.calculateTimeBasedProgress(order);
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
    const methods: Record<string, string> = {
      'card': 'Tarjeta',
      'cash': 'Efectivo',
      'nequi': 'Nequi',
      'daviplata': 'Daviplata',
      'transfer': 'Transferencia Bancaria'
    };
    return methods[method] || method;
  }

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
    const statusClasses: Record<string, string> = {
      'pending': 'status-pending',
      'confirmed': 'status-confirmed',
      'cancelled': 'status-cancelled',
      'completed': 'status-completed'
    };
    return statusClasses[status] || '';
  }

  getReservationStatusText(status: string): string {
    const statusTexts: Record<string, string> = {
      'pending': 'Pendiente',
      'confirmed': 'Confirmada',
      'cancelled': 'Cancelada',
      'completed': 'Completada'
    };
    return statusTexts[status] || status;
  }

  getReservationStatusIcon(status: string): string {
    const statusIcons: Record<string, string> = {
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

