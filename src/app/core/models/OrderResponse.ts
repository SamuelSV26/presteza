import { CreateOrderDto, ProductOrderItem } from './CreateOrderDto';

export interface OrderResponse {
  message: string;
  order: OrderFromBackend;
}

export interface OrdersResponse {
  message: string;
  orders: OrderFromBackend[];
  count: number;
  usuarioId?: string;
  status?: string;
}

export interface OrderFromBackend {
  _id?: string;
  id?: string;
  usuarioId: string;
  total: number;
  payment_method: string;
  products: ProductOrderItem[] | string[]; // Puede ser array de ProductOrderItem o array de IDs (legacy)
  status: 'pendiente' | 'en_proceso' | 'completado' | 'cancelado';
  user_name: string;
  createdAt?: string;
  updatedAt?: string;
}

