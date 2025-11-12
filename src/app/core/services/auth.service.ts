import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, tap, finalize } from 'rxjs/operators';
import { Router } from '@angular/router';
import { UserInfo } from '../models/UserInfo';
import { NotificationService } from './notification.service';

export interface LoginResponse {
  token?: string;
  access_token?: string;
  user?: string | {
    role?: string;
  };
  data?: {
    token?: string;
    access_token?: string;
    role?: string;
  };
  role?: string;
  message?: string;
}

export interface RegisterResponse {
  message: string;
  userId: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:4000';
  private tokenSubject = new BehaviorSubject<string | null>(this.getToken());
  public token$ = this.tokenSubject.asObservable();
  private userInfoSubject = new BehaviorSubject<UserInfo | null>(this.getUserInfo());
  public userInfo$ = this.userInfoSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    private notificationService: NotificationService
  ) {
    this.checkTokenExpiration();
  }

  login(email: string, password: string, rememberMe: boolean = false): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, {
      email,
      password
    }).pipe(
      tap(response => {
        let token: string | undefined;
        if (response.token) {
          token = response.token;
        } else if (typeof response.user === 'string') {
          token = response.user;
        } else if (response.data?.token) {
          token = response.data.token;
        } else if (response.access_token) {
          token = response.access_token;
        } else if (response.data?.access_token) {
          token = response.data.access_token;
        }
        if (!token) return;
        this.setToken(token, rememberMe);
        const payload = this.decodeToken(token);
        const userRole = payload?.role || payload?.userRole || payload?.rol || payload?.type || 'client';
        this.decodeAndStoreUserInfo(token);
        this.tokenSubject.next(token);
        this.userInfoSubject.next(this.getUserInfo());
        const event = new CustomEvent('userLoggedIn', {
          detail: { token, role: userRole }
        });
        window.dispatchEvent(event);
      }),
      finalize(() => {}),
      catchError(this.handleError)
    );
  }

  register(registerData: {
    complete_name: string;
    email: string;
    phone_number: string;
    password: string;
    role?: string;
  }): Observable<RegisterResponse> {
    const registrationDate = new Date();
    return this.http.post<RegisterResponse>(`${this.apiUrl}/auth/register`, registerData).pipe(
      tap(response => {
        if (response.userId) {
          localStorage.setItem(`userRegistrationDate_${response.userId}`, registrationDate.toISOString());
        }
        localStorage.setItem(`userRegistrationDate_${registerData.email}`, registrationDate.toISOString());
      }),
      catchError((error) => this.handleError(error))
    );
  }

  logout(): void {
    const userInfo = this.getUserInfo();
    const userEmail = userInfo?.email || localStorage.getItem('userEmail') || 'usuario';
    localStorage.clear();
    sessionStorage.clear();
    this.tokenSubject.next(null);
    this.userInfoSubject.next(null);
    this.notificationService.showInfo(`Has cerrado sesión con el correo ${userEmail}`);
    this.router.navigate(['/']);
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/forgot-password`, {
      email
    }).pipe(
      catchError(this.handleError)
    );
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/reset-password`, {
      token,
      newPassword
    }).pipe(
      catchError(this.handleError)
    );
  }

  getToken(): string | null {
    const token = localStorage.getItem('authToken');
    if (token) return token;
    return sessionStorage.getItem('authToken');
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const payload = this.decodeToken(token);
      if (payload && payload.exp) {
        const expirationDate = new Date(payload.exp * 1000);
        return expirationDate > new Date();
      }
      return true;
    } catch {
      return false;
    }
  }

  getUserInfo(): UserInfo | null {
    const userInfoStr = localStorage.getItem('userInfo');
    if (userInfoStr) {
      try {
        return JSON.parse(userInfoStr);
      } catch {
        return null;
      }
    }
    return null;
  }

  getRole(): string | null {
    const userInfo = this.getUserInfo();
    return userInfo?.role || null;
  }

  isAdmin(): boolean {
    const role = this.getRole();
    if (!role) return false;
    return role.toString().toLowerCase().trim() === 'admin';
  }

  redirectAfterLogin(role?: string): void {
    const rawRole = role || this.getRole();
    const userRole = rawRole ? rawRole.toString().toLowerCase().trim() : null;
    if (userRole === 'admin') {
      this.router.navigate(['/admin']);
    } else if (userRole === 'client' || userRole === 'cliente') {
      this.router.navigate(['/perfil']);
    } else {
      this.router.navigate(['/perfil']);
    }
  }

  private setToken(token: string, rememberMe: boolean = false): void {
    if (rememberMe) {
      localStorage.setItem('authToken', token);
      sessionStorage.removeItem('authToken');
    } else {
      sessionStorage.setItem('authToken', token);
      localStorage.removeItem('authToken');
    }
  }

  private decodeToken(token: string): any {
    try {
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const base64Url = parts[1];
      let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      try {
        const decoded = atob(base64);
        const jsonPayload = decodeURIComponent(
          decoded
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        return JSON.parse(jsonPayload);
      } catch {
        try {
          const simpleDecoded = atob(base64Url);
          return JSON.parse(simpleDecoded);
        } catch {
          return null;
        }
      }
    } catch {
      return null;
    }
  }

  private decodeAndStoreUserInfo(token: string): void {
    const payload = this.decodeToken(token);
    if (payload) {
      const role = payload.role || payload.userRole || payload.rol || payload.type || 'client';
      const userInfo: UserInfo = {
        userId: payload.userId || payload.sub,
        email: payload.email,
        name: payload.name,
        role: role
      };
      const oldUserInfoStr = localStorage.getItem('userInfo');
      let oldUserId: string | null = null;
      if (oldUserInfoStr) {
        try {
          const oldUserInfo = JSON.parse(oldUserInfoStr);
          oldUserId = oldUserInfo.userId || oldUserInfo.email;
        } catch {}
      }
      const newUserId = userInfo.userId || userInfo.email;
      if (oldUserId && oldUserId !== newUserId) {
        localStorage.removeItem('userProfile');
      }
      if (payload.iat && !localStorage.getItem(`userRegistrationDate_${newUserId}`) && !localStorage.getItem(`userRegistrationDate_${userInfo.email}`)) {
        const registrationDate = new Date(payload.iat * 1000);
        localStorage.setItem(`userRegistrationDate_${newUserId}`, registrationDate.toISOString());
        localStorage.setItem(`userRegistrationDate_${userInfo.email}`, registrationDate.toISOString());
      }
      localStorage.setItem('userInfo', JSON.stringify(userInfo));
      localStorage.setItem('userName', userInfo.name);
      localStorage.setItem('userEmail', userInfo.email);
      if (payload.phone || payload.phone_number) {
        localStorage.setItem('userPhone', payload.phone || payload.phone_number);
      }
      this.userInfoSubject.next(userInfo);
      window.dispatchEvent(new CustomEvent('userInfoUpdated', { detail: userInfo }));
    }
  }

  private checkTokenExpiration(): void {
    const token = this.getToken();
    if (token) {
      try {
        const payload = this.decodeToken(token);
        if (payload && payload.exp) {
          const expirationDate = new Date(payload.exp * 1000);
          if (expirationDate <= new Date()) {
            this.logout();
          } else {
            this.decodeAndStoreUserInfo(token);
          }
        }
      } catch {
        this.logout();
      }
    }
  }

  private handleError = (error: HttpErrorResponse): Observable<never> => {
    let errorMessage = 'Ocurrió un error';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      if (error.status === 0) {
        errorMessage = 'No se pudo conectar con el servidor. Por favor, verifica que el servidor backend esté corriendo en http://localhost:4000';
      } else {
        switch (error.status) {
          case 401:
            errorMessage = 'Credenciales inválidas';
            break;
          case 409:
            errorMessage = 'El email ya está registrado';
            break;
          case 400:
            errorMessage = error.error?.message || 'Datos inválidos';
            break;
          default:
            errorMessage = `Error ${error.status}: ${error.error?.message || error.message}`;
        }
      }
    }
    return throwError(() => new Error(errorMessage));
  };
}
