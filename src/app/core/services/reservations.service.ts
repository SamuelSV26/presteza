import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CreateReservationDto } from '../models/CreateReservationDto';
import { UpdateReservationDto } from '../models/UpdateReservationDto';
import { ReservationFromBackend, Reservation } from '../models/ReservationResponse';
import { ErrorHandlerService } from './error-handler.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ReservationsService {
  private apiUrl = `${environment.apiUrl}/reservations`;

  constructor(
    private http: HttpClient,
    private errorHandler: ErrorHandlerService
  ) {}

  create(createReservationDto: CreateReservationDto): Observable<ReservationFromBackend> {
    return this.http.post<ReservationFromBackend>(this.apiUrl, createReservationDto).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  findAll(): Observable<ReservationFromBackend[]> {
    return this.http.get<ReservationFromBackend[]>(this.apiUrl).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  findMyReservations(): Observable<ReservationFromBackend[]> {
    return this.http.get<ReservationFromBackend[]>(`${this.apiUrl}/my-reservations`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  findOne(id: string): Observable<ReservationFromBackend> {
    return this.http.get<ReservationFromBackend>(`${this.apiUrl}/${id}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  update(id: string, updateReservationDto: UpdateReservationDto): Observable<ReservationFromBackend> {
    return this.http.patch<ReservationFromBackend>(`${this.apiUrl}/${id}`, updateReservationDto).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  updateStatus(id: string, status: 'pending' | 'confirmed' | 'cancelled' | 'completed'): Observable<ReservationFromBackend> {
    return this.http.patch<ReservationFromBackend>(`${this.apiUrl}/${id}/status`, { status }).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  /**
   * Convierte una reserva del backend al formato del frontend
   */
  mapBackendReservationToFrontend(backendReservation: ReservationFromBackend): Reservation {
    const reservationId = backendReservation._id || backendReservation.id || '';
    return {
      id: reservationId,
      tableNumber: backendReservation.tableNumber,
      date: backendReservation.date,
      time: backendReservation.time,
      numberOfPeople: backendReservation.numberOfPeople,
      specialRequests: backendReservation.specialRequests,
      userId: backendReservation.userId,
      userName: backendReservation.userName,
      userEmail: backendReservation.userEmail,
      status: backendReservation.status,
      createdAt: backendReservation.createdAt ? new Date(backendReservation.createdAt) : undefined,
      updatedAt: backendReservation.updatedAt ? new Date(backendReservation.updatedAt) : undefined,
    };
  }
}

