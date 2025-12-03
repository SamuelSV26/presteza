import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../../../../core/services/user.service';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { CartService } from '../../../../core/services/cart.service';
import { Observable, Subject } from 'rxjs';
import { MenuItem, ProductOption } from '../../../../core/models/MenuItem';
import { MenuService } from '../../../../core/services/menu.service';
import { AddsService, Add } from '../../../../core/services/adds.service';
import { Meta, Title } from '@angular/platform-browser';

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
  selectedOptions = new Map<string, boolean>();
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
  isFavorite$ = new Observable<boolean>();
  isLoggedIn = false;
  private addsUpdatedHandler = () => {
    setTimeout(() => {
      if (this.product && this.categoryId) {
        this.loadAddsFromBackend();
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
    private addsService: AddsService,
    private title: Title,
    private meta: Meta
  ) {
    this.title.setTitle('Detalle del Producto - PRESTEZA');
    this.meta.updateTag({ name: 'description', content: 'Detalles del producto en PRESTEZA. Personaliza tu pedido con opciones y adicionales.' });
  }

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isAuthenticated();
    this.authService.userInfo$.subscribe(() => {
      this.isLoggedIn = this.authService.isAuthenticated();
    });

    window.addEventListener('addsUpdated', this.addsUpdatedHandler);
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
            if (this.categoryId) {
              this.loadAddsFromBackend();
            }
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
    const selectedOptionsList: { id: string; name: string; price: number; type?: 'addon' | 'size' | 'extra' | 'removal' }[] = [];
    this.selectedOptions.forEach((checked, optionId) => {
      if (checked) {
        let option: ProductOption | undefined;
        let optionType: 'addon' | 'size' | 'extra' | 'removal' | undefined;

        option = this.removals.find(opt => String(opt.id) === String(optionId));
        if (option) {
          optionType = 'removal';
        } else {
          option = this.addons.find(opt => String(opt.id) === String(optionId));
          if (option) {
            optionType = 'addon';
          } else {
            option = this.extras.find(opt => String(opt.id) === String(optionId));
            if (option) {
              optionType = 'extra';
            } else {
              option = this.sizes.find(opt => String(opt.id) === String(optionId));
              if (option) {
                optionType = 'size';
              } else {
                option = this.product?.options?.find(opt => String(opt.id) === String(optionId));
                if (option) {
                  optionType = option.type || 'extra';
                }
              }
            }
          }
        }

        if (option) {
          selectedOptionsList.push({
            id: String(option.id),
            name: option.name,
            price: option.price || 0,
            type: optionType
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

    const productId = this.product.id;

    this.userService.toggleFavorite(productId).subscribe({
      next: () => {
        if (this.product) {
          this.isFavorite$ = this.userService.isFavorite(productId);
        }
      },
      error: (error) => {
        console.error('Error al alternar favorito:', error);
        if (this.product) {
          this.isFavorite$ = this.userService.isFavorite(productId);
        }
      }
    });
  }

  loadAddsFromBackend(): void {
    if (!this.categoryId || !this.product) {
      return;
    }

    const productIdStr = String(this.product.id);

    this.addsService.findAvailable().subscribe({
      next: (allAdds: Add[]) => {
        const backendAddons: ProductOption[] = [];
        const addedIds = new Set<string>();

        allAdds.forEach(add => {
          if (!add.available) {
            return;
          }

          let shouldInclude = false;

          if (add.dishIds && add.dishIds.length > 0) {
            shouldInclude = add.dishIds.includes(productIdStr);
          } else {
            shouldInclude = !!(add.categoryIds && this.categoryId && add.categoryIds.includes(this.categoryId));
          }

          if (!shouldInclude) {
            return;
          }

          const addId = add._id || add.id;
          if (!addId) {
            console.warn(`Adicional "${add.name}" no tiene ID válido`);
            return;
          }

          if (addedIds.has(addId)) {
            return;
          }
          addedIds.add(addId);

          const addonOption: ProductOption = {
            id: addId,
            name: add.name,
            price: add.price,
            type: 'addon'
          };

          backendAddons.push(addonOption);
          this.selectedOptions.set(addonOption.id, false);
        });

        this.addons = backendAddons;

        this.calculateTotal();
      },
      error: (error) => {
        console.error('Error al cargar adicionales desde el backend:', error);
        this.addons = [];
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    window.removeEventListener('addsUpdated', this.addsUpdatedHandler);
  }
}
