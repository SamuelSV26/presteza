import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private loadingMessageSubject = new BehaviorSubject<string>('');
  private loadingCount = 0;

  get loading$(): Observable<boolean> {
    return this.loadingSubject.asObservable();
  }

  get loadingMessage$(): Observable<string> {
    return this.loadingMessageSubject.asObservable();
  }

  get isLoading(): boolean {
    return this.loadingSubject.value;
  }

  startLoading(message = ''): void {
    this.loadingCount++;
    this.loadingSubject.next(true);
    if (message) {
      this.loadingMessageSubject.next(message);
    }
  }

  stopLoading(): void {
    this.loadingCount = Math.max(0, this.loadingCount - 1);
    if (this.loadingCount === 0) {
      this.loadingSubject.next(false);
      this.loadingMessageSubject.next('');
    }
  }

  forceStopLoading(): void {
    this.loadingCount = 0;
    this.loadingSubject.next(false);
    this.loadingMessageSubject.next('');
  }

  async executeWithLoading<T>(
    fn: () => Promise<T>,
    message = 'Cargando...'
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
