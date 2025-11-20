/**
 * DTO para crear una reserva - debe coincidir con el backend
 */
export interface CreateReservationDto {
  tableNumber: string; // T1, T2, T27, etc.
  date: string; // Fecha en formato DD/MM/YYYY
  time: string; // Hora en formato HH:mm a. m./p. m.
  numberOfPeople: number; // Número de personas
  specialRequests?: string; // Solicitudes especiales (opcional)
}

