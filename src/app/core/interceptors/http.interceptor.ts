import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import { LoadingService } from '../services/loading.service';
import { ErrorHandlerService } from '../services/error-handler.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

/**
 * Interceptor HTTP para manejar peticiones, loading states y errores
 */
export const httpInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const loadingService = inject(LoadingService);
  const errorHandler = inject(ErrorHandlerService);
  const authService = inject(AuthService);
  const router = inject(Router);

  // Iniciar loading solo para peticiones que no sean de verificación
  if (!req.url.includes('check') && !req.url.includes('ping')) {
    loadingService.startLoading();
  }

  // Agregar token JWT a las peticiones (excepto login y register)
  const token = authService.getToken();
  let clonedRequest = req.clone({
    setHeaders: {
      'Content-Type': 'application/json',
    }
  });

  if (token && !req.url.includes('/auth/login') && !req.url.includes('/auth/register')) {
    clonedRequest = req.clone({
      setHeaders: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(clonedRequest).pipe(
    tap({
      next: (event) => {
        // Log de respuestas exitosas (opcional, solo en desarrollo)
        if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
          // Solo loggear en producción si es necesario
        }
      },
      error: (error) => {
        // Manejar errores específicos
        if (error instanceof HttpErrorResponse) {
          const appError = errorHandler.handleHttpError(error);

          // Manejar errores específicos
          if (error.status === 401) {
            // Redirigir al login si no está autenticado
            authService.logout();
            router.navigate(['/']);
          } else if (error.status === 403) {
            // Manejar acceso denegado
            console.warn('Access denied:', appError.message);
          } else if (error.status === 0) {
            // Error de conexión
            console.error('Connection error:', appError.message);
          }
        } else {
          errorHandler.handleError(error);
        }
      }
    }),
    catchError((error: HttpErrorResponse) => {
      return throwError(() => error);
    }),
    finalize(() => {
      // Detener loading al finalizar (éxito o error)
      if (!req.url.includes('check') && !req.url.includes('ping')) {
        loadingService.stopLoading();
      }
    })
  );
};

