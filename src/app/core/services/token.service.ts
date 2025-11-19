import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TokenService {

  setToken(token: string, rememberMe: boolean): void {
    const expirationDays = rememberMe ? 30 : 1;
    const expires = new Date();
    expires.setDate(expires.getDate() + expirationDays);

    document.cookie = `authToken=${token}; expires=${expires.toUTCString()}; path=/; Secure; SameSite=Lax`;
  }

  getToken(): string | null {
    const match = document.cookie.match(new RegExp('(^| )authToken=([^;]+)'));
    return match ? match[2] : null;
  }

  deleteToken(): void {
    document.cookie = "authToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;";
  }
}
