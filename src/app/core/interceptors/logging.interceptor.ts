import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

/**
 * Interceptor para logging de peticiones HTTP (útil para debugging)
 */
export const loggingInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const startTime = Date.now();

  // Solo loggear en desarrollo
  const isDevelopment = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (isDevelopment) {
    console.group(`🔵 HTTP ${req.method} ${req.url}`);
    console.log('Headers:', req.headers.keys());
    if (req.body) {
      console.log('Body:', req.body);
    }
  }

  return next(req).pipe(
    tap({
      next: (event) => {
        if (isDevelopment && event.type === 4) { // HttpResponse
          const duration = Date.now() - startTime;
          console.log(`✅ Response received in ${duration}ms`);
          console.groupEnd();
        }
      },
      error: (error) => {
        if (isDevelopment) {
          const duration = Date.now() - startTime;
          console.error(`❌ Error after ${duration}ms:`, error);
          console.groupEnd();
        }
      }
    })
  );
};

