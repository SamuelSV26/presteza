export interface PaymentMethod {
  id?: string; // ID opcional para compatibilidad
  name?: string; // Nombre de la tarjeta (opcional)
  cardholder_name: string; // Nombre del titular
  last_four_digits: string; // Últimos 4 dígitos
  last4?: string; // Alias para compatibilidad con código existente
  type: 'debit' | 'credit' | 'cash'; // Tipo de tarjeta o efectivo
  brand: string; // Marca: visa, mastercard, amex, etc.
  expiry_date: string; // Fecha de expiración en formato MM/YY
  is_primary?: boolean; // Si es la tarjeta principal
  isDefault?: boolean; // Alias para compatibilidad con código existente
  // Campos adicionales para el formulario (no se envían al backend)
  cardNumber?: string; // Número completo (solo en formulario)
  expiryMonth?: string; // Mes de expiración (solo en formulario)
  expiryYear?: string; // Año de expiración (solo en formulario)
  cvv?: string; // CVV (solo en formulario, no se guarda)
}
