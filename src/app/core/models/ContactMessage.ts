
export interface CreateContactMessageDto {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

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

