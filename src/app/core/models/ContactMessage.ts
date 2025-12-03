
export interface CreateContactMessageDto {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

export interface CreateCommentDto {
  user_name: string;
  user_email: string;
  user_phone: string;
  user_title: string;
  user_comment: string;
}

export interface CommentFromBackend {
  _id?: string;
  id?: string;
  user_name: string;
  user_email: string;
  user_phone: string;
  user_title: string;
  user_comment: string;
  createdAt?: string;
  updatedAt?: string;
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

