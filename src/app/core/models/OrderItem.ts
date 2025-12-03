export interface OrderItemOption {
  id: string;
  name: string;
  price: number;
  type?: 'addon' | 'size' | 'extra';
}

export interface OrderItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
  selectedOptions?: OrderItemOption[];
  notes?: string;
  unavailable?: boolean;
  unavailableReason?: string;
  replacedWith?: number;
}
