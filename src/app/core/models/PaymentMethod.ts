export interface PaymentMethod {
  id: string;
  type: 'card' | 'cash';
  last4?: string;
  brand?: string;
  isDefault: boolean;
}
