export interface ProductOption {
  id: string;
  name: string;
  price: number;
  type: 'addon' | 'size' | 'extra';
}


export interface ProductSupply {
  supplyId: string; // ID del insumo
  quantityRequired: number; // Cantidad de insumo requerida para el producto
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
  supplies?: ProductSupply[]; // Insumos requeridos para este producto
  stockStatus?: 'available' | 'low_stock' | 'out_of_stock'; // Estado del stock basado en insumos
  unavailableSupplies?: string[]; // IDs de insumos que están agotados
}
