import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ErrorHandlerService } from './error-handler.service';
import { environment } from '../../../environments/environment';

export interface Add {
  _id?: string;
  id?: string;
  name: string;
  description: string;
  price: number;
  categoryIds: string[];
  dishIds?: string[];
  available: boolean;
  image?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AddsService {
  private apiUrl = `${environment.apiUrl}/adds`;
  private addsCache: Add[] | null = null;

  constructor(
    private http: HttpClient,
    private errorHandler: ErrorHandlerService
  ) { }

  findAll(): Observable<Add[]> {
    return this.http.get<Add[]>(this.apiUrl).pipe(
      map(adds => {
        this.addsCache = adds;
        return adds;
      }),
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  findAvailable(): Observable<Add[]> {
    return this.http.get<Add[]>(`${this.apiUrl}/available`).pipe(
      map((adds: Add[]) => {
        this.addsCache = adds;
        return adds;
      }),
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  findOne(id: string): Observable<Add> {
    return this.http.get<Add>(`${this.apiUrl}/${id}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  findByCategory(categoryId: string): Observable<Add[]> {
    return this.http.get<Add[]>(`${this.apiUrl}/category/${categoryId}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  findByName(name: string): Observable<Add | null> {
    return this.findAvailable().pipe(
      map(adds => {
        const normalizedName = name.toLowerCase().trim();
        const add = adds.find(a =>
          a.name.toLowerCase().trim() === normalizedName ||
          a.name.toLowerCase().includes(normalizedName.replace('addon-', '').replace('extra', '').trim())
        );
        return add || null;
      }),
      catchError(() => of(null))
    );
  }

  mapFrontendIdToBackendId(frontendId: string): Observable<string | null> {
    if (/^[0-9a-fA-F]{24}$/.test(frontendId)) {
      return of(frontendId);
    }

    const nameFromId = frontendId
      .replace(/^addon-/, '')
      .replace(/-/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return this.findAvailable().pipe(
      map(adds => {
        const normalizedSearch = nameFromId.toLowerCase().trim();
        const add = adds.find(a => {
          const addName = a.name.toLowerCase().trim();
          return addName.includes(normalizedSearch) ||
            normalizedSearch.includes(addName.replace(' extra', '').replace(' extra', ''));
        });

        if (add) {
          return add._id || add.id || null;
        }

        const addById = adds.find(a => (a._id || a.id) === frontendId);
        return addById ? (addById._id || addById.id || null) : null;
      }),
      catchError(() => of(null))
    );
  }

  mapFrontendIdsToBackendIds(frontendIds: string[]): Observable<Map<string, string>> {
    const result = new Map<string, string>();

    if (frontendIds.length === 0) {
      return of(result);
    }

    return this.findAvailable().pipe(
      map(adds => {
        frontendIds.forEach(frontendId => {
          if (/^[0-9a-fA-F]{24}$/.test(frontendId)) {
            result.set(frontendId, frontendId);
            return;
          }

          const nameFromId = frontendId
            .replace(/^addon-/, '')
            .replace(/-/g, ' ')
            .toLowerCase()
            .trim();

          const add = adds.find(a => {
            const addName = a.name.toLowerCase().trim();
            const cleanAddName = addName
              .replace(/\s+extra\s*/g, ' ')
              .replace(/\s+adicional\s*/g, ' ')
              .trim();

            return cleanAddName === nameFromId ||
              cleanAddName.includes(nameFromId) ||
              nameFromId.includes(cleanAddName) ||
              nameFromId.split(' ').some(word => cleanAddName.includes(word));
          });

          if (add) {
            const backendId = add._id || add.id;
            if (backendId) {
              result.set(frontendId, backendId);
              console.log(`Mapeado: "${frontendId}" -> "${backendId}" (${add.name})`);
            }
          } else {
            console.warn(`No se encontró mapeo para el ID del frontend: "${frontendId}"`);
          }
        });

        return result;
      }),
      catchError((error) => {
        console.error('Error al mapear IDs de adicionales:', error);
        return of(result);
      })
    );
  }

  create(createAddDto: { name: string; description: string; price: number; categoryIds: string[]; available?: boolean; image?: string; dishIds?: string[] }): Observable<Add> {
    return this.http.post<Add>(this.apiUrl, createAddDto).pipe(
      map(add => {
        if (this.addsCache) {
          this.addsCache.push(add);
        }
        return add;
      }),
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  update(id: string, updateAddDto: Partial<{ name: string; description: string; price: number; categoryIds: string[]; available?: boolean; image?: string; dishIds?: string[] }>): Observable<Add> {
    return this.http.patch<Add>(`${this.apiUrl}/${id}`, updateAddDto).pipe(
      map(updatedAdd => {
        if (this.addsCache) {
          const index = this.addsCache.findIndex(a => (a._id || a.id) === id);
          if (index > -1) {
            this.addsCache[index] = updatedAdd;
          }
        }
        return updatedAdd;
      }),
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      map(() => {
        if (this.addsCache) {
          this.addsCache = this.addsCache.filter(a => (a._id || a.id) !== id);
        }
        return undefined;
      }),
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }
}
