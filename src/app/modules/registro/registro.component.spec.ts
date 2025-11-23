import { ComponentFixture, TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { RegistroComponent } from './registro.component';
import { AuthService } from '../../core/services/auth.service';
import { TokenService } from '../../core/services/token.service';
import { Router } from '@angular/router';

describe('RegistroComponent', () => {
  let component: RegistroComponent;
  let fixture: ComponentFixture<RegistroComponent>;
  let authServiceSpy: any;
  let tokenServiceSpy: any;
  let routerSpy: any;

  beforeEach(async () => {
    authServiceSpy = {
      register: jasmine.createSpy('register'),
      login: jasmine.createSpy('login'),
      getUserInfo: jasmine.createSpy('getUserInfo').and.returnValue(null),
      getRole: jasmine.createSpy('getRole').and.returnValue(null)
    };

    // tokenService.getToken puede devolver el token cuando convenga en cada test
    tokenServiceSpy = {
      getToken: jasmine.createSpy('getToken')
    };

    routerSpy = {
      navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)),
      navigateByUrl: jasmine.createSpy('navigateByUrl').and.returnValue(Promise.resolve(true))
    };

    await TestBed.configureTestingModule({
      imports: [RegistroComponent],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: TokenService, useValue: tokenServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RegistroComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería crearse', () => {
    expect(component).toBeTruthy();
  });

  it('no debe llamar register si el formulario es inválido', () => {
    component.registroForm.controls['name'].setValue('');
    component.registroForm.controls['email'].setValue('x');
    component.registroForm.controls['phone'].setValue('123');
    component.registroForm.controls['password'].setValue('short');
    component.registroForm.controls['confirmPassword'].setValue('diff');
    component.registroForm.controls['acceptTerms'].setValue(false);

    component.onSubmit();
    expect(authServiceSpy.register).not.toHaveBeenCalled();
    expect(component.formError).toBeNull();
  });

  it('debe registrar, loguear y redirigir a /perfil cuando role cliente', fakeAsync(() => {
    component.registroForm.controls['name'].setValue('Juan Perez');
    component.registroForm.controls['email'].setValue('juan@test.com');
    component.registroForm.controls['phone'].setValue('9998887777');
    component.registroForm.controls['password'].setValue('Password1A');
    component.registroForm.controls['confirmPassword'].setValue('Password1A');
    component.registroForm.controls['acceptTerms'].setValue(true);

    const payload = JSON.stringify({ role: 'client' });
    const b64 = btoa(payload); // base64 del payload esto es para simular un token JWT
    const token = `h.${b64}.s`;

    authServiceSpy.register.and.returnValue(of({ message: 'ok', userId: 'u1' }));
    authServiceSpy.login.and.returnValue(of({ token }));
    tokenServiceSpy.getToken.and.returnValue(token);

    component.onSubmit();

    // el componente espera 1500ms antes de llamar a login
    tick(1500);
    flush();

    expect(authServiceSpy.register).toHaveBeenCalled();
    expect(authServiceSpy.login).toHaveBeenCalledWith('juan@test.com', 'Password1A', false);
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/perfil');
  }));

  it('debe redirigir a /admin cuando role admin', fakeAsync(() => {
    component.registroForm.controls['name'].setValue('Admin');
    component.registroForm.controls['email'].setValue('admin@test.com');
    component.registroForm.controls['phone'].setValue('9998887777');
    component.registroForm.controls['password'].setValue('AdminPass1');
    component.registroForm.controls['confirmPassword'].setValue('AdminPass1');
    component.registroForm.controls['acceptTerms'].setValue(true);

    const payload = JSON.stringify({ role: 'admin' });
    const b64 = btoa(payload);
    const token = `h.${b64}.s`;

    authServiceSpy.register.and.returnValue(of({ message: 'ok', userId: 'a1' }));
    authServiceSpy.login.and.returnValue(of({ token }));
    tokenServiceSpy.getToken.and.returnValue(token);

    component.onSubmit();
    tick(1500);
    flush();

    expect(authServiceSpy.register).toHaveBeenCalled();
    expect(authServiceSpy.login).toHaveBeenCalledWith('admin@test.com', 'AdminPass1', false);
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/admin');
  }));

  it('debe mostrar error cuando register falla', fakeAsync(() => {
    component.registroForm.controls['name'].setValue('Error');
    component.registroForm.controls['email'].setValue('err@test.com');
    component.registroForm.controls['phone'].setValue('9998887777');
    component.registroForm.controls['password'].setValue('ErrorPass1');
    component.registroForm.controls['confirmPassword'].setValue('ErrorPass1');
    component.registroForm.controls['acceptTerms'].setValue(true);

    authServiceSpy.register.and.returnValue(throwError(() => ({ message: 'fail' })));

    component.onSubmit();
    tick();

    expect(component.isLoading).toBeFalse();
    expect(component.formError).toBeTruthy();
  }));
});
