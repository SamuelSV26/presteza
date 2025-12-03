import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { NotificationService } from './notification.service';
import { environment } from '../../../environments/environment';
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
  constructor(private notificationService: NotificationService) {}
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
          if (error.error?.message) {
            errorMessage = error.error.message;
          } else if (error.error?.error) {
            errorMessage = error.error.error;
          } else if (typeof error.error === 'string') {
            errorMessage = error.error;
          } else {
            errorMessage = 'Solicitud incorrecta. Por favor, verifique los datos enviados.';
          }
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

  public handleErrorToAuth(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Ocurrió un error';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      if (error.status === 0) {
        errorMessage = `No se pudo conectar con el servidor. Por favor, verifica que el servidor backend esté corriendo en ${environment.apiUrl}`;
        this.notificationService.showError(errorMessage);
      } else {
        switch (error.status) {
          case 401:
            errorMessage = 'Credenciales inválidas';
            this.notificationService.showError(errorMessage);
            break;
          case 409:
            errorMessage = 'El email ya está registrado';
            this.notificationService.showError(errorMessage);
            break;
          case 400:
            errorMessage = error.error?.message || 
                          error.error?.error?.message || 
                          (Array.isArray(error.error?.message) ? error.error.message.join(', ') : error.error?.message) ||
                          'Datos inválidos';
            this.notificationService.showError(errorMessage);
            break;
          case 404:
            errorMessage = error.error?.message || 'Recurso no encontrado';
            this.notificationService.showError(errorMessage);
            break;
          default:
            errorMessage = error.error?.message || 
                          `Error ${error.status}: ${error.statusText || 'Error desconocido'}`;
            this.notificationService.showError(errorMessage);
        }
      }
    }
    const customError: any = new Error(errorMessage);
    customError.originalError = error;
    customError.error = error.error;
    return throwError(() => customError);
  };
}
