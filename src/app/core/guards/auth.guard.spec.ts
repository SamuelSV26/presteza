import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { TokenService } from '../services/token.service';

describe('AuthGuard', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;
  let notificationService: jasmine.SpyObj<NotificationService>;
  let tokenService: jasmine.SpyObj<TokenService>;

  beforeEach(() => {
    const authSpy = jasmine.createSpyObj('AuthService', ['isAuthenticated']);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    const notificationSpy = jasmine.createSpyObj('NotificationService', ['showError']);
    const tokenSpy = jasmine.createSpyObj('TokenService', ['getToken']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
        { provide: NotificationService, useValue: notificationSpy },
        { provide: TokenService, useValue: tokenSpy }
      ]
    });

    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    notificationService = TestBed.inject(NotificationService) as jasmine.SpyObj<NotificationService>;
    tokenService = TestBed.inject(TokenService) as jasmine.SpyObj<TokenService>;
  });

  // Prueba 108
  it('should allow access when user is authenticated', () => {
    tokenService.getToken.and.returnValue('valid-token');
    authService.isAuthenticated.and.returnValue(true);

    const result = TestBed.runInInjectionContext(() => 
      authGuard({} as any, { url: '/protected' } as any)
    );

    expect(result).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  // Prueba 109
  it('should deny access when token is missing', () => {
    tokenService.getToken.and.returnValue(null);
    authService.isAuthenticated.and.returnValue(false);

    const result = TestBed.runInInjectionContext(() => 
      authGuard({} as any, { url: '/protected' } as any)
    );

    expect(result).toBe(false);
    expect(notificationService.showError).toHaveBeenCalledWith('Debes iniciar sesión para acceder a esta sección.');
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/protected' } });
  });

  // Prueba 110
  it('should deny access when user is not authenticated', () => {
    tokenService.getToken.and.returnValue('token');
    authService.isAuthenticated.and.returnValue(false);

    const result = TestBed.runInInjectionContext(() => 
      authGuard({} as any, { url: '/protected' } as any)
    );

    expect(result).toBe(false);
    expect(notificationService.showError).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/protected' } });
  });

  // Prueba 111
  it('should store returnUrl in sessionStorage when denying access', () => {
    tokenService.getToken.and.returnValue(null);
    authService.isAuthenticated.and.returnValue(false);

    TestBed.runInInjectionContext(() => 
      authGuard({} as any, { url: '/protected-route' } as any)
    );

    expect(sessionStorage.getItem('returnUrl')).toBe('/protected-route');
  });
});


