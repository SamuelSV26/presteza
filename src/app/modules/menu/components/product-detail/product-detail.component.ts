import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../../../../core/services/user.service';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { CartService } from '../../../../core/services/cart.service';
import { Observable } from 'rxjs';
import { MenuItem, ProductOption } from '../../../../core/models/MenuItem';
import { MenuService } from '../../../../core/services/menu.service';

interface SelectedOption {
  option: ProductOption;
  checked: boolean;
}

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.css']
})
export class ProductDetailComponent implements OnInit {
  product: MenuItem | null = null;
  loading = true;
  quantity = 1;
  selectedOptions: Map<string, boolean> = new Map();
  totalPrice = 0;
  basePrice = 0;
  categoryId: string | null = null; // Guardar el ID de la categoría para volver

  // Mock data para rating
  rating = 4.5;
  totalReviews = 124;

  // Opciones agrupadas por tipo
  addons: ProductOption[] = [];
  extras: ProductOption[] = [];
  sizes: ProductOption[] = [];
  removals: ProductOption[] = [];

  // Favoritos
  isFavorite$: Observable<boolean> = new Observable();
  isLoggedIn = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private menuService: MenuService,
    private userService: UserService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private cartService: CartService
  ) { }

  ngOnInit(): void {
    // Verificar autenticación (pero no redirigir, permitir ver el producto sin autenticación)
    this.isLoggedIn = this.authService.isAuthenticated();

    // Escuchar cambios en el estado de autenticación
    this.authService.userInfo$.subscribe(() => {
      this.isLoggedIn = this.authService.isAuthenticated();
    });

    const productId = this.route.snapshot.paramMap.get('id');
    // Intentar obtener categoryId de query params primero (si viene desde navegación)
    const categoryIdFromQuery = this.route.snapshot.queryParamMap.get('categoryId');
    if (categoryIdFromQuery) {
      this.categoryId = categoryIdFromQuery;
      console.log('📍 CategoryId obtenido de query params:', this.categoryId);
    }

    console.log('🔍 ID del producto obtenido de la ruta:', productId);

    if (productId) {
      // Mantener el ID como string si es un ObjectId de MongoDB (24 caracteres)
      // o convertirlo a número si es un ID numérico corto
      const idToUse: number | string =
        (productId.length === 24 && /^[0-9a-fA-F]{24}$/.test(productId))
          ? productId
          : (!isNaN(parseInt(productId, 10)) && productId.length < 10
            ? parseInt(productId, 10)
            : productId);

      console.log('📦 ID a usar para obtener el producto:', idToUse, '(tipo:', typeof idToUse, ')');

      this.menuService.getItemById(idToUse).subscribe({
        next: (item) => {
          if (item) {
            console.log('✅ Producto obtenido:', item);
            this.product = item;
            this.basePrice = item.price;
            this.totalPrice = item.price;
            // Guardar el categoryId del producto si no se obtuvo de query params
            if (!this.categoryId && item.categoryId) {
              this.categoryId = item.categoryId;
              console.log('📍 CategoryId obtenido del producto:', this.categoryId);
            }
            this.organizeOptions();
            this.loading = false;
            this.initFavorites();
          } else {
            console.warn('⚠️ Producto no encontrado, redirigiendo al menú');
            this.router.navigate(['/menu']);
          }
        },
        error: (error) => {
          console.error('❌ Error al obtener el producto:', error);
          this.router.navigate(['/menu']);
        }
      });
    } else {
      console.warn('⚠️ No se encontró ID en la ruta, redirigiendo al menú');
      this.router.navigate(['/menu']);
    }
  }

  initFavorites(): void {
    this.isLoggedIn = this.authService.isAuthenticated();
    if (this.product && this.isLoggedIn) {
      this.isFavorite$ = this.userService.isFavorite(this.product.id);
    }

    // Escuchar cuando el usuario inicie sesión
    window.addEventListener('userLoggedIn', () => {
      this.isLoggedIn = this.authService.isAuthenticated();
      if (this.product && this.isLoggedIn) {
        this.isFavorite$ = this.userService.isFavorite(this.product.id);
      }
    });
  }

  organizeOptions(): void {
    // Limpiar arrays antes de organizar
    this.addons = [];
    this.extras = [];
    this.sizes = [];
    this.removals = [];

    // Analizar la descripción del producto para extraer ingredientes
    const description = (this.product?.description || '').toLowerCase();

    // Lista de ingredientes comunes y sus variaciones
    const ingredientMap: { [key: string]: string[] } = {
      'cebolla': ['cebolla', 'cebollas'],
      'tomate': ['tomate', 'tomates'],
      'lechuga': ['lechuga'],
      'queso': ['queso', 'quesos', 'cheddar'],
      'salsa': ['salsa', 'salsas'],
      'mayonesa': ['mayonesa'],
      'mostaza': ['mostaza'],
      'pepinillos': ['pepinillos', 'pepinillo'],
      'aguacate': ['aguacate', 'palta'],
      'huevo': ['huevo', 'huevos'],
      'tocino': ['tocino', 'tocineta', 'bacon'],
      'carne': ['carne', 'carne asada', 'carne molida'],
      'pollo': ['pollo'],
      'pescado': ['pescado', 'salmón'],
      'mariscos': ['mariscos', 'camarones'],
      'frijoles': ['frijoles', 'fríjoles', 'frijol'],
      'arroz': ['arroz'],
      'papa': ['papa', 'papas', 'papas a la francesa'],
      'plátano': ['plátano', 'plátanos', 'plátano maduro'],
      'arepa': ['arepa', 'arepas']
    };

    // Extraer ingredientes del plato desde la descripción
    const foundIngredients: string[] = [];
    Object.keys(ingredientMap).forEach(ingredient => {
      const variations = ingredientMap[ingredient];
      const found = variations.some(variation => description.includes(variation));
      if (found) {
        foundIngredients.push(ingredient);
      }
    });

    // Crear opciones de eliminación solo para los ingredientes que tiene el plato
    foundIngredients.forEach(ingredient => {
      const removalOption: ProductOption = {
        id: `removal-${ingredient}`,
        name: `Sin ${ingredient}`,
        price: 0,
        type: 'extra'
      };
      this.removals.push(removalOption);
      this.selectedOptions.set(removalOption.id, false);
    });

    // Mapa de nombres en español para las adiciones
    const addonNames: { [key: string]: string } = {
      'queso': 'Queso extra',
      'tocino': 'Tocino extra',
      'huevo': 'Huevo extra',
      'aguacate': 'Aguacate extra',
      'papa': 'Papas extra',
      'carne': 'Carne extra',
      'pollo': 'Pollo extra',
      'cebolla': 'Cebolla extra',
      'tomate': 'Tomate extra',
      'lechuga': 'Lechuga extra',
      'salsa': 'Salsa extra',
      'mayonesa': 'Mayonesa extra',
      'mostaza': 'Mostaza extra',
      'pepinillos': 'Pepinillos extra',
      'pescado': 'Pescado extra',
      'mariscos': 'Mariscos extra',
      'frijoles': 'Frijoles extra',
      'arroz': 'Arroz extra',
      'plátano': 'Plátano extra'
    };

    // Mapa de precios para adiciones según ingrediente
    const addonPrices: { [key: string]: number } = {
      'queso': 2000,
      'tocino': 3000,
      'huevo': 1500,
      'aguacate': 2000,
      'papa': 3000,
      'carne': 5000,
      'pollo': 4000,
      'cebolla': 1000,
      'tomate': 1000,
      'lechuga': 1000,
      'salsa': 1500,
      'mayonesa': 1000,
      'mostaza': 1000,
      'pepinillos': 1500,
      'pescado': 6000,
      'mariscos': 7000,
      'frijoles': 2000,
      'arroz': 2000,
      'plátano': 2000
    };

    // Crear opciones de adición basadas en los ingredientes del plato
    // Solo agregar adiciones para ingredientes que tienen precio definido y tienen sentido como extra
    const addableIngredients = ['queso', 'tocino', 'huevo', 'aguacate', 'papa', 'carne', 'pollo',
      'cebolla', 'tomate', 'lechuga', 'salsa', 'mayonesa', 'mostaza',
      'pepinillos', 'pescado', 'mariscos', 'frijoles', 'arroz', 'plátano'];

    foundIngredients.forEach(ingredient => {
      // Solo crear adición si el ingrediente está en la lista de adicionables y tiene precio
      if (addableIngredients.includes(ingredient) && addonPrices[ingredient] !== undefined) {
        const addonOption: ProductOption = {
          id: `addon-${ingredient}`,
          name: addonNames[ingredient] || `${ingredient.charAt(0).toUpperCase() + ingredient.slice(1)} extra`,
          price: addonPrices[ingredient],
          type: 'addon'
        };
        // Evitar duplicados
        if (!this.addons.find(a => a.id === addonOption.id)) {
          this.addons.push(addonOption);
          this.selectedOptions.set(addonOption.id, false);
        }
      }
    });

    // Si hay opciones del backend, procesarlas también
    if (this.product?.options && Array.isArray(this.product.options)) {
      console.log('🔍 Organizando opciones del producto:', this.product.options);

      this.product.options.forEach(option => {
        // Validar que la opción tenga los campos necesarios
        if (!option || !option.id || !option.name) {
          console.warn('⚠️ Opción inválida encontrada:', option);
          return;
        }

        const optionName = String(option.name).toLowerCase().trim();
        const optionAny = option as any;
        console.log('🔍 Procesando opción:', optionName, 'Tipo:', option.type, 'Opción completa:', option);

        // Detectar opciones de eliminación del backend
        const isRemovalByField = optionAny.isRemoval === true ||
          optionAny.removal === true ||
          optionAny.remove === true ||
          optionAny.exclude === true ||
          optionAny.isExclude === true;

        const isRemovalByType = optionAny.type === 'removal' ||
          optionAny.type === 'remove' ||
          optionAny.type === 'exclude' ||
          optionAny.tipo === 'removal' ||
          optionAny.tipo === 'remove' ||
          optionAny.tipo === 'exclude';

        const removalKeywords = ['sin', 'quitar', 'no incluir', 'excluir'];
        const isRemovalByName = removalKeywords.some(keyword => optionName.includes(keyword));

        const isRemoval = isRemovalByField || isRemovalByType || isRemovalByName;

        if (isRemoval) {
          console.log('➕ Agregando a removals:', option.name);
          // Evitar duplicados con las opciones generadas desde la descripción
          if (!this.removals.find(r => r.id === option.id)) {
            this.removals.push(option);
          }
        } else {
          // Agregar a otras categorías según su tipo
          if (option.type === 'addon' || optionAny.tipo === 'addon') {
            console.log('➕ Agregando a addons:', option.name);
            // Evitar duplicados
            if (!this.addons.find(a => a.id === option.id)) {
              this.addons.push(option);
            }
          } else if (option.type === 'extra' || optionAny.tipo === 'extra') {
            console.log('➕ Agregando a extras:', option.name);
            this.extras.push(option);
          } else if (option.type === 'size' || optionAny.tipo === 'size') {
            console.log('➕ Agregando a sizes:', option.name);
            this.sizes.push(option);
          } else {
            // Si no tiene tipo definido, agregarlo a extras por defecto
            console.log('➕ Agregando a extras (por defecto):', option.name);
            this.extras.push(option);
          }
        }

        this.selectedOptions.set(String(option.id), false);
      });
    }

    // Log para debugging
    console.log('📋 Opciones organizadas:', {
      removals: this.removals.length,
      extras: this.extras.length,
      addons: this.addons.length,
      sizes: this.sizes.length,
      ingredientesEncontrados: foundIngredients,
      totalBackend: this.product?.options?.length || 0
    });

    if (this.removals.length > 0) {
      console.log('📋 Lista de removals:', this.removals.map(r => r.name));
    }
    if (this.addons.length > 0) {
      console.log('📋 Lista de addons:', this.addons.map(a => a.name));
    }
  }

  toggleOption(optionId: string): void {
    const currentValue = this.selectedOptions.get(optionId) || false;
    this.selectedOptions.set(optionId, !currentValue);
    this.calculateTotal();
  }

  increaseQuantity(): void {
    this.quantity++;
    this.calculateTotal();
  }

  decreaseQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
      this.calculateTotal();
    }
  }

  getSelectedOptionsPrice(): number {
    let total = 0;
    this.selectedOptions.forEach((checked, optionId) => {
      if (checked) {
        // Buscar en todas las opciones disponibles
        let option: ProductOption | undefined;

        // Buscar primero en las opciones del producto
        option = this.product?.options?.find(opt => String(opt.id) === String(optionId));

        // Si no se encuentra, buscar en removals
        if (!option) {
          option = this.removals.find(opt => String(opt.id) === String(optionId));
        }

        // Si no se encuentra, buscar en addons
        if (!option) {
          option = this.addons.find(opt => String(opt.id) === String(optionId));
        }

        // Si no se encuentra, buscar en extras
        if (!option) {
          option = this.extras.find(opt => String(opt.id) === String(optionId));
        }

        // Si no se encuentra, buscar en sizes
        if (!option) {
          option = this.sizes.find(opt => String(opt.id) === String(optionId));
        }

        if (option && option.price > 0) {
          total += option.price;
        }
      }
    });
    return total;
  }

  calculateTotal(): void {
    const extrasTotal = this.getSelectedOptionsPrice();
    this.totalPrice = (this.basePrice + extrasTotal) * this.quantity;
  }

  addToCart(): void {
    // Verificar autenticación antes de agregar al carrito
    if (!this.isLoggedIn || !this.authService.isAuthenticated()) {
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: this.router.url }
      });
      return;
    }

    if (!this.product) return;

    // Convertir las opciones seleccionadas al formato del carrito
    const selectedOptionsList: Array<{ id: string; name: string; price: number }> = [];
    this.selectedOptions.forEach((checked, optionId) => {
      if (checked) {
        // Buscar en todas las opciones disponibles
        let option: ProductOption | undefined;

        // Buscar primero en las opciones del producto
        option = this.product?.options?.find(opt => String(opt.id) === String(optionId));

        // Si no se encuentra, buscar en removals
        if (!option) {
          option = this.removals.find(opt => String(opt.id) === String(optionId));
        }

        // Si no se encuentra, buscar en addons
        if (!option) {
          option = this.addons.find(opt => String(opt.id) === String(optionId));
        }

        // Si no se encuentra, buscar en extras
        if (!option) {
          option = this.extras.find(opt => String(opt.id) === String(optionId));
        }

        // Si no se encuentra, buscar en sizes
        if (!option) {
          option = this.sizes.find(opt => String(opt.id) === String(optionId));
        }

        if (option) {
          selectedOptionsList.push({
            id: String(option.id),
            name: option.name,
            price: option.price || 0
          });
        }
      }
    });

    // Agregar al carrito usando el servicio
    this.cartService.addItem({
      productId: this.product.id,
      productName: this.product.name,
      productDescription: this.product.description || '',
      basePrice: this.basePrice,
      selectedOptions: selectedOptionsList,
      quantity: this.quantity,
      imageUrl: this.product.imageUrl
    });

    console.log('✅ Producto agregado al carrito:', {
      product: this.product.name,
      quantity: this.quantity,
      selectedOptions: selectedOptionsList.length,
      totalPrice: this.totalPrice,
      removalsSelected: selectedOptionsList.filter(opt => opt.name.toLowerCase().includes('sin')).length
    });

    this.notificationService.showSuccess(
      `${this.product.name} agregado al carrito`,
      '¡Éxito!'
    );

    // Opcional: navegar a la categoría después de un breve delay
    setTimeout(() => {
      if (this.categoryId) {
        this.router.navigate(['/menu', this.categoryId]);
      } else {
        this.router.navigate(['/menu']);
      }
    }, 1500);
  }

  goBack(): void {
    // Si tenemos un categoryId, volver a esa categoría
    if (this.categoryId) {
      console.log('🔙 Volviendo a la categoría:', this.categoryId);
      this.router.navigate(['/menu', this.categoryId]);
    } else {
      // Si no hay categoryId, volver al menú principal
      console.log('🔙 Volviendo al menú principal');
      this.router.navigate(['/menu']);
    }
  }

  getStars(): number[] {
    return Array(5).fill(0).map((_, i) => i + 1);
  }

  toggleFavorite(): void {
    if (!this.product) return;

    // Verificar el estado de autenticación en tiempo real
    this.isLoggedIn = this.authService.isAuthenticated();

    if (!this.isLoggedIn) {
      // Redirigir a la página de login
      this.router.navigate(['/login']);
      return;
    }

    this.userService.toggleFavorite(this.product.id);
    this.isFavorite$ = this.userService.isFavorite(this.product.id);
  }
}

