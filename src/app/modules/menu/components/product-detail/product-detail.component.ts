import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../../../../core/services/user.service';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { CartService } from '../../../../core/services/cart.service';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MenuItem, ProductOption } from '../../../../core/models/MenuItem';
import { MenuService } from '../../../../core/services/menu.service';
import { ExtrasAvailabilityService } from '../../../../core/services/extras-availability.service';

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
export class ProductDetailComponent implements OnInit, OnDestroy {
  product: MenuItem | null = null;
  loading = true;
  quantity = 1;
  selectedOptions: Map<string, boolean> = new Map();
  totalPrice = 0;
  basePrice = 0;
  private destroy$ = new Subject<void>();
  categoryId: string | null = null;
  rating = 4.5;
  totalReviews = 124;
  addons: ProductOption[] = [];
  extras: ProductOption[] = [];
  sizes: ProductOption[] = [];
  removals: ProductOption[] = [];
  isFavorite$: Observable<boolean> = new Observable();
  isLoggedIn = false;
  private extrasUpdatedHandler = () => {
    // Forzar actualización de las opciones cuando se actualizan los extras
    // Usar setTimeout para asegurar que localStorage se haya actualizado
    setTimeout(() => {
      if (this.product) {
        this.organizeOptions();
        this.calculateTotal();
      }
    }, 100);
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private menuService: MenuService,
    private userService: UserService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private cartService: CartService,
    private extrasAvailabilityService: ExtrasAvailabilityService
  ) { }

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isAuthenticated();
    this.authService.userInfo$.subscribe(() => {
      this.isLoggedIn = this.authService.isAuthenticated();
    });

    window.addEventListener('extrasUpdated', this.extrasUpdatedHandler);
    const productId = this.route.snapshot.paramMap.get('id');
    const categoryIdFromQuery = this.route.snapshot.queryParamMap.get('categoryId');
    if (categoryIdFromQuery) {
      this.categoryId = categoryIdFromQuery;
    }
    if (productId) {
      const idToUse: number | string =
        (productId.length === 24 && /^[0-9a-fA-F]{24}$/.test(productId))
          ? productId
          : (!isNaN(parseInt(productId, 10)) && productId.length < 10
            ? parseInt(productId, 10)
            : productId);
      this.menuService.getItemById(idToUse).subscribe({
        next: (item) => {
          if (item) {
            this.product = item;
            this.basePrice = item.price;
            this.totalPrice = item.price;
            if (!this.categoryId && item.categoryId) {
              this.categoryId = item.categoryId;
            }
            this.organizeOptions();
            this.loading = false;
            this.initFavorites();
          } else {
            this.router.navigate(['/menu']);
          }
        },
        error: () => {
          this.router.navigate(['/menu']);
        }
      });
    } else {
      this.router.navigate(['/menu']);
    }
  }

  initFavorites(): void {
    this.isLoggedIn = this.authService.isAuthenticated();
    if (this.product && this.isLoggedIn) {
      this.isFavorite$ = this.userService.isFavorite(this.product.id);
    }

    window.addEventListener('userLoggedIn', () => {
      this.isLoggedIn = this.authService.isAuthenticated();
      if (this.product && this.isLoggedIn) {
        this.isFavorite$ = this.userService.isFavorite(this.product.id);
      }
    });
  }

  organizeOptions(): void {
    this.addons = [];
    this.extras = [];
    this.sizes = [];
    this.removals = [];
    const description = (this.product?.description || '').toLowerCase();
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

    const foundIngredients: string[] = [];
    Object.keys(ingredientMap).forEach(ingredient => {
      const variations = ingredientMap[ingredient];
      const found = variations.some(variation => description.includes(variation));
      if (found) {
        foundIngredients.push(ingredient);
      }
    });

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

    const addableIngredients = ['queso', 'tocino', 'huevo', 'aguacate', 'papa', 'carne', 'pollo',
      'cebolla', 'tomate', 'lechuga', 'salsa', 'mayonesa', 'mostaza',
      'pepinillos', 'pescado', 'mariscos', 'frijoles', 'arroz', 'plátano'];
    foundIngredients.forEach(ingredient => {
      if (addableIngredients.includes(ingredient)) {
        const addonId = `addon-${ingredient}`;
        
        // Verificar primero si está disponible usando el método del servicio
        if (!this.extrasAvailabilityService.isExtraAvailable(addonId)) {
          // Si no está disponible, no agregarlo
          return;
        }
        
        // Obtener el extra directamente del servicio
        const storedExtra = this.extrasAvailabilityService.getExtraById(addonId);
        
        // Solo mostrar si existe y está disponible (doble verificación)
        if (storedExtra && storedExtra.available === true) {
          const addonOption: ProductOption = {
            id: addonId,
            name: storedExtra.name,
            price: storedExtra.price,
            type: 'addon'
          };
          if (!this.addons.find(a => a.id === addonOption.id)) {
            this.addons.push(addonOption);
            this.selectedOptions.set(addonOption.id, false);
          }
        }
      }
    });
    
    const allExtras = this.extrasAvailabilityService.getAllExtras();
    allExtras.forEach(extra => {
      if (extra.available && !extra.id.startsWith('addon-')) {
        const addonOption: ProductOption = {
          id: extra.id,
          name: extra.name,
          price: extra.price,
          type: 'addon'
        };
        if (!this.addons.find(a => a.id === addonOption.id)) {
          this.addons.push(addonOption);
          this.selectedOptions.set(addonOption.id, false);
        }
      }
    });
    if (this.product?.options && Array.isArray(this.product.options)) {
      this.product.options.forEach(option => {
        if (!option || !option.id || !option.name) {
          return;
        }
        const optionName = String(option.name).toLowerCase().trim();
        const optionAny = option as any;
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
          if (!this.removals.find(r => r.id === option.id)) {
            this.removals.push(option);
          }
        } else {
          if (option.type === 'addon' || optionAny.tipo === 'addon') {
            if (!this.addons.find(a => a.id === option.id)) {
              this.addons.push(option);
            }
          } else if (option.type === 'extra' || optionAny.tipo === 'extra') {
            this.extras.push(option);
          } else if (option.type === 'size' || optionAny.tipo === 'size') {
            this.sizes.push(option);
          } else {
            this.extras.push(option);
          }
        }
        this.selectedOptions.set(String(option.id), false);
      });
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
        let option: ProductOption | undefined;
        option = this.product?.options?.find(opt => String(opt.id) === String(optionId));
        if (!option) {
          option = this.removals.find(opt => String(opt.id) === String(optionId));
        }
        if (!option) {
          option = this.addons.find(opt => String(opt.id) === String(optionId));
        }
        if (!option) {
          option = this.extras.find(opt => String(opt.id) === String(optionId));
        }
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
    if (!this.isLoggedIn || !this.authService.isAuthenticated()) {
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: this.router.url }
      });
      return;
    }
    if (!this.product) return;
    const selectedOptionsList: Array<{ id: string; name: string; price: number }> = [];
    this.selectedOptions.forEach((checked, optionId) => {
      if (checked) {
        let option: ProductOption | undefined;
        option = this.product?.options?.find(opt => String(opt.id) === String(optionId));
        if (!option) {
          option = this.removals.find(opt => String(opt.id) === String(optionId));
        }
        if (!option) {
          option = this.addons.find(opt => String(opt.id) === String(optionId));
        }
        if (!option) {
          option = this.extras.find(opt => String(opt.id) === String(optionId));
        }
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
    this.cartService.addItem({
      productId: this.product.id,
      productName: this.product.name,
      productDescription: this.product.description || '',
      basePrice: this.basePrice,
      selectedOptions: selectedOptionsList,
      quantity: this.quantity,
      imageUrl: this.product.imageUrl
    });
    this.notificationService.showSuccess(
      `${this.product.name} agregado al carrito`,
      '¡Éxito!'
    );
    setTimeout(() => {
      if (this.categoryId) {
        this.router.navigate(['/menu', this.categoryId]);
      } else {
        this.router.navigate(['/menu']);
      }
    }, 1500);
  }

  goBack(): void {
    if (this.categoryId) {
      this.router.navigate(['/menu', this.categoryId]);
    } else {
      this.router.navigate(['/menu']);
    }
  }

  getStars(): number[] {
    return Array(5).fill(0).map((_, i) => i + 1);
  }

  toggleFavorite(): void {
    if (!this.product) return;
    this.isLoggedIn = this.authService.isAuthenticated();
    if (!this.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }

    this.userService.toggleFavorite(this.product.id);
    this.isFavorite$ = this.userService.isFavorite(this.product.id);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    window.removeEventListener('extrasUpdated', this.extrasUpdatedHandler);
  }
}

