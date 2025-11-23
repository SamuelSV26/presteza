import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { adminGuard } from './admin.guard';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { TokenService } from '../services/token.service';

describe('AdminGuard', () => {
  let guard: typeof adminGuard;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;
  let notificationService: jasmine.SpyObj<NotificationService>;
  let tokenService: jasmine.SpyObj<TokenService>;

  beforeEach(() => {
    const authSpy = jasmine.createSpyObj('AuthService', ['isAuthenticated', 'isAdmin', 'getRole']);
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

    guard = adminGuard;
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    notificationService = TestBed.inject(NotificationService) as jasmine.SpyObj<NotificationService>;
    tokenService = TestBed.inject(TokenService) as jasmine.SpyObj<TokenService>;
  });

  // Prueba 112
  it('should allow access when user is admin', () => {
    tokenService.getToken.and.returnValue('valid-token');
    authService.isAuthenticated.and.returnValue(true);
    authService.isAdmin.and.returnValue(true);
    authService.getRole.and.returnValue('admin');

    const result = TestBed.runInInjectionContext(() => guard({} as any, { url: '/admin' } as any));

    expect(result).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  // Prueba 113
  it('should deny access when token is missing', () => {
    tokenService.getToken.and.returnValue(null);

    const result = TestBed.runInInjectionContext(() => guard({} as any, { url: '/admin' } as any));

    expect(result).toBe(false);
    expect(notificationService.showError).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/admin' } });
  });

  // Prueba 114
  it('should deny access when user is not authenticated', () => {
    tokenService.getToken.and.returnValue('token');
    authService.isAuthenticated.and.returnValue(false);

    const result = TestBed.runInInjectionContext(() => guard({} as any, { url: '/admin' } as any));

    expect(result).toBe(false);
    expect(notificationService.showError).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/admin' } });
  });

  // Prueba 115
  it('should deny access when user is not admin', () => {
    tokenService.getToken.and.returnValue('token');
    authService.isAuthenticated.and.returnValue(true);
    authService.isAdmin.and.returnValue(false);
    authService.getRole.and.returnValue('client');

    const result = TestBed.runInInjectionContext(() => guard({} as any, { url: '/admin' } as any));

    expect(result).toBe(false);
    expect(notificationService.showError).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  // Prueba 116
  it('should deny access when role is not exactly admin', () => {
    tokenService.getToken.and.returnValue('token');
    authService.isAuthenticated.and.returnValue(true);
    authService.isAdmin.and.returnValue(false);
    authService.getRole.and.returnValue('ADMIN'); // Different case

    const result = TestBed.runInInjectionContext(() => guard({} as any, { url: '/admin' } as any));

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  // Prueba 117
  it('should handle errors gracefully', () => {
    tokenService.getToken.and.throwError('Error');

    const result = TestBed.runInInjectionContext(() => guard({} as any, { url: '/admin' } as any));

    expect(result).toBe(false);
    expect(notificationService.showError).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });
});


