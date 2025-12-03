
export interface ReservationResponse {
  message?: string;
  reservation?: ReservationFromBackend;
}

export interface ReservationsResponse {
  message?: string;
  reservations?: ReservationFromBackend[];
  count?: number;
}

export interface ReservationFromBackend {
  _id?: string;
  id?: string;
  tableNumber: string;
  date: string;
  time: string;
  numberOfPeople: number;
  specialRequests?: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  createdAt?: string;
  updatedAt?: string;
}

export interface Reservation {
  id: string;
  tableNumber: string;
  date: string;
  time: string;
  numberOfPeople: number;
  specialRequests?: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  createdAt?: Date;
  updatedAt?: Date;
}

