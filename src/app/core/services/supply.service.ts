import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CreateSupplyDto, UpdateSupplyDto, SupplyResponse, SuppliesListResponse, Supply } from '../models/Supply';
import { ErrorHandlerService } from './error-handler.service';

@Injectable({
  providedIn: 'root'
})
export class SupplyService {
  private apiUrl = 'http://localhost:4000/supplies';

  constructor(
    private http: HttpClient,
    private errorHandler: ErrorHandlerService
  ) {}

  create(createSupplyDto: CreateSupplyDto): Observable<SupplyResponse> {
    return this.http.post<SupplyResponse>(this.apiUrl, createSupplyDto).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        console.error('Error al crear el insumo:', appError);
        return throwError(() => appError);
      })
    );
  }

  findAll(
    quantity?: number,
    operator?: 'eq' | 'lt' | 'lte' | 'gt' | 'gte',
    quantityMin?: number,
    quantityMax?: number
  ): Observable<SuppliesListResponse> {
    let params = new HttpParams();
    
    if (quantity !== undefined) {
      params = params.set('quantity', quantity.toString());
    }
    if (operator) {
      params = params.set('operator', operator);
    }
    if (quantityMin !== undefined) {
      params = params.set('quantityMin', quantityMin.toString());
    }
    if (quantityMax !== undefined) {
      params = params.set('quantityMax', quantityMax.toString());
    }

    return this.http.get<SuppliesListResponse>(this.apiUrl, { params }).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        console.error('Error al obtener los insumos:', appError);
        return throwError(() => appError);
      })
    );
  }

  findOne(id: string): Observable<SupplyResponse> {
    return this.http.get<SupplyResponse>(`${this.apiUrl}/${id}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        console.error('Error al obtener el insumo:', appError);
        return throwError(() => appError);
      })
    );
  }

  update(id: string, updateSupplyDto: UpdateSupplyDto): Observable<SupplyResponse> {
    return this.http.patch<SupplyResponse>(`${this.apiUrl}/${id}`, updateSupplyDto).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        console.error('Error al actualizar el insumo:', appError);
        return throwError(() => appError);
      })
    );
  }

  remove(id: string): Observable<SupplyResponse> {
    return this.http.delete<SupplyResponse>(`${this.apiUrl}/${id}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        console.error('Error al eliminar el insumo:', appError);
        return throwError(() => appError);
      })
    );
  }

  filterByQuantity(
    quantity?: number,
    operator?: 'eq' | 'lt' | 'lte' | 'gt' | 'gte',
    quantityMin?: number,
    quantityMax?: number
  ): Observable<SuppliesListResponse> {
    let params = new HttpParams();
    
    if (quantity !== undefined) {
      params = params.set('quantity', quantity.toString());
    }
    if (operator) {
      params = params.set('operator', operator);
    }
    if (quantityMin !== undefined) {
      params = params.set('quantityMin', quantityMin.toString());
    }
    if (quantityMax !== undefined) {
      params = params.set('quantityMax', quantityMax.toString());
    }

    return this.http.get<SuppliesListResponse>(`${this.apiUrl}/filter/quantity`, { params }).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        console.error('Error al filtrar los insumos por cantidad:', appError);
        return throwError(() => appError);
      })
    );
  }

  /**
   * Obtener insumos con stock bajo (menos de un umbral)
   */
  getLowStock(threshold: number = 10): Observable<SuppliesListResponse> {
    return this.filterByQuantity(threshold, 'lt');
  }

  /**
   * Obtener insumos agotados (cantidad = 0)
   */
  getOutOfStock(): Observable<SuppliesListResponse> {
    return this.filterByQuantity(0, 'eq');
  }
}

