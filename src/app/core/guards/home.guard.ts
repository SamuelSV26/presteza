import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

/**
 * Guard para la página de inicio
 * Verifica que el usuario pueda acceder y prepara el entorno necesario
 */
export const homeGuard: CanActivateFn = (route, state): Observable<boolean> => {
  const router = inject(Router);

  // Verificar si hay datos en localStorage necesarios
  const checkPreconditions = (): boolean => {
    // Aquí puedes agregar validaciones específicas
    // Por ejemplo: verificar si el usuario está autenticado, etc.
    return true;
  };

  // Verificar que la página puede cargarse
  if (!checkPreconditions()) {
    // Si hay algún problema, redirigir o retornar false
    return of(false);
  }

  // Registrar acceso a la página de inicio (para analytics, etc.)
  if (typeof window !== 'undefined' && window.localStorage) {
    const accessCount = parseInt(localStorage.getItem('homeAccessCount') || '0', 10);
    localStorage.setItem('homeAccessCount', (accessCount + 1).toString());
    localStorage.setItem('lastHomeAccess', new Date().toISOString());
  }

  return of(true);
};

