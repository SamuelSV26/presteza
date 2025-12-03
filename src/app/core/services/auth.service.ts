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

  login(email: string, password: string, rememberMe = false): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, {
      email,
      password
    }).pipe(
      tap(response => {
        let oldUserId: string | null = null;
        let oldEmail: string | null = null;
        const oldUserInfoStr = localStorage.getItem('userInfo');
        if (oldUserInfoStr) {
          try {
            const oldUserInfo = JSON.parse(oldUserInfoStr);
            oldUserId = oldUserInfo.userId || oldUserInfo.email;
            oldEmail = oldUserInfo.email;
          } catch (e) {
          }
        }

        const preservedData: any = {};
        if (oldUserId) {
          preservedData.userProfile = localStorage.getItem(`userProfile_${oldUserId}`);
          preservedData.userAddresses = localStorage.getItem(`userAddresses_${oldUserId}`);
          preservedData.userPaymentMethods = localStorage.getItem(`userPaymentMethods_${oldUserId}`);
          preservedData.userFavoriteDishes = localStorage.getItem(`userFavoriteDishes_${oldUserId}`);
          preservedData.userOrders = localStorage.getItem(`userOrders_${oldUserId}`);
          preservedData.userPhone = localStorage.getItem('userPhone');

          if (oldEmail && oldEmail !== oldUserId) {
            if (!preservedData.userProfile) {
              preservedData.userProfile = localStorage.getItem(`userProfile_${oldEmail}`);
            }
            if (!preservedData.userAddresses) {
              preservedData.userAddresses = localStorage.getItem(`userAddresses_${oldEmail}`);
            }
            if (!preservedData.userPaymentMethods) {
              preservedData.userPaymentMethods = localStorage.getItem(`userPaymentMethods_${oldEmail}`);
            }
            if (!preservedData.userFavoriteDishes) {
              preservedData.userFavoriteDishes = localStorage.getItem(`userFavoriteDishes_${oldEmail}`);
            }
            if (!preservedData.userOrders) {
              preservedData.userOrders = localStorage.getItem(`userOrders_${oldEmail}`);
            }
          }
        }

        localStorage.clear();

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

        const newUserInfo = this.getUserInfo();
        const newUserId = newUserInfo?.userId || newUserInfo?.email;
        const newEmail = newUserInfo?.email;

        const isSameUser = newUserId && oldUserId && (
          newUserId === oldUserId || 
          newEmail === oldEmail ||
          (newUserInfo?.email && newUserInfo.email === oldEmail)
        );

        if (isSameUser && newUserId) {
          if (preservedData.userProfile) {
            localStorage.setItem(`userProfile_${newUserId}`, preservedData.userProfile);
          }
          if (preservedData.userAddresses) {
            localStorage.setItem(`userAddresses_${newUserId}`, preservedData.userAddresses);
          }
          if (preservedData.userPaymentMethods) {
            localStorage.setItem(`userPaymentMethods_${newUserId}`, preservedData.userPaymentMethods);
          }
          if (preservedData.userFavoriteDishes) {
            localStorage.setItem(`userFavoriteDishes_${newUserId}`, preservedData.userFavoriteDishes);
          }
          if (preservedData.userOrders) {
            localStorage.setItem(`userOrders_${newUserId}`, preservedData.userOrders);
          }
          if (preservedData.userPhone) {
            localStorage.setItem('userPhone', preservedData.userPhone);
          }
        }

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
      }),
      catchError((error) => this.errorHandler.handleErrorToAuth(error))
    );
  }

  logout(): void {
    const userInfo = this.getUserInfo();
    const userId = userInfo?.userId || userInfo?.email;
    const email = userInfo?.email;
    const preservedData: any = {};

    if (userId) {
      preservedData.userProfile = localStorage.getItem(`userProfile_${userId}`);
      preservedData.userAddresses = localStorage.getItem(`userAddresses_${userId}`);
      preservedData.userPaymentMethods = localStorage.getItem(`userPaymentMethods_${userId}`);
      preservedData.userFavoriteDishes = localStorage.getItem(`userFavoriteDishes_${userId}`);
      preservedData.userOrders = localStorage.getItem(`userOrders_${userId}`);
      preservedData.userPhone = localStorage.getItem('userPhone');

      if (email && email !== userId) {
        if (!preservedData.userProfile) {
          preservedData.userProfile = localStorage.getItem(`userProfile_${email}`);
        }
        if (!preservedData.userAddresses) {
          preservedData.userAddresses = localStorage.getItem(`userAddresses_${email}`);
        }
        if (!preservedData.userPaymentMethods) {
          preservedData.userPaymentMethods = localStorage.getItem(`userPaymentMethods_${email}`);
        }
        if (!preservedData.userFavoriteDishes) {
          preservedData.userFavoriteDishes = localStorage.getItem(`userFavoriteDishes_${email}`);
        }
        if (!preservedData.userOrders) {
          preservedData.userOrders = localStorage.getItem(`userOrders_${email}`);
        }
      }
    }
    
    localStorage.clear();
    sessionStorage.clear();
    
    const restoreKey = userId || email;
    if (restoreKey) {
      if (preservedData.userProfile) {
        localStorage.setItem(`userProfile_${restoreKey}`, preservedData.userProfile);
      }
      if (preservedData.userAddresses) {
        localStorage.setItem(`userAddresses_${restoreKey}`, preservedData.userAddresses);
      }
      if (preservedData.userPaymentMethods) {
        localStorage.setItem(`userPaymentMethods_${restoreKey}`, preservedData.userPaymentMethods);
      }
      if (preservedData.userFavoriteDishes) {
        localStorage.setItem(`userFavoriteDishes_${restoreKey}`, preservedData.userFavoriteDishes);
      }
      if (preservedData.userOrders) {
        localStorage.setItem(`userOrders_${restoreKey}`, preservedData.userOrders);
      }
      if (preservedData.userPhone) {
        localStorage.setItem('userPhone', preservedData.userPhone);
      }
    }
    
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
        phone: payload.phone,
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
      localStorage.setItem('userInfo', JSON.stringify(userInfo));
      
      const phoneNumber = payload.phone_number || payload.phone;
      if (phoneNumber) {
        localStorage.setItem('userPhone', phoneNumber);
        if (newUserId) {
          const existingProfileStr = localStorage.getItem(`userProfile_${newUserId}`);
          if (existingProfileStr) {
            try {
              const existingProfile = JSON.parse(existingProfileStr);
              if (!existingProfile.phone || existingProfile.phone === '' || existingProfile.phone === 'No especificado') {
                existingProfile.phone = phoneNumber;
                localStorage.setItem(`userProfile_${newUserId}`, JSON.stringify(existingProfile));
              }
            } catch (e) {
              console.error('Error al actualizar perfil con teléfono del token:', e);
            }
          }
        }
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
