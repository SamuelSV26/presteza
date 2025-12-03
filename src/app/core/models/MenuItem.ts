export interface ProductOption {
  id: string;
  name: string;
  price: number;
  type: 'addon' | 'size' | 'extra';
}

export interface ProductSupply {
  supplyId: string;
  quantityRequired: number;
}

export interface MenuItem {
  id: number | string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  available: boolean;
  categoryId: string;
  options?: ProductOption[];
  supplies?: ProductSupply[];
  stockStatus?: 'available' | 'low_stock' | 'out_of_stock';
  unavailableSupplies?: string[];
}
