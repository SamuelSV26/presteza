import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { catchError, tap, finalize } from 'rxjs/operators';
import { Router } from '@angular/router';
import { UserInfo } from '../models/UserInfo';
import { NotificationService } from './notification.service';
import { environment } from '../../../environments/environment';
import { ErrorHandlerService } from './error-handler.service';
import { TokenService } from './token.service';

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
  private apiUrl = environment.apiUrl + '/auth';
  private tokenSubject = new BehaviorSubject<string | null>(this.tokenService.getToken());
  public token$ = this.tokenSubject.asObservable();
  private userInfoSubject = new BehaviorSubject<UserInfo | null>(this.getUserInfo());
  public userInfo$ = this.userInfoSubject.asObservable();

constructor(
  private http: HttpClient,
  private router: Router,
  private tokenService: TokenService,
  private notificationService: NotificationService,
  private errorHandler: ErrorHandlerService
) { }

  login(email: string, password: string, rememberMe: boolean = false): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, {
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
        this.tokenService.setToken(token, rememberMe);
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
      catchError((error) => (this.errorHandler.handleErrorToAuth(error)))
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
    return this.http.post<RegisterResponse>(`${this.apiUrl}/register`, registerData).pipe(
      tap(response => {
        if (response.userId) {
          localStorage.setItem(`userRegistrationDate_${response.userId}`, registrationDate.toISOString());
        }
        localStorage.setItem(`userRegistrationDate_${registerData.email}`, registrationDate.toISOString());
      }),
      catchError((error) => this.errorHandler.handleErrorToAuth(error))
    );
  }

  logout(): void {
    localStorage.clear();
    sessionStorage.clear();
    this.tokenSubject.next(null);
    this.userInfoSubject.next(null);
    this.tokenService.deleteToken();
    this.notificationService.showInfo('Has cerrado sesión correctamente');
    this.router.navigate(['/']);
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/forgot-password`, {
      email
    }).pipe(
      catchError((error) => this.errorHandler.handleErrorToAuth(error))
    );
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/reset-password`, {
      token,
      newPassword
    }).pipe(
      catchError((error) => this.errorHandler.handleErrorToAuth(error))
    );
  }

  isAuthenticated(): boolean {
    const token = this.tokenService.getToken();
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
      if (payload.phone || payload.phone_number) {
        localStorage.setItem('userPhone', payload.phone || payload.phone_number);
      }
      this.userInfoSubject.next(userInfo);
      window.dispatchEvent(new CustomEvent('userInfoUpdated', { detail: userInfo }));
    }
  }

  private checkTokenExpiration(): void {
    const token = this.tokenService.getToken();
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


}
