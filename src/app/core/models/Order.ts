import { OrderItem } from "./OrderItem";

export interface Order {
  id: string;
  date: Date;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  deliveryAddress?: string;
}
