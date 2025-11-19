import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { TokenService } from '../services/token.service';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const notificationService = inject(NotificationService);
  const token = inject(TokenService).getToken();
  const isAuthenticated = authService.isAuthenticated();
  if (!isAuthenticated || !token) {
    sessionStorage.setItem('returnUrl', state.url);
    router.navigateByUrl('/login?returnUrl=' + encodeURIComponent(state.url));
    return false;
  }
  return true;
};

