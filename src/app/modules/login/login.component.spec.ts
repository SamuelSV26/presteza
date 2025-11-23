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

  // Prueba 84
  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Prueba 85
  it('should redirect to admin if authenticated as admin', () => {
    authService.isAuthenticated.and.returnValue(true);
    authService.getRole.and.returnValue('admin');
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/admin']);
  });

  // Prueba 86
  it('should redirect to profile if authenticated as client', () => {
    authService.isAuthenticated.and.returnValue(true);
    authService.getRole.and.returnValue('client');
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/perfil']);
  });

  // Prueba 87
  it('should not submit login with empty fields', () => {
    fixture.detectChanges();

    component.onLoginSubmit();

    expect(component.loginError).toBe('Por favor completa todos los campos');
    expect(authService.login).not.toHaveBeenCalled();
  });

  // Prueba 88
  it('should submit login successfully', (done) => {
    fixture.detectChanges();

    component.loginEmail = 'test@example.com';
    component.loginPassword = 'password123';
    authService.login.and.returnValue(of({ token: 'mock-token' }));
    authService.getUserInfo.and.returnValue({ userId: '1', email: 'test@example.com', name: 'Test User', role: 'client' });

    component.onLoginSubmit();

    setTimeout(() => {
      expect(authService.login).toHaveBeenCalledWith('test@example.com', 'password123', false);
      expect(component.isLoading).toBe(false);
      done();
    }, 100);
  });

  // Prueba 89
  it('should handle login error', (done) => {
    fixture.detectChanges();

    component.loginEmail = 'test@example.com';
    component.loginPassword = 'wrongpassword';
    authService.login.and.returnValue(throwError(() => ({ message: 'Invalid credentials' })));

    component.onLoginSubmit();

    setTimeout(() => {
      expect(component.isLoading).toBe(false);
      expect(component.loginError).toBe('Invalid credentials');
      done();
    }, 100);
  });

  // Prueba 90
  it('should navigate to registro', () => {
    fixture.detectChanges();

    component.navigateToRegistro();

    expect(router.navigate).toHaveBeenCalledWith(['/registro']);
  });

  // Prueba 91
  it('should navigate back to home', () => {
    fixture.detectChanges();

    component.goBack();

    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  // Prueba 92
  it('should open forgot password modal', () => {
    fixture.detectChanges();

    component.loginEmail = 'test@example.com';
    component.onForgotPassword();

    expect(component.showForgotPasswordModal).toBe(true);
    expect(component.forgotPasswordEmail).toBe('test@example.com');
  });

  // Prueba 93
  it('should close forgot password modal', () => {
    fixture.detectChanges();

    component.showForgotPasswordModal = true;
    component.forgotPasswordEmail = 'test@example.com';
    component.closeForgotPasswordModal();

    expect(component.showForgotPasswordModal).toBe(false);
    expect(component.forgotPasswordEmail).toBe('');
  });

  // Prueba 94
  it('should not submit forgot password with empty email', () => {
    fixture.detectChanges();

    component.forgotPasswordEmail = '';
    component.onSubmitForgotPassword();

    expect(component.forgotPasswordError).toBe('Por favor ingresa tu correo electrónico');
    expect(authService.forgotPassword).not.toHaveBeenCalled();
  });

  // Prueba 95
  it('should not submit forgot password with invalid email', () => {
    fixture.detectChanges();

    component.forgotPasswordEmail = 'invalid-email';
    component.onSubmitForgotPassword();

    expect(component.forgotPasswordError).toBe('Por favor ingresa un correo electrónico válido');
    expect(authService.forgotPassword).not.toHaveBeenCalled();
  });

  // Prueba 96
  it('should submit forgot password successfully', (done) => {
    fixture.detectChanges();

    component.forgotPasswordEmail = 'test@example.com';
    authService.forgotPassword.and.returnValue(of({ message: 'Email sent' }));

    component.onSubmitForgotPassword();

    setTimeout(() => {
      expect(authService.forgotPassword).toHaveBeenCalledWith('test@example.com');
      expect(component.isSendingReset).toBe(false);
      expect(notificationService.showSuccess).toHaveBeenCalled();
      expect(component.showForgotPasswordModal).toBe(false);
      done();
    }, 100);
  });

  // Prueba 97
  it('should handle forgot password error', (done) => {
    fixture.detectChanges();

    component.forgotPasswordEmail = 'test@example.com';
    authService.forgotPassword.and.returnValue(throwError(() => ({ message: 'User not found' })));

    component.onSubmitForgotPassword();

    setTimeout(() => {
      expect(component.isSendingReset).toBe(false);
      expect(component.forgotPasswordError).toBe('User not found');
      done();
    }, 100);
  });
});
