/**
 * DTO para crear una orden - debe coincidir con el backend
 */
export interface ProductOrderItem {
  id: string;
  quantity: number;
}

export interface CreateOrderDto {
  usuarioId: string;
  total: number;
  payment_method: string;
  products: ProductOrderItem[];
  status: 'pendiente' | 'en_proceso' | 'completado' | 'entregado' | 'cancelado';
  user_name: string;
}

