import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { MenuCategory } from '../models/MenuCategory';
import { MenuItem, ProductSupply } from '../models/MenuItem';
import { SupplyService } from './supply.service';
import { Supply } from '../models/Supply';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  private apiUrl = environment.apiUrl;
  private suppliesCache: Supply[] = [];
  private suppliesCacheTime: number = 0;
  private cacheTimeout = 30000;

  constructor(
    private http: HttpClient,
    private supplyService?: SupplyService
  ) {}

  getCategories(): Observable<MenuCategory[]> {
    return this.http.get<any>(`${this.apiUrl}/categories`).pipe(
      map(response => {
        const categories = response.categories || response || [];
        return categories
          .map((cat: any) => {
            if (!cat || typeof cat !== 'object') return null;
            const mapped: MenuCategory = {
              id: cat.id || cat._id || (cat.name ? String(cat.name).toLowerCase().replace(/\s+/g, '-') : ''),
              name: cat.name || '',
              description: cat.description || '',
              icon: cat.icon || '',
              imageUrl: cat.imageUrl || undefined
            };
            return mapped.id ? mapped : null;
          })
          .filter((cat: MenuCategory | null) => cat !== null) as MenuCategory[];
      }),
      catchError(() => of([]))
    );
  }

  getCategoryById(id: string | null): Observable<MenuCategory | undefined> {
    if (!id) return of(undefined);
    return this.http.get<any>(`${this.apiUrl}/categories/${id}`).pipe(
      map(response => {
        const category = response.category || response;
        if (!category || typeof category !== 'object') return undefined;
        const mappedCategory: MenuCategory = {
          id: category.id || category._id || '',
          name: category.name || '',
          description: category.description || '',
          icon: category.icon || '',
          imageUrl: category.imageUrl || undefined
        };
        return mappedCategory.id ? mappedCategory : undefined;
      }),
      catchError(() => of(undefined))
    );
  }

  getItemsByCategory(categoryId: string | null): Observable<MenuItem[]> {
    if (!categoryId) return of([]);
    return this.http.get<any>(`${this.apiUrl}/dishes/category/${categoryId}`).pipe(
      switchMap(response => {
        const dishes = response.dishes || response || [];
        if (!Array.isArray(dishes)) return of([]);
        const mappedItems = dishes
          .map((dish: any) => {
            try {
              return this.mapDishToMenuItem(dish);
            } catch {
              return null;
            }
          })
          .filter((item: MenuItem | null) => item !== null) as MenuItem[];
        return this.getSupplies().pipe(
          map(supplies => this.checkProductsAvailability(mappedItems, supplies))
        );
      }),
      catchError(() => of([]))
    );
  }

  getItemById(id: number | string): Observable<MenuItem | undefined> {
    const idString = typeof id === 'string' ? id : id.toString();
    return this.http.get<any>(`${this.apiUrl}/dishes/${idString}`).pipe(
      switchMap(response => {
        const dish = response.dish || response;
        const mappedItem = this.mapDishToMenuItem(dish);
        return this.getSupplies().pipe(
          map(supplies => this.checkProductAvailability(mappedItem, supplies))
        );
      }),
      catchError(() => of(undefined))
    );
  }

  getAllDishes(): Observable<MenuItem[]> {
    return this.http.get<any>(`${this.apiUrl}/dishes`).pipe(
      switchMap(response => {
        const dishes = response.dishes || response || [];
        if (!Array.isArray(dishes)) return of([]);
        const menuItems = dishes
          .map((dish: any) => {
            try {
              return this.mapDishToMenuItem(dish);
            } catch {
              return null;
            }
          })
          .filter((item: MenuItem | null) => item !== null) as MenuItem[];
        return this.getSupplies().pipe(
          map(supplies => this.checkProductsAvailability(menuItems, supplies))
        );
      }),
      catchError(() => of([]))
    );
  }

  getFeaturedItems(): Observable<MenuItem[]> {
    return this.http.get<any>(`${this.apiUrl}/dishes`).pipe(
      switchMap(response => {
        const dishes = response.dishes || response || [];
        if (!Array.isArray(dishes)) return of([]);
        const menuItems = dishes
          .map((dish: any) => {
            try {
              return this.mapDishToMenuItem(dish);
            } catch {
              return null;
            }
          })
          .filter((item: MenuItem | null) => item !== null) as MenuItem[];
        return this.getSupplies().pipe(
          map(supplies => {
            const checkedItems = this.checkProductsAvailability(menuItems, supplies);
            return checkedItems
              .filter((item: MenuItem) => {
                if (item.available === false) return false;
                const nameLower = item.name?.toLowerCase() || '';
                if (nameLower.includes('bbq') && nameLower.includes('doble')) return false;
                if (nameLower.includes('vegetariana') || nameLower.includes('veggie')) return false;
                return true;
              })
              .slice(0, 10);
          })
        );
      }),
      catchError(() => of([]))
    );
  }

  createDish(dishData: Partial<MenuItem>): Observable<MenuItem> {
    const backendData: any = {
      name: dishData.name,
      description: dishData.description,
      price: Number(dishData.price),
      categoryId: dishData.categoryId,
      available: dishData.available !== undefined ? dishData.available : true,
      image: (dishData.imageUrl && dishData.imageUrl.trim() !== '')
        ? dishData.imageUrl.trim()
        : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80',
      type: 'dish'
    };
    return this.http.post<any>(`${this.apiUrl}/dishes`, backendData).pipe(
      map(response => {
        const dish = response.dish || response;
        return this.mapDishToMenuItem(dish);
      })
    );
  }

  updateDish(dishId: number | string, dishData: Partial<MenuItem>): Observable<MenuItem> {
    const idString = typeof dishId === 'string' ? dishId : dishId.toString();
    const imageValue = (dishData.imageUrl && dishData.imageUrl.trim() !== '')
      ? dishData.imageUrl.trim()
      : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80';
    const backendData: any = {
      image: imageValue,
      type: 'dish'
    };
    if (dishData.name !== undefined) backendData.name = dishData.name;
    if (dishData.description !== undefined) backendData.description = dishData.description;
    if (dishData.price !== undefined) backendData.price = Number(dishData.price);
    if (dishData.categoryId !== undefined) backendData.categoryId = dishData.categoryId;
    if (dishData.available !== undefined) backendData.available = dishData.available;
    return this.http.patch<any>(`${this.apiUrl}/dishes/${idString}`, backendData).pipe(
      map(response => {
        const dish = response.dish || response;
        return this.mapDishToMenuItem(dish);
      })
    );
  }

  deleteDish(dishId: number | string): Observable<void> {
    const idString = typeof dishId === 'string' ? dishId : dishId.toString();
    return this.http.delete<void>(`${this.apiUrl}/dishes/${idString}`);
  }

  updateDishAvailability(dishId: number | string, available: boolean): Observable<MenuItem> {
    const idString = typeof dishId === 'string' ? dishId : dishId.toString();
    return this.http.patch<any>(`${this.apiUrl}/dishes/${idString}`, { available }).pipe(
      map(response => {
        const dish = response.dish || response;
        return this.mapDishToMenuItem(dish);
      })
    );
  }

  createCategory(categoryData: Partial<MenuCategory>): Observable<MenuCategory> {
    return this.http.post<any>(`${this.apiUrl}/categories`, categoryData).pipe(
      map(response => {
        const category = response.category || response;
        return this.mapCategoryToMenuCategory(category);
      })
    );
  }

  updateCategory(categoryId: string, categoryData: Partial<MenuCategory>): Observable<MenuCategory> {
    return this.http.patch<any>(`${this.apiUrl}/categories/${categoryId}`, categoryData).pipe(
      map(response => {
        const category = response.category || response;
        return this.mapCategoryToMenuCategory(category);
      })
    );
  }

  deleteCategory(categoryId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/categories/${categoryId}`);
  }

  private getSupplies(): Observable<Supply[]> {
    const now = Date.now();
    if (this.suppliesCache.length > 0 && (now - this.suppliesCacheTime) < this.cacheTimeout) {
      return of(this.suppliesCache);
    }
    if (!this.supplyService) return of([]);
    return this.supplyService.findAll().pipe(
      map(response => {
        this.suppliesCache = response.supplies || [];
        this.suppliesCacheTime = now;
        return this.suppliesCache;
      }),
      catchError(() => of([]))
    );
  }

  private checkProductAvailability(product: MenuItem, supplies: Supply[]): MenuItem {
    if (!product.supplies || product.supplies.length === 0) {
      return { ...product, stockStatus: 'available' };
    }
    const unavailableSupplies: string[] = [];
    let hasLowStock = false;
    for (const productSupply of product.supplies) {
      const supply = supplies.find(s => (s._id || s.id) === productSupply.supplyId);
      if (!supply) {
        unavailableSupplies.push(productSupply.supplyId);
        continue;
      }
      if (supply.quantity === 0) {
        unavailableSupplies.push(productSupply.supplyId);
      } else if (supply.quantity < productSupply.quantityRequired) {
        unavailableSupplies.push(productSupply.supplyId);
      } else if (supply.quantity < (productSupply.quantityRequired * 2)) {
        hasLowStock = true;
      }
    }
    let stockStatus: 'available' | 'low_stock' | 'out_of_stock' = 'available';
    let available = product.available;
    if (unavailableSupplies.length > 0) {
      stockStatus = 'out_of_stock';
      available = false;
    } else if (hasLowStock) {
      stockStatus = 'low_stock';
    }
    return {
      ...product,
      available,
      stockStatus,
      unavailableSupplies: unavailableSupplies.length > 0 ? unavailableSupplies : undefined
    };
  }

  private checkProductsAvailability(products: MenuItem[], supplies: Supply[]): MenuItem[] {
    return products.map(product => this.checkProductAvailability(product, supplies));
  }

  private mapDishToMenuItem(dish: any): MenuItem {
    if (!dish || typeof dish !== 'object') {
      throw new Error('Dish data is invalid');
    }
    const dishId = dish.id || dish._id;
    let supplies: ProductSupply[] | undefined;
    if (dish.supplies && Array.isArray(dish.supplies)) {
      supplies = dish.supplies.map((s: any) => ({
        supplyId: s.supplyId || s.supply_id || s._id || s.id,
        quantityRequired: s.quantityRequired || s.quantity_required || s.quantity || 1
      }));
    }
    let finalId: number | string;
    if (!dishId) {
      finalId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    } else if (typeof dishId === 'string' && dishId.length === 24 && /^[0-9a-fA-F]{24}$/.test(dishId)) {
      finalId = dishId;
    } else if (typeof dishId === 'string' && !isNaN(parseInt(dishId, 10)) && dishId.length < 10) {
      finalId = parseInt(dishId, 10);
    } else if (typeof dishId === 'number') {
      finalId = dishId;
    } else {
      finalId = String(dishId);
    }
    let categoryId = '';
    if (dish.categoryId) {
      categoryId = String(dish.categoryId);
    } else if (dish.category?.id) {
      categoryId = String(dish.category.id);
    } else if (dish.categoria?.id) {
      categoryId = String(dish.categoria.id);
    } else if (dish.categoriaId) {
      categoryId = String(dish.categoriaId);
    }
    let options: any[] = [];
    if (Array.isArray(dish.options)) {
      options = dish.options;
    } else if (Array.isArray(dish.opciones)) {
      options = dish.opciones;
    }
    const mappedOptions = options.map((opt: any, index: number) => ({
      id: opt.id || opt._id || `opt_${index}`,
      name: opt.name || opt.nombre || '',
      price: typeof opt.price === 'number' ? opt.price : (typeof opt.precio === 'number' ? opt.precio : 0),
      type: opt.type || opt.tipo || 'extra'
    }));
    return {
      id: finalId,
      name: dish.name || dish.nombre || '',
      description: dish.description || dish.descripcion || '',
      price: typeof dish.price === 'number' ? dish.price : (typeof dish.precio === 'number' ? dish.precio : 0),
      imageUrl: dish.image || dish.imageUrl || dish.imagen || '',
      available: dish.available !== undefined ? Boolean(dish.available) : (dish.disponible !== undefined ? Boolean(dish.disponible) : true),
      categoryId: categoryId,
      options: mappedOptions,
      supplies: supplies
    };
  }

  private mapCategoryToMenuCategory(category: any): MenuCategory {
    if (!category || typeof category !== 'object') {
      throw new Error('Category data is invalid');
    }
    return {
      id: category.id || category._id || '',
      name: category.name || '',
      description: category.description || '',
      icon: category.icon || '',
      imageUrl: category.imageUrl || undefined
    };
  }
}
