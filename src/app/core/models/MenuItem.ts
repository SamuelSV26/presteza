export interface ProductOption {
  id: string;
  name: string;
  price: number;
  type: 'addon' | 'size' | 'extra';
}


export interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  available: boolean;
  categoryId: string;
  options?: ProductOption[];
}
