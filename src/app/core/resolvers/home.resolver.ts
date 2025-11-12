import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { MenuCategory } from '../models/MenuCategory';
import { MenuItem } from '../models/MenuItem';
import { MenuService } from '../services/menu.service';


export interface HomeData {
  categories: MenuCategory[];
  featuredProducts: MenuItem[];
  loading: boolean;
  error: string | null;
}

export const homeResolver: ResolveFn<HomeData> = (route, state): Observable<HomeData> => {
  const menuService = inject(MenuService);
  return forkJoin({
    categories: menuService.getCategories().pipe(
      catchError(() => {
        return of([]);
      })
    ),
    featuredItems: menuService.getFeaturedItems().pipe(
      catchError(() => {
        return of([]);
      })
    )
  }).pipe(
    map(({ categories, featuredItems }) => {
      const categoriesWithIcon = categories.filter((cat: any) => cat.icon && cat.icon.trim() !== '');
      const categoriesToShow = categoriesWithIcon.length > 0 ? categoriesWithIcon : categories;
      return {
        categories: categoriesToShow.slice(0, 5),
        featuredProducts: featuredItems,
        loading: false,
        error: null
      };
    }),
    catchError(() => {
      return of({
        categories: [],
        featuredProducts: [],
        loading: false,
        error: 'Error al cargar los datos. Por favor, intente nuevamente.'
      });
    })
  );
};

