export interface Supply {
  _id?: string;
  id?: string;
  name: string;
  description: string;
  unit_price: number;
  quantity: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSupplyDto {
  name: string;
  description: string;
  unit_price: number;
  quantity: number;
}

export interface UpdateSupplyDto {
  name?: string;
  description?: string;
  unit_price?: number;
  quantity?: number;
}

export interface SupplyResponse {
  message: string;
  supply: Supply;
}

export interface SuppliesListResponse {
  message: string;
  supplies: Supply[];
  count: number;
  filter?: {
    quantity?: number;
    operator?: 'eq' | 'lt' | 'lte' | 'gt' | 'gte';
    quantityMin?: number;
    quantityMax?: number;
    query?: any;
  };
}

