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
  private apiUrl = 'http://localhost:4000'; // Ajusta según tu backend
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

  login(email: string, password: string): Observable<LoginResponse> {
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
          // El backend devuelve el token directamente en el campo "user"
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
        this.setToken(token);

        const payload = this.decodeToken(token);
        console.log('🔍 Token decodificado completo:', payload);

        if (!payload) {
          console.error('❌ No se pudo decodificar el token. Verifica que el token sea un JWT válido.');
          // Intentar obtener el rol desde la respuesta directamente si está disponible
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

        // Buscar el rol en diferentes campos posibles
        const userRole = payload?.role || payload?.userRole || payload?.rol || payload?.type || 'client';
        console.log('📋 Rol extraído del token (sin normalizar):', userRole);
        console.log('📋 Tipo de dato del rol:', typeof userRole);

        this.decodeAndStoreUserInfo(token);
        this.tokenSubject.next(token);
        this.userInfoSubject.next(this.getUserInfo());
        window.dispatchEvent(new CustomEvent('userLoggedIn'));
        // Redirigir según el rol del usuario
        this.redirectAfterLogin(userRole);
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
    return this.http.post<RegisterResponse>(`${this.apiUrl}/auth/register`, registerData).pipe(
      tap(response => {
        console.log('Respuesta del registro:', response);
      }),
      catchError((error) => {
        console.error('Error en el registro:', error);
        return this.handleError(error);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userInfo');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userPhone');
    this.tokenSubject.next(null);
    this.userInfoSubject.next(null);
    this.router.navigate(['/']);
  }

  getToken(): string | null {
    return localStorage.getItem('authToken');
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;

    // Verificar si el token está expirado
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
    // Si no se pasa el rol como parámetro, obtenerlo del localStorage
    const rawRole = role || this.getRole();
    // Normalizar el rol: convertir a minúsculas y quitar espacios
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
      // Si no tiene rol definido, redirigir al perfil por defecto
      console.warn('⚠️ Rol no reconocido:', userRole, '- Redirigiendo a /perfil por defecto');
      this.router.navigate(['/perfil']);
    }
  }

  private setToken(token: string): void {
    localStorage.setItem('authToken', token);
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

      // Añadir padding si es necesario
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
        // Intentar decodificación más simple
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
      // Buscar el rol en diferentes campos posibles
      const role = payload.role || payload.userRole || payload.rol || payload.type || 'client';
      const userInfo: UserInfo = {
        userId: payload.userId || payload.sub,
        email: payload.email,
        name: payload.name,
        role: role
      };
      console.log('💾 Guardando información del usuario:', userInfo);
      localStorage.setItem('userInfo', JSON.stringify(userInfo));
      localStorage.setItem('userName', userInfo.name);
      localStorage.setItem('userEmail', userInfo.email);

      // Guardar teléfono si está disponible en el token
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

