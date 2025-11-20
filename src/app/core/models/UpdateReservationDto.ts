/**
 * DTO para actualizar una reserva - campos opcionales
 */
export interface UpdateReservationDto {
  tableNumber?: string;
  date?: string;
  time?: string;
  numberOfPeople?: number;
  specialRequests?: string;
  status?: 'pending' | 'confirmed' | 'cancelled' | 'completed';
}

