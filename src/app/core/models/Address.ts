export interface Address {
  id?: string;
  title?: string;
  name?: string;
  address: string;
  neighborhood?: string;
  city: string;
  postalCode?: string;
  postal_code?: string;
  isDefault?: boolean;
  is_primary?: boolean;
}

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
