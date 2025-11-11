import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { catchError, map, tap, switchMap } from 'rxjs/operators';
import { MenuCategory } from '../models/MenuCategory';
import { MenuItem, ProductSupply } from '../models/MenuItem';
import { SupplyService } from './supply.service';
import { Supply } from '../models/Supply';





@Injectable({
  providedIn: 'root'
})
export class MenuService {
  private apiUrl = 'http://localhost:4000';
  private suppliesCache: Supply[] = [];
  private suppliesCacheTime: number = 0;
  private cacheTimeout = 30000; // 30 segundos

  constructor(
    private http: HttpClient,
    private supplyService?: SupplyService
  ) { }

  // NOTA: Los datos locales están comentados - TODO debe venir de la base de datos
  // Estos arrays solo se mantienen como referencia pero NO se usan como fallback
  /*
  private categories: MenuCategory[] = [
    {
      id: 'almuerzos',
      name: 'Almuerzos del Día',
      description: 'Platos principales y almuerzos completos',
      icon: 'bi-egg-fried'
    },
    {
      id: 'hamburguesas',
      name: 'Hamburguesas',
      description: 'Hamburguesas artesanales con ingredientes frescos',
      icon: 'bi-layers'
    },
    {
      id: 'entradas',
      name: 'Entradas',
      description: 'Aperitivos y entradas deliciosas',
      icon: 'bi-cup-hot'
    },
    {
      id: 'acompanamientos',
      name: 'Acompañamientos',
      description: 'Perfectos complementos para tu comida',
      icon: 'bi-basket'
    },
    {
      id: 'bebidas',
      name: 'Bebidas',
      description: 'Bebidas refrescantes y naturales',
      icon: 'bi-cup-straw'
    },
    {
      id: 'postres',
      name: 'Postres',
      description: 'Deliciosos postres y dulces para terminar tu comida',
      icon: 'bi-cake'
    },
    {
      id: 'desayunos',
      name: 'Desayunos',
      description: 'Comienza tu día con nuestros deliciosos desayunos',
      icon: 'bi-sunrise'
    },
    {
      id: 'sopas',
      name: 'Sopas',
      description: 'Sopas caseras y reconfortantes para cualquier ocasión',
      icon: 'bi-bowl'
    },
    {
      id: 'ensaladas',
      name: 'Ensaladas',
      description: 'Ensaladas frescas y nutritivas con ingredientes de calidad',
      icon: 'bi-apple'
    },
    {
      id: 'pescados',
      name: 'Pescados y Mariscos',
      description: 'Frescos del mar, preparados con maestría',
      icon: 'bi-water'
    },
    {
      id: 'carnes',
      name: 'Carnes',
      description: 'Cortes selectos preparados a la perfección',
      icon: 'bi-fire'
    }
  ];
  */

  // NOTA: menuItems también está comentado - TODO debe venir de la base de datos
  /*
  private menuItems: MenuItem[] = [
    {
      id: 1,
      name: 'Bandeja Paisa Presteza',
      description: 'Carne asada, chicharrón, frijoles, arroz, aguacate, huevo, plátano y arepa',
      price: 25000,
      available: true,
      categoryId: 'almuerzos',
      options: [
        { id: 'extra-carne', name: 'Extra carne', price: 5000, type: 'extra' },
        { id: 'extra-aguacate', name: 'Extra aguacate', price: 2000, type: 'extra' },
        { id: 'sin-frijoles', name: 'Sin frijoles', price: 0, type: 'addon' }
      ]
    },
    {
      id: 2,
      name: 'Pollo a la Plancha',
      description: 'Pechuga de pollo asada, arroz, ensalada fresca, papas salteadas y salsas',
      price: 18000,
      available: true,
      categoryId: 'almuerzos',
      options: [
        { id: 'extra-pollo', name: 'Extra pollo', price: 4000, type: 'extra' },
        { id: 'arroz-integral', name: 'Arroz integral', price: 1000, type: 'addon' }
      ]
    },
    {
      id: 3,
      name: 'Salmon en Salsa de Maracuyá',
      description: 'Salmón fresco con salsa de maracuyá, puré de papa y vegetales al vapor',
      price: 32000,
      available: true,
      categoryId: 'almuerzos',
      options: [
        { id: 'extra-salmon', name: 'Extra salmón', price: 8000, type: 'extra' },
        { id: 'vegetales-mixtos', name: 'Vegetales mixtos', price: 2000, type: 'addon' }
      ]
    },
    {
      id: 4,
      name: 'Arroz con Pollo',
      description: 'Arroz sazonado con pollo, papa, chorizo y plátano maduro',
      price: 16000,
      available: true,
      categoryId: 'almuerzos'
    },
    {
      id: 5,
      name: 'Hamburguesa Clásica',
      description: 'Carne 100% agnus, lechuga, tomate, cebolla y nuestra salsa especial',
      price: 15000,
      available: true,
      categoryId: 'hamburguesas',
      options: [
        { id: 'doble-carne', name: 'Doble carne', price: 5000, type: 'extra' },
        { id: 'queso-cheddar', name: 'Queso cheddar', price: 2000, type: 'addon' },
        { id: 'tocino', name: 'Tocino', price: 3000, type: 'addon' },
        { id: 'huevo', name: 'Huevo', price: 1500, type: 'addon' }
      ]
    },
    {
      id: 6,
      name: 'Hamburguesa Presteza',
      description: 'Doble carne, queso cheddar, tocino, huevo y salsa BBQ',
      price: 22000,
      available: true,
      categoryId: 'hamburguesas',
      options: [
        { id: 'triple-carne', name: 'Triple carne', price: 5000, type: 'extra' },
        { id: 'extra-queso', name: 'Extra queso', price: 2000, type: 'addon' }
      ]
    },
    {
      id: 7,
      name: 'Hamburguesa Vegetariana',
      description: 'Medallón vegetal, aguacate, tomate y nuestra salsa vegana',
      price: 18000,
      available: true,
      categoryId: 'hamburguesas'
    },
    {
      id: 8,
      name: 'Empanadas de Carne',
      description: '3 empanadas artesanales con carne molida y especias',
      price: 9000,
      available: true,
      categoryId: 'entradas',
      options: [
        { id: 'cantidad-6', name: '6 unidades', price: 8000, type: 'size' }
      ]
    },
    {
      id: 9,
      name: 'Chuzos Mixtos',
      description: 'Chuzos de res y pollo con salsa de ajo y papas fritas',
      price: 14000,
      available: true,
      categoryId: 'entradas'
    },
    {
      id: 10,
      name: 'Ceviche de Pescado',
      description: 'Pescado fresco marinado en limón, cebolla, cilantro y ají',
      price: 16000,
      available: true,
      categoryId: 'entradas'
    },
    {
      id: 11,
      name: 'Papas Fritas',
      description: 'Papas fritas crujientes con nuestra salsa especial',
      price: 8000,
      available: true,
      categoryId: 'acompanamientos',
      options: [
        { id: 'tamano-familiar', name: 'Tamaño familiar', price: 4000, type: 'size' },
        { id: 'extra-salsa', name: 'Extra salsa', price: 1000, type: 'addon' }
      ]
    },
    {
      id: 12,
      name: 'Ensalada Mixta',
      description: 'Lechuga, tomate, cebolla, zanahoria y aderezo casero',
      price: 7000,
      available: true,
      categoryId: 'acompanamientos'
    },
    {
      id: 13,
      name: 'Sopas del Día',
      description: 'Sopa casera que varía según el día, servida con pan',
      price: 10000,
      available: true,
      categoryId: 'acompanamientos'
    },
    {
      id: 14,
      name: 'Gaseosa',
      description: 'Coca Cola, Sprite, Fanta o Manzana',
      price: 5000,
      available: true,
      categoryId: 'bebidas',
      options: [
        { id: 'tamano-grande', name: 'Grande', price: 2000, type: 'size' },
        { id: 'tamano-familiar-bebida', name: 'Familiar', price: 5000, type: 'size' }
      ]
    },
    {
      id: 15,
      name: 'Jugo Natural',
      description: 'Jugo de naranja, limonada o lulo',
      price: 7000,
      available: true,
      categoryId: 'bebidas',
      options: [
        { id: 'sabor-naranja', name: 'Naranja', price: 0, type: 'addon' },
        { id: 'sabor-limonada', name: 'Limonada', price: 0, type: 'addon' },
        { id: 'sabor-lulo', name: 'Lulo', price: 0, type: 'addon' }
      ]
    },
    {
      id: 16,
      name: 'Limonada de Coco',
      description: 'Nuestra especialidad: limonada de coco refrescante',
      price: 8000,
      available: true,
      categoryId: 'bebidas'
    },
    {
      id: 17,
      name: 'Tres Leches',
      description: 'Bizcocho esponjoso bañado en tres leches, con crema y cereza',
      price: 12000,
      available: true,
      categoryId: 'postres'
    },
    {
      id: 18,
      name: 'Brownie con Helado',
      description: 'Brownie de chocolate caliente con helado de vainilla y salsa de chocolate',
      price: 15000,
      available: true,
      categoryId: 'postres',
      options: [
        { id: 'helado-chocolate', name: 'Helado de chocolate', price: 2000, type: 'addon' },
        { id: 'helado-fresa', name: 'Helado de fresa', price: 2000, type: 'addon' }
      ]
    },
    {
      id: 19,
      name: 'Flan de Caramelo',
      description: 'Tradicional flan casero con caramelo suave',
      price: 10000,
      available: true,
      categoryId: 'postres'
    },
    {
      id: 20,
      name: 'Cheesecake de Maracuyá',
      description: 'Cheesecake cremoso con topping de maracuyá fresco',
      price: 14000,
      available: true,
      categoryId: 'postres'
    },
    {
      id: 21,
      name: 'Desayuno Continental',
      description: 'Huevos al gusto, pan tostado, mantequilla, mermelada, café y jugo',
      price: 15000,
      available: true,
      categoryId: 'desayunos',
      options: [
        { id: 'huevos-revueltos', name: 'Huevos revueltos', price: 0, type: 'addon' },
        { id: 'huevos-fritos', name: 'Huevos fritos', price: 0, type: 'addon' },
        { id: 'extra-huevos', name: 'Extra huevos', price: 2000, type: 'extra' }
      ]
    },
    {
      id: 22,
      name: 'Arepa con Todo',
      description: 'Arepa rellena con huevo, queso, carne desmechada y hogao',
      price: 12000,
      available: true,
      categoryId: 'desayunos',
      options: [
        { id: 'sin-carne', name: 'Sin carne', price: 0, type: 'addon' },
        { id: 'extra-queso', name: 'Extra queso', price: 2000, type: 'extra' }
      ]
    },
    {
      id: 23,
      name: 'Calentado Paisa',
      description: 'Frijoles, arroz, huevo frito, carne asada y arepa',
      price: 14000,
      available: true,
      categoryId: 'desayunos'
    },
    {
      id: 24,
      name: 'Sopa de Pollo',
      description: 'Sopa casera de pollo con papa, arracacha, yuca y cilantro',
      price: 11000,
      available: true,
      categoryId: 'sopas'
    },
    {
      id: 25,
      name: 'Ajiaco Santafereño',
      description: 'Tradicional ajiaco con pollo, papas, mazorca, alcaparras y crema',
      price: 16000,
      available: true,
      categoryId: 'sopas',
      options: [
        { id: 'extra-pollo', name: 'Extra pollo', price: 3000, type: 'extra' },
        { id: 'sin-crema', name: 'Sin crema', price: 0, type: 'addon' }
      ]
    },
    {
      id: 26,
      name: 'Sancocho de Gallina',
      description: 'Sancocho tradicional con gallina, papa, yuca, plátano y cilantro',
      price: 18000,
      available: true,
      categoryId: 'sopas'
    },
    {
      id: 27,
      name: 'Ensalada César',
      description: 'Lechuga romana, pollo a la plancha, crutones, parmesano y aderezo césar',
      price: 16000,
      available: true,
      categoryId: 'ensaladas',
      options: [
        { id: 'sin-pollo', name: 'Sin pollo (vegetariana)', price: -3000, type: 'addon' },
        { id: 'con-camarones', name: 'Con camarones', price: 4000, type: 'extra' }
      ]
    },
    {
      id: 28,
      name: 'Ensalada Presteza',
      description: 'Mix de lechugas, tomate cherry, aguacate, queso feta, nueces y aderezo de miel',
      price: 18000,
      available: true,
      categoryId: 'ensaladas'
    },
    {
      id: 29,
      name: 'Ensalada de Atún',
      description: 'Atún fresco, lechuga, tomate, cebolla, aceitunas y aderezo especial',
      price: 17000,
      available: true,
      categoryId: 'ensaladas'
    },
    {
      id: 30,
      name: 'Cazuela de Mariscos',
      description: 'Mezcla de mariscos en salsa cremosa con arroz y patacones',
      price: 28000,
      available: true,
      categoryId: 'pescados',
      options: [
        { id: 'picante', name: 'Nivel picante', price: 0, type: 'addon' }
      ]
    },
    {
      id: 31,
      name: 'Pescado Frito',
      description: 'Pescado fresco frito, patacones, arroz con coco y ensalada',
      price: 24000,
      available: true,
      categoryId: 'pescados'
    },
    {
      id: 32,
      name: 'Salmon a la Plancha',
      description: 'Salmón fresco a la plancha con vegetales salteados y puré de papa',
      price: 32000,
      available: true,
      categoryId: 'pescados',
      options: [
        { id: 'salsa-mostaza', name: 'Salsa de mostaza', price: 2000, type: 'addon' },
        { id: 'vegetales-mixtos', name: 'Vegetales mixtos', price: 2000, type: 'addon' }
      ]
    },
    {
      id: 33,
      name: 'Pechuga a la Plancha',
      description: 'Pechuga de pollo o res a la plancha, papas al horno y vegetales',
      price: 20000,
      available: true,
      categoryId: 'carnes',
      options: [
        { id: 'tipo-pollo', name: 'Pollo', price: 0, type: 'addon' },
        { id: 'tipo-res', name: 'Res', price: 5000, type: 'extra' }
      ]
    },
    {
      id: 34,
      name: 'Bistec a Caballo',
      description: 'Bistec de res, arroz, huevo frito, patacones y ensalada',
      price: 22000,
      available: true,
      categoryId: 'carnes',
      options: [
        { id: 'doble-carne', name: 'Doble carne', price: 8000, type: 'extra' }
      ]
    },
    {
      id: 35,
      name: 'Costilla BBQ',
      description: 'Costilla de cerdo en salsa BBQ, papas a la francesa y ensalada coleslaw',
      price: 26000,
      available: true,
      categoryId: 'carnes'
    }
  ];
  */

  getCategories(): Observable<MenuCategory[]> {
    console.log('🔍 Obteniendo categorías desde el backend...');
    return this.http.get<any>(`${this.apiUrl}/categories`).pipe(
      map(response => {
        // El backend devuelve { message, categories, count }
        // Extraer el array de categorías de la respuesta
        const categories = response.categories || response || [];
        console.log('✅ Categorías obtenidas del backend:', categories.length, 'categorías');
        console.log('📦 Datos de categorías:', categories);

        // Mapear las categorías para asegurar que tengan el campo 'id'
        // Si el backend devuelve _id (MongoDB), convertirlo a id
        const mappedCategories = categories
          .map((cat: any) => {
            try {
              if (!cat || typeof cat !== 'object') {
                console.warn('⚠️ Categoría inválida encontrada:', cat);
                return null;
              }
              const mapped: MenuCategory = {
                id: cat.id || cat._id || (cat.name ? String(cat.name).toLowerCase().replace(/\s+/g, '-') : ''),
                name: cat.name || '',
                description: cat.description || '',
                icon: cat.icon || ''
              };
              // Validar que al menos tenga un ID válido
              if (!mapped.id) {
                console.warn('⚠️ Categoría sin ID válido:', cat);
                return null;
              }
              console.log('🔄 Mapeando categoría:', cat, '→', mapped);
              return mapped;
            } catch (error) {
              console.error('❌ Error al mapear categoría:', cat, error);
              return null;
            }
          })
          .filter((cat: MenuCategory | null) => cat !== null) as MenuCategory[];

        console.log('📦 Categorías mapeadas:', mappedCategories);
        return mappedCategories;
      }),
      catchError(error => {
        console.error('❌ Error al obtener categorías del backend:', error);
        console.warn('⚠️ No se pueden obtener categorías del backend. Retornando array vacío.');
        // NO usar fallback - retornar array vacío para forzar uso solo de BD
        return of([]);
      })
    );
  }

  getCategoryById(id: string | null): Observable<MenuCategory | undefined> {
    if (!id) {
      return of(undefined);
    }
    console.log('🔍 Obteniendo categoría por ID:', id);
    return this.http.get<any>(`${this.apiUrl}/categories/${id}`).pipe(
      map(response => {
        // El backend devuelve { message, category }
        // Extraer la categoría de la respuesta
        const category = response.category || response;
        console.log('✅ Categoría obtenida del backend:', category);

        // Validar que la categoría existe y es válida
        if (!category || typeof category !== 'object') {
          console.warn('⚠️ Categoría inválida recibida del backend:', category);
          return undefined;
        }

        // Asegurar que tenga el campo 'id' (mapear _id a id si es necesario)
        const mappedCategory: MenuCategory = {
          id: category.id || category._id || '',
          name: category.name || '',
          description: category.description || '',
          icon: category.icon || ''
        };

        // Validar que tenga un ID válido
        if (!mappedCategory.id) {
          console.warn('⚠️ Categoría sin ID válido:', category);
          return undefined;
        }

        return mappedCategory;
      }),
      catchError(error => {
        console.error('❌ Error al obtener categoría del backend:', error);
        console.error('❌ Detalles:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error
        });
        console.warn('⚠️ No se puede obtener la categoría del backend. Retornando undefined.');
        // NO usar fallback - retornar undefined para forzar uso solo de BD
        return of(undefined);
      })
    );
  }

  getItemsByCategory(categoryId: string | null): Observable<MenuItem[]> {
    if (!categoryId) {
      return of([]);
    }

    console.log(`🔍 Obteniendo productos de la categoría: ${categoryId} desde el backend...`);
    console.log(`📝 Tipo del ID: ${typeof categoryId}, Valor: ${categoryId}`);

    // Usar el endpoint específico del backend para obtener platos por categoría
    // El backend puede esperar el ID de MongoDB o el nombre de la categoría
    return this.http.get<any>(`${this.apiUrl}/dishes/category/${categoryId}`).pipe(
      switchMap(response => {
        // El backend puede devolver { message, dishes } o directamente un array
        const dishes = response.dishes || response || [];
        console.log(`✅ Respuesta del backend:`, response);
        console.log(`✅ Productos obtenidos del backend para categoría ${categoryId}:`, Array.isArray(dishes) ? dishes.length : 0, 'productos');

        if (!Array.isArray(dishes)) {
          console.error('❌ La respuesta no es un array:', dishes);
          return of([]);
        }

        // Si es la categoría de hamburguesas, buscar hamburguesas vegetarianas
        if (categoryId && (categoryId.toString().toLowerCase().includes('hamburguesa') || categoryId.toString().toLowerCase() === 'hamburguesas')) {
          const vegetarianBurgers = dishes.filter((d: any) => {
            const name = (d.name || d.nombre || '').toLowerCase();
            return name.includes('vegetariana') || name.includes('veggie');
          });
          if (vegetarianBurgers.length > 0) {
            console.log('🌱 Hamburguesas vegetarianas encontradas en esta categoría:', vegetarianBurgers.map((d: any) => d.name || d.nombre));
          } else {
            console.log('❌ No se encontraron hamburguesas vegetarianas en la categoría de hamburguesas');
          }
        }

        // Mapear los platos del backend al modelo MenuItem del frontend
        const mappedItems = dishes
          .map((dish: any) => {
            try {
              const mapped = this.mapDishToMenuItem(dish);
              console.log(`🔄 Mapeando plato:`, dish, '→', mapped);
              return mapped;
            } catch (error) {
              console.error(`❌ Error al mapear plato:`, dish, error);
              return null;
            }
          })
          .filter((item: MenuItem | null) => item !== null) as MenuItem[];
        console.log(`📦 Productos mapeados:`, mappedItems);
        
        // Verificar disponibilidad basada en stock de insumos
        return this.getSupplies().pipe(
          map(supplies => {
            const checkedItems = this.checkProductsAvailability(mappedItems, supplies);
            return checkedItems;
          })
        );
      }),
      catchError(error => {
        console.error(`❌ Error al obtener productos del backend por categoría ${categoryId}:`, error);
        console.error(`❌ Detalles del error:`, {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error
        });
        console.warn(`⚠️ No se pueden obtener productos del backend. Retornando array vacío.`);
        // NO usar fallback - retornar array vacío para forzar uso solo de BD
        return of([]);
      })
    );
  }

  getItemById(id: number | string): Observable<MenuItem | undefined> {
    // Convertir el ID a string para la URL (MongoDB usa ObjectIds como strings)
    const idString = typeof id === 'string' ? id : id.toString();
    console.log('🔍 Obteniendo producto por ID:', idString, '(tipo:', typeof id, ')');

    return this.http.get<any>(`${this.apiUrl}/dishes/${idString}`).pipe(
      switchMap(response => {
        // El backend puede devolver { message, dish } o directamente el objeto
        const dish = response.dish || response;
        console.log('📦 Respuesta del backend para producto:', dish);
        const mappedItem = this.mapDishToMenuItem(dish);
        console.log('✅ Producto mapeado:', mappedItem);
        
        // Verificar disponibilidad basada en stock de insumos
        return this.getSupplies().pipe(
          map(supplies => {
            const checkedItem = this.checkProductAvailability(mappedItem, supplies);
            return checkedItem;
          })
        );
      }),
      catchError(error => {
        console.error('❌ Error al obtener producto del backend:', error);
        console.error('❌ Detalles del error:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error
        });
        console.warn('⚠️ No se puede obtener el producto del backend. Retornando undefined.');
        // NO usar fallback - retornar undefined para forzar uso solo de BD
        return of(undefined);
      })
    );
  }

  /**
   * Obtiene todos los platos desde el backend (sin filtros)
   * Útil para el panel de administración
   */
  /**
   * Obtener insumos con caché
   */
  private getSupplies(): Observable<Supply[]> {
    const now = Date.now();
    if (this.suppliesCache.length > 0 && (now - this.suppliesCacheTime) < this.cacheTimeout) {
      return of(this.suppliesCache);
    }

    if (!this.supplyService) {
      return of([]);
    }

    return this.supplyService.findAll().pipe(
      map(response => {
        this.suppliesCache = response.supplies || [];
        this.suppliesCacheTime = now;
        return this.suppliesCache;
      }),
      catchError(() => of([]))
    );
  }

  /**
   * Verificar disponibilidad de producto basada en stock de insumos
   */
  private checkProductAvailability(product: MenuItem, supplies: Supply[]): MenuItem {
    if (!product.supplies || product.supplies.length === 0) {
      // Si no tiene insumos asociados, mantener disponibilidad original
      return { ...product, stockStatus: 'available' };
    }

    const unavailableSupplies: string[] = [];
    let hasLowStock = false;

    for (const productSupply of product.supplies) {
      const supply = supplies.find(s => (s._id || s.id) === productSupply.supplyId);
      
      if (!supply) {
        // Insumo no encontrado, considerar como agotado
        unavailableSupplies.push(productSupply.supplyId);
        continue;
      }

      if (supply.quantity === 0) {
        unavailableSupplies.push(productSupply.supplyId);
      } else if (supply.quantity < productSupply.quantityRequired) {
        unavailableSupplies.push(productSupply.supplyId);
      } else if (supply.quantity < (productSupply.quantityRequired * 2)) {
        // Stock bajo si tiene menos del doble de lo requerido
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
      // Mantener disponible pero con advertencia
    }

    return {
      ...product,
      available,
      stockStatus,
      unavailableSupplies: unavailableSupplies.length > 0 ? unavailableSupplies : undefined
    };
  }

  /**
   * Verificar disponibilidad de múltiples productos
   */
  private checkProductsAvailability(products: MenuItem[], supplies: Supply[]): MenuItem[] {
    return products.map(product => this.checkProductAvailability(product, supplies));
  }

  getAllDishes(): Observable<MenuItem[]> {
    console.log('🔍 Obteniendo todos los platos desde el backend...');
    return this.http.get<any>(`${this.apiUrl}/dishes`).pipe(
      switchMap(response => {
        // El backend puede devolver { message, dishes } o directamente un array
        const dishes = response.dishes || response || [];
        
        if (!Array.isArray(dishes)) {
          console.error('❌ La respuesta no es un array:', dishes);
          return of([]);
        }

        console.log('📦 Total de productos recibidos del backend:', dishes.length, 'productos');

        // Mapear todos los platos
        const menuItems = dishes
          .map((dish: any) => {
            try {
              return this.mapDishToMenuItem(dish);
            } catch (error) {
              console.error(`❌ Error al mapear plato:`, dish, error);
              return null;
            }
          })
          .filter((item: MenuItem | null) => item !== null) as MenuItem[];

        console.log('✅ Productos mapeados exitosamente:', menuItems.length, 'productos');
        
        // Verificar disponibilidad basada en stock de insumos
        return this.getSupplies().pipe(
          map(supplies => {
            const checkedItems = this.checkProductsAvailability(menuItems, supplies);
            console.log('✅ Disponibilidad verificada basada en stock de insumos');
            return checkedItems;
          })
        );
      }),
      catchError(error => {
        console.error('❌ Error al obtener todos los platos del backend:', error);
        return of([]);
      })
    );
  }

  getFeaturedItems(): Observable<MenuItem[]> {
    // Retornar productos destacados/populares desde el backend
    return this.http.get<any>(`${this.apiUrl}/dishes`).pipe(
      switchMap(response => {
        // El backend puede devolver { message, dishes } o directamente un array
        const dishes = response.dishes || response || [];
        if (!Array.isArray(dishes)) {
          console.error('❌ La respuesta de productos destacados no es un array:', dishes);
          return of([]);
        }

        console.log('📦 Productos recibidos del backend:', dishes.length, 'productos');
        console.log('📋 Nombres de productos:', dishes.map((d: any) => d.name || d.nombre));

        // Buscar específicamente hamburguesas vegetarianas
        const vegetarianBurgers = dishes.filter((d: any) => {
          const name = (d.name || d.nombre || '').toLowerCase();
          return name.includes('vegetariana') || name.includes('veggie');
        });
        if (vegetarianBurgers.length > 0) {
          console.log('🌱 Hamburguesas vegetarianas encontradas:', vegetarianBurgers.map((d: any) => d.name || d.nombre));
        } else {
          console.log('❌ No se encontraron hamburguesas vegetarianas en la base de datos');
        }

        // Mapear los platos del backend al modelo MenuItem con manejo de errores
        const menuItems = dishes
          .map((dish: any) => {
            try {
              return this.mapDishToMenuItem(dish);
            } catch (error) {
              console.error(`❌ Error al mapear plato destacado:`, dish, error);
              return null;
            }
          })
          .filter((item: MenuItem | null) => item !== null) as MenuItem[];

        // Verificar disponibilidad basada en stock de insumos
        return this.getSupplies().pipe(
          map(supplies => {
            const checkedItems = this.checkProductsAvailability(menuItems, supplies);
            
            // Filtrar productos destacados (puedes ajustar la lógica según tu backend)
            // Por ahora, tomamos los primeros 3 productos disponibles
            // Excluir productos específicos que no deben aparecer
            const filteredItems = checkedItems.filter((item: MenuItem) => {
              if (item.available === false) return false;
              const nameLower = item.name?.toLowerCase() || '';

              // Excluir "Hamburguesa Doble BBQ"
              if (nameLower.includes('bbq') && nameLower.includes('doble')) {
                console.warn('⚠️ Producto "Hamburguesa Doble BBQ" detectado y excluido:', item.name);
                return false;
              }

              // Excluir "Hamburguesa Vegetariana" si no está en la BD
              if (nameLower.includes('vegetariana') || nameLower.includes('veggie')) {
                console.warn('⚠️ Producto "Hamburguesa Vegetariana" detectado y excluido:', item.name);
                return false;
              }

              return true;
            });

            console.log('✅ Productos filtrados para destacados:', filteredItems.length, 'productos');
            return filteredItems.slice(0, 10); // Retornar más productos para tener opciones en recomendaciones
          })
        );
      }),
      catchError(error => {
        console.error('Error al obtener productos destacados del backend, usando datos locales:', error);
        // NO usar fallback a datos locales - retornar array vacío para forzar uso solo de BD
        // Esto asegura que solo se muestren productos que realmente existen en la base de datos
        console.warn('⚠️ No se pueden obtener productos del backend. Retornando array vacío para evitar mostrar productos hardcodeados.');
        return of([]);
      })
    );
  }

  /**
   * Mapea un plato del backend al modelo MenuItem del frontend
   * Ajusta este método según la estructura de datos que devuelve tu backend
   * El DTO tiene: name, description, price, categoryId, image, available, type
   */
  private mapDishToMenuItem(dish: any): MenuItem {
    // Validar que dish existe
    if (!dish || typeof dish !== 'object') {
      console.warn('⚠️ Intento de mapear un plato inválido:', dish);
      throw new Error('Dish data is invalid');
    }

    // Obtener el ID del plato de forma segura
    const dishId = dish.id || dish._id;
    
    // Mapear supplies si existen
    let supplies: ProductSupply[] | undefined;
    if (dish.supplies && Array.isArray(dish.supplies)) {
      supplies = dish.supplies.map((s: any) => ({
        supplyId: s.supplyId || s.supply_id || s._id || s.id,
        quantityRequired: s.quantityRequired || s.quantity_required || s.quantity || 1
      }));
    }

    // Si es un ObjectId de MongoDB (24 caracteres hexadecimales), mantenerlo como string
    // Si es un número o un string numérico corto, convertirlo a número
    let finalId: number | string;
    if (!dishId) {
      // Si no hay ID, generar uno temporal o usar un valor por defecto
      console.warn('⚠️ El plato no tiene ID, usando ID temporal');
      finalId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    } else if (typeof dishId === 'string' && dishId.length === 24 && /^[0-9a-fA-F]{24}$/.test(dishId)) {
      // Es un ObjectId de MongoDB, mantenerlo como string
      finalId = dishId;
    } else if (typeof dishId === 'string' && !isNaN(parseInt(dishId, 10)) && dishId.length < 10) {
      // Es un string numérico corto, convertirlo a número
      finalId = parseInt(dishId, 10);
    } else if (typeof dishId === 'number') {
      // Ya es un número
      finalId = dishId;
    } else {
      // Por defecto, mantener como string
      finalId = String(dishId);
    }

    // Obtener categoryId de forma segura
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

    // Validar y mapear opciones de forma segura
    let options: any[] = [];
    if (Array.isArray(dish.options)) {
      options = dish.options;
      console.log('📦 Opciones encontradas en dish.options:', options);
    } else if (Array.isArray(dish.opciones)) {
      options = dish.opciones;
      console.log('📦 Opciones encontradas en dish.opciones:', options);
    } else {
      console.log('⚠️ No se encontraron opciones en el plato:', dish);
    }

    // Mapear las opciones para asegurar que tengan el formato correcto
    const mappedOptions = options.map((opt: any, index: number) => {
      const mapped = {
        id: opt.id || opt._id || `opt_${index}`,
        name: opt.name || opt.nombre || '',
        price: typeof opt.price === 'number' ? opt.price : (typeof opt.precio === 'number' ? opt.precio : 0),
        type: opt.type || opt.tipo || 'extra'
      };
      console.log('🔄 Mapeando opción:', opt, '→', mapped);
      return mapped;
    });

    console.log('📋 Opciones mapeadas:', mappedOptions);

    return {
      id: finalId,
      name: dish.name || dish.nombre || '',
      description: dish.description || dish.descripcion || '',
      price: typeof dish.price === 'number' ? dish.price : (typeof dish.precio === 'number' ? dish.precio : 0),
      // El backend usa 'image', el frontend espera 'imageUrl'
      imageUrl: dish.image || dish.imageUrl || dish.imagen || '',
      available: dish.available !== undefined ? Boolean(dish.available) : (dish.disponible !== undefined ? Boolean(dish.disponible) : true),
      categoryId: categoryId,
      // Las opciones mapeadas
      options: mappedOptions,
      // Insumos requeridos
      supplies: supplies
    };
  }

  /**
   * Crear un nuevo producto en el backend
   */
  createDish(dishData: Partial<MenuItem>): Observable<MenuItem> {
    console.log('📤 Creando nuevo producto:', dishData);
    console.log('📤 URL del endpoint:', `${this.apiUrl}/dishes`);

    // Asegurar que los datos estén en el formato correcto para el backend
    const backendData: any = {
      name: dishData.name,
      description: dishData.description,
      price: Number(dishData.price), // Asegurar que sea un número
      categoryId: dishData.categoryId,
      available: dishData.available !== undefined ? dishData.available : true,
      // El backend requiere 'image' como string no vacío
      image: (dishData.imageUrl && dishData.imageUrl.trim() !== '')
        ? dishData.imageUrl.trim()
        : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80', // Imagen por defecto
      // El backend requiere 'type' como string no vacío
      type: 'dish' // Valor por defecto para el tipo de plato
    };

    console.log('📤 Datos formateados para el backend:', backendData);

    return this.http.post<any>(`${this.apiUrl}/dishes`, backendData).pipe(
      tap(response => {
        console.log('📥 Respuesta completa del backend:', response);
      }),
      map(response => {
        const dish = response.dish || response;
        console.log('✅ Producto creado exitosamente:', dish);
        return this.mapDishToMenuItem(dish);
      }),
      catchError(error => {
        console.error('❌ Error completo al crear producto:', error);
        console.error('❌ Status:', error.status);
        console.error('❌ Status Text:', error.statusText);
        console.error('❌ Error Body:', error.error);
        console.error('❌ Error Message:', error.message);
        throw error;
      })
    );
  }

  /**
   * Actualizar un producto existente en el backend
   */
  updateDish(dishId: number | string, dishData: Partial<MenuItem>): Observable<MenuItem> {
    const idString = typeof dishId === 'string' ? dishId : dishId.toString();
    console.log(`📤 Actualizando producto ${idString}:`, dishData);

    // Obtener la imagen: usar la nueva si se proporciona, sino usar una por defecto
    const imageValue = (dishData.imageUrl && dishData.imageUrl.trim() !== '')
      ? dishData.imageUrl.trim()
      : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80'; // Imagen por defecto

    // Formatear datos para el backend - siempre incluir campos requeridos
    const backendData: any = {
      // El backend requiere 'image' como string no vacío - siempre incluirlo
      image: imageValue,
      // El backend requiere 'type' como string no vacío - siempre incluirlo
      type: 'dish'
    };

    // Agregar campos opcionales solo si están definidos
    if (dishData.name !== undefined) {
      backendData.name = dishData.name;
    }
    if (dishData.description !== undefined) {
      backendData.description = dishData.description;
    }
    if (dishData.price !== undefined) {
      backendData.price = Number(dishData.price);
    }
    if (dishData.categoryId !== undefined) {
      backendData.categoryId = dishData.categoryId;
    }
    if (dishData.available !== undefined) {
      backendData.available = dishData.available;
    }

    console.log(`📤 Datos formateados para actualizar:`, backendData);

    return this.http.patch<any>(`${this.apiUrl}/dishes/${idString}`, backendData).pipe(
      tap(response => {
        console.log('📥 Respuesta completa del backend al actualizar:', response);
      }),
      map(response => {
        const dish = response.dish || response;
        console.log('✅ Producto actualizado exitosamente:', dish);
        return this.mapDishToMenuItem(dish);
      }),
      catchError(error => {
        console.error('❌ Error completo al actualizar producto:', error);
        console.error('❌ Status:', error.status);
        console.error('❌ Status Text:', error.statusText);
        console.error('❌ Error Body:', error.error);
        console.error('❌ Error Message:', error.message);
        throw error;
      })
    );
  }

  /**
   * Eliminar un producto del backend
   */
  deleteDish(dishId: number | string): Observable<void> {
    const idString = typeof dishId === 'string' ? dishId : dishId.toString();
    console.log(`📤 Eliminando producto ${idString}`);
    return this.http.delete<void>(`${this.apiUrl}/dishes/${idString}`).pipe(
      tap(() => {
        console.log('✅ Producto eliminado exitosamente');
      }),
      catchError(error => {
        console.error('❌ Error al eliminar producto:', error);
        throw error;
      })
    );
  }

  /**
   * Actualizar solo la disponibilidad de un producto
   */
  updateDishAvailability(dishId: number | string, available: boolean): Observable<MenuItem> {
    const idString = typeof dishId === 'string' ? dishId : dishId.toString();
    console.log(`📤 Actualizando disponibilidad del producto ${idString} a ${available}`);
    return this.http.patch<any>(`${this.apiUrl}/dishes/${idString}`, { available }).pipe(
      map(response => {
        const dish = response.dish || response;
        console.log('✅ Disponibilidad actualizada:', dish);
        return this.mapDishToMenuItem(dish);
      }),
      catchError(error => {
        console.error('❌ Error al actualizar disponibilidad:', error);
        throw error;
      })
    );
  }

  /**
   * Crear una nueva categoría en el backend
   */
  createCategory(categoryData: Partial<MenuCategory>): Observable<MenuCategory> {
    console.log('📤 Creando nueva categoría:', categoryData);
    return this.http.post<any>(`${this.apiUrl}/categories`, categoryData).pipe(
      tap(response => {
        console.log('📥 Respuesta completa del backend:', response);
      }),
      map(response => {
        const category = response.category || response;
        console.log('✅ Categoría creada:', category);
        return this.mapCategoryToMenuCategory(category);
      }),
      catchError(error => {
        console.error('❌ Error al crear categoría:', error);
        throw error;
      })
    );
  }

  /**
   * Actualizar una categoría existente en el backend
   */
  updateCategory(categoryId: string, categoryData: Partial<MenuCategory>): Observable<MenuCategory> {
    console.log(`📤 Actualizando categoría ${categoryId}:`, categoryData);
    return this.http.patch<any>(`${this.apiUrl}/categories/${categoryId}`, categoryData).pipe(
      tap(response => {
        console.log('📥 Respuesta completa del backend:', response);
      }),
      map(response => {
        const category = response.category || response;
        console.log('✅ Categoría actualizada:', category);
        return this.mapCategoryToMenuCategory(category);
      }),
      catchError(error => {
        console.error('❌ Error al actualizar categoría:', error);
        throw error;
      })
    );
  }

  /**
   * Eliminar una categoría del backend
   */
  deleteCategory(categoryId: string): Observable<void> {
    console.log(`📤 Eliminando categoría ${categoryId}`);
    return this.http.delete<void>(`${this.apiUrl}/categories/${categoryId}`).pipe(
      tap(() => {
        console.log('✅ Categoría eliminada exitosamente');
      }),
      catchError(error => {
        console.error('❌ Error al eliminar categoría:', error);
        throw error;
      })
    );
  }

  /**
   * Mapea una categoría del backend al modelo MenuCategory del frontend
   */
  private mapCategoryToMenuCategory(category: any): MenuCategory {
    if (!category || typeof category !== 'object') {
      throw new Error('Category data is invalid');
    }

    return {
      id: category.id || category._id || '',
      name: category.name || '',
      description: category.description || '',
      icon: category.icon || ''
    };
  }
}
