import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CartService} from '../../../core/services/cart.service';
import { Observable } from 'rxjs';
import { CartItem } from '../../../core/models/CartItem';

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

  constructor(private cartService: CartService) {}

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

  trackById(index: number, item: CartItem) {
    return item.id;
  }
}
