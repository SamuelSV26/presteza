import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CartService, CartItem } from '../../../core/services/cart.service';
import { Observable } from 'rxjs';
@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css']
})
export class CartComponent implements OnInit {
  cartItems$!: Observable<CartItem[]>;
  totalItems$!: Observable<number>;
  totalPrice$!: Observable<number>;
  showCartDropdown = false;

  constructor(
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cartItems$ = this.cartService.cartItems$;
    this.totalItems$ = this.cartService.getTotalItems();
    this.totalPrice$ = this.cartService.getTotalPrice();
  }

  toggleCart(): void {
    this.showCartDropdown = !this.showCartDropdown;
  }

  removeItem(itemId: string): void {
    this.cartService.removeItem(itemId);
  }

  updateQuantity(itemId: string, quantity: number): void {
    if (quantity < 1) return;
    this.cartService.updateQuantity(itemId, quantity);
  }

  clearCart(): void {
    this.cartService.clearCart();
    this.showCartDropdown = false;
  }

  goToCheckout(): void {
    this.showCartDropdown = false;
    this.router.navigate(['/checkout']);
  }

  trackById(index: number, item: CartItem) {
    return item.id;
  }
}
