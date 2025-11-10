import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MenuService} from '../../core/services/menu.service';
import { AuthService } from '../../core/services/auth.service';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { MenuCategory } from '../../core/models/MenuCategory';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css'
})
export class MenuComponent implements OnInit {
  categories$!: Observable<MenuCategory[]>;
  filteredCategories$!: Observable<MenuCategory[]>;
  loading = true;
  error: string | null = null;
  searchTerm: string = '';
  isAuthenticated: boolean = false;

  constructor(
    private menuService: MenuService,
    public router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Verificar autenticación (pero no redirigir, permitir ver el menú sin autenticación)
    this.isAuthenticated = this.authService.isAuthenticated();
    
    // Escuchar cambios en el estado de autenticación
    this.authService.userInfo$.subscribe((userInfo) => {
      this.isAuthenticated = this.authService.isAuthenticated();
    });

    // Escuchar eventos de actualización de productos desde el admin
    window.addEventListener('productsUpdated', () => {
      console.log('🔄 Productos actualizados, recargando categorías...');
      this.loadCategories();
    });

    // Escuchar eventos de actualización de categorías desde el admin
    window.addEventListener('categoriesUpdated', () => {
      console.log('🔄 Categorías actualizadas, recargando...');
      this.loadCategories();
    });

    this.loadCategories();
  }

  private loadCategories(): void {
    this.categories$ = this.menuService.getCategories().pipe(
      catchError(error => {
        console.error('Error al cargar categorías:', error);
        this.error = 'Error al cargar las categorías. Por favor, intenta nuevamente.';
        this.loading = false;
        return of([]);
      })
    );
    
    // Inicializar categorías filtradas con todas las categorías
    this.filteredCategories$ = this.categories$;
    
    // Ocultar loading cuando se carguen las categorías
    this.categories$.subscribe({
      next: (categories) => {
        this.loading = false;
        console.log('Categorías cargadas en el componente:', categories);
        // Verificar que todas las categorías tengan ID
        categories.forEach((cat, index) => {
          console.log(`Categoría ${index}:`, cat);
          if (!cat.id) {
            console.error(`❌ Categoría sin ID en índice ${index}:`, cat);
          }
        });
        if (categories.length === 0) {
          this.error = 'No hay categorías disponibles.';
        }
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Error al cargar las categorías.';
        console.error('Error en el componente:', error);
      }
    });
  }

  onSearchChange(): void {
    if (!this.searchTerm || this.searchTerm.trim() === '') {
      // Si no hay término de búsqueda, mostrar todas las categorías
      this.filteredCategories$ = this.categories$;
    } else {
      // Filtrar categorías por nombre o descripción
      const searchLower = this.searchTerm.toLowerCase().trim();
      this.filteredCategories$ = this.categories$.pipe(
        map(categories => 
          categories.filter(category => 
            category.name.toLowerCase().includes(searchLower) ||
            (category.description && category.description.toLowerCase().includes(searchLower))
          )
        )
      );
    }
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.onSearchChange();
  }

  navigateToCategory(categoryId: string): void {
    console.log('🖱️ Navegando a categoría:', categoryId);
    console.log('📝 Tipo del categoryId:', typeof categoryId);
    
    if (!categoryId) {
      console.error('❌ Error: categoryId es undefined o null');
      return;
    }
    
    this.router.navigate(['/menu', categoryId]).then(
      (success) => {
        if (success) {
          console.log('✅ Navegación exitosa a:', `/menu/${categoryId}`);
        } else {
          console.error('❌ Error en la navegación');
        }
      }
    );
  }
}
