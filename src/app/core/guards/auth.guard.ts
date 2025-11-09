import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

/**
 * Guard para proteger rutas que requieren autenticación
 * Redirige al login si el usuario no está autenticado
 */
export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const notificationService = inject(NotificationService);

  // Verificar si el usuario está autenticado
  const isAuthenticated = authService.isAuthenticated();
  console.log('🔒 authGuard - Verificando autenticación para:', state.url);
  console.log('🔒 authGuard - Usuario autenticado:', isAuthenticated);
  
  if (!isAuthenticated) {
    console.log('❌ authGuard - Usuario no autenticado, redirigiendo a login');
    notificationService.showWarning('Debes iniciar sesión para acceder a esta sección');
    // Guardar el returnUrl en sessionStorage para que esté disponible después del login
    sessionStorage.setItem('returnUrl', state.url);
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  console.log('✅ authGuard - Usuario autenticado, permitiendo acceso');
  return true;
};

