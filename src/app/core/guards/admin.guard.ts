import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

export const adminGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const notificationService = inject(NotificationService);
  if (!authService.isAuthenticated() || !authService.isAdmin()) {
    notificationService.showError('No tienes permisos para acceder a esta sección. Solo los administradores pueden acceder.');
    router.navigate(['/']);
    return false;
  }
  return true;
};

