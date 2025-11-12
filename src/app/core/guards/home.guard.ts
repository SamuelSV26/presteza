import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export const homeGuard: CanActivateFn = (route, state): Observable<boolean> => {
  const router = inject(Router);
  const checkPreconditions = (): boolean => {
    return true;
  };
  if (!checkPreconditions()) {
    return of(false);
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    const accessCount = parseInt(localStorage.getItem('homeAccessCount') || '0', 10);
    localStorage.setItem('homeAccessCount', (accessCount + 1).toString());
    localStorage.setItem('lastHomeAccess', new Date().toISOString());
  }
  return of(true);
};

