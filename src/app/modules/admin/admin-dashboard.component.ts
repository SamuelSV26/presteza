import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
import { ContactService } from '../../core/services/contact.service';
import { ContactMessageFromBackend, ContactMessage } from '../../core/models/ContactMessage';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  activeTab: 'dashboard' | 'products' | 'orders' | 'categories' | 'settings' | 'inventory' | 'reservations' | 'extras' | 'messages' = 'dashboard';

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
  contactMessages: ContactMessage[] = [];
  selectedMessage: ContactMessage | null = null;
  showMessageModal = false;
  messageFilter: 'all' | 'unread' | 'read' = 'all';
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
    private menuService: MenuService,
    private extrasAvailabilityService: ExtrasAvailabilityService,
    private userService: UserService,
    private orderService: OrderService,
    private supplyService: SupplyService,
    private reservationsService: ReservationsService,
    private contactService: ContactService,
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {
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

    this.supplyForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      unit_price: [0, [Validators.required, Validators.min(0)]],
      quantity: [0, [Validators.required, Validators.min(0)]]
    });
  }

  ngOnInit(): void {
    // Verificación de seguridad adicional en el componente (doble capa de protección)
    if (!this.authService.isAuthenticated()) {
      this.notificationService.showError('⚠️ No tienes permisos de administrador. Debes iniciar sesión como administrador para acceder a esta sección.');
      this.router.navigate(['/login']);
      return;
    }
    
    if (!this.authService.isAdmin()) {
      this.notificationService.showError('🚫 No tienes permisos de administrador. Solo los usuarios con rol de administrador pueden acceder a esta sección.');
      this.router.navigate(['/']);
      return;
    }
    
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loadCategories();
    this.loadAllProducts();
    this.loadOrders();
    this.loadReservations();
    this.loadExtras();
    // Los mensajes se cargan solo cuando el usuario accede a la pestaña
    setInterval(() => {
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

  setActiveTab(tab: 'dashboard' | 'products' | 'orders' | 'categories' | 'settings' | 'inventory' | 'reservations' | 'extras' | 'messages'): void {
    this.activeTab = tab;
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
    }
    if (tab === 'messages') {
      this.loadContactMessages();
    }
  }

  openProductModal(product?: MenuItem): void {
    this.selectedProduct = product || null;
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

  closeProductModal(): void {
    this.showProductModal = false;
    this.selectedProduct = null;
    this.productForm.reset();
  }

  saveProduct(): void {
    if (this.productForm.valid) {
      const formValue = this.productForm.value;

      if (!formValue.categoryId) {
        this.notificationService.showError('Por favor, selecciona una categoría');
        return;
      }

      const productData = {
        name: formValue.name.trim(),
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

    return filtered;
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
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          if (dateB !== dateA) {
            return dateB - dateA;
          }
          return String(b.id).localeCompare(String(a.id));
        });
        this.calculateStats();
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
        });
      }
    });
  }

  private mapBackendOrderToFrontend(backendOrder: OrderFromBackend): Order {
    const orderId = backendOrder._id || backendOrder.id || '';
    let detailedOrder: Order | null = null;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('userOrders_')) {
          try {
            const storedOrders = JSON.parse(localStorage.getItem(key) || '[]');
            const found = storedOrders.find((o: Order) => {
              return o.id === orderId || 
                     o.id.includes(orderId.substring(0, 8)) ||
                     (o.trackingCode && orderId.includes(o.trackingCode));
            });
            if (found) {
              detailedOrder = found;
              break;
            }
          } catch {
            continue;
          }
        }
      }
    } catch {}
    let orderItems = detailedOrder?.items || [];
    if (orderItems.length === 0) {
      orderItems = backendOrder.products.map(productId => {
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

    const mappedStatus = this.mapBackendStatusToFrontend(backendOrder.status);
    const finalStatus = detailedOrder?.status === 'delivered' 
      ? 'delivered' 
      : mappedStatus;
    const orderTotal = backendOrder.total || detailedOrder?.total || 0;
    
    return {
      id: orderId,
      date: backendOrder.createdAt ? new Date(backendOrder.createdAt) : new Date(),
      items: orderItems,
      total: orderTotal,
      status: finalStatus,
      paymentMethod: backendOrder.payment_method,
      trackingCode: orderId.substring(0, 8).toUpperCase(),
      userName: backendOrder.user_name,
      deliveryAddress: detailedOrder?.deliveryAddress,
      deliveryNeighborhood: detailedOrder?.deliveryNeighborhood,
      deliveryPhone: detailedOrder?.deliveryPhone,
      orderType: detailedOrder?.orderType,
      subtotal: detailedOrder?.subtotal || orderTotal,
      additionalFees: detailedOrder?.additionalFees || 0,
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

  private mapFrontendStatusToBackend(frontendStatus: Order['status']): 'pendiente' | 'en_proceso' | 'completado' | 'entregado' | 'cancelado' {
    const statusMap: Record<Order['status'], 'pendiente' | 'en_proceso' | 'completado' | 'entregado' | 'cancelado'> = {
      'pending': 'pendiente',
      'preparing': 'en_proceso',
      'ready': 'completado',
      'delivered': 'completado',
      'cancelled': 'cancelado'
    };
    return statusMap[frontendStatus] || 'pendiente';
  }

  updateOrderStatus(order: Order, newStatus: Order['status']): void {
    const backendStatus = this.mapFrontendStatusToBackend(newStatus);
    let statusToSend = backendStatus;
    if (newStatus === 'delivered' && backendStatus === 'completado') {
      statusToSend = 'entregado';
    }
    this.orderService.update(order.id, { status: statusToSend }).subscribe({
      next: () => {
        order.status = newStatus;
        if (newStatus === 'delivered') {
          this.userService.saveOrder(order);
        }
        
        this.calculateStats();
        this.notificationService.showSuccess('Estado del pedido actualizado');
      },
      error: (error) => {
        if (newStatus === 'delivered' && statusToSend === 'entregado' && error.status === 400) {
          this.orderService.update(order.id, { status: 'completado' }).subscribe({
            next: () => {
              order.status = newStatus;
              this.userService.saveOrder(order);
              this.calculateStats();
              this.notificationService.showSuccess('Estado del pedido actualizado');
            },
            error: (retryError) => {
              let errorMessage = 'Error al actualizar el estado del pedido';
              if (retryError.error && retryError.error.message) {
                errorMessage = `Error: ${retryError.error.message}`;
              } else if (retryError.message) {
                errorMessage = `Error: ${retryError.message}`;
              }
              this.notificationService.showError(errorMessage);
            }
          });
        } else {
          let errorMessage = 'Error al actualizar el estado del pedido';
          if (error.error && error.error.message) {
            errorMessage = `Error: ${error.error.message}`;
          } else if (error.message) {
            errorMessage = `Error: ${error.message}`;
          }
          
          this.notificationService.showError(errorMessage);
        }
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

  handleUnavailableItem(action: 'cancel' | 'notify' | 'replace', reason?: string, replacementId?: number): void {
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
      case 'replace':
        if (replacementId) {
          updatedItems[itemIndex] = {
            ...item,
            unavailable: true,
            unavailableReason: reason || 'Producto reemplazado',
            replacedWith: replacementId
          };
        }
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
      error: () => {}
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

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
      const categoryData = {
        name: formValue.name.trim(),
        description: formValue.description.trim(),
        imageUrl: formValue.imageUrl?.trim() || undefined
      };

      if (this.selectedCategory) {
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
      const supplyData: CreateSupplyDto | UpdateSupplyDto = {
        name: formValue.name.trim(),
        description: formValue.description.trim(),
        unit_price: Number(formValue.unit_price),
        quantity: Number(formValue.quantity)
      };

      if (this.selectedSupply) {
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

  deleteSupply(id: string): void {
    if (confirm('¿Estás seguro de que quieres eliminar este insumo?')) {
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

  // Métodos para Reservas
  loadReservations(): void {
    this.reservationsService.findAll().subscribe({
      next: (reservations) => {
        this.reservations = reservations.map(r => this.reservationsService.mapBackendReservationToFrontend(r));
        this.reservations.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        this.calculateReservationStats();
      },
      error: (error) => {
        this.notificationService.showError('Error al cargar las reservas');
        console.error('Error loading reservations:', error);
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
        
        // Notificar al cliente
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
    // Recargar los extras para reflejar el cambio en la vista
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

  // Métodos para Mensajes de Contacto
  loadContactMessages(): void {
    this.contactService.findAll().subscribe({
      next: (messages) => {
        this.contactMessages = messages.map(m => this.contactService.mapBackendMessageToFrontend(m));
        this.contactMessages.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        this.calculateMessageStats();
      },
      error: (error) => {
        console.error('Error loading contact messages:', error);
        this.contactMessages = [];
        this.calculateMessageStats();
        this.notificationService.showError('Error al cargar los mensajes de contacto');
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
    
    // Marcar como leído si no lo está
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

  deleteMessage(message: ContactMessage): void {
    if (confirm('¿Estás seguro de que deseas eliminar este mensaje?')) {
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
}

