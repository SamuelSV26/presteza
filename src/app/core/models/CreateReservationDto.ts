
export interface CreateReservationDto {
  tableNumber: string;
  date: string;
  time: string;
  numberOfPeople: number;
  specialRequests?: string;
}

