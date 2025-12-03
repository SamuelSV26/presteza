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

  // Prueba 49
  it('should allow access when authenticated and deny when not', () => {
    tokenService.getToken.and.returnValue('valid-token');
    authService.isAuthenticated.and.returnValue(true);

    const result1 = TestBed.runInInjectionContext(() => 
      authGuard({} as any, { url: '/protected' } as any)
    );

    expect(result1).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();

    tokenService.getToken.and.returnValue(null);
    authService.isAuthenticated.and.returnValue(false);

    const result2 = TestBed.runInInjectionContext(() => 
      authGuard({} as any, { url: '/protected-route' } as any)
    );

    expect(result2).toBe(false);
    expect(notificationService.showError).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/protected-route' } });
    expect(sessionStorage.getItem('returnUrl')).toBe('/protected-route');
  });
});


