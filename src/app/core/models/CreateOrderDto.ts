export interface AddOrderItem {
  addId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface ProductOrderItem {
  dishId: string;
  name: string;
  quantity: number;
  unit_price: number;
  description: string;
  adds?: AddOrderItem[];
}

export interface CreateOrderDto {
  usuarioId: string;
  total: number;
  payment_method: string;
  products: ProductOrderItem[];
  status: 'pendiente' | 'en_proceso' | 'completado' | 'cancelado';
  user_name: string;
}
