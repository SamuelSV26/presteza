export interface Address {
  id: string;
  title: string;
  address: string;
  neighborhood?: string; // Barrio
  city: string;
  postalCode: string;
  isDefault: boolean;
}
