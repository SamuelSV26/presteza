import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Servicio para manejar estados de carga globalmente
 */
@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private loadingMessageSubject = new BehaviorSubject<string>('');
  private loadingCount = 0;

  /**
   * Observable para suscribirse al estado de carga
   */
  get loading$(): Observable<boolean> {
    return this.loadingSubject.asObservable();
  }

  /**
   * Observable para el mensaje de carga
   */
  get loadingMessage$(): Observable<string> {
    return this.loadingMessageSubject.asObservable();
  }

  /**
   * Obtener el estado actual de carga
   */
  get isLoading(): boolean {
    return this.loadingSubject.value;
  }

  /**
   * Iniciar carga
   * @param message Mensaje opcional para mostrar durante la carga
   */
  startLoading(message: string = ''): void {
    this.loadingCount++;
    this.loadingSubject.next(true);
    if (message) {
      this.loadingMessageSubject.next(message);
    }
  }

  /**
   * Detener carga
   */
  stopLoading(): void {
    this.loadingCount = Math.max(0, this.loadingCount - 1);
    if (this.loadingCount === 0) {
      this.loadingSubject.next(false);
      this.loadingMessageSubject.next('');
    }
  }

  /**
   * Forzar detención de carga (útil en caso de errores)
   */
  forceStopLoading(): void {
    this.loadingCount = 0;
    this.loadingSubject.next(false);
    this.loadingMessageSubject.next('');
  }

  /**
   * Ejecutar una función asíncrona con loading automático
   */
  async executeWithLoading<T>(
    fn: () => Promise<T>,
    message: string = 'Cargando...'
  ): Promise<T> {
    try {
      this.startLoading(message);
      const result = await fn();
      return result;
    } finally {
      this.stopLoading();
    }
  }
}

