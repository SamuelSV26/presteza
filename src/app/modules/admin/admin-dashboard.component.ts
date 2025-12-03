import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MenuItem } from '../../core/models/MenuItem';
import { MenuCategory } from '../../core/models/MenuCategory';
import { Order } from '../../core/models/Order';
import { MenuService } from '../../core/services/menu.service';
import { UserService } from '../../core/services/user.service';
import { OrderService } from '../../core/services/order.service';
import { OrderFromBackend } from '../../core/models/OrderResponse';
import { SupplyService } from '../../core/services/supply.service';
import { Supply, CreateSupplyDto, UpdateSupplyDto } from '../../core/models/Supply';
import { ReservationsService } from '../../core/services/reservations.service';
import { ReservationFromBackend, Reservation } from '../../core/models/ReservationResponse';
import { ExtrasAvailabilityService, ExtraAvailability } from '../../core/services/extras-availability.service';
import { AddsService, Add } from '../../core/services/adds.service';
import { ContactService } from '../../core/services/contact.service';
import { ContactMessageFromBackend, ContactMessage } from '../../core/models/ContactMessage';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  activeTab: 'dashboard' | 'products' | 'orders' | 'categories' | 'settings' | 'inventory' | 'reservations' | 'extras' | 'messages' | 'customers' = 'dashboard';
  private refreshInterval: any = null;
  sidebarOpen = false;
  private resizeListener?: () => void;

  stats = {
    totalOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    totalProducts: 0,
    totalCustomers: 0,
    totalReservations: 0,
    pendingReservations: 0,
    totalMessages: 0,
    unreadMessages: 0
  };
  products: MenuItem[] = [];
  categories: MenuCategory[] = [];
  selectedProduct: MenuItem | null = null;
  showProductModal = false;
  productForm: FormGroup;
  isViewingProduct = false;
  selectedCategory: MenuCategory | null = null;
  showCategoryModal = false;
  categoryForm: FormGroup;
  orders: Order[] = [];
  selectedOrder: Order | null = null;
  showOrderDetailsModal = false;
  showUnavailableModal = false;
  selectedItemForUnavailable: { order: Order; item: any; itemIndex: number } | null = null;
  supplies: Supply[] = [];
  selectedSupply: Supply | null = null;
  showSupplyModal = false;
  supplyForm: FormGroup;
  supplyFilter: 'all' | 'low' | 'out' = 'all';
  lowStockThreshold = 10;
  orderFilter: 'all' | 'pending' | 'preparing' | 'ready' | 'delivered' = 'all';
  searchTerm = '';
  categoryFilter = '';
  availabilityFilter: 'all' | 'available' | 'unavailable' = 'all';
  productViewMode: 'grid' | 'list' = 'list';
  orderViewMode: 'list' | 'grid' = 'list';
  settingsForm!: FormGroup;
  reservations: Reservation[] = [];
  reservationFilter: 'all' | 'pending' | 'confirmed' | 'cancelled' | 'completed' = 'all';
  selectedReservation: Reservation | null = null;
  showCancelReservationModal = false;
  cancelReason = '';
  availableExtras: ExtraAvailability[] = [];
  showExtrasModal = false;
  selectedExtra: ExtraAvailability | null = null;
  extraForm: FormGroup;
  showExtraFormModal = false;

  adds: Add[] = [];
  selectedAdd: Add | null = null;
  showAddModal = false;
  addForm: FormGroup;
  addSearchTerm = '';
  addSelectionMode: 'categories' | 'products' | 'both' = 'categories';
  selectedProductsForAdd: string[] = [];
  contactMessages: ContactMessage[] = [];
  selectedMessage: ContactMessage | null = null;
  showMessageModal = false;
  messageFilter: 'all' | 'unread' | 'read' = 'all';

  customers: any[] = [];
  selectedCustomer: any | null = null;
  showCustomerModal = false;
  customerFilter: 'all' | 'active' | 'inactive' = 'all';
  customerSearchTerm = '';
  customerViewMode: 'list' | 'grid' = 'list';
  customerForm: FormGroup;
  isEditingCustomer = false;

  showAdminModal = false;
  adminForm: FormGroup;
  get pendingOrdersCount(): number {
    return this.orders.filter(o => o.status === 'pending').length;
  }

  get preparingOrdersCount(): number {
    return this.orders.filter(o => o.status === 'preparing').length;
  }

  get readyOrdersCount(): number {
    return this.orders.filter(o => o.status === 'ready').length;
  }

  get deliveredOrdersCount(): number {
    return this.orders.filter(o => o.status === 'delivered').length;
  }

  constructor(
    private title: Title,
    private meta: Meta,
    private menuService: MenuService,
    private extrasAvailabilityService: ExtrasAvailabilityService,
    private addsService: AddsService,
    private userService: UserService,
    private orderService: OrderService,
    private supplyService: SupplyService,
    private reservationsService: ReservationsService,
    private contactService: ContactService,
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef,
    private http: HttpClient
  ) {

    this.title.setTitle('Admin Dashboard - PRESTEZA');
    this.meta.updateTag({ name: 'description', content: 'Panel de administración de PRESTEZA. Gestiona productos, pedidos, categorías, inventario y más.' });
    this.productForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      price: [0, [Validators.required, Validators.min(1)]],
      categoryId: ['', Validators.required],
      imageUrl: [''],
      available: [true]
    });

    this.settingsForm = this.fb.group({
      restaurantName: ['PRESTEZA', [Validators.required]],
      email: ['info@presteza.com', [Validators.required, Validators.email]],
      phone: ['3104941839', [Validators.required]],
      address: ['Carrera 23 # 70B - 57, Milan, Manizales', [Validators.required]],
      openingTime: ['08:00', [Validators.required]],
      closingTime: ['22:00', [Validators.required]],
      deliveryEnabled: [true],
      pickupEnabled: [true],
      taxRate: [19, [Validators.required, Validators.min(0), Validators.max(100)]],
      minOrderAmount: [15000, [Validators.required, Validators.min(0)]],
      deliveryFee: [3000, [Validators.required, Validators.min(0)]],
      maxDeliveryDistance: [10, [Validators.required, Validators.min(1)]]
    });

    this.categoryForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: ['', [Validators.required, Validators.minLength(5)]],
      imageUrl: ['']
    });

    this.extraForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      price: [0, [Validators.required, Validators.min(0)]],
      available: [true]
    });

    this.addForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      price: [0, [Validators.required, Validators.min(1)]],
      categoryIds: [[]],
      dishIds: [[]],
      available: [true]
    });

    this.supplyForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      unit_price: [0, [Validators.required, Validators.min(0)]],
      quantity: [0, [Validators.required, Validators.min(0)]]
    });

    this.customerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      address: ['']
    });

    this.adminForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      password: ['', [Validators.required, Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.adminPasswordMatchValidator });
  }

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      this.notificationService.showError('⚠ No tienes permisos de administrador. Debes iniciar sesión como administrador para acceder a esta sección.');
      this.router.navigate(['/login']);
      return;
    }

    if (!this.authService.isAdmin()) {
      this.notificationService.showError('🚫 No tienes permisos de administrador. Solo los usuarios con rol de administrador pueden acceder a esta sección.');
      this.router.navigate(['/']);
      return;
    }

    this.sidebarOpen = !this.isMobile();

    this.resizeListener = () => {
      if (!this.isMobile()) {
        this.sidebarOpen = true;
      } else {
        this.sidebarOpen = false;
      }
    };
    window.addEventListener('resize', this.resizeListener);

    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loadCategories();
    this.loadAllProducts();
    this.loadOrders();
    this.loadReservations();
    this.loadExtras();
    this.loadCustomers();
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.refreshInterval = setInterval(() => {
      if (!this.authService.isAuthenticated() || !this.authService.isAdmin()) {
        if (this.refreshInterval) {
          clearInterval(this.refreshInterval);
          this.refreshInterval = null;
        }
        return;
      }
      if (this.activeTab === 'orders' || this.activeTab === 'dashboard') {
        this.loadOrders();
      }
      if (this.activeTab === 'reservations' || this.activeTab === 'dashboard') {
        this.loadReservations();
      }
    }, 10000);
  }

  loadCategories(): void {
    this.menuService.getCategories().subscribe(categories => {
      this.categories = categories;
    });
  }

  loadAllProducts(): void {
    this.menuService.getAllDishes().subscribe({
      next: (products) => {
        this.products = products;
        this.stats.totalProducts = products.length;
      },
      error: () => {
        this.products = [];
        this.stats.totalProducts = 0;
      }
    });
  }

  calculateStats(): void {
    this.stats.totalOrders = this.orders.length;
    this.stats.pendingOrders = this.orders.filter(o => o.status === 'pending' || o.status === 'preparing').length;
    const revenueOrders = this.orders.filter(o => o.status !== 'cancelled');
    this.stats.totalRevenue = revenueOrders.reduce((sum, order) => {
      const orderTotal = Number(order.total) || 0;
      return sum + orderTotal;
    }, 0);
    this.stats.totalProducts = this.products.filter(p => p.available !== false).length;
    const uniqueUserIds = new Set(this.orders.map(o => {
      if (o.userName) return o.userName;
      if (o.deliveryPhone) return o.deliveryPhone;
      return o.id;
    }));
    this.stats.totalCustomers = uniqueUserIds.size;
  }


  openProductModal(product?: MenuItem): void {
    this.isViewingProduct = false;
    this.selectedProduct = product || null;
    this.productForm.enable();
    if (product) {
      this.productForm.patchValue({
        name: product.name,
        description: product.description,
        price: product.price,
        categoryId: product.categoryId,
        imageUrl: product.imageUrl || '',
        available: product.available
      });
    } else {
      this.productForm.reset({
        available: true
      });
    }
    this.showProductModal = true;
  }

  viewProductDetails(product: MenuItem): void {
    this.isViewingProduct = true;
    this.selectedProduct = product;
    this.productForm.patchValue({
      name: product.name,
      description: product.description,
      price: product.price,
      categoryId: product.categoryId,
      imageUrl: product.imageUrl || '',
      available: product.available
    });
    this.productForm.disable();
    this.showProductModal = true;
  }

  closeProductModal(): void {
    this.showProductModal = false;
    this.selectedProduct = null;
    this.isViewingProduct = false;
    this.productForm.reset();
    this.productForm.enable();
  }

  saveProduct(): void {
    if (this.productForm.valid) {
      const formValue = this.productForm.value;

      if (!formValue.categoryId) {
        this.notificationService.showError('Por favor, selecciona una categoría');
        return;
      }

      const productName = formValue.name.trim();

      if (!this.selectedProduct) {
        const duplicateProduct = this.products.find(
          p => p.name.toLowerCase().trim() === productName.toLowerCase().trim()
        );

        if (duplicateProduct) {
          this.notificationService.showError(
            `No se puede crear el producto porque ya existe uno con el nombre "${duplicateProduct.name}"`
          );
          return;
        }
      } else {
        const duplicateProduct = this.products.find(
          p => p.id !== this.selectedProduct?.id &&
            p.name.toLowerCase().trim() === productName.toLowerCase().trim()
        );

        if (duplicateProduct) {
          this.notificationService.showError(
            `No se puede actualizar el producto porque ya existe otro con el nombre "${duplicateProduct.name}"`
          );
          return;
        }
      }

      const productData = {
        name: productName,
        description: formValue.description.trim(),
        price: Number(formValue.price),
        categoryId: formValue.categoryId,
        imageUrl: (formValue.imageUrl && formValue.imageUrl.trim()) || '',
        available: formValue.available !== false
      };

      if (this.selectedProduct) {
        this.menuService.updateDish(this.selectedProduct.id, productData).subscribe({
          next: () => {
            this.notificationService.showSuccess('Producto actualizado correctamente');
            this.closeProductModal();
            this.loadAllProducts();
            window.dispatchEvent(new CustomEvent('productsUpdated'));
          },
          error: (error) => {
            let errorMessage = 'Error al actualizar el producto. Por favor, intenta nuevamente.';
            if (error.error && error.error.message) {
              errorMessage = `Error: ${error.error.message}`;
            } else if (error.error && typeof error.error === 'string') {
              errorMessage = `Error: ${error.error}`;
            } else if (error.message) {
              errorMessage = `Error: ${error.message}`;
            }
            this.notificationService.showError(errorMessage);
          }
        });
      } else {
        this.menuService.createDish(productData).subscribe({
          next: () => {
            this.notificationService.showSuccess('Producto creado correctamente');
            this.closeProductModal();
            this.loadAllProducts();
            window.dispatchEvent(new CustomEvent('productsUpdated'));
          },
          error: (error) => {
            let errorMessage = 'Error al crear el producto. Por favor, intenta nuevamente.';
            if (error.error && error.error.message) {
              errorMessage = `Error: ${error.error.message}`;
            } else if (error.error && typeof error.error === 'string') {
              errorMessage = `Error: ${error.error}`;
            } else if (error.message) {
              errorMessage = `Error: ${error.message}`;
            }

            this.notificationService.showError(errorMessage);
          }
        });
      }
    }
  }

  async deleteProduct(productId: number | string): Promise<void> {
    const confirmed = await this.notificationService.confirm(
      'Eliminar Producto',
      '¿Estás seguro de que deseas eliminar este producto?'
    );

    if (confirmed) {
      this.menuService.deleteDish(productId).subscribe({
        next: () => {
          this.notificationService.showSuccess('Producto eliminado correctamente');
          this.loadAllProducts();
          window.dispatchEvent(new CustomEvent('productsUpdated'));
        },
        error: () => {
          this.notificationService.showError('Error al eliminar el producto. Por favor, intenta nuevamente.');
        }
      });
    }
  }

  toggleProductAvailability(product: MenuItem): void {
    const newAvailability = !product.available;
    this.menuService.updateDishAvailability(product.id, newAvailability).subscribe({
      next: (updatedProduct) => {
        product.available = updatedProduct.available;
        this.notificationService.showSuccess(
          `Producto ${updatedProduct.available ? 'activado' : 'desactivado'} correctamente`
        );
        this.loadAllProducts();
        window.dispatchEvent(new CustomEvent('productsUpdated'));
      },
      error: () => {
        product.available = !newAvailability;
        this.notificationService.showError('Error al actualizar la disponibilidad. Por favor, intenta nuevamente.');
      }
    });
  }

  toggleProductView(): void {
    this.productViewMode = this.productViewMode === 'grid' ? 'list' : 'grid';
  }

  getFilteredProducts(): MenuItem[] {
    let filtered = this.products;

    if (this.categoryFilter) {
      filtered = filtered.filter(p => p.categoryId === this.categoryFilter);
    }

    if (this.searchTerm) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }

    if (this.availabilityFilter === 'available') {
      filtered = filtered.filter(p => p.available === true);
    } else if (this.availabilityFilter === 'unavailable') {
      filtered = filtered.filter(p => p.available === false || p.available === undefined);
    }

    return filtered;
  }

  getCategoryName(categoryId: string): string {
    const category = this.categories.find(c => c.id === categoryId);
    return category ? category.name : categoryId;
  }
  getFilteredOrders(): Order[] {
    let filtered = this.orders;

    if (this.orderFilter !== 'all') {
      filtered = filtered.filter(order => order.status === this.orderFilter);
    }

    if (this.searchTerm) {
      filtered = filtered.filter(order =>
        order.id.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        order.deliveryAddress?.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }

    return filtered;
  }

  loadOrders(): void {
    this.orderService.findAll().subscribe({
      next: (response) => {
        this.orders = response.orders.map(backendOrder => this.mapBackendOrderToFrontend(backendOrder));
        this.orders.sort((a, b) => {
          const dateA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
          const dateB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
          return dateB - dateA;
        });
        this.calculateStats();
        if (this.activeTab === 'customers') {
          this.loadCustomers();
        }
      },
      error: () => {
        this.notificationService.showError('Error al cargar los pedidos');
        this.userService.getOrders().subscribe(orders => {
          this.orders = orders.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (dateB !== dateA) {
              return dateB - dateA;
            }
            return String(b.id).localeCompare(String(a.id));
          });
          this.calculateStats();
          if (this.activeTab === 'customers') {
            this.loadCustomers();
          }
        });
      }
    });
  }

  clearAllOrders(): void {
    this.notificationService.confirm(
      'Eliminar Todos los Pedidos',
      '¿Estás seguro de que deseas eliminar TODOS los pedidos? Esta acción eliminará todos los pedidos del backend y del localStorage. Esta acción NO se puede deshacer.',
      'Eliminar Todos',
      'Cancelar'
    ).then(confirmed => {
      if (confirmed) {
        if (this.orders.length === 0) {
          this.notificationService.showWarning('No hay pedidos para eliminar');
          return;
        }

        const deleteObservables = this.orders.map(order =>
          this.orderService.remove(order.id).pipe(
            catchError(error => {
              console.error(`Error al eliminar pedido ${order.id}:`, error);
              return of(null);
            })
          )
        );

        forkJoin(deleteObservables).subscribe({
          next: (results) => {
            const successCount = results.filter(r => r !== null).length;
            const failCount = results.length - successCount;

            try {
              for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && key.startsWith('userOrders_')) {
                  localStorage.removeItem(key);
                }
              }
            } catch (error) {
              console.error('Error al limpiar localStorage:', error);
            }

            if (successCount > 0) {
              this.notificationService.showSuccess(
                `Se eliminaron ${successCount} pedido(s)${failCount > 0 ? `. ${failCount} pedido(s) no se pudieron eliminar.` : ''}`
              );
              this.loadOrders();
            } else {
              this.notificationService.showError('No se pudo eliminar ningún pedido. Por favor, intenta nuevamente.');
            }
          },
          error: (error) => {
            console.error('Error al eliminar pedidos:', error);
            this.notificationService.showError('Error al eliminar los pedidos. Por favor, intenta nuevamente.');
          }
        });
      }
    });
  }

  private mapBackendOrderToFrontend(backendOrder: OrderFromBackend): Order {
    const orderId = backendOrder._id || backendOrder.id || '';
    let detailedOrder: Order | null = null;
    let orderItems: any[] = [];
    if (orderItems.length === 0) {
      if (backendOrder.products && backendOrder.products.length > 0) {
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
              id: product.dishId || '',
              name: product.name || `Producto #${product.dishId}`,
              quantity: product.quantity || 1,
              price: product.unit_price || 0,
              selectedOptions: selectedOptions
            };
          });
        } else {
          orderItems = (backendOrder.products as string[]).map(productId => {
            const product = this.products.find(p => String(p.id) === String(productId));
            const productIdNumber = typeof product?.id === 'number'
              ? product.id
              : (typeof product?.id === 'string' ? Number(product.id) || 0 : 0);
            return {
              id: productIdNumber,
              name: product?.name || `Producto #${productId}`,
              quantity: 1,
              price: product?.price || 0,
              selectedOptions: []
            };
          });
        }
      }
    }

    const mappedStatus = this.mapBackendStatusToFrontend(backendOrder.status);
    const orderTotal = backendOrder.total || 0;

    const orderDate = backendOrder.createdAt
      ? new Date(backendOrder.createdAt)
      : new Date();

    return {
      id: orderId,
      date: orderDate,
      items: orderItems,
      total: orderTotal,
      status: mappedStatus,
      paymentMethod: backendOrder.payment_method,
      trackingCode: orderId.substring(0, 8).toUpperCase(),
      userName: backendOrder.user_name,
      deliveryAddress: undefined,
      deliveryNeighborhood: undefined,
      deliveryPhone: undefined,
      orderType: undefined,
      subtotal: orderTotal,
      additionalFees: 0,
    };
  }

  private mapBackendStatusToFrontend(backendStatus: string): Order['status'] {
    const statusMap: Record<string, Order['status']> = {
      'pendiente': 'pending',
      'en_proceso': 'preparing',
      'completado': 'ready',
      'entregado': 'delivered',
      'cancelado': 'cancelled'
    };
    return statusMap[backendStatus] || 'pending';
  }

  private mapFrontendStatusToBackend(frontendStatus: Order['status']): 'pendiente' | 'en_proceso' | 'completado' | 'cancelado' {
    const statusMap: Record<Order['status'], 'pendiente' | 'en_proceso' | 'completado' | 'cancelado'> = {
      'pending': 'pendiente',
      'preparing': 'en_proceso',
      'ready': 'completado',
      'delivered': 'completado',
      'cancelled': 'cancelado'
    };
    return statusMap[frontendStatus] || 'pendiente';
  }

  updateOrderStatus(order: Order, newStatus: Order['status']): void {
    const statusForEndpoint = this.orderService.mapFrontendStatusToStatusEndpoint(newStatus);
    
    this.orderService.updateStatus(order.id, statusForEndpoint).subscribe({
      next: (response) => {
        order.status = newStatus;
        
        order.statusChangedByAdmin = true;
        order.lastStatusChangeTime = new Date();
        
        if (newStatus === 'delivered') {
          this.userService.saveOrder(order);
        }

        this.calculateStats();
        this.notificationService.showSuccess('Estado del pedido actualizado exitosamente');
      },
      error: (error) => {
        let errorMessage = 'Error al actualizar el estado del pedido';
        if (error.error && error.error.message) {
          errorMessage = `Error: ${error.error.message}`;
        } else if (error.message) {
          errorMessage = `Error: ${error.message}`;
        }
        this.notificationService.showError(errorMessage);
        console.error('Error al actualizar estado del pedido:', error);
      }
    });
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

  trackByOrderId(index: number, order: Order): string {
    return order.id;
  }

  viewOrderDetails(order: Order): void {
    this.selectedOrder = order;
    this.showOrderDetailsModal = true;
  }

  closeOrderDetailsModal(): void {
    this.showOrderDetailsModal = false;
    this.selectedOrder = null;
  }

  markItemAsUnavailable(order: Order, item: any, itemIndex: number): void {
    this.selectedItemForUnavailable = { order, item, itemIndex };
    this.showUnavailableModal = true;
  }

  closeUnavailableModal(): void {
    this.showUnavailableModal = false;
    this.selectedItemForUnavailable = null;
  }

  handleUnavailableItem(action: 'cancel' | 'notify', reason?: string): void {
    if (!this.selectedItemForUnavailable) return;

    const { order, item, itemIndex } = this.selectedItemForUnavailable;
    const orderIndex = this.orders.findIndex(o => o.id === order.id);

    if (orderIndex === -1) return;

    const currentOrder = this.orders[orderIndex];
    const updatedItems = [...currentOrder.items];

    switch (action) {
      case 'cancel':
        updatedItems[itemIndex] = {
          ...item,
          unavailable: true,
          unavailableReason: reason || 'Producto no disponible',
          quantity: 0
        };
        const newTotal = updatedItems.reduce((sum, it) => {
          const itemTotal = it.price * it.quantity;
          const optionsTotal = (it.selectedOptions || []).reduce((optSum, opt) => optSum + (opt.price * it.quantity), 0);
          return sum + itemTotal + optionsTotal;
        }, 0);
        this.orders[orderIndex].total = newTotal;
        break;
      case 'notify':
        updatedItems[itemIndex] = {
          ...item,
          unavailable: true,
          unavailableReason: reason || 'Producto no disponible temporalmente'
        };
        break;
    }
    this.orders[orderIndex] = {
      ...currentOrder,
      items: updatedItems
    };
    this.userService.saveOrder(this.orders[orderIndex]);
    this.orderService.update(order.id, {}).subscribe({
      next: () => {
        this.notificationService.showSuccess('Item actualizado correctamente');
        this.calculateStats();
      },
      error: () => { }
    });

    this.closeUnavailableModal();
  }

  printOrder(order: Order): void {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Pedido #${order.id.slice(-8)}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { color: #6b1d3d; }
              .order-info { margin: 20px 0; }
              .order-item { margin: 10px 0; padding: 10px; background: #f5f5f5; }
              .total { font-size: 1.5em; font-weight: bold; margin-top: 20px; }
            </style>
          </head>
          <body>
            <h1>Pedido #${order.id.slice(-8)}</h1>
            <div class="order-info">
              <p><strong>Fecha:</strong> ${this.formatDate(order.date)}</p>
              <p><strong>Cliente:</strong> ${order.userName || 'N/A'}</p>
              <p><strong>Estado:</strong> ${this.getOrderStatusText(order.status)}</p>
              <p><strong>Total:</strong> $${order.total.toLocaleString()}</p>
            </div>
            <h2>Items:</h2>
            ${order.items.map(item => `
              <div class="order-item">
                <strong>${item.name}</strong> x${item.quantity} - $${(item.price * item.quantity).toLocaleString()}
                ${item.selectedOptions && item.selectedOptions.length > 0 ? `
                  <ul>
                    ${item.selectedOptions.map(opt => `<li>${opt.name} ${opt.price > 0 ? '+$' + opt.price.toLocaleString() : ''}</li>`).join('')}
                  </ul>
                ` : ''}
              </div>
            `).join('')}
            <div class="total">Total: $${order.total.toLocaleString()}</div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
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

  formatDate(date: Date | string): string {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) {
      return 'Fecha inválida';
    }
    return dateObj.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  onSettingsSubmit(): void {
    if (this.settingsForm.valid) {
      this.notificationService.showSuccess('Configuración guardada correctamente');
    }
  }

  openCategoryModal(category?: MenuCategory): void {
    this.selectedCategory = category || null;
    if (category) {
      this.categoryForm.patchValue({
        name: category.name,
        description: category.description,
        imageUrl: category.imageUrl || ''
      });
    } else {
      this.categoryForm.reset({
        imageUrl: ''
      });
    }
    this.showCategoryModal = true;
  }

  closeCategoryModal(): void {
    this.showCategoryModal = false;
    this.selectedCategory = null;
    this.categoryForm.reset();
  }

  saveCategory(): void {
    if (this.categoryForm.valid) {
      const formValue = this.categoryForm.value;
      const categoryName = formValue.name.trim();
      
      const categoryData = {
        name: categoryName,
        description: formValue.description.trim()
      };

      if (this.selectedCategory) {
        const existingCategory = this.categories.find(
          cat => cat.id !== this.selectedCategory!.id && 
          cat.name.toLowerCase().trim() === categoryName.toLowerCase()
        );
        
        if (existingCategory) {
          this.notificationService.showError('Ya existe una categoría con ese nombre. Por favor, elige otro nombre.');
          return;
        }
        
        this.menuService.updateCategory(this.selectedCategory.id, categoryData).subscribe({
          next: () => {
            this.notificationService.showSuccess('Categoría actualizada correctamente');
            this.closeCategoryModal();
            this.loadCategories();
            window.dispatchEvent(new CustomEvent('categoriesUpdated'));
          },
          error: (error) => {
            let errorMessage = 'Error al actualizar la categoría. Por favor, intenta nuevamente.';
            if (error.error && error.error.message) {
              errorMessage = `Error: ${error.error.message}`;
            }
            this.notificationService.showError(errorMessage);
          }
        });
      } else {
        const existingCategory = this.categories.find(
          cat => cat.name.toLowerCase().trim() === categoryName.toLowerCase()
        );
        
        if (existingCategory) {
          this.notificationService.showError('Ya existe una categoría con ese nombre. Por favor, elige otro nombre.');
          return;
        }
        
        this.menuService.createCategory(categoryData).subscribe({
          next: () => {
            this.notificationService.showSuccess('Categoría creada correctamente');
            this.closeCategoryModal();
            this.loadCategories();
            window.dispatchEvent(new CustomEvent('categoriesUpdated'));
          },
          error: (error) => {
            let errorMessage = 'Error al crear la categoría. Por favor, intenta nuevamente.';
            if (error.error && error.error.message) {
              errorMessage = `Error: ${error.error.message}`;
            }
            this.notificationService.showError(errorMessage);
          }
        });
      }
    }
  }

  async deleteCategory(categoryId: string): Promise<void> {
    const confirmed = await this.notificationService.confirm(
      '¿Estás seguro de que deseas eliminar esta categoría?',
      'Esta acción no se puede deshacer.'
    );

    if (confirmed) {
      this.menuService.deleteCategory(categoryId).subscribe({
        next: () => {
          this.notificationService.showSuccess('Categoría eliminada correctamente');
          this.loadCategories();
          window.dispatchEvent(new CustomEvent('categoriesUpdated'));
        },
        error: (error) => {
          let errorMessage = 'Error al eliminar la categoría. Por favor, intenta nuevamente.';
          if (error.error && error.error.message) {
            errorMessage = `Error: ${error.error.message}`;
          }
          this.notificationService.showError(errorMessage);
        }
      });
    }
  }

  logout(): void {
    this.authService.logout();
  }

  loadSupplies(): void {
    switch (this.supplyFilter) {
      case 'low':
        this.supplyService.getLowStock(this.lowStockThreshold).subscribe({
          next: (response) => {
            this.supplies = response.supplies;
          },
          error: () => {
            this.notificationService.showError('Error al cargar el inventario');
          }
        });
        break;
      case 'out':
        this.supplyService.getOutOfStock().subscribe({
          next: (response) => {
            this.supplies = response.supplies;
          },
          error: () => {
            this.notificationService.showError('Error al cargar el inventario');
          }
        });
        break;
      default:
        this.supplyService.findAll().subscribe({
          next: (response) => {
            this.supplies = response.supplies;
          },
          error: () => {
            this.notificationService.showError('Error al cargar el inventario');
          }
        });
        break;
    }
  }

  openSupplyModal(supply?: Supply): void {
    this.selectedSupply = supply || null;
    if (supply) {
      this.supplyForm.patchValue({
        name: supply.name,
        description: supply.description,
        unit_price: supply.unit_price,
        quantity: supply.quantity
      });
    } else {
      this.supplyForm.reset({
        unit_price: 0,
        quantity: 0
      });
    }
    this.showSupplyModal = true;
  }

  closeSupplyModal(): void {
    this.showSupplyModal = false;
    this.selectedSupply = null;
    this.supplyForm.reset();
  }

  saveSupply(): void {
    if (this.supplyForm.valid) {
      const formValue = this.supplyForm.value;
      const supplyName = formValue.name.trim();
      
      const supplyData: CreateSupplyDto | UpdateSupplyDto = {
        name: supplyName,
        description: formValue.description.trim(),
        unit_price: Number(formValue.unit_price),
        quantity: Number(formValue.quantity)
      };

      if (this.selectedSupply) {
        const existingSupply = this.supplies.find(
          sup => (sup._id || sup.id) !== (this.selectedSupply!._id || this.selectedSupply!.id) && 
          sup.name.toLowerCase().trim() === supplyName.toLowerCase()
        );
        
        if (existingSupply) {
          this.notificationService.showError('Ya existe un insumo con ese nombre. Por favor, elige otro nombre.');
          return;
        }
        
        this.supplyService.update(this.selectedSupply._id || this.selectedSupply.id || '', supplyData).subscribe({
          next: () => {
            this.notificationService.showSuccess('Insumo actualizado correctamente');
            this.closeSupplyModal();
            this.loadSupplies();
          },
          error: (error) => {
            this.notificationService.showError(error.message || 'Error al actualizar el insumo.');
          }
        });
      } else {
        const existingSupply = this.supplies.find(
          sup => sup.name.toLowerCase().trim() === supplyName.toLowerCase()
        );
        
        if (existingSupply) {
          this.notificationService.showError('Ya existe un insumo con ese nombre. Por favor, elige otro nombre.');
          return;
        }
        
        this.supplyService.create(supplyData as CreateSupplyDto).subscribe({
          next: () => {
            this.notificationService.showSuccess('Insumo creado correctamente');
            this.closeSupplyModal();
            this.loadSupplies();
          },
          error: (error) => {
            this.notificationService.showError(error.message || 'Error al crear el insumo.');
          }
        });
      }
    }
  }

  async deleteSupply(id: string): Promise<void> {
    const confirmed = await this.notificationService.confirm(
      'Eliminar Insumo',
      '¿Estás seguro de que quieres eliminar este insumo? Esta acción no se puede deshacer.',
      'Eliminar',
      'Cancelar'
    );

    if (confirmed) {
      this.supplyService.remove(id).subscribe({
        next: () => {
          this.notificationService.showSuccess('Insumo eliminado correctamente');
          this.loadSupplies();
        },
        error: (error) => {
          this.notificationService.showError(error.message || 'Error al eliminar el insumo.');
        }
      });
    }
  }

  getStockStatusClass(quantity: number): string {
    if (quantity === 0) return 'stock-out';
    if (quantity < this.lowStockThreshold) return 'stock-low';
    return 'stock-ok';
  }

  getStockStatusText(quantity: number): string {
    if (quantity === 0) return 'Agotado';
    if (quantity < this.lowStockThreshold) return 'Stock Bajo';
    return 'Disponible';
  }

  loadReservations(): void {
    if (!this.authService.isAuthenticated() || !this.authService.isAdmin()) {
      this.reservations = [];
      this.calculateReservationStats();
      return;
    }

    this.reservationsService.findAll().subscribe({
      next: (reservations) => {
        this.reservations = reservations.map(r => this.reservationsService.mapBackendReservationToFrontend(r));
        this.reservations.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        this.calculateReservationStats();
        if (this.activeTab === 'customers') {
          this.loadCustomers();
        }
      },
      error: (error) => {
        if (error?.status === 401 || error?.status === 403 || error?.status === 0 || error?.status === 404) {
          this.reservations = [];
          this.calculateReservationStats();
          return;
        }

        console.error('Error loading reservations:', error);
        if (error?.status && error.status >= 500) {
          this.notificationService.showError('Error al cargar las reservas');
        }
        this.reservations = [];
        this.calculateReservationStats();
      }
    });
  }

  calculateReservationStats(): void {
    this.stats.totalReservations = this.reservations.length;
    this.stats.pendingReservations = this.reservations.filter(r => r.status === 'pending').length;
  }

  getFilteredReservations(): Reservation[] {
    let filtered = this.reservations;

    if (this.reservationFilter !== 'all') {
      filtered = filtered.filter(reservation => reservation.status === this.reservationFilter);
    }

    if (this.searchTerm) {
      filtered = filtered.filter(reservation =>
        reservation.tableNumber.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        reservation.userName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        reservation.userEmail.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }

    return filtered;
  }

  confirmReservation(reservation: Reservation): void {
    this.reservationsService.updateStatus(reservation.id, 'confirmed').subscribe({
      next: () => {
        reservation.status = 'confirmed';
        this.calculateReservationStats();
        this.notificationService.showSuccess(`Reserva ${reservation.tableNumber} confirmada exitosamente`);
      },
      error: (error) => {
        const errorMessage = error?.message || error?.error?.message || 'Error al confirmar la reserva';
        this.notificationService.showError(errorMessage);
      }
    });
  }

  openCancelReservationModal(reservation: Reservation): void {
    this.selectedReservation = reservation;
    this.cancelReason = '';
    this.showCancelReservationModal = true;
  }

  closeCancelReservationModal(): void {
    this.showCancelReservationModal = false;
    this.selectedReservation = null;
    this.cancelReason = '';
  }

  cancelReservation(): void {
    if (!this.selectedReservation) return;

    const reason = this.cancelReason.trim() || 'Reserva cancelada por el administrador';

    this.reservationsService.updateStatus(this.selectedReservation.id, 'cancelled').subscribe({
      next: () => {
        this.selectedReservation!.status = 'cancelled';
        this.calculateReservationStats();
        this.notificationService.showSuccess(`Reserva ${this.selectedReservation!.tableNumber} cancelada exitosamente`);

        const clientMessage = `Su reserva para la mesa ${this.selectedReservation!.tableNumber} el ${this.selectedReservation!.date} a las ${this.selectedReservation!.time} ha sido cancelada. ${reason}`;
        this.notificationService.showInfo(`Cliente notificado: ${clientMessage}`);

        this.closeCancelReservationModal();
      },
      error: (error) => {
        const errorMessage = error?.message || error?.error?.message || 'Error al cancelar la reserva';
        this.notificationService.showError(errorMessage);
      }
    });
  }

  completeReservation(reservation: Reservation): void {
    this.reservationsService.updateStatus(reservation.id, 'completed').subscribe({
      next: () => {
        reservation.status = 'completed';
        this.calculateReservationStats();
        this.notificationService.showSuccess(`Reserva ${reservation.tableNumber} marcada como completada`);
      },
      error: (error) => {
        const errorMessage = error?.message || error?.error?.message || 'Error al completar la reserva';
        this.notificationService.showError(errorMessage);
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

  get pendingReservationsCount(): number {
    return this.reservations.filter(r => r.status === 'pending').length;
  }

  get confirmedReservationsCount(): number {
    return this.reservations.filter(r => r.status === 'confirmed').length;
  }

  get cancelledReservationsCount(): number {
    return this.reservations.filter(r => r.status === 'cancelled').length;
  }

  get completedReservationsCount(): number {
    return this.reservations.filter(r => r.status === 'completed').length;
  }

  loadExtras(): void {
    this.availableExtras = this.extrasAvailabilityService.getAllExtras();
    this.loadAdds();
  }

  loadAdds(): void {
    this.addsService.findAll().subscribe({
      next: (adds) => {
        this.adds = adds;
      },
      error: (error) => {
        console.error('Error al cargar adicionales:', error);
        this.notificationService.showError('Error al cargar los adicionales del servidor');
      }
    });
  }

  openExtrasModal(): void {
    this.loadExtras();
    this.showExtrasModal = true;
  }

  closeExtrasModal(): void {
    this.showExtrasModal = false;
  }

  toggleExtraAvailability(extra: ExtraAvailability): void {
    const newAvailability = !extra.available;
    this.extrasAvailabilityService.updateExtraAvailability(extra.id, newAvailability);
    this.loadExtras();
    this.notificationService.showSuccess(`${extra.name} ${newAvailability ? 'habilitado' : 'deshabilitado'}`);
    window.dispatchEvent(new CustomEvent('extrasUpdated'));
  }

  resetExtrasToDefaults(): void {
    this.extrasAvailabilityService.resetToDefaults();
    this.loadExtras();
    this.notificationService.showSuccess('Adicionales restaurados a valores por defecto');
    window.dispatchEvent(new CustomEvent('extrasUpdated'));
  }

  openExtraFormModal(extra?: ExtraAvailability): void {
    if (extra) {
      this.selectedExtra = { ...extra };
      this.extraForm.enable();
      this.extraForm.patchValue({
        name: extra.name,
        price: extra.price,
        available: extra.available
      });
    } else {
      this.selectedExtra = null;
      this.extraForm.enable();
      this.extraForm.reset({
        name: '',
        price: 0,
        available: true
      });
    }

    this.showExtraFormModal = true;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 10);
  }

  closeExtraFormModal(): void {
    this.showExtraFormModal = false;
    this.selectedExtra = null;
    this.extraForm.reset();
    this.extraForm.enable();
  }

  saveExtra(): void {
    if (this.extraForm.valid) {
      const formValue = this.extraForm.value;

      if (this.selectedExtra) {
        this.extrasAvailabilityService.updateExtra(this.selectedExtra.id, {
          name: formValue.name.trim(),
          price: Number(formValue.price),
          available: formValue.available
        });
        this.notificationService.showSuccess('Adicional actualizado correctamente');
      } else {
        this.extrasAvailabilityService.createExtra({
          name: formValue.name.trim(),
          price: Number(formValue.price),
          available: formValue.available
        });
        this.notificationService.showSuccess('Adicional creado correctamente');
      }

      this.loadExtras();
      this.closeExtraFormModal();
      window.dispatchEvent(new CustomEvent('extrasUpdated'));
    }
  }

  async deleteExtra(extra: ExtraAvailability): Promise<void> {
    const confirmed = await this.notificationService.confirm(
      'Eliminar Adicional',
      `¿Estás seguro de que deseas eliminar "${extra.name}"?`
    );

    if (confirmed) {
      this.extrasAvailabilityService.deleteExtra(extra.id);
      this.loadExtras();
      this.notificationService.showSuccess('Adicional eliminado correctamente');
      window.dispatchEvent(new CustomEvent('extrasUpdated'));
    }
  }

  viewExtra(extra: ExtraAvailability): void {
    this.selectedExtra = { ...extra };
    this.extraForm.patchValue({
      name: extra.name,
      price: extra.price,
      available: extra.available
    });
    this.extraForm.disable();
    this.showExtraFormModal = true;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 10);
  }

  trackByExtraId(index: number, extra: ExtraAvailability): string {
    return extra.id;
  }

  openAddModal(add?: Add): void {
    this.selectedAdd = add || null;
    if (add) {
      this.addForm.patchValue({
        name: add.name,
        price: add.price,
        categoryIds: add.categoryIds || [],
        dishIds: add.dishIds || [],
        available: add.available !== false
      });
      this.selectedProductsForAdd = add.dishIds || [];
      if (add.dishIds && add.dishIds.length > 0) {
        this.addSelectionMode = add.categoryIds && add.categoryIds.length > 0 ? 'both' : 'products';
      } else {
        this.addSelectionMode = 'categories';
      }
    } else {
      this.addForm.reset({
        name: '',
        price: 0,
        categoryIds: [],
        dishIds: [],
        available: true
      });
      this.selectedProductsForAdd = [];
      this.addSelectionMode = 'categories';
    }
    this.showAddModal = true;
  }

  closeAddModal(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.showAddModal = false;
    this.selectedAdd = null;
    this.addForm.reset({
      name: '',
      price: 0,
      categoryIds: [],
      dishIds: [],
      available: true
    });
    this.selectedProductsForAdd = [];
    this.addSelectionMode = 'categories';
  }

  saveAdd(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (this.addForm.invalid) {
      Object.keys(this.addForm.controls).forEach(key => {
        this.addForm.get(key)?.markAsTouched();
      });
      this.notificationService.showError('Por favor, completa todos los campos requeridos');
      return;
    }

    const formValue = this.addForm.value;
    const categoryIds = Array.isArray(formValue.categoryIds) ? formValue.categoryIds : [];
    const dishIds = Array.isArray(formValue.dishIds) ? formValue.dishIds : [];
    const addName = formValue.name.trim();

    if (!this.selectedAdd) {
      const duplicateAdd = this.adds.find(
        a => a.name.toLowerCase().trim() === addName.toLowerCase().trim()
      );

      if (duplicateAdd) {
        this.notificationService.showError(
          `No se puede crear el adicional porque ya existe uno con el nombre "${duplicateAdd.name}"`
        );
        return;
      }
    } else {
      const currentAddId = this.selectedAdd._id || this.selectedAdd.id;
      const duplicateAdd = this.adds.find(
        a => (a._id || a.id) !== currentAddId &&
          a.name.toLowerCase().trim() === addName.toLowerCase().trim()
      );

      if (duplicateAdd) {
        this.notificationService.showError(
          `No se puede actualizar el adicional porque ya existe otro con el nombre "${duplicateAdd.name}"`
        );
        return;
      }
    }

    if (this.addSelectionMode === 'categories' && categoryIds.length === 0) {
      this.notificationService.showError('Debes seleccionar al menos una categoría');
      return;
    }

    if (this.addSelectionMode === 'products' && dishIds.length === 0) {
      this.notificationService.showError('Debes seleccionar al menos un producto específico');
      return;
    }

    if (this.addSelectionMode === 'both' && categoryIds.length === 0 && dishIds.length === 0) {
      this.notificationService.showError('Debes seleccionar al menos una categoría o producto específico');
      return;
    }

    const addData: any = {
      name: addName,
      price: Number(formValue.price),
      categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
      available: formValue.available !== false
    };

    if (dishIds.length > 0) {
      addData.dishIds = dishIds;
    } else if (this.addSelectionMode === 'products') {
      addData.dishIds = [];
    }

    if (this.selectedAdd) {
      const addId = this.selectedAdd._id || this.selectedAdd.id;
      if (!addId) {
        this.notificationService.showError('Error: ID del adicional no válido');
        return;
      }

      this.addsService.update(addId, addData).subscribe({
        next: () => {
          this.notificationService.showSuccess('Adicional actualizado correctamente');
          this.closeAddModal();
          this.loadAdds();
          window.dispatchEvent(new CustomEvent('addsUpdated'));
        },
        error: (error) => {
          let errorMessage = 'Error al actualizar el adicional';
          if (error.error?.message) {
            errorMessage = error.error.message;
          }
          this.notificationService.showError(errorMessage);
        }
      });
    } else {
      this.addsService.create(addData).subscribe({
        next: () => {
          this.notificationService.showSuccess('Adicional creado correctamente');
          this.closeAddModal();
          this.loadAdds();
          window.dispatchEvent(new CustomEvent('addsUpdated'));
        },
        error: (error) => {
          let errorMessage = 'Error al crear el adicional';
          if (error.error?.message) {
            errorMessage = error.error.message;
          }
          this.notificationService.showError(errorMessage);
        }
      });
    }
  }

  deleteAdd(add: Add): void {
    const addName = add.name;
    this.notificationService.confirm(
      'Eliminar Adicional',
      `¿Estás seguro de que deseas eliminar el adicional "${addName}"? Esta acción no se puede deshacer.`,
      'Eliminar',
      'Cancelar'
    ).then(confirmed => {
      if (confirmed) {
        const addId = add._id || add.id;
        if (!addId) {
          this.notificationService.showError('Error: ID del adicional no válido');
          return;
        }

        this.addsService.remove(addId).subscribe({
          next: () => {
            this.notificationService.showSuccess('Adicional eliminado correctamente');
            this.loadAdds();
            window.dispatchEvent(new CustomEvent('addsUpdated'));
          },
          error: (error) => {
            let errorMessage = 'Error al eliminar el adicional';
            if (error.error?.message) {
              errorMessage = error.error.message;
            }
            this.notificationService.showError(errorMessage);
          }
        });
      }
    });
  }

  toggleAddAvailability(add: Add): void {
    const addId = add._id || add.id;
    if (!addId) {
      this.notificationService.showError('Error: ID del adicional no válido');
      return;
    }

    const newAvailability = !add.available;
    this.addsService.update(addId, { available: newAvailability }).subscribe({
      next: () => {
        add.available = newAvailability;
        this.notificationService.showSuccess(
          `Adicional ${newAvailability ? 'habilitado' : 'deshabilitado'} correctamente`
        );
        this.loadAdds();
        window.dispatchEvent(new CustomEvent('addsUpdated'));
      },
      error: (error) => {
        let errorMessage = 'Error al actualizar la disponibilidad';
        if (error.error?.message) {
          errorMessage = error.error.message;
        }
        this.notificationService.showError(errorMessage);
      }
    });
  }

  getCategoryNames(categoryIds: string[]): string {
    if (!categoryIds || categoryIds.length === 0) {
      return 'Sin categorías';
    }
    const categoryNames = categoryIds
      .map(id => {
        const category = this.categories.find(c => c.id === id);
        return category ? category.name : id;
      })
      .filter(name => name);

    if (categoryNames.length === 0) {
      return 'Categorías no encontradas';
    }
    if (categoryNames.length === this.categories.length) {
      return 'Todas las categorías';
    }
    return categoryNames.join(', ');
  }

  getProductNames(dishIds: string[]): string {
    if (!dishIds || dishIds.length === 0) {
      return '';
    }
    const productNames = dishIds
      .map(id => {
        const product = this.products.find(p => String(p.id) === id);
        return product ? product.name : id;
      })
      .filter(name => name);

    if (productNames.length === 0) {
      return 'Productos no encontrados';
    }
    if (productNames.length === this.products.length) {
      return 'Todos los productos';
    }
    return productNames.join(', ');
  }

  toggleProductSelection(dishId: string | number): void {
    const dishIdStr = String(dishId);
    const currentIds = this.addForm.get('dishIds')?.value || [];
    const index = currentIds.indexOf(dishIdStr);

    if (index > -1) {
      currentIds.splice(index, 1);
    } else {
      currentIds.push(dishIdStr);
    }

    this.addForm.patchValue({ dishIds: currentIds });
    this.selectedProductsForAdd = currentIds;
  }

  isProductSelected(dishId: string | number): boolean {
    const dishIdStr = String(dishId);
    const currentIds = this.addForm.get('dishIds')?.value || [];
    return currentIds.includes(dishIdStr);
  }

  selectAllProducts(): void {
    const allProductIds = this.products.map(p => String(p.id));
    this.addForm.patchValue({ dishIds: allProductIds });
    this.selectedProductsForAdd = allProductIds;
  }

  deselectAllProducts(): void {
    this.addForm.patchValue({ dishIds: [] });
    this.selectedProductsForAdd = [];
  }

  toggleCategorySelection(categoryId: string): void {
    const currentIds = this.addForm.get('categoryIds')?.value || [];
      const index = currentIds.indexOf(categoryId);

    if (index > -1) {
      currentIds.splice(index, 1);
    } else {
      currentIds.push(categoryId);
    }

    this.addForm.patchValue({ categoryIds: currentIds });
  }

  selectAllCategories(): void {
    const allCategoryIds = this.categories.map(c => c.id);
    this.addForm.patchValue({ categoryIds: allCategoryIds });
  }

  deselectAllCategories(): void {
    this.addForm.patchValue({ categoryIds: [] });
  }

  isCategorySelected(categoryId: string): boolean {
    const currentIds = this.addForm.get('categoryIds')?.value || [];
    return currentIds.includes(categoryId);
  }

  get filteredAdds(): Add[] {
    if (!this.addSearchTerm) {
      return this.adds;
    }
    const search = this.addSearchTerm.toLowerCase();
    return this.adds.filter(add =>
      add.name.toLowerCase().includes(search) ||
      add.description.toLowerCase().includes(search)
    );
  }

  loadContactMessages(): void {
    this.contactService.findAll().subscribe({
      next: (messages) => {
        this.contactMessages = messages.map(m => this.contactService.mapBackendMessageToFrontend(m));
        this.contactMessages.sort((a, b) => {
          const dateA = a.createdAt ? (a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime()) : 0;
          const dateB = b.createdAt ? (b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime()) : 0;
          return dateB - dateA;
        });
        this.calculateMessageStats();
      },
      error: (error) => {
        console.error('Error loading contact messages:', error);
        if (error?.status !== 404 && error?.status !== 0) {
          this.notificationService.showError('Error al cargar los mensajes de contacto');
        }
        this.contactMessages = [];
        this.calculateMessageStats();
      }
    });
  }

  calculateMessageStats(): void {
    this.stats.totalMessages = this.contactMessages.length;
    this.stats.unreadMessages = this.contactMessages.filter(m => !m.read).length;
  }

  getFilteredMessages(): ContactMessage[] {
    let filtered = this.contactMessages;

    if (this.messageFilter === 'unread') {
      filtered = filtered.filter(m => !m.read);
    } else if (this.messageFilter === 'read') {
      filtered = filtered.filter(m => m.read);
    }

    return filtered;
  }

  openMessageModal(message: ContactMessage): void {
    this.selectedMessage = message;
    this.showMessageModal = true;

    if (!message.read) {
      this.contactService.markAsRead(message.id).subscribe({
        next: () => {
          message.read = true;
          this.calculateMessageStats();
        },
        error: (error) => {
          console.error('Error marking message as read:', error);
        }
      });
    }
  }

  closeMessageModal(): void {
    this.showMessageModal = false;
    this.selectedMessage = null;
  }

  async deleteMessage(message: ContactMessage): Promise<void> {
    const confirmed = await this.notificationService.confirm(
      'Eliminar Mensaje',
      `¿Estás seguro de que deseas eliminar el mensaje "${message.subject}"? Esta acción no se puede deshacer.`,
      'Eliminar',
      'Cancelar'
    );

    if (confirmed) {
      this.contactService.remove(message.id).subscribe({
        next: () => {
          this.contactMessages = this.contactMessages.filter(m => m.id !== message.id);
          this.calculateMessageStats();
          this.notificationService.showSuccess('Mensaje eliminado correctamente');
          if (this.selectedMessage?.id === message.id) {
            this.closeMessageModal();
          }
        },
        error: (error) => {
          const errorMessage = error?.message || error?.error?.message || 'Error al eliminar el mensaje';
          this.notificationService.showError(errorMessage);
        }
      });
    }
  }

  markMessageAsRead(message: ContactMessage): void {
    if (!message.read) {
      this.contactService.markAsRead(message.id).subscribe({
        next: () => {
          message.read = true;
          this.calculateMessageStats();
          this.notificationService.showSuccess('Mensaje marcado como leído');
        },
        error: (error) => {
          const errorMessage = error?.message || error?.error?.message || 'Error al marcar el mensaje como leído';
          this.notificationService.showError(errorMessage);
        }
      });
    }
  }

  get unreadMessagesCount(): number {
    return this.contactMessages.filter(m => !m.read).length;
  }

  isMobile(): boolean {
    return window.innerWidth <= 1200;
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  setActiveTab(tab: 'dashboard' | 'products' | 'orders' | 'categories' | 'settings' | 'inventory' | 'reservations' | 'extras' | 'messages' | 'customers'): void {
    if (this.isMobile()) {
      this.sidebarOpen = false;
    }
    this.activeTab = tab;
    if (this.isMobile()) {
      this.closeSidebar();
    }
    if (tab === 'orders') {
      this.loadOrders();
    }
    if (tab === 'inventory') {
      this.loadSupplies();
    }
    if (tab === 'reservations') {
      this.loadReservations();
    }
    if (tab === 'extras') {
      this.loadExtras();
      this.loadAdds();
    }
    if (tab === 'messages') {
      this.loadContactMessages();
    }
    if (tab === 'customers') {
      this.loadCustomers();
    }
  }

  loadCustomers(): void {
    this.userService.getAllUsers().subscribe({
      next: (response) => {
        let users: any[] = [];
        if (Array.isArray(response)) {
          users = response;
        } else if (response && Array.isArray(response.users)) {
          users = response.users;
        } else if (response && Array.isArray(response.data)) {
          users = response.data;
        } else {
          console.warn('Formato de respuesta inesperado del backend:', response);
          this.loadCustomersFromOrders();
          return;
        }

        console.log('Usuarios cargados del backend:', users.length);

        const customersMap = new Map<string, any>();

        users.forEach(user => {
          const userId = user._id || user.id || user.email;
          
          if (!userId) {
            console.warn('Usuario sin ID válido:', user);
            return;
          }
          
          const customerOrders = this.orders.filter(o => 
            o.userName === user.complete_name || 
            o.userName === user.name ||
            o.deliveryPhone === user.phone_number ||
            o.deliveryPhone === user.phone
          );

          const customerReservations = this.reservations.filter(r =>
            r.userEmail === user.email ||
            r.userName === user.complete_name ||
            r.userName === user.name
          );

          const totalSpent = customerOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
          
          let lastActivityDate: Date | null = null;
          
          if (customerOrders.length > 0) {
            const lastOrder = customerOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            lastActivityDate = new Date(lastOrder.date);
          }
          
          if (customerReservations.length > 0) {
            const lastReservation = customerReservations.sort((a, b) => {
              const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return dateB - dateA;
            })[0];
            
            const reservationDate = lastReservation.createdAt ? new Date(lastReservation.createdAt) : null;
            if (reservationDate) {
              if (!lastActivityDate || reservationDate > lastActivityDate) {
                lastActivityDate = reservationDate;
              }
            }
          }
          
          const lastOrderDate = lastActivityDate || (user.createdAt ? new Date(user.createdAt) : null);

          customersMap.set(userId, {
            id: userId,
            name: user.complete_name || user.name || 'Cliente',
            email: user.email || '',
            phone: user.phone_number || user.phone || '',
            address: user.address || '',
            totalOrders: customerOrders.length,
            totalReservations: customerReservations.length,
            totalSpent: totalSpent,
            lastOrderDate: lastOrderDate,
            status: user.status || 'active',
            role: user.role || 'customer',
            createdAt: user.createdAt
          });
        });

        this.customers = Array.from(customersMap.values());
        this.stats.totalCustomers = this.customers.length;
        console.log('Clientes mapeados:', this.customers.length);
      },
      error: (error) => {
        console.error('Error al cargar clientes desde el backend:', error);
        this.notificationService.showError('Error al cargar clientes desde el backend. Usando datos locales.');
        this.loadCustomersFromOrders();
      }
    });
  }

  private loadCustomersFromOrders(): void {
    const customersMap = new Map<string, any>();

    this.orders.forEach(order => {
      const customerKey = order.userName || order.deliveryPhone || order.id;
      if (customerKey && !customersMap.has(customerKey)) {
        const customerOrders = this.orders.filter(o =>
          (o.userName && o.userName === order.userName) ||
          (o.deliveryPhone && o.deliveryPhone === order.deliveryPhone)
        );

        customersMap.set(customerKey, {
          id: customerKey,
          name: order.userName || 'Cliente',
          email: '',
          phone: order.deliveryPhone || '',
          address: order.deliveryAddress || '',
          totalOrders: customerOrders.length,
          totalSpent: customerOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0),
          lastOrderDate: order.date,
          status: 'active',
          role: 'customer'
        });
      }
    });

    this.reservations.forEach(reservation => {
      const customerKey = reservation.userEmail || reservation.userName;
      if (customerKey) {
        if (customersMap.has(customerKey)) {
          const customer = customersMap.get(customerKey);
          customer.totalReservations = (customer.totalReservations || 0) + 1;
        } else {
          const customerReservations = this.reservations.filter(r =>
            r.userEmail === reservation.userEmail || r.userName === reservation.userName
          );

          customersMap.set(customerKey, {
            id: customerKey,
            name: reservation.userName || 'Cliente',
            email: reservation.userEmail || '',
            phone: '',
            address: '',
            totalOrders: 0,
            totalReservations: customerReservations.length,
            totalSpent: 0,
            lastOrderDate: reservation.createdAt ? new Date(reservation.createdAt) : new Date(),
            status: 'active',
            role: 'customer'
          });
        }
      }
    });

    this.customers = Array.from(customersMap.values());
    this.stats.totalCustomers = this.customers.length;
  }

  getFilteredCustomers(): any[] {
    let filtered = this.customers;

    if (this.customerFilter !== 'all') {
      filtered = filtered.filter(customer => customer.status === this.customerFilter);
    }

    if (this.customerSearchTerm) {
      const search = this.customerSearchTerm.toLowerCase();
      filtered = filtered.filter(customer =>
        customer.name.toLowerCase().includes(search) ||
        customer.email.toLowerCase().includes(search) ||
        customer.phone.toLowerCase().includes(search)
      );
    }

    return filtered;
  }

  openCustomerModal(customer: any, edit: boolean = false): void {
    this.selectedCustomer = customer;
    this.isEditingCustomer = edit;
    if (edit && customer) {
      this.customerForm.patchValue({
        name: customer.name || '',
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || ''
      });
    } else {
      this.customerForm.reset();
    }
    this.showCustomerModal = true;
  }

  closeCustomerModal(): void {
    this.showCustomerModal = false;
    this.selectedCustomer = null;
    this.isEditingCustomer = false;
    this.customerForm.reset();
  }

  saveCustomer(): void {
    if (this.customerForm.valid && this.selectedCustomer) {
      const formValue = this.customerForm.value;
      const updateData: any = {
        complete_name: formValue.name.trim(),
        email: formValue.email.trim(),
        phone_number: formValue.phone.trim()
      };
      if (formValue.address) {
        updateData.address = formValue.address.trim();
      }

      const customerId = this.selectedCustomer.id || this.selectedCustomer.email;
      if (!customerId) {
        this.notificationService.showError('Error: ID del cliente no válido');
        return;
      }

      this.http.patch<any>(`${environment.apiUrl}/users/${customerId}`, updateData).subscribe({
        next: () => {
          this.notificationService.showSuccess('Cliente actualizado correctamente');
          this.closeCustomerModal();
          this.loadCustomers();
        },
        error: (error) => {
          let errorMessage = 'Error al actualizar el cliente. Por favor, intenta nuevamente.';
          if (error.error && error.error.message) {
            errorMessage = `Error: ${error.error.message}`;
          }
          this.notificationService.showError(errorMessage);
        }
      });
    }
  }

  adminPasswordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  openAdminModal(): void {
    this.showAdminModal = true;
    this.adminForm.reset();
  }

  closeAdminModal(): void {
    this.showAdminModal = false;
    this.adminForm.reset();
  }

  createAdmin(): void {
    if (this.adminForm.valid) {
      const formValue = this.adminForm.value;
      const adminData = {
        complete_name: formValue.name.trim(),
        email: formValue.email.trim(),
        phone_number: formValue.phone.trim(),
        password: formValue.password,
        role: 'admin'
      };

      this.authService.register(adminData).subscribe({
        next: () => {
          this.notificationService.showSuccess('Administrador creado correctamente');
          this.closeAdminModal();
          this.loadCustomers();
        },
        error: (error) => {
          let errorMessage = 'Error al crear el administrador. Por favor, intenta nuevamente.';
          if (error.error && error.error.message) {
            errorMessage = `Error: ${error.error.message}`;
          }
          this.notificationService.showError(errorMessage);
        }
      });
    }
  }

  async deleteCustomer(customer: any): Promise<void> {
    const confirmed = await this.notificationService.confirm(
      'Eliminar Cliente',
      `¿Estás seguro de que deseas eliminar al cliente "${customer.name}"? Esta acción no se puede deshacer.`
    );

    if (confirmed) {
      const customerId = customer.id || customer.email;
      if (!customerId) {
        this.notificationService.showError('Error: ID del cliente no válido');
        return;
      }

      this.http.delete<any>(`${environment.apiUrl}/users/${customerId}`).subscribe({
        next: () => {
          this.notificationService.showSuccess('Cliente eliminado correctamente');
          this.loadCustomers();
        },
        error: (error) => {
          let errorMessage = 'Error al eliminar el cliente. Por favor, intenta nuevamente.';
          if (error.error && error.error.message) {
            errorMessage = `Error: ${error.error.message}`;
          }
          this.notificationService.showError(errorMessage);
        }
      });
    }
  }

  getCustomerInitials(name: string): string {
    if (!name) return 'C';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  getCustomerOrders(customerId: string): Order[] {
    return this.orders.filter(order =>
      (order.userName && order.userName === customerId) ||
      (order.deliveryPhone && order.deliveryPhone === customerId)
    );
  }

  getCustomerReservations(customerEmail: string, customerName: string): Reservation[] {
    return this.reservations.filter(reservation =>
      reservation.userEmail === customerEmail || reservation.userName === customerName
    );
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }
}
