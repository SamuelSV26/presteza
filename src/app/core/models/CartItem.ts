export interface CartItemOption {
  id: string;
  name: string;
  price: number;
  type?: 'addon' | 'size' | 'extra' | 'removal';
}

export interface CartItem {
  id: string;
  productId: number | string; 
  productName: string;
  productDescription: string;
  basePrice: number;
  selectedOptions: CartItemOption[];
  quantity: number;
  totalPrice: number;
  imageUrl?: string;
}
