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

    // Cargar pedidos
    this.userService.getOrders().subscribe(orders => {
      this.orders = orders;
      this.calculateStats();
    });
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

