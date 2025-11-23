import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { TokenService } from '../services/token.service';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const notificationService = inject(NotificationService);
  const tokenService = inject(TokenService);
  
  const token = tokenService.getToken();
  const isAuthenticated = authService.isAuthenticated();
  
  if (!token || !isAuthenticated) {
    notificationService.showError('Debes iniciar sesión para acceder a esta sección.');
    sessionStorage.setItem('returnUrl', state.url);
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
  
  return true;
};

