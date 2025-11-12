import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';

export interface AppError {
  message: string;
  code?: string;
  status?: number;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService {
  private errorSubject = new BehaviorSubject<AppError | null>(null);
  error$ = this.errorSubject.asObservable();

  handleHttpError(error: HttpErrorResponse): AppError {
    let errorMessage = 'Ha ocurrido un error inesperado';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      switch (error.status) {
        case 0:
          errorMessage = 'No se pudo conectar con el servidor. Verifique su conexión a internet.';
          break;
        case 400:
          errorMessage = 'Solicitud incorrecta. Por favor, verifique los datos enviados.';
          break;
        case 401:
          errorMessage = 'No autorizado. Por favor, inicie sesión.';
          break;
        case 403:
          errorMessage = 'Acceso denegado. No tiene permisos para realizar esta acción.';
          break;
        case 404:
          errorMessage = 'Recurso no encontrado.';
          break;
        case 500:
          errorMessage = 'Error interno del servidor. Por favor, intente más tarde.';
          break;
        case 503:
          errorMessage = 'Servicio no disponible temporalmente. Por favor, intente más tarde.';
          break;
        default:
          errorMessage = error.error?.message || `Error ${error.status}: ${error.statusText}`;
      }
    }
    const appError: AppError = {
      message: errorMessage,
      code: error.error?.code,
      status: error.status,
      timestamp: new Date()
    };
    this.errorSubject.next(appError);
    return appError;
  }

  handleError(error: any): AppError {
    let errorMessage = 'Ha ocurrido un error inesperado';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error?.message) {
      errorMessage = error.message;
    }
    const appError: AppError = {
      message: errorMessage,
      timestamp: new Date()
    };
    this.errorSubject.next(appError);
    return appError;
  }

  clearError(): void {
    this.errorSubject.next(null);
  }

  getLastError(): AppError | null {
    return this.errorSubject.value;
  }
}
