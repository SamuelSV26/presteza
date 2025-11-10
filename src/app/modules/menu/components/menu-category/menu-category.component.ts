import { MenuItemComponent } from '../menu-item/menu-item.component';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, of, combineLatest } from 'rxjs';
import { map, switchMap, catchError, tap } from 'rxjs/operators';
import { MenuCategory } from '../../../../core/models/MenuCategory';
import { MenuItem } from '../../../../core/models/MenuItem';
import { MenuService } from '../../../../core/services/menu.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-menu-category',
  standalone: true,
  imports: [CommonModule, MenuItemComponent, FormsModule],
  templateUrl: './menu-category.component.html',
  styleUrl: './menu-category.component.css'
})
export class MenuCategoryComponent implements OnInit {
  category$!: Observable<MenuCategory | undefined>;
  items$!: Observable<MenuItem[]>;
  filteredItems$!: Observable<MenuItem[]>;
  loading = true;
  error: string | null = null;
  currentCategoryId: string | null = null;
  isAuthenticated: boolean = false;

  // Filtros y búsqueda
  searchTerm: string = '';
  sortBy: 'name' | 'price-asc' | 'price-desc' = 'name';
  priceRange: { min: number | null; max: number | null } = { min: null, max: null };

  // Estadísticas
  totalItems: number = 0;
  filteredCount: number = 0;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private menuService: MenuService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    // Verificar autenticación (pero no redirigir, permitir ver el menú sin autenticación)
    this.isAuthenticated = this.authService.isAuthenticated();

    // Escuchar cambios en el estado de autenticación
    this.authService.userInfo$.subscribe(() => {
      this.isAuthenticated = this.authService.isAuthenticated();
    });

    // Escuchar eventos de actualización de productos desde el admin
    window.addEventListener('productsUpdated', () => {
      console.log('🔄 Productos actualizados, recargando productos de la categoría...');
      // Recargar productos de la categoría actual
      if (this.currentCategoryId) {
        this.items$ = this.menuService.getItemsByCategory(this.currentCategoryId).pipe(
          tap(items => {
            console.log('📦 Productos recargados:', items.length, 'productos');
            this.loading = false;
            this.totalItems = items.length;
            if (items.length === 0) {
              this.error = 'No hay productos disponibles en esta categoría';
            } else {
              this.error = null;
            }
          }),
          catchError(error => {
            console.error('❌ Error al recargar productos:', error);
            this.loading = false;
            this.error = 'Error al cargar los productos.';
            return of([]);
          })
        );
        // Aplicar filtros nuevamente
        this.applyFilters();
      }
    });

    const categoryId$ = this.route.paramMap.pipe(
      map(params => {
        const id = params.get('id');
        console.log('📍 ID de categoría obtenido de la ruta:', id);
        console.log('📍 Tipo del ID:', typeof id);
        // Guardar el ID de la categoría actual
        this.currentCategoryId = id;
        return id;
      }),
      tap(id => {
        if (!id) {
          console.error('❌ No se encontró ID de categoría en la ruta');
          this.error = 'Categoría no encontrada';
          this.loading = false;
        } else {
          console.log('✅ ID válido encontrado, procediendo a cargar datos...');
        }
      })
    );

    // Obtener la categoría
    this.category$ = categoryId$.pipe(
      switchMap(id => {
        if (!id) {
          return of(undefined);
        }
        console.log('🔍 Llamando a getCategoryById con:', id);
        return this.menuService.getCategoryById(id).pipe(
          tap(category => {
            console.log('📋 Categoría obtenida:', category);
            if (!category) {
              console.warn('⚠️ Categoría no encontrada en el backend');
            }
          }),
          catchError(error => {
            console.error('❌ Error al obtener categoría:', error);
            return of(undefined);
          })
        );
      })
    );

    // Obtener los productos de la categoría
    this.items$ = categoryId$.pipe(
      switchMap(id => {
        if (!id) {
          console.warn('⚠️ No hay ID, retornando array vacío');
          this.loading = false;
          return of([]);
        }
        console.log('🔍 Llamando a getItemsByCategory con:', id);
        return this.menuService.getItemsByCategory(id).pipe(
          tap(items => {
            console.log('📦 Productos obtenidos:', items.length, 'productos');
            console.log('📦 Lista de productos:', items);
            this.loading = false;
            this.totalItems = items.length;
            if (items.length === 0) {
              console.warn('⚠️ No se encontraron productos para esta categoría');
              this.error = 'No hay productos disponibles en esta categoría';
            } else {
              this.error = null;
            }
          }),
          catchError(error => {
            console.error('❌ Error al obtener productos:', error);
            console.error('❌ Error completo:', JSON.stringify(error, null, 2));
            this.loading = false;
            this.error = 'Error al cargar los productos. Verifica la consola para más detalles.';
            return of([]);
          })
        );
      })
    );

    // Inicializar productos filtrados con todas las categorías
    this.filteredItems$ = this.items$.pipe(
      map(items => this.filterItems(items))
    );
  }

  filterItems(items: MenuItem[]): MenuItem[] {
    let filtered = [...items];

    // Filtrar productos no disponibles - siempre mostrar solo productos disponibles
    filtered = filtered.filter(item => item.available);

    // Filtrar por búsqueda
    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const searchLower = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchLower) ||
        (item.description && item.description.toLowerCase().includes(searchLower))
      );
    }

    // Filtrar por rango de precio
    if (this.priceRange.min !== null) {
      filtered = filtered.filter(item => item.price >= this.priceRange.min!);
    }
    if (this.priceRange.max !== null) {
      filtered = filtered.filter(item => item.price <= this.priceRange.max!);
    }

    // Ordenar
    filtered.sort((a, b) => {
      switch (this.sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price-asc':
          return a.price - b.price;
        case 'price-desc':
          return b.price - a.price;
        default:
          return 0;
      }
    });

    this.filteredCount = filtered.length;
    return filtered;
  }

  applyFilters(): void {
    this.filteredItems$ = this.items$.pipe(
      map(items => this.filterItems(items))
    );
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onSortChange(): void {
    this.applyFilters();
  }

  onPriceRangeChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.sortBy = 'name';
    this.priceRange = { min: null, max: null };
    this.applyFilters();
  }

  getMaxPrice(): Observable<number> {
    return this.items$.pipe(
      map(items => {
        if (items.length === 0) return 0;
        return Math.max(...items.map(i => i.price));
      })
    );
  }

  goBack(): void {
    this.router.navigate(['/menu']);
  }

  openProductDetail(product: MenuItem): void {
    if (!product || !product.id) {
      console.error('❌ Intento de abrir detalle de producto inválido:', product);
      return;
    }
    console.log('🖱️ Abriendo detalle del producto:', product.id);
    // Navegar al detalle del producto pasando el categoryId como query param
    if (this.currentCategoryId) {
      this.router.navigate(['/menu/producto', product.id], {
        queryParams: { categoryId: this.currentCategoryId }
      });
    } else {
      // Si no hay categoryId en la ruta, usar el del producto
      const categoryId = product.categoryId || this.currentCategoryId;
      if (categoryId) {
        this.router.navigate(['/menu/producto', product.id], {
          queryParams: { categoryId: categoryId }
        });
      } else {
        this.router.navigate(['/menu/producto', product.id]);
      }
    }
  }

  onFavoriteClick(event: { dishId: number | string; action: 'add' | 'remove' | 'login' }): void {
    if (event.action === 'login') {
      // Disparar evento global para mostrar el modal de login en el navbar
      window.dispatchEvent(new CustomEvent('showLoginModal'));
    }
  }
}
