export interface CartItemOption {
  id: string;
  name: string;
  price: number;
}


export interface CartItem {
  id: string;
  productId: number;
  productName: string;
  productDescription: string;
  basePrice: number;
  selectedOptions: CartItemOption[];
  quantity: number;
  totalPrice: number;
  imageUrl?: string;
}
