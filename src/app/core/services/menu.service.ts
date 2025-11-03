import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

export interface MenuCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
}

export interface ProductOption {
  id: string;
  name: string;
  price: number;
  type: 'addon' | 'size' | 'extra';
}

export interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  available: boolean;
  categoryId: string;
  options?: ProductOption[];
}

@Injectable({
  providedIn: 'root'
})
export class MenuService {
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

  getCategories(): Observable<MenuCategory[]> {
    return of(this.categories);
  }

  getCategoryById(id: string | null): Observable<MenuCategory | undefined> {
    if (!id) {
      return of(undefined);
    }
    const category = this.categories.find(c => c.id === id);
    return of(category);
  }

  getItemsByCategory(categoryId: string | null): Observable<MenuItem[]> {
    if (!categoryId) {
      return of([]);
    }
    const items = this.menuItems.filter(item => item.categoryId === categoryId && item.available);
    return of(items);
  }

  getItemById(id: number): Observable<MenuItem | undefined> {
    const item = this.menuItems.find(item => item.id === id);
    return of(item);
  }

  getFeaturedItems(): Observable<MenuItem[]> {
    // Retornar productos destacados/populares
    const featuredIds = [1, 6, 30]; // Bandeja Paisa, Hamburguesa Presteza, Cazuela de Mariscos
    const featured = this.menuItems.filter(item => 
      featuredIds.includes(item.id) && item.available
    );
    return of(featured);
  }
}