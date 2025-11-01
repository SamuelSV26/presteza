import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuItem, ProductOption } from '../../../core/services/menu.service';
import { CartService, CartItemOption } from '../../../core/services/cart.service';

interface SelectedOption {
  option: ProductOption;
  selected: boolean;
}

@Component({
  selector: 'app-product-customization-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-customization-modal.component.html',
  styleUrl: './product-customization-modal.component.css'
})
export class ProductCustomizationModalComponent implements OnInit {
  @Input() product!: MenuItem;
  @Output() close = new EventEmitter<void>();
  @Output() productAdded = new EventEmitter<void>();

  selectedOptions: SelectedOption[] = [];
  quantity: number = 1;
  totalPrice: number = 0;
  hasSelectedOptions: boolean = false;

  constructor(private cartService: CartService) {}

  ngOnInit(): void {
    if (this.product.options) {
      this.selectedOptions = this.product.options.map(option => ({
        option,
        selected: false
      }));
    }
    this.calculateTotalPrice();
  }

  toggleOption(selectedOption: SelectedOption): void {
    selectedOption.selected = !selectedOption.selected;
    this.updateHasSelectedOptions();
    this.calculateTotalPrice();
  }

  updateHasSelectedOptions(): void {
    this.hasSelectedOptions = this.selectedOptions.some(so => so.selected);
  }

  updateQuantity(change: number): void {
    this.quantity = Math.max(1, this.quantity + change);
    this.calculateTotalPrice();
  }

  calculateTotalPrice(): void {
    const basePrice = this.product.price;
    const optionsPrice = this.getSelectedOptionsPrice();

    this.totalPrice = (basePrice + optionsPrice) * this.quantity;
  }

  getSelectedOptionsPrice(): number {
    return this.selectedOptions
      .filter(so => so.selected)
      .reduce((sum, so) => sum + so.option.price, 0);
  }

  addToCart(): void {
    const cartOptions: CartItemOption[] = this.selectedOptions
      .filter(so => so.selected)
      .map(so => ({
        id: so.option.id,
        name: so.option.name,
        price: so.option.price
      }));

    this.cartService.addItem({
      productId: this.product.id,
      productName: this.product.name,
      productDescription: this.product.description,
      basePrice: this.product.price,
      selectedOptions: cartOptions,
      quantity: this.quantity,
      imageUrl: this.product.imageUrl
    });

    this.productAdded.emit();
  }

  closeModal(): void {
    this.close.emit();
  }
}
