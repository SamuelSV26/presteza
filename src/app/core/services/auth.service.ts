import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Router } from '@angular/router';

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

export interface UserInfo {
  userId: string;
  email: string;
  name: string;
  role: string;
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
    private router: Router
  ) {
    this.checkTokenExpiration();
  }

  login(email: string, password: string, rememberMe: boolean = false): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, {
      email,
      password
    }).pipe(
      tap(response => {
        console.log('📥 Respuesta completa del login:', response);

        // Verificar diferentes formatos posibles de respuesta
        // El backend devuelve el token en el campo "user" como string
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

        if (!token) {
          console.error('❌ No se encontró token en la respuesta del login');
          console.log('📋 Estructura de la respuesta:', JSON.stringify(response, null, 2));
          return;
        }

        console.log('✅ Token encontrado (primeros 50 caracteres):', token.substring(0, 50));
        this.setToken(token, rememberMe);

        const payload = this.decodeToken(token);
        console.log('🔍 Token decodificado completo:', payload);

        if (!payload) {
          console.error('❌ No se pudo decodificar el token. Verifica que el token sea un JWT válido.');
          let roleFromResponse: string | undefined;
          if (response.role) {
            roleFromResponse = response.role;
          } else if (response.data?.role) {
            roleFromResponse = response.data.role;
          } else if (typeof response.user === 'object' && response.user?.role) {
            roleFromResponse = response.user.role;
          }

          if (roleFromResponse) {
            console.log('📋 Rol encontrado en la respuesta (no en token):', roleFromResponse);
            this.redirectAfterLogin(roleFromResponse);
            return;
          }
        }

        const userRole = payload?.role || payload?.userRole || payload?.rol || payload?.type || 'client';
        console.log('📋 Rol extraído del token (sin normalizar):', userRole);
        console.log('📋 Tipo de dato del rol:', typeof userRole);

        this.decodeAndStoreUserInfo(token);
        this.tokenSubject.next(token);
        this.userInfoSubject.next(this.getUserInfo());
        window.dispatchEvent(new CustomEvent('userLoggedIn'));

        // Verificar si hay returnUrl en sessionStorage
        const returnUrl = sessionStorage.getItem('returnUrl');
        if (!returnUrl) {
          // Si no hay returnUrl, redirigir según el rol (para login desde registro u otros lugares)
          const userRole = payload?.role || payload?.userRole || payload?.rol || payload?.type || 'client';
          this.redirectAfterLogin(userRole);
        }
      }),
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
    console.log('Enviando datos de registro:', { ...registerData, password: '***' });
    const registrationDate = new Date(); // Fecha de registro

    return this.http.post<RegisterResponse>(`${this.apiUrl}/auth/register`, registerData).pipe(
      tap(response => {
        console.log('Respuesta del registro:', response);

        // Guardar la fecha de registro asociada al email del usuario
        // Cuando haga login, se usará esta fecha
        if (response.userId) {
          localStorage.setItem(`userRegistrationDate_${response.userId}`, registrationDate.toISOString());
        }
        // También guardar por email como respaldo
        localStorage.setItem(`userRegistrationDate_${registerData.email}`, registrationDate.toISOString());
      }),
      catchError((error) => {
        console.error('Error en el registro:', error);
        return this.handleError(error);
      })
    );
  }

  logout(): void {
    // Limpiar datos de autenticación de ambos storage
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('authToken');
    localStorage.removeItem('userInfo');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userPhone');

    // Limpiar perfil del usuario
    localStorage.removeItem('userProfile');

    // Limpiar favoritos (no se eliminan completamente, pero se limpia la referencia)
    // Los favoritos se mantienen asociados al userId del usuario anterior

    this.tokenSubject.next(null);
    this.userInfoSubject.next(null);
    this.router.navigate(['/']);
  }

  /**
   * Solicita recuperación de contraseña
   * @param email Email del usuario que olvidó su contraseña
   */
  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/forgot-password`, {
      email
    }).pipe(
      tap(response => {
        console.log('Respuesta de recuperación de contraseña:', response);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Resetea la contraseña con el token de recuperación
   * @param token Token de recuperación recibido por email
   * @param newPassword Nueva contraseña
   */
  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/reset-password`, {
      token,
      newPassword
    }).pipe(
      tap(response => {
        console.log('Respuesta de reseteo de contraseña:', response);
      }),
      catchError(this.handleError)
    );
  }

  getToken(): string | null {
    // Intentar obtener desde localStorage primero (remember me)
    const token = localStorage.getItem('authToken');
    if (token) return token;

    // Si no hay en localStorage, intentar desde sessionStorage
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
    } catch (e) {
      return false;
    }

    return true;
  }

  getUserInfo(): UserInfo | null {
    const userInfoStr = localStorage.getItem('userInfo');
    if (userInfoStr) {
      try {
        return JSON.parse(userInfoStr);
      } catch (e) {
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

    console.log('Rol original:', rawRole);
    console.log('Rol normalizado:', userRole);
    console.log('Comparación con admin:', userRole === 'admin');

    if (userRole === 'admin') {
      console.log('✅ Usuario es ADMIN - Redirigiendo a /admin');
      this.router.navigate(['/admin']);
    } else if (userRole === 'client' || userRole === 'cliente') {
      console.log('✅ Usuario es CLIENTE - Redirigiendo a /perfil');
      this.router.navigate(['/perfil']);
    } else {
      console.warn('⚠️ Rol no reconocido:', userRole, '- Redirigiendo a /perfil por defecto');
      this.router.navigate(['/perfil']);
    }
  }

  private setToken(token: string, rememberMe: boolean = false): void {
    if (rememberMe) {
      // Guardar en localStorage (persistente, se mantiene después de cerrar el navegador)
      localStorage.setItem('authToken', token);
      // Limpiar de sessionStorage si existe
      sessionStorage.removeItem('authToken');
    } else {
      // Guardar en sessionStorage (temporal, se elimina al cerrar el navegador)
      sessionStorage.setItem('authToken', token);
      // Limpiar de localStorage si existe
      localStorage.removeItem('authToken');
    }
  }

  private decodeToken(token: string): any {
    try {
      if (!token) {
        console.error('❌ Token es null o undefined');
        return null;
      }

      console.log('🔑 Token recibido (primeros 50 caracteres):', token.substring(0, 50));

      const parts = token.split('.');
      console.log('📦 Partes del token:', parts.length);

      if (parts.length !== 3) {
        console.error('❌ Token no tiene formato JWT válido (debe tener 3 partes separadas por puntos)');
        return null;
      }

      const base64Url = parts[1];
      console.log('📦 Parte del payload (base64Url):', base64Url);

      let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

      while (base64.length % 4) {
        base64 += '=';
      }

      try {
        const decoded = atob(base64);
        console.log('📦 Payload decodificado (primeros 100 caracteres):', decoded.substring(0, 100));

        const jsonPayload = decodeURIComponent(
          decoded
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );

        const parsed = JSON.parse(jsonPayload);
        console.log('✅ Token decodificado exitosamente:', parsed);
        return parsed;
      } catch (base64Error) {
        console.error('❌ Error al decodificar base64:', base64Error);
        try {
          const simpleDecoded = atob(base64Url);
          return JSON.parse(simpleDecoded);
        } catch (simpleError) {
          console.error('❌ Error en decodificación simple:', simpleError);
          return null;
        }
      }
    } catch (e) {
      console.error('❌ Error general al decodificar token:', e);
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
      console.log('💾 Guardando información del usuario:', userInfo);

      // Obtener userId del usuario anterior para limpiar datos si es diferente
      const oldUserInfoStr = localStorage.getItem('userInfo');
      let oldUserId: string | null = null;
      if (oldUserInfoStr) {
        try {
          const oldUserInfo = JSON.parse(oldUserInfoStr);
          oldUserId = oldUserInfo.userId || oldUserInfo.email;
        } catch (e) {
          console.error('Error al parsear userInfo anterior:', e);
        }
      }

      const newUserId = userInfo.userId || userInfo.email;

      // Si es un usuario diferente, limpiar el perfil anterior
      if (oldUserId && oldUserId !== newUserId) {
        console.log('🔄 Cambio de usuario detectado. Limpiando datos del usuario anterior.');
        localStorage.removeItem('userProfile');
        // Los favoritos se mantienen asociados al userId, así que no hay problema
      }

      // Guardar fecha de registro del token si está disponible (iat = issued at)
      if (payload.iat && !localStorage.getItem(`userRegistrationDate_${newUserId}`) && !localStorage.getItem(`userRegistrationDate_${userInfo.email}`)) {
        const registrationDate = new Date(payload.iat * 1000); // iat está en segundos
        localStorage.setItem(`userRegistrationDate_${newUserId}`, registrationDate.toISOString());
        localStorage.setItem(`userRegistrationDate_${userInfo.email}`, registrationDate.toISOString());
        console.log('📅 Fecha de registro guardada desde el token:', registrationDate);
      }

      localStorage.setItem('userInfo', JSON.stringify(userInfo));
      localStorage.setItem('userName', userInfo.name);
      localStorage.setItem('userEmail', userInfo.email);

      if (payload.phone || payload.phone_number) {
        localStorage.setItem('userPhone', payload.phone || payload.phone_number);
      }

      this.userInfoSubject.next(userInfo);
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
      } catch (e) {
        this.logout();
      }
    }
  }

  private handleError = (error: HttpErrorResponse): Observable<never> => {
    let errorMessage = 'Ocurrió un error';

    if (error.error instanceof ErrorEvent) {
      // Error del lado del cliente
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Error del lado del servidor
      if (error.status === 0) {
        // Error de conexión - servidor no disponible
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

