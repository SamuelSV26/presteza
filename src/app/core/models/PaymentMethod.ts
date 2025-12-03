export interface PaymentMethod {
  id?: string;
  name?: string;
  cardholder_name: string;
  last_four_digits: string;
  last4?: string;
  type: 'debit' | 'credit' | 'cash';
  brand: string;
  expiry_date: string;
  is_primary?: boolean;
  isDefault?: boolean;
  cardNumber?: string;
  expiryMonth?: string;
  expiryYear?: string;
  cvv?: string;
}
