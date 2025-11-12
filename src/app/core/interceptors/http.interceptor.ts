import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import { LoadingService } from '../services/loading.service';
import { ErrorHandlerService } from '../services/error-handler.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

export const httpInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const loadingService = inject(LoadingService);
  const errorHandler = inject(ErrorHandlerService);
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!req.url.includes('check') && !req.url.includes('ping')) {
    loadingService.startLoading();
  }

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
      next: () => {},
      error: (error) => {
        if (error instanceof HttpErrorResponse) {
          const appError = errorHandler.handleHttpError(error);
          if (error.status === 401) {
            const isAuthRequest = req.url.includes('/auth/login') || req.url.includes('/auth/register');
            if (!isAuthRequest) {
              authService.logout();
              router.navigate(['/']);
            }
          } else if (error.status === 403) {
            console.warn('Access denied:', appError.message);
          } else if (error.status === 0) {
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
      if (!req.url.includes('check') && !req.url.includes('ping')) {
        loadingService.stopLoading();
      }
    })
  );
};
