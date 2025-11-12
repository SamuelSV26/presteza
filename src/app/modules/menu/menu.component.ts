import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MenuService } from '../../core/services/menu.service';
import { AuthService } from '../../core/services/auth.service';
import { MenuCategory } from '../../core/models/MenuCategory';
import { Observable, of, Subject } from 'rxjs';
import { catchError, map, takeUntil } from 'rxjs/operators';

const DEFAULT_CATEGORY_IMAGE = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80';
const GRADIENT_OVERLAY = 'linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.6))';

const CATEGORY_IMAGES: { [key: string]: string } = {
  'bebidas': 'https://images.unsplash.com/photo-1546171753-97d7676e4602?w=800&q=80',
  'desayunos': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80',
  'comida rapida': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80',
  'ensaladas': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
  'postres': 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80',
  'almuerzos': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
  'hamburguesas': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80',
  'entradas': 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&q=80',
  'acompanamientos': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800&q=80',
  'sopas': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80',
  'pescados': 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80',
  'carnes': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80',
  'comida vegetariana': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80',
  'comida internacional': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80',
  'comida tipica': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80'
};

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css'
})
export class MenuComponent implements OnInit, OnDestroy {
  categories$!: Observable<MenuCategory[]>;
  filteredCategories$!: Observable<MenuCategory[]>;
  loading = true;
  error: string | null = null;
  searchTerm = '';
  isAuthenticated = false;

  private destroy$ = new Subject<void>();

  constructor(
    private menuService: MenuService,
    private router: Router,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.initializeAuthentication();
    this.setupEventListeners();
    this.loadCategories();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    window.removeEventListener('productsUpdated', this.handleProductsUpdate);
    window.removeEventListener('categoriesUpdated', this.handleCategoriesUpdate);
  }

  onSearchChange(): void {
    if (!this.searchTerm.trim()) {
      this.filteredCategories$ = this.categories$;
      return;
    }

    const searchLower = this.searchTerm.toLowerCase().trim();
    this.filteredCategories$ = this.categories$.pipe(
      map(categories =>
        categories.filter(category =>
          category.name.toLowerCase().includes(searchLower) ||
          category.description?.toLowerCase().includes(searchLower)
        )
      )
    );
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.onSearchChange();
  }

  navigateToCategory(categoryId: string): void {
    if (!categoryId) return;
    this.router.navigate(['/menu', categoryId]);
  }

  getCategoryBackgroundImage(category: MenuCategory): string {
    if (category.imageUrl) {
      return `${GRADIENT_OVERLAY}, url("${category.imageUrl}")`;
    }

    const normalizedName = this.normalizeCategoryName(category.name);
    const imageUrl = CATEGORY_IMAGES[normalizedName] || DEFAULT_CATEGORY_IMAGE;

    return `${GRADIENT_OVERLAY}, url("${imageUrl}")`;
  }

  private initializeAuthentication(): void {
    this.isAuthenticated = this.authService.isAuthenticated();
    this.authService.userInfo$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.isAuthenticated = this.authService.isAuthenticated();
      });
  }

  private setupEventListeners(): void {
    window.addEventListener('productsUpdated', this.handleProductsUpdate);
    window.addEventListener('categoriesUpdated', this.handleCategoriesUpdate);
  }

  private handleProductsUpdate = (): void => {
    this.loadCategories();
  };

  private handleCategoriesUpdate = (): void => {
    this.loadCategories();
  };

  private loadCategories(): void {
    this.loading = true;
    this.error = null;

    this.categories$ = this.menuService.getCategories().pipe(
      catchError(error => {
        this.error = 'Error al cargar las categorías. Por favor, intenta nuevamente.';
        this.loading = false;
        return of([]);
      })
    );

    this.filteredCategories$ = this.categories$;

    this.categories$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (categories) => {
        this.loading = false;
        if (categories.length === 0) {
          this.error = 'No hay categorías disponibles.';
        }
      },
      error: () => {
        this.loading = false;
        this.error = 'Error al cargar las categorías.';
      }
    });
  }

  private normalizeCategoryName(name: string): string {
    if (!name) return '';
    return name
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, ' ');
  }
}
