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

  searchTerm: string = '';
  sortBy: 'name' | 'price-asc' | 'price-desc' = 'name';
  priceRange: { min: number | null; max: number | null } = { min: null, max: null };
  totalItems: number = 0;
  filteredCount: number = 0;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private menuService: MenuService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.isAuthenticated = this.authService.isAuthenticated();
    this.authService.userInfo$.subscribe(() => {
      this.isAuthenticated = this.authService.isAuthenticated();
    });
    window.addEventListener('productsUpdated', () => {
      if (this.currentCategoryId) {
        this.items$ = this.menuService.getItemsByCategory(this.currentCategoryId).pipe(
          tap(items => {
            this.loading = false;
            this.totalItems = items.length;
            if (items.length === 0) {
              this.error = 'No hay productos disponibles en esta categoría';
            } else {
              this.error = null;
            }
          }),
          catchError(() => {
            this.loading = false;
            this.error = 'Error al cargar los productos.';
            return of([]);
          })
        );
        this.applyFilters();
      }
    });

    const categoryId$ = this.route.paramMap.pipe(
      map(params => {
        const id = params.get('id');
        this.currentCategoryId = id;
        return id;
      }),
      tap(id => {
        if (!id) {
          this.error = 'Categoría no encontrada';
          this.loading = false;
        }
      })
    );
    this.category$ = categoryId$.pipe(
      switchMap(id => {
        if (!id) {
          return of(undefined);
        }
        return this.menuService.getCategoryById(id).pipe(
          catchError(() => {
            return of(undefined);
          })
        );
      })
    );
    this.items$ = categoryId$.pipe(
      switchMap(id => {
        if (!id) {
          this.loading = false;
          return of([]);
        }
        return this.menuService.getItemsByCategory(id).pipe(
          tap(items => {
            this.loading = false;
            this.totalItems = items.length;
            if (items.length === 0) {
              this.error = 'No hay productos disponibles en esta categoría';
            } else {
              this.error = null;
            }
          }),
          catchError(() => {
            this.loading = false;
            this.error = 'Error al cargar los productos.';
            return of([]);
          })
        );
      })
    );
    this.filteredItems$ = this.items$.pipe(
      map(items => this.filterItems(items))
    );
  }

  filterItems(items: MenuItem[]): MenuItem[] {
    let filtered = [...items];
    filtered = filtered.filter(item => item.available);
    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const searchLower = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchLower) ||
        (item.description && item.description.toLowerCase().includes(searchLower))
      );
    }
    if (this.priceRange.min !== null) {
      filtered = filtered.filter(item => item.price >= this.priceRange.min!);
    }
    if (this.priceRange.max !== null) {
      filtered = filtered.filter(item => item.price <= this.priceRange.max!);
    }
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
      return;
    }
    if (this.currentCategoryId) {
      this.router.navigate(['/menu/producto', product.id], {
        queryParams: { categoryId: this.currentCategoryId }
      });
    } else {
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
      window.dispatchEvent(new CustomEvent('showLoginModal'));
    }
  }
}
