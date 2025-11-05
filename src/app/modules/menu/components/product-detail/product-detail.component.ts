import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MenuService, MenuItem, ProductOption } from '../../../../core/services/menu.service';
import { UserService } from '../../../../core/services/user.service';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Observable } from 'rxjs';

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
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    const productId = this.route.snapshot.paramMap.get('id');
    if (productId) {
      this.menuService.getItemById(+productId).subscribe({
        next: (item) => {
          if (item) {
            this.product = item;
            this.basePrice = item.price;
            this.totalPrice = item.price;
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
    
    // Escuchar cuando el usuario inicie sesión
    window.addEventListener('userLoggedIn', () => {
      this.isLoggedIn = this.authService.isAuthenticated();
      if (this.product && this.isLoggedIn) {
        this.isFavorite$ = this.userService.isFavorite(this.product.id);
      }
    });
  }

  organizeOptions(): void {
    if (!this.product?.options) return;
    
    // Limpiar arrays antes de organizar
    this.addons = [];
    this.extras = [];
    this.sizes = [];
    this.removals = [];
    
    this.product.options.forEach(option => {
      // Primero verificar si es una opción de eliminación (sin algo)
      if (option.name.toLowerCase().includes('sin')) {
        this.removals.push(option);
      } else {
        // Solo agregar a otras categorías si NO es una eliminación
        if (option.type === 'addon') {
          this.addons.push(option);
        } else if (option.type === 'extra') {
          this.extras.push(option);
        } else if (option.type === 'size') {
          this.sizes.push(option);
        }
      }
      
      this.selectedOptions.set(option.id, false);
    });
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
        const option = this.product?.options?.find(opt => opt.id === optionId);
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
    if (!this.product) return;
    
    const selectedOptionsList: ProductOption[] = [];
    this.selectedOptions.forEach((checked, optionId) => {
      if (checked) {
        const option = this.product?.options?.find(opt => opt.id === optionId);
        if (option) {
          selectedOptionsList.push(option);
        }
      }
    });

    console.log('Producto agregado al carrito:', {
      product: this.product,
      quantity: this.quantity,
      selectedOptions: selectedOptionsList,
      totalPrice: this.totalPrice
    });

    // Aquí iría la lógica para agregar al carrito
    this.notificationService.showSuccess('Producto agregado al carrito', '¡Éxito!');
    setTimeout(() => {
      this.router.navigate(['/menu']);
    }, 1000);
  }

  goBack(): void {
    this.router.navigate(['/menu']);
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

