/**
 * Respuesta del backend al crear/obtener una reserva
 */
export interface ReservationResponse {
  message?: string;
  reservation?: ReservationFromBackend;
}

/**
 * Respuesta del backend al obtener múltiples reservas
 */
export interface ReservationsResponse {
  message?: string;
  reservations?: ReservationFromBackend[];
  count?: number;
}

/**
 * Estructura de reserva que viene del backend (MongoDB)
 */
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

/**
 * Interfaz de reserva para el frontend
 */
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

