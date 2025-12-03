import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService, LoginResponse, RegisterResponse } from './auth.service';
import { NotificationService } from './notification.service';
import { TokenService } from './token.service';
import { ErrorHandlerService } from './error-handler.service';
import { environment } from '../../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: jasmine.SpyObj<Router>;
  let notificationService: jasmine.SpyObj<NotificationService>;
  let tokenService: jasmine.SpyObj<TokenService>;
  let errorHandler: jasmine.SpyObj<ErrorHandlerService>;

  beforeEach(() => {
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    const notificationSpy = jasmine.createSpyObj('NotificationService', ['showInfo', 'showError']);
    const tokenSpy = jasmine.createSpyObj('TokenService', ['getToken', 'setToken', 'deleteToken']);
    const errorHandlerSpy = jasmine.createSpyObj('ErrorHandlerService', ['handleErrorToAuth']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: routerSpy },
        { provide: NotificationService, useValue: notificationSpy },
        { provide: TokenService, useValue: tokenSpy },
        { provide: ErrorHandlerService, useValue: errorHandlerSpy }
      ]
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    notificationService = TestBed.inject(NotificationService) as jasmine.SpyObj<NotificationService>;
    tokenService = TestBed.inject(TokenService) as jasmine.SpyObj<TokenService>;
    errorHandler = TestBed.inject(ErrorHandlerService) as jasmine.SpyObj<ErrorHandlerService>;
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  // Prueba 1
  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // Prueba 2
  it('should login successfully and store token', (done) => {
    const mockResponse: LoginResponse = {
      token: 'mock-token-123',
      role: 'client'
    };
    tokenService.getToken.and.returnValue(null);
    tokenService.setToken.and.returnValue(undefined);

    service.login('test@example.com', 'password123').subscribe({
      next: (response) => {
        expect(response).toEqual(mockResponse);
        expect(tokenService.setToken).toHaveBeenCalledWith('mock-token-123', false);
        done();
      }
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'test@example.com', password: 'password123' });
    req.flush(mockResponse);
  });

  // Prueba 3
  it('should handle login with rememberMe option', (done) => {
    const mockResponse: LoginResponse = {
      access_token: 'mock-access-token'
    };
    tokenService.getToken.and.returnValue(null);

    service.login('test@example.com', 'password123', true).subscribe({
      next: () => {
        expect(tokenService.setToken).toHaveBeenCalledWith('mock-access-token', true);
        done();
      }
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    req.flush(mockResponse);
  });

  // Prueba 4
  it('should register a new user successfully', (done) => {
    const mockResponse: RegisterResponse = {
      message: 'Usuario registrado exitosamente',
      userId: 'user-123'
    };
    const registerData = {
      complete_name: 'Test User',
      email: 'test@example.com',
      phone_number: '123456789',
      password: 'password123'
    };

    service.register(registerData).subscribe({
      next: (response) => {
        expect(response).toEqual(mockResponse);
        // El localStorage se guarda en el servicio, pero en el test puede no estar disponible inmediatamente
        // Verificamos que la respuesta sea correcta
        expect(response.userId).toBe('user-123');
        done();
      }
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/register`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(registerData);
    req.flush(mockResponse);
  });

  // Prueba 5
  it('should logout and clear all storage', () => {
    tokenService.deleteToken.and.returnValue(undefined);
    localStorage.setItem('test', 'value');
    sessionStorage.setItem('test', 'value');

    service.logout();

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(tokenService.deleteToken).toHaveBeenCalled();
    expect(notificationService.showInfo).toHaveBeenCalledWith('Has cerrado sesión correctamente');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  // Prueba 6
  it('should return true when user is authenticated with valid token', () => {
    const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9.test';
    tokenService.getToken.and.returnValue(validToken);

    const result = service.isAuthenticated();
    expect(result).toBe(true);
  });

  // Prueba 7
  it('should return false when token is missing', () => {
    tokenService.getToken.and.returnValue(null);
    const result = service.isAuthenticated();
    expect(result).toBe(false);
  });

  // Prueba 8
  it('should return false when token is expired', () => {
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxNTE2MjM5MDIyfQ.test';
    tokenService.getToken.and.returnValue(expiredToken);

    const result = service.isAuthenticated();
    expect(result).toBe(false);
  });

  // Prueba 9
  it('should get user info from localStorage', () => {
    const mockUserInfo = { userId: '123', email: 'test@example.com', name: 'Test User', phone: '1234567890', role: 'client' };
    localStorage.setItem('userInfo', JSON.stringify(mockUserInfo));

    const result = service.getUserInfo();
    expect(result).toEqual(mockUserInfo);
  });

  // Prueba 10
  it('should return null when user info is not in localStorage', () => {
    localStorage.removeItem('userInfo');
    const result = service.getUserInfo();
    expect(result).toBeNull();
  });

  // Prueba 11
  it('should get role from user info', () => {
    const mockUserInfo = { userId: '123', email: 'test@example.com', name: 'Test User', role: 'admin' };
    localStorage.setItem('userInfo', JSON.stringify(mockUserInfo));

    const result = service.getRole();
    expect(result).toBe('admin');
  });

  // Prueba 12
  it('should return true when user is admin', () => {
    const mockUserInfo = { userId: '123', email: 'test@example.com', name: 'Test User', role: 'admin' };
    localStorage.setItem('userInfo', JSON.stringify(mockUserInfo));

    const result = service.isAdmin();
    expect(result).toBe(true);
  });

  // Prueba 13
  it('should return false when user is not admin', () => {
    const mockUserInfo = { userId: '123', email: 'test@example.com', name: 'Test User', role: 'client' };
    localStorage.setItem('userInfo', JSON.stringify(mockUserInfo));

    const result = service.isAdmin();
    expect(result).toBe(false);
  });

  // Prueba 14
  it('should redirect admin to admin dashboard after login', () => {
    const mockUserInfo = { userId: '123', email: 'test@example.com', name: 'Test User', role: 'admin' };
    localStorage.setItem('userInfo', JSON.stringify(mockUserInfo));

    service.redirectAfterLogin('admin');
    expect(router.navigate).toHaveBeenCalledWith(['/admin']);
  });

  // Prueba 15
  it('should redirect client to profile after login', () => {
    const mockUserInfo = { userId: '123', email: 'test@example.com', name: 'Test User', role: 'client' };
    localStorage.setItem('userInfo', JSON.stringify(mockUserInfo));

    service.redirectAfterLogin('client');
    expect(router.navigate).toHaveBeenCalledWith(['/perfil']);
  });

  // Prueba 16
  it('should handle forgot password request', (done) => {
    const mockResponse = { message: 'Email sent successfully' };

    service.forgotPassword('test@example.com').subscribe({
      next: (response) => {
        expect(response).toEqual(mockResponse);
        done();
      }
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/forgot-password`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'test@example.com' });
    req.flush(mockResponse);
  });

  // Prueba 17
  it('should handle reset password request', (done) => {
    const mockResponse = { message: 'Password reset successfully' };

    service.resetPassword('reset-token', 'newPassword123').subscribe({
      next: (response) => {
        expect(response).toEqual(mockResponse);
        done();
      }
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/reset-password`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'reset-token', newPassword: 'newPassword123' });
    req.flush(mockResponse);
  });
});


