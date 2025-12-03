import { OrderItem } from "./OrderItem";

export interface OrderStatusHistory {
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  timestamp: Date;
  message?: string;
}

export interface Order {
  id: string;
  date: Date;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  deliveryAddress?: string;
  // Propiedades adicionales
  trackingCode?: string;
  estimatedDeliveryTime?: Date | string;
  estimatedPrepTime?: number;
  canCancel?: boolean;
  statusHistory?: OrderStatusHistory[];
  orderType?: 'pickup' | 'delivery';
  deliveryNeighborhood?: string;
  deliveryPhone?: string;
  deliveryInstructions?: string;
  paymentMethod?: string;
  paymentInfo?: any; // Información adicional del pago (puede variar según el método)
  subtotal?: number;
  additionalFees?: number;
  userName?: string; // Nombre del usuario que hizo el pedido
  statusChangedByAdmin?: boolean; // Indica si el estado fue cambiado por el admin (para completar la barra de progreso)
  lastStatusChangeTime?: Date; // Fecha del último cambio de estado
}
