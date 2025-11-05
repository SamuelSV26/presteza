import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

/**
 * Guard para proteger la ruta del admin
 * Solo permite acceso a usuarios con rol de administrador
 */
export const adminGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const notificationService = inject(NotificationService);

  // Verificar si el usuario es administrador
  // Si no está autenticado o no es admin, mostrar mensaje de acceso denegado
  if (!authService.isAuthenticated() || !authService.isAdmin()) {
    notificationService.showError('No tienes permisos para acceder a esta sección. Solo los administradores pueden acceder.');
    router.navigate(['/']);
    return false;
  }

  return true;
};

