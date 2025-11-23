import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { TokenService } from '../services/token.service';

export const adminGuard: CanActivateFn = (route, state) => {
  try {
    const router = inject(Router);
    const authService = inject(AuthService);
    const notificationService = inject(NotificationService);
    const tokenService = inject(TokenService);
    
    // Verificar token primero
    const token = tokenService.getToken();
    if (!token) {
      notificationService.showError('⚠️ No tienes permisos de administrador. Debes iniciar sesión como administrador para acceder a esta sección.');
      router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }
    
    // Verificar autenticación
    const isAuthenticated = authService.isAuthenticated();
    if (!isAuthenticated) {
      notificationService.showError('⚠️ No tienes permisos de administrador. Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
      router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }
    
    // Verificar rol de admin - ESTA ES LA VERIFICACIÓN MÁS IMPORTANTE
    const isAdmin = authService.isAdmin();
    const role = authService.getRole();
    
    // Bloquear acceso si NO es admin
    if (!isAdmin || role?.toLowerCase().trim() !== 'admin') {
      notificationService.showError('🚫 No tienes permisos de administrador. Solo los usuarios con rol de administrador pueden acceder a esta sección.');
      router.navigate(['/']);
      return false;
    }
    
    // Solo permitir acceso si es admin
    return true;
  } catch (error) {
    // En caso de error, bloquear acceso por seguridad
    console.error('[AdminGuard] Error al verificar permisos:', error);
    const router = inject(Router);
    const notificationService = inject(NotificationService);
    notificationService.showError('🚫 No tienes permisos de administrador. Error al verificar permisos.');
    router.navigate(['/']);
    return false;
  }
};

