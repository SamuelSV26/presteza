export interface Address {
  id?: string; // ID opcional para compatibilidad con frontend
  title?: string; // Compatibilidad con frontend
  name?: string; // Nombre de la dirección (backend)
  address: string;
  neighborhood?: string; // Barrio
  city: string;
  postalCode?: string; // Compatibilidad con frontend
  postal_code?: string; // Código postal (backend)
  isDefault?: boolean; // Compatibilidad con frontend
  is_primary?: boolean; // Marcar como principal (backend)
}

// DTOs para el backend
export interface AddAddressDto {
  name: string;
  address: string;
  neighborhood?: string;
  city: string;
  postal_code: string;
  is_primary?: boolean;
}

export interface UpdateAddressDto {
  name?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  postal_code?: string;
  is_primary?: boolean;
}
