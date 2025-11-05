import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MenuService, MenuItem, MenuCategory } from '../../core/services/menu.service';
import { UserService, Order } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';

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
  
  // Pedidos
  orders: Order[] = [];
  selectedOrder: Order | null = null;
  
  // Filtros
  orderFilter: 'all' | 'pending' | 'preparing' | 'ready' | 'delivered' = 'all';
  searchTerm = '';
  categoryFilter = '';
  productViewMode: 'grid' | 'list' = 'list';

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
  }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    // Cargar categorías
    this.menuService.getCategories().subscribe(categories => {
      this.categories = categories;
    });

    // Cargar todos los productos
    this.loadAllProducts();

    // Cargar pedidos
    this.userService.getOrders().subscribe(orders => {
      this.orders = orders;
      this.calculateStats();
    });
  }

  loadAllProducts(): void {
    this.menuService.getCategories().subscribe(categories => {
      this.products = [];
      categories.forEach(category => {
        this.menuService.getItemsByCategory(category.id).subscribe(items => {
          this.products = [...this.products, ...items];
          this.stats.totalProducts = this.products.length;
        });
      });
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
      console.log('Guardar producto:', this.productForm.value);
      this.notificationService.showSuccess('Producto guardado correctamente');
      this.closeProductModal();
      this.loadAllProducts();
    }
  }

  async deleteProduct(productId: number): Promise<void> {
    const confirmed = await this.notificationService.confirm(
      'Eliminar Producto',
      '¿Estás seguro de que deseas eliminar este producto?'
    );
    
    if (confirmed) {
      console.log('Eliminar producto:', productId);
      this.notificationService.showSuccess('Producto eliminado correctamente');
      this.loadAllProducts();
    }
  }

  toggleProductAvailability(product: MenuItem): void {
    product.available = !product.available;
    console.log('Cambiar disponibilidad:', product);
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

  updateOrderStatus(order: Order, newStatus: Order['status']): void {
    order.status = newStatus;
    console.log('Actualizar estado del pedido:', order.id, newStatus);
    this.calculateStats();
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

  logout(): void {
    // Usar el método logout del AuthService que limpia todo correctamente
    this.authService.logout();
  }
}

