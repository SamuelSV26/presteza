import { Component, OnInit } from '@angular/core';
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

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  activeTab: 'dashboard' | 'products' | 'orders' | 'categories' | 'settings' = 'dashboard';

  // Estadísticas
  stats = {
    totalOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    totalProducts: 0,
    totalCustomers: 0
  };

  // Productos
  products: MenuItem[] = [];
  categories: MenuCategory[] = [];
  selectedProduct: MenuItem | null = null;
  showProductModal = false;
  productForm: FormGroup;

  // Categorías
  selectedCategory: MenuCategory | null = null;
  showCategoryModal = false;
  categoryForm: FormGroup;

  // Pedidos
  orders: Order[] = [];
  selectedOrder: Order | null = null;
  showOrderDetailsModal = false;
  showUnavailableModal = false;
  selectedItemForUnavailable: { order: Order; item: any; itemIndex: number } | null = null;

  // Filtros
  orderFilter: 'all' | 'pending' | 'preparing' | 'ready' | 'delivered' = 'all';
  searchTerm = '';
  categoryFilter = '';
  productViewMode: 'grid' | 'list' = 'list';
  orderViewMode: 'list' | 'grid' = 'list';

  // Configuración
  settingsForm!: FormGroup;

  // Contadores de pedidos por estado
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
    private userService: UserService,
    private orderService: OrderService,
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder,
    private notificationService: NotificationService
  ) {
    this.productForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      price: [0, [Validators.required, Validators.min(1)]],
      categoryId: ['', Validators.required],
      imageUrl: [''], // Campo opcional - sin Validators.required
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
      description: ['', [Validators.required, Validators.minLength(5)]]
    });
  }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    // Cargar categorías
    this.loadCategories();

    // Cargar todos los productos
    this.loadAllProducts();

    // Cargar pedidos desde el backend
    this.loadOrders();
    
    // Recargar pedidos cada 10 segundos para ver nuevos pedidos
    setInterval(() => {
      if (this.activeTab === 'orders' || this.activeTab === 'dashboard') {
        this.loadOrders();
      }
    }, 10000);
  }

  loadCategories(): void {
    this.menuService.getCategories().subscribe(categories => {
      this.categories = categories;
    });
  }

  loadAllProducts(): void {
    console.log('🔍 Cargando todos los productos desde el backend...');

    // Usar getAllDishes() que obtiene todos los productos de una sola vez
    this.menuService.getAllDishes().subscribe({
      next: (products) => {
        console.log(`✅ Productos cargados: ${products.length} productos`);

        // Agregar logs detallados para debug
        products.forEach((product, index) => {
          console.log(`  ${index + 1}. ${product.name} (ID: ${product.id}, Categoría: ${product.categoryId})`);
        });

        this.products = products;
        this.stats.totalProducts = products.length;

        console.log(`📊 Total de productos en el sistema: ${this.stats.totalProducts}`);
      },
      error: (error) => {
        console.error('❌ Error al cargar productos:', error);
        this.products = [];
        this.stats.totalProducts = 0;
      }
    });
  }

  calculateStats(): void {
    this.stats.totalOrders = this.orders.length;
    this.stats.pendingOrders = this.orders.filter(o => o.status === 'pending' || o.status === 'preparing').length;
    this.stats.totalRevenue = this.orders
      .filter(o => o.status === 'delivered')
      .reduce((sum, order) => sum + order.total, 0);
    this.stats.totalCustomers = new Set(this.orders.map(o => o.id)).size;
  }

  setActiveTab(tab: 'dashboard' | 'products' | 'orders' | 'categories' | 'settings'): void {
    this.activeTab = tab;
    // Recargar pedidos cuando se cambia a la pestaña de pedidos
    if (tab === 'orders') {
      this.loadOrders();
    }
  }

  // Gestión de Productos
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

      // Validar que categoryId esté seleccionado
      if (!formValue.categoryId) {
        this.notificationService.showError('Por favor, selecciona una categoría');
        return;
      }

      const productData = {
        name: formValue.name.trim(),
        description: formValue.description.trim(),
        price: Number(formValue.price), // Asegurar que sea un número
        categoryId: formValue.categoryId,
        imageUrl: (formValue.imageUrl && formValue.imageUrl.trim()) || '', // Enviar string vacío si no hay imagen
        available: formValue.available !== false
      };

      if (this.selectedProduct) {
        // Actualizar producto existente
        console.log('📤 Datos del producto a actualizar:', productData);
        console.log('📤 ID del producto:', this.selectedProduct.id);
        this.menuService.updateDish(this.selectedProduct.id, productData).subscribe({
          next: (updatedProduct) => {
            console.log('✅ Producto actualizado:', updatedProduct);
            this.notificationService.showSuccess('Producto actualizado correctamente');
            this.closeProductModal();
            this.loadAllProducts();
            // Disparar evento para que los componentes del cliente recarguen datos
            window.dispatchEvent(new CustomEvent('productsUpdated'));
          },
          error: (error) => {
            console.error('❌ Error al actualizar producto:', error);
            console.error('❌ Detalles del error:', {
              status: error.status,
              statusText: error.statusText,
              message: error.message,
              error: error.error
            });

            // Mostrar mensaje de error más detallado
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
        // Crear nuevo producto
        console.log('📤 Datos del producto a enviar:', productData);
        this.menuService.createDish(productData).subscribe({
          next: (newProduct) => {
            console.log('✅ Producto creado:', newProduct);
            this.notificationService.showSuccess('Producto creado correctamente');
            this.closeProductModal();
            this.loadAllProducts();
            // Disparar evento para que los componentes del cliente recarguen datos
            window.dispatchEvent(new CustomEvent('productsUpdated'));
          },
          error: (error) => {
            console.error('❌ Error al crear producto:', error);
            console.error('❌ Detalles del error:', {
              status: error.status,
              statusText: error.statusText,
              message: error.message,
              error: error.error
            });

            // Mostrar mensaje de error más detallado
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
          console.log('✅ Producto eliminado:', productId);
          this.notificationService.showSuccess('Producto eliminado correctamente');
          this.loadAllProducts();
          // Disparar evento para que los componentes del cliente recarguen datos
          window.dispatchEvent(new CustomEvent('productsUpdated'));
        },
        error: (error) => {
          console.error('❌ Error al eliminar producto:', error);
          this.notificationService.showError('Error al eliminar el producto. Por favor, intenta nuevamente.');
        }
      });
    }
  }

  toggleProductAvailability(product: MenuItem): void {
    const newAvailability = !product.available;
    this.menuService.updateDishAvailability(product.id, newAvailability).subscribe({
      next: (updatedProduct) => {
        console.log('✅ Disponibilidad actualizada:', updatedProduct);
        product.available = updatedProduct.available;
        this.notificationService.showSuccess(
          `Producto ${updatedProduct.available ? 'activado' : 'desactivado'} correctamente`
        );
        this.loadAllProducts();
        // Disparar evento para que los componentes del cliente recarguen datos
        window.dispatchEvent(new CustomEvent('productsUpdated'));
      },
      error: (error) => {
        console.error('❌ Error al actualizar disponibilidad:', error);
        // Revertir el cambio visual si falla
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

  // Gestión de Pedidos
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
        console.log('✅ Pedidos cargados desde el backend:', response);
        // Mapear pedidos del backend al formato del frontend
        this.orders = response.orders.map(backendOrder => this.mapBackendOrderToFrontend(backendOrder));
        
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
        
        this.calculateStats();
      },
      error: (error) => {
        console.error('❌ Error al cargar pedidos:', error);
        this.notificationService.showError('Error al cargar los pedidos');
        // Fallback: cargar desde localStorage
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
          this.calculateStats();
        });
      }
    });
  }

  private mapBackendOrderToFrontend(backendOrder: OrderFromBackend): Order {
    const orderId = backendOrder._id || backendOrder.id || '';
    
    // Buscar detalles completos en localStorage de todos los usuarios
    let detailedOrder: Order | null = null;
    try {
      // Buscar en todas las claves de localStorage que contengan "userOrders_"
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('userOrders_')) {
          try {
            const storedOrders = JSON.parse(localStorage.getItem(key) || '[]');
            const found = storedOrders.find((o: Order) => {
              // Buscar por ID completo o por coincidencia parcial
              return o.id === orderId || 
                     o.id.includes(orderId.substring(0, 8)) ||
                     (o.trackingCode && orderId.includes(o.trackingCode));
            });
            if (found) {
              detailedOrder = found;
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }
    } catch (e) {
      console.warn('No se pudieron obtener detalles del pedido desde localStorage:', e);
    }

    // Si encontramos el pedido detallado, usar sus items
    let orderItems = detailedOrder?.items || [];
    
    // Si no hay items detallados, construir desde los IDs del backend
    if (orderItems.length === 0) {
      orderItems = backendOrder.products.map(productId => {
        const product = this.products.find(p => String(p.id) === String(productId));
        // Asegurar que id sea siempre un número
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

    return {
      id: orderId,
      date: backendOrder.createdAt ? new Date(backendOrder.createdAt) : new Date(),
      items: orderItems,
      total: backendOrder.total,
      status: this.mapBackendStatusToFrontend(backendOrder.status),
      paymentMethod: backendOrder.payment_method,
      trackingCode: orderId.substring(0, 8).toUpperCase(),
      // Información del backend
      userName: backendOrder.user_name,
      // Información adicional del backend o localStorage
      deliveryAddress: detailedOrder?.deliveryAddress,
      deliveryNeighborhood: detailedOrder?.deliveryNeighborhood,
      deliveryPhone: detailedOrder?.deliveryPhone,
      orderType: detailedOrder?.orderType,
      subtotal: detailedOrder?.subtotal,
      additionalFees: detailedOrder?.additionalFees,
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
      'delivered': 'completado', // Usar 'completado' si el backend no acepta 'entregado'
      'cancelled': 'cancelado'
    };
    return statusMap[frontendStatus] || 'pendiente';
  }

  updateOrderStatus(order: Order, newStatus: Order['status']): void {
    const backendStatus = this.mapFrontendStatusToBackend(newStatus);
    
    console.log('🔄 Actualizando estado:', { 
      orderId: order.id, 
      frontendStatus: newStatus, 
      backendStatus: backendStatus 
    });
    
    // Si el estado es "delivered", intentar primero con "entregado", si falla usar "completado"
    let statusToSend = backendStatus;
    if (newStatus === 'delivered' && backendStatus === 'completado') {
      // Intentar primero con "entregado" si el backend lo acepta
      statusToSend = 'entregado';
    }
    
    // Actualizar en el backend
    this.orderService.update(order.id, { status: statusToSend }).subscribe({
      next: (response) => {
        console.log('✅ Estado actualizado:', response);
        order.status = newStatus;
        
        // Si el estado es "delivered", guardar en localStorage para mantener la distinción
        if (newStatus === 'delivered') {
          this.userService.saveOrder(order);
        }
        
        this.calculateStats();
        this.notificationService.showSuccess('Estado del pedido actualizado');
      },
      error: (error) => {
        console.error('❌ Error al actualizar estado:', error);
        console.error('❌ Detalles del error:', {
          status: error.status,
          message: error.message,
          error: error.error
        });
        
        // Si falló con "entregado" y el estado es "delivered", intentar con "completado"
        if (newStatus === 'delivered' && statusToSend === 'entregado' && error.status === 400) {
          console.log('🔄 Reintentando con "completado" en lugar de "entregado"');
          this.orderService.update(order.id, { status: 'completado' }).subscribe({
            next: (response) => {
              console.log('✅ Estado actualizado con "completado":', response);
              order.status = newStatus; // Mantener "delivered" en el frontend
              this.userService.saveOrder(order); // Guardar para mantener la distinción
              this.calculateStats();
              this.notificationService.showSuccess('Estado del pedido actualizado');
            },
            error: (retryError) => {
              console.error('❌ Error al actualizar estado (reintento):', retryError);
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
          // Mostrar mensaje de error más detallado
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
        // Marcar el item como no disponible y cancelarlo
        updatedItems[itemIndex] = {
          ...item,
          unavailable: true,
          unavailableReason: reason || 'Producto no disponible',
          quantity: 0 // Reducir cantidad a 0 efectivamente lo cancela
        };
        // Recalcular total
        const newTotal = updatedItems.reduce((sum, it) => {
          const itemTotal = it.price * it.quantity;
          const optionsTotal = (it.selectedOptions || []).reduce((optSum, opt) => optSum + (opt.price * it.quantity), 0);
          return sum + itemTotal + optionsTotal;
        }, 0);
        this.orders[orderIndex].total = newTotal;
        break;
      
      case 'notify':
        // Marcar como no disponible pero mantener en el pedido (para notificar al cliente)
        updatedItems[itemIndex] = {
          ...item,
          unavailable: true,
          unavailableReason: reason || 'Producto no disponible temporalmente'
        };
        break;
      
      case 'replace':
        // Reemplazar con otro producto
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

    // Actualizar el pedido
    this.orders[orderIndex] = {
      ...currentOrder,
      items: updatedItems
    };

    // Guardar en localStorage también
    this.userService.saveOrder(this.orders[orderIndex]);

    // Actualizar en el backend (opcional, dependiendo de tu estructura)
    this.orderService.update(order.id, {
      // Aquí podrías enviar información sobre items no disponibles si el backend lo soporta
    }).subscribe({
      next: () => {
        this.notificationService.showSuccess('Item actualizado correctamente');
        this.calculateStats();
      },
      error: (error) => {
        console.error('Error al actualizar pedido:', error);
        // No mostrar error si el backend no soporta esta funcionalidad aún
      }
    });

    this.closeUnavailableModal();
  }

  printOrder(order: Order): void {
    // Crear una nueva ventana para imprimir
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
      console.log('Guardar configuración:', this.settingsForm.value);
      this.notificationService.showSuccess('Configuración guardada correctamente');
      // Aquí iría la lógica para guardar en el backend
    }
  }

  // Gestión de Categorías
  openCategoryModal(category?: MenuCategory): void {
    this.selectedCategory = category || null;
    if (category) {
      this.categoryForm.patchValue({
        name: category.name,
        description: category.description
      });
    } else {
      this.categoryForm.reset();
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
        description: formValue.description.trim()
      };

      if (this.selectedCategory) {
        // Actualizar categoría existente
        console.log('📤 Actualizando categoría:', categoryData);
        this.menuService.updateCategory(this.selectedCategory.id, categoryData).subscribe({
          next: (updatedCategory) => {
            console.log('✅ Categoría actualizada:', updatedCategory);
            this.notificationService.showSuccess('Categoría actualizada correctamente');
            this.closeCategoryModal();
            this.loadCategories();
            // Disparar evento para que los componentes recarguen datos
            window.dispatchEvent(new CustomEvent('categoriesUpdated'));
          },
          error: (error) => {
            console.error('❌ Error al actualizar categoría:', error);
            let errorMessage = 'Error al actualizar la categoría. Por favor, intenta nuevamente.';
            if (error.error && error.error.message) {
              errorMessage = `Error: ${error.error.message}`;
            }
            this.notificationService.showError(errorMessage);
          }
        });
      } else {
        // Crear nueva categoría
        console.log('📤 Creando categoría:', categoryData);
        this.menuService.createCategory(categoryData).subscribe({
          next: (newCategory) => {
            console.log('✅ Categoría creada:', newCategory);
            this.notificationService.showSuccess('Categoría creada correctamente');
            this.closeCategoryModal();
            this.loadCategories();
            // Disparar evento para que los componentes recarguen datos
            window.dispatchEvent(new CustomEvent('categoriesUpdated'));
          },
          error: (error) => {
            console.error('❌ Error al crear categoría:', error);
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
          // Disparar evento para que los componentes recarguen datos
          window.dispatchEvent(new CustomEvent('categoriesUpdated'));
        },
        error: (error) => {
          console.error('❌ Error al eliminar categoría:', error);
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
    // Usar el método logout del AuthService que limpia todo correctamente
    this.authService.logout();
  }
}

