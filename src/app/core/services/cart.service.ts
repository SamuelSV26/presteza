import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CartItem, CartItemOption } from '../models/CartItem';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
  public cartItems$ = this.cartItemsSubject.asObservable();

  private get cartItems(): CartItem[] {
    return this.cartItemsSubject.value;
  }

  addItem(item: Omit<CartItem, 'id' | 'totalPrice'>): void {
    const id = `${item.productId}-${Date.now()}-${Math.random()}`;
    const totalPrice = this.calculateTotalPrice(item.basePrice, item.selectedOptions) * item.quantity;
    const cartItem: CartItem = {
      ...item,
      id,
      totalPrice
    };
    const currentItems = this.cartItems;
    currentItems.push(cartItem);
    this.cartItemsSubject.next([...currentItems]);
  }

  removeItem(itemId: string): void {
    const currentItems = this.cartItems.filter(item => item.id !== itemId);
    this.cartItemsSubject.next([...currentItems]);
  }

  updateQuantity(itemId: string, quantity: number): void {
    const currentItems = this.cartItems.map(item => {
      if (item.id === itemId) {
        const newQuantity = Math.max(1, quantity);
        const totalPrice = this.calculateTotalPrice(item.basePrice, item.selectedOptions) * newQuantity;
        return { ...item, quantity: newQuantity, totalPrice };
      }
      return item;
    });
    this.cartItemsSubject.next([...currentItems]);
  }

  getTotalItems(): Observable<number> {
    return new Observable(observer => {
      this.cartItems$.subscribe(items => {
        const total = items.reduce((sum, item) => sum + item.quantity, 0);
        observer.next(total);
      });
    });
  }

  getTotalPrice(): Observable<number> {
    return new Observable(observer => {
      this.cartItems$.subscribe(items => {
        const total = items.reduce((sum, item) => sum + item.totalPrice, 0);
        observer.next(total);
      });
    });
  }

  clearCart(): void {
    this.cartItemsSubject.next([]);
  }

  private calculateTotalPrice(basePrice: number, options: CartItemOption[]): number {
    const optionsPrice = options.reduce((sum, option) => sum + option.price, 0);
    return basePrice + optionsPrice;
  }
}

export { CartItem };
