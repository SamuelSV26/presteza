/**
 * DTO para crear una orden - debe coincidir con el backend
 */
export interface CreateOrderDto {
  usuarioId: string;
  total: number;
  payment_method: string;
  products: string[];
  status: 'pendiente' | 'en_proceso' | 'completado' | 'entregado' | 'cancelado';
  user_name: string;
}

