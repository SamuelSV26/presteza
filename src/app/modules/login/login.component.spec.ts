import { ComponentFixture, TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { of, throwError, BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';

import { LoginComponent } from './login.component';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { TokenService } from '../../core/services/token.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authServiceSpy: any;
  let notificationSpy: any;
  let tokenServiceSpy: any;
  let routerSpy: any;
  let activatedRouteStub: any;
  let userInfoSubject: BehaviorSubject<any>;

  beforeEach(async () => {
    // mocks / spies
    userInfoSubject = new BehaviorSubject<any>(null);

    authServiceSpy = {
      login: jasmine.createSpy('login'),
      getUserInfo: jasmine.createSpy('getUserInfo'),
      userInfo$: userInfoSubject.asObservable(),
      isAuthenticated: jasmine.createSpy('isAuthenticated').and.returnValue(false),
      getRole: jasmine.createSpy('getRole').and.returnValue(null)
    };

    notificationSpy = {
      showSuccess: jasmine.createSpy('showSuccess'),
      showError: jasmine.createSpy('showError'),
      showInfo: jasmine.createSpy('showInfo')
    };

    tokenServiceSpy = {
      getToken: jasmine.createSpy('getToken').and.returnValue(null)
    };

    // IMPORTANT: navegar devuelve Promise para que .then() funcione en el componente
    routerSpy = {
      navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)),
      navigateByUrl: jasmine.createSpy('navigateByUrl').and.returnValue(Promise.resolve(true))
    };

    activatedRouteStub = {
      snapshot: { queryParams: {} }
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent], // componente standalone se importa aquí
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: NotificationService, useValue: notificationSpy },
        { provide: TokenService, useValue: tokenServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: activatedRouteStub }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería crearse', () => {
    expect(component).toBeTruthy();
  });

  it('debe mostrar error cuando faltan campos', () => {
    component.loginEmail = '';
    component.loginPassword = '';
    component.onLoginSubmit();
    expect(component.loginError).toBeTruthy();
    expect(component.isLoading).toBeFalse();
  });

  it('debe llamar authService.login y redirigir a perfil cuando rol client', fakeAsync(() => {
    component.loginEmail = 'test@gmail.com';
    component.loginPassword = 'Test1234';
    const mockResponse = { token: 'header.payload.signature' };
    authServiceSpy.login.and.returnValue(of(mockResponse));
    authServiceSpy.getUserInfo.and.returnValue({ userId: '69226f0f95a4d5f709419676', email: 'test@gmail.com', name: 'test', role: 'client' });

    component.onLoginSubmit();
    tick();
    expect(authServiceSpy.login).toHaveBeenCalledWith('test@gmail.com', 'Test1234', false);
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/perfil');
    flush();
  }));

  it('debe redirigir a admin cuando rol admin', fakeAsync(() => {
    component.loginEmail = 'admin@gmail.com';
    component.loginPassword = 'Admin1234';
    authServiceSpy.login.and.returnValue(of({ token: 't' }));
    authServiceSpy.getUserInfo.and.returnValue({ userId: 'a1', email: 'admin@gmail.com', name: 'Admin', role: 'admin' });

    component.onLoginSubmit();
    tick();
    expect(authServiceSpy.login).toHaveBeenCalled();
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/admin');
    flush();
  }));

  it('si userInfo no está disponible espera userInfo$ antes de redirigir', fakeAsync(() => {
    component.loginEmail = 'delayed@example.com';
    component.loginPassword = 'pass';
    authServiceSpy.login.and.returnValue(of({ token: 't' }));
    authServiceSpy.getUserInfo.and.returnValue(null);

    component.onLoginSubmit();
    tick();
    expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
    // emitir userInfo usando la subject compartida
    userInfoSubject.next({ userId: 'u2', email: 'delayed@example.com', name: 'Delayed', role: 'client' });
    tick(10);
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/perfil');
    flush();
  }));

  it('onForgotPassword abre modal y usa email existente', () => {
    component.loginEmail = 'mi@email.com';
    component.onForgotPassword();
    expect(component.showForgotPasswordModal).toBeTrue();
    expect(component.forgotPasswordEmail).toBe('mi@email.com');
  });

  it('onSubmitForgotPassword llama a authService.forgotPassword y muestra notificación', fakeAsync(() => {
    component.forgotPasswordEmail = 'user@x.com';
    authServiceSpy.forgotPassword = jasmine.createSpy('forgotPassword').and.returnValue(of({ message: 'ok' }));
    component.onSubmitForgotPassword();
    tick();
    expect(authServiceSpy.forgotPassword).toHaveBeenCalledWith('user@x.com');
    expect(notificationSpy.showSuccess).toHaveBeenCalled();
    expect(component.showForgotPasswordModal).toBeFalse();
    flush();
  }));

  it('onSubmitForgotPassword maneja error del servidor', fakeAsync(() => {
    component.forgotPasswordEmail = 'bad@x.com';
    authServiceSpy.forgotPassword = jasmine.createSpy('forgotPassword').and.returnValue(throwError(() => ({ message: 'fail' })));
    component.onSubmitForgotPassword();
    tick();
    expect(component.forgotPasswordError).toBeTruthy();
    flush();
  }));
});
