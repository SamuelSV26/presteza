import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CreateOrderDto } from '../models/CreateOrderDto';
import { UpdateOrderDto } from '../models/UpdateOrderDto';
import { OrderResponse, OrdersResponse, OrderFromBackend } from '../models/OrderResponse';
import { Order } from '../models/Order';
import { ErrorHandlerService } from './error-handler.service';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = 'http://localhost:4000/orders';

  constructor(
    private http: HttpClient,
    private errorHandler: ErrorHandlerService
  ) {}

  /**
   * Crear una nueva orden
   */
  createOrder(createOrderDto: CreateOrderDto): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(this.apiUrl, createOrderDto).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        console.error('Error al crear la orden:', appError);
        return throwError(() => appError);
      })
    );
  }

  /**
   * Obtener todas las órdenes
   */
  findAll(): Observable<OrdersResponse> {
    return this.http.get<OrdersResponse>(this.apiUrl).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        console.error('Error al obtener las órdenes:', appError);
        return throwError(() => appError);
      })
    );
  }

  /**
   * Obtener una orden por ID
   */
  findOne(id: string): Observable<OrderResponse> {
    return this.http.get<OrderResponse>(`${this.apiUrl}/${id}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        console.error('Error al obtener la orden:', appError);
        return throwError(() => appError);
      })
    );
  }

  /**
   * Obtener órdenes por usuario
   */
  findByUser(usuarioId: string): Observable<OrdersResponse> {
    return this.http.get<OrdersResponse>(`${this.apiUrl}/user/${usuarioId}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        console.error('Error al obtener las órdenes del usuario:', appError);
        return throwError(() => appError);
      })
    );
  }

  /**
   * Obtener órdenes por estado
   */
  findByStatus(status: string): Observable<OrdersResponse> {
    return this.http.get<OrdersResponse>(`${this.apiUrl}/status/${status}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        console.error('Error al obtener las órdenes por estado:', appError);
        return throwError(() => appError);
      })
    );
  }

  /**
   * Actualizar una orden
   */
  update(id: string, updateOrderDto: UpdateOrderDto): Observable<OrderResponse> {
    return this.http.patch<OrderResponse>(`${this.apiUrl}/${id}`, updateOrderDto).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        console.error('Error al actualizar la orden:', appError);
        return throwError(() => appError);
      })
    );
  }

  /**
   * Eliminar una orden
   */
  remove(id: string): Observable<OrderResponse> {
    return this.http.delete<OrderResponse>(`${this.apiUrl}/${id}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        console.error('Error al eliminar la orden:', appError);
        return throwError(() => appError);
      })
    );
  }

  /**
   * Mapear OrderFromBackend a Order (formato del frontend)
   */
  mapBackendOrderToFrontend(backendOrder: OrderFromBackend): Order {
    const orderId = backendOrder._id || backendOrder.id || '';
    
    return {
      id: orderId,
      date: backendOrder.createdAt ? new Date(backendOrder.createdAt) : new Date(),
      items: [], // Los items se mapearían desde los products si es necesario
      total: backendOrder.total,
      status: this.mapBackendStatusToFrontend(backendOrder.status),
      paymentMethod: backendOrder.payment_method,
      // Campos adicionales
      trackingCode: orderId.substring(0, 8).toUpperCase(),
    };
  }

  /**
   * Mapear status del backend al formato del frontend
   */
  private mapBackendStatusToFrontend(backendStatus: string): Order['status'] {
    const statusMap: Record<string, Order['status']> = {
      'pendiente': 'pending',
      'en_proceso': 'preparing',
      'completado': 'ready',
      'entregado': 'delivered',
      'cancelado': 'cancelled'
    };
    
    return statusMap[backendStatus] || 'pending';
  }

  /**
   * Mapear status del frontend al formato del backend
   */
  mapFrontendStatusToBackend(frontendStatus: Order['status']): CreateOrderDto['status'] {
    const statusMap: Record<Order['status'], CreateOrderDto['status']> = {
      'pending': 'pendiente',
      'preparing': 'en_proceso',
      'ready': 'completado',
      'delivered': 'entregado',
      'cancelled': 'cancelado'
    };
    
    return statusMap[frontendStatus] || 'pendiente';
  }

  /**
   * Mapear payment method del frontend al formato del backend
   */
  mapPaymentMethodToBackend(paymentMethod: string): string {
    // El backend espera los mismos valores, pero podemos normalizar aquí
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

