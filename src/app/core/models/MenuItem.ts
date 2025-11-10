export interface ProductOption {
  id: string;
  name: string;
  price: number;
  type: 'addon' | 'size' | 'extra';
}


export interface MenuItem {
  id: number | string; // Puede ser número (datos locales) o string (MongoDB ObjectId)
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  available: boolean;
  categoryId: string;
  options?: ProductOption[];
}
