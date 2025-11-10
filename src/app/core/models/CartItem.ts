export interface CartItemOption {
  id: string;
  name: string;
  price: number;
}


export interface CartItem {
  id: string;
  productId: number | string; // Puede ser número (datos locales) o string (MongoDB ObjectId)
  productName: string;
  productDescription: string;
  basePrice: number;
  selectedOptions: CartItemOption[];
  quantity: number;
  totalPrice: number;
  imageUrl?: string;
}
