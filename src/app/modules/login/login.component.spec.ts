import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { TokenService } from '../../core/services/token.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;
  let notificationService: jasmine.SpyObj<NotificationService>;
  let tokenService: jasmine.SpyObj<TokenService>;
  let activatedRoute: ActivatedRoute;

  beforeEach(async () => {
    const authSpy = jasmine.createSpyObj('AuthService', ['login', 'isAuthenticated', 'getRole', 'getUserInfo', 'forgotPassword'], {
      userInfo$: of(null)
    });
    const routerSpy = jasmine.createSpyObj('Router', ['navigate', 'navigateByUrl'], { url: '/login' });
    routerSpy.navigateByUrl.and.returnValue(Promise.resolve(true));
    const notificationSpy = jasmine.createSpyObj('NotificationService', ['showSuccess', 'showError']);
    const tokenSpy = jasmine.createSpyObj('TokenService', ['getToken']);

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
        { provide: NotificationService, useValue: notificationSpy },
        { provide: TokenService, useValue: tokenSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParams: {} } }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    notificationService = TestBed.inject(NotificationService) as jasmine.SpyObj<NotificationService>;
    tokenService = TestBed.inject(TokenService) as jasmine.SpyObj<TokenService>;
    activatedRoute = TestBed.inject(ActivatedRoute);
  });

  // Prueba 52
  it('should create and handle authentication redirects', () => {
    expect(component).toBeTruthy();
    
    // Resetear el spy antes de cada verificación
    router.navigate.calls.reset();
    authService.isAuthenticated.and.returnValue(true);
    authService.getRole.and.returnValue('admin');
    
    // Crear un nuevo componente para la primera prueba
    const fixture1 = TestBed.createComponent(LoginComponent);
    fixture1.detectChanges();
    expect(router.navigate).toHaveBeenCalledWith(['/admin']);

    // Resetear nuevamente para la segunda verificación
    router.navigate.calls.reset();
    authService.getRole.and.returnValue('client');
    
    // Crear un nuevo componente para la segunda prueba
    const fixture2 = TestBed.createComponent(LoginComponent);
    fixture2.detectChanges();
    expect(router.navigate).toHaveBeenCalledWith(['/perfil']);
  });

  // Prueba 53
  it('should handle login submission and errors', (done) => {
    fixture.detectChanges();

    component.onLoginSubmit();
    expect(component.loginError).toBe('Por favor completa todos los campos');
    expect(authService.login).not.toHaveBeenCalled();

    component.loginEmail = 'test@example.com';
    component.loginPassword = 'password123';
    authService.login.and.returnValue(of({ token: 'mock-token' }));
    authService.getUserInfo.and.returnValue({ userId: '1', email: 'test@example.com', name: 'Test User', phone: '1234567890', role: 'client' });

    component.onLoginSubmit();
    setTimeout(() => {
      expect(authService.login).toHaveBeenCalledWith('test@example.com', 'password123', false);
      expect(component.isLoading).toBe(false);

      authService.login.and.returnValue(throwError(() => ({ message: 'Invalid credentials' })));
      component.onLoginSubmit();
      setTimeout(() => {
        expect(component.loginError).toBe('Invalid credentials');
        done();
      }, 100);
    }, 100);
  });

  // Prueba 54
  it('should handle navigation and forgot password flow', (done) => {
    fixture.detectChanges();

    component.navigateToRegistro();
    expect(router.navigate).toHaveBeenCalledWith(['/registro']);

    component.goBack();
    expect(router.navigate).toHaveBeenCalledWith(['/']);

    component.loginEmail = 'test@example.com';
    component.onForgotPassword({ preventDefault: () => {}, stopPropagation: () => {} } as any);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/forgot-password');

    component.showForgotPasswordModal = true;
    component.forgotPasswordEmail = 'test@example.com';
    component.closeForgotPasswordModal();
    expect(component.showForgotPasswordModal).toBe(false);

    component.forgotPasswordEmail = '';
    component.onSubmitForgotPassword();
    expect(component.forgotPasswordError).toBe('Por favor ingresa tu correo electrónico');

    component.forgotPasswordEmail = 'invalid-email';
    component.onSubmitForgotPassword();
    expect(component.forgotPasswordError).toBe('Por favor ingresa un correo electrónico válido');

    component.forgotPasswordEmail = 'test@example.com';
    authService.forgotPassword.and.returnValue(of({ message: 'Email sent' }));
    component.onSubmitForgotPassword();
    setTimeout(() => {
      expect(authService.forgotPassword).toHaveBeenCalledWith('test@example.com');
      expect(component.showForgotPasswordModal).toBe(false);

      authService.forgotPassword.and.returnValue(throwError(() => ({ message: 'User not found', error: { message: 'User not found' } })));
      component.onSubmitForgotPassword();
      setTimeout(() => {
        // El componente usa error.message o un mensaje genérico
        expect(component.forgotPasswordError).toBeTruthy();
        // Puede ser el mensaje del error o el mensaje genérico
        if (component.forgotPasswordError) {
          expect(component.forgotPasswordError.length).toBeGreaterThan(0);
        }
        done();
      }, 100);
    }, 100);
  });
});
