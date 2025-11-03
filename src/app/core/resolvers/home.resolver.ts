import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { MenuService, MenuCategory, MenuItem } from '../services/menu.service';

export interface HomeData {
  categories: MenuCategory[];
  featuredProducts: MenuItem[];
  loading: boolean;
  error: string | null;
}

/**
 * Resolver para precargar datos de la página de inicio
 * Asegura que los datos estén disponibles antes de mostrar el componente
 */
export const homeResolver: ResolveFn<HomeData> = (route, state): Observable<HomeData> => {
  const menuService = inject(MenuService);

  // Precargar categorías y productos destacados
  return forkJoin({
    categories: menuService.getCategories().pipe(
      catchError(error => {
        console.error('Error loading categories:', error);
        return of([]);
      })
    ),
    featuredItems: menuService.getFeaturedItems().pipe(
      catchError(error => {
        console.error('Error loading featured items:', error);
        return of([]);
      })
    )
  }).pipe(
    map(({ categories, featuredItems }) => ({
      categories: categories.slice(0, 6), // Limitar a 6 categorías
      featuredProducts: featuredItems,
      loading: false,
      error: null
    })),
    catchError(error => {
      console.error('Error in home resolver:', error);
      return of({
        categories: [],
        featuredProducts: [],
        loading: false,
        error: 'Error al cargar los datos. Por favor, intente nuevamente.'
      });
    })
  );
};

