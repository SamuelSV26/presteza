/**
 * DTO para crear un mensaje de contacto
 */
export interface CreateContactMessageDto {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

/**
 * Interfaz de mensaje de contacto desde el backend
 */
export interface ContactMessageFromBackend {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  read?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Interfaz de mensaje de contacto para el frontend
 */
export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  read: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

