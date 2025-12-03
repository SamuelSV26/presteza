import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CreateOrderDto } from '../models/CreateOrderDto';
import { UpdateOrderDto } from '../models/UpdateOrderDto';
import { OrderResponse, OrdersResponse, OrderFromBackend } from '../models/OrderResponse';
import { Order } from '../models/Order';
import { ErrorHandlerService } from './error-handler.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = `${environment.apiUrl}/orders`;

  constructor(
    private http: HttpClient,
    private errorHandler: ErrorHandlerService
  ) { }

  createOrder(createOrderDto: CreateOrderDto): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(this.apiUrl, createOrderDto).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  findAll(): Observable<OrdersResponse> {
    return this.http.get<OrdersResponse>(this.apiUrl).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  findOne(id: string): Observable<OrderResponse> {
    return this.http.get<OrderResponse>(`${this.apiUrl}/${id}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  findByUser(usuarioId: string): Observable<OrdersResponse> {
    return this.http.get<OrdersResponse>(`${this.apiUrl}/user/${usuarioId}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  findByStatus(status: string): Observable<OrdersResponse> {
    return this.http.get<OrdersResponse>(`${this.apiUrl}/status/${status}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  update(id: string, updateOrderDto: UpdateOrderDto): Observable<OrderResponse> {
    return this.http.patch<OrderResponse>(`${this.apiUrl}/${id}`, updateOrderDto).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  /**
   * Actualiza solo el estado de una orden usando el endpoint específico /orders/:id/status
   * @param id ID de la orden
   * @param status Nuevo estado (pendiente, Preparando, listo, entregado, cancelado)
   */
  updateStatus(id: string, status: string): Observable<OrderResponse> {
    return this.http.patch<OrderResponse>(`${this.apiUrl}/${id}/status`, { status }).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  remove(id: string): Observable<OrderResponse> {
    return this.http.delete<OrderResponse>(`${this.apiUrl}/${id}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  mapBackendOrderToFrontend(backendOrder: OrderFromBackend): Order {
    const orderId = backendOrder._id || backendOrder.id || '';
    return {
      id: orderId,
      date: backendOrder.createdAt ? new Date(backendOrder.createdAt) : new Date(),
      items: [],
      total: backendOrder.total,
      status: this.mapBackendStatusToFrontend(backendOrder.status),
      paymentMethod: backendOrder.payment_method,
      trackingCode: orderId.substring(0, 8).toUpperCase(),
    };
  }

  private mapBackendStatusToFrontend(backendStatus: string): Order['status'] {
    const statusMap: Record<string, Order['status']> = {
      'pendiente': 'pending',
      'Preparando': 'preparing',
      'preparando': 'preparing', // Por si viene en minúsculas
      'en_proceso': 'preparing', // Compatibilidad con formato anterior
      'listo': 'ready',
      'Listo': 'ready', // Por si viene con mayúscula
      'completado': 'ready', // Compatibilidad con formato anterior
      'entregado': 'delivered',
      'Entregado': 'delivered', // Por si viene con mayúscula
      'cancelado': 'cancelled',
      'Cancelado': 'cancelled' // Por si viene con mayúscula
    };
    return statusMap[backendStatus] || 'pending';
  }

  mapFrontendStatusToBackend(frontendStatus: Order['status']): CreateOrderDto['status'] {
    const statusMap: Record<Order['status'], CreateOrderDto['status']> = {
      'pending': 'pendiente',
      'preparing': 'en_proceso',
      'ready': 'completado',
      'delivered': 'completado',
      'cancelled': 'cancelado'
    };
    return statusMap[frontendStatus] || 'pendiente';
  }

  /**
   * Mapea el estado del frontend al formato que espera el endpoint /orders/:id/status
   * Estados válidos: pendiente, Preparando, listo, entregado, cancelado
   */
  mapFrontendStatusToStatusEndpoint(frontendStatus: Order['status']): string {
    const statusMap: Record<Order['status'], string> = {
      'pending': 'pendiente',
      'preparing': 'Preparando',
      'ready': 'listo',
      'delivered': 'entregado',
      'cancelled': 'cancelado'
    };
    return statusMap[frontendStatus] || 'pendiente';
  }

  mapPaymentMethodToBackend(paymentMethod: string): string {
    const methodMap: Record<string, string> = {
      'card': 'card',
      'cash': 'cash',
      'nequi': 'nequi',
      'daviplata': 'daviplata',
      'transfer': 'transfer'
    };
    return methodMap[paymentMethod.toLowerCase()] || paymentMethod;
  }
}
