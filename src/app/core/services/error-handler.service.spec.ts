import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { ErrorHandlerService } from './error-handler.service';
import { NotificationService } from './notification.service';
import { take } from 'rxjs/operators';

describe('ErrorHandlerService', () => {
  let service: ErrorHandlerService;
  let notificationService: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    const notificationSpy = jasmine.createSpyObj('NotificationService', ['showError']);

    TestBed.configureTestingModule({
      providers: [
        ErrorHandlerService,
        { provide: NotificationService, useValue: notificationSpy }
      ]
    });

    service = TestBed.inject(ErrorHandlerService);
    notificationService = TestBed.inject(NotificationService) as jasmine.SpyObj<NotificationService>;
  });

  // Prueba 30
  it('should be created and handle HTTP errors', () => {
    expect(service).toBeTruthy();
    
    const errors = [
      { status: 400, message: 'Datos inválidos' },
      { status: 401, message: 'No autorizado. Por favor, inicie sesión.' },
      { status: 403, message: 'Acceso denegado. No tiene permisos para realizar esta acción.' },
      { status: 404, message: 'Recurso no encontrado.' },
      { status: 500, message: 'Error interno del servidor. Por favor, intente más tarde.' },
      { status: 0, message: 'No se pudo conectar con el servidor. Verifique su conexión a internet.' }
    ];

    errors.forEach(({ status, message }) => {
      const error = new HttpErrorResponse({
        status,
        statusText: 'Error',
        error: status === 400 ? { message: 'Datos inválidos' } : undefined
      });
      const appError = service.handleHttpError(error);
      expect(appError.status).toBe(status);
      if (status === 400) {
        expect(appError.message).toBe('Datos inválidos');
      } else {
        expect(appError.message).toBe(message);
      }
    });
  });

  // Prueba 31
  it('should handle client-side and network errors', () => {
    const clientError = new HttpErrorResponse({
      error: new ErrorEvent('Network error', { message: 'Connection failed' })
    });
    const appError1 = service.handleHttpError(clientError);
    expect(appError1.message).toContain('Connection failed');

    const genericError = new Error('Generic error');
    const appError2 = service.handleError(genericError);
    expect(appError2.message).toBe('Generic error');

    const stringError = 'String error';
    const appError3 = service.handleError(stringError);
    expect(appError3.message).toBe('String error');

    const objectError = { message: 'Error with message' };
    const appError4 = service.handleError(objectError);
    expect(appError4.message).toBe('Error with message');
  });

  // Prueba 32
  it('should manage error observable and state', (done) => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { message: 'Test error' }
    });

    const appError = service.handleHttpError(error);
    expect(appError.message).toBe('Test error');
    
    service.error$.pipe(take(1)).subscribe(emittedError => {
      expect(emittedError).toBeTruthy();
      expect(emittedError?.message).toBe('Test error');
      
      const lastError = service.getLastError();
      expect(lastError).toBeTruthy();
      expect(lastError?.message).toBe('Test error');
      
      service.clearError();
      service.error$.pipe(take(1)).subscribe(clearedError => {
        expect(clearedError).toBeNull();
        done();
      });
    });
  });

  // Prueba 33
  it('should handle auth-specific errors', (done) => {
    const error401 = new HttpErrorResponse({
      status: 401,
      error: { message: 'Unauthorized' }
    });

    service.handleErrorToAuth(error401).subscribe({
      error: () => {
        expect(notificationService.showError).toHaveBeenCalledWith('Credenciales inválidas');
        
        const error409 = new HttpErrorResponse({
          status: 409,
          error: { message: 'Conflict' }
        });

        service.handleErrorToAuth(error409).subscribe({
          error: () => {
            expect(notificationService.showError).toHaveBeenCalledWith('El email ya está registrado');
            done();
          }
        });
      }
    });
  });
});

