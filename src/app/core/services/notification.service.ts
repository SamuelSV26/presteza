import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  title?: string;
  duration?: number;
}

export interface ConfirmDialog {
  id: string;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  private confirmDialogSubject = new BehaviorSubject<ConfirmDialog | null>(null);
  public confirmDialog$ = this.confirmDialogSubject.asObservable();

  private confirmResponseSubject = new BehaviorSubject<{ id: string; confirmed: boolean } | null>(null);
  public confirmResponse$ = this.confirmResponseSubject.asObservable();

  showSuccess(message: string, title?: string, duration: number = 3000): void {
    this.addNotification({
      id: this.generateId(),
      type: 'success',
      message,
      title,
      duration
    });
  }

  showError(message: string, title?: string, duration: number = 5000): void {
    this.addNotification({
      id: this.generateId(),
      type: 'error',
      message,
      title,
      duration
    });
  }

  showInfo(message: string, title?: string, duration: number = 3000): void {
    this.addNotification({
      id: this.generateId(),
      type: 'info',
      message,
      title,
      duration
    });
  }

  showWarning(message: string, title?: string, duration: number = 4000): void {
    this.addNotification({
      id: this.generateId(),
      type: 'warning',
      message,
      title,
      duration
    });
  }

  confirm(title: string, message: string, confirmText: string = 'Aceptar', cancelText: string = 'Cancelar'): Promise<boolean> {
    return new Promise((resolve) => {
      const dialogId = this.generateId();
      const dialog: ConfirmDialog = {
        id: dialogId,
        title,
        message,
        confirmText,
        cancelText
      };

      this.confirmDialogSubject.next(dialog);

      // Escuchar la respuesta
      const subscription = this.confirmResponse$.subscribe(response => {
        if (response && response.id === dialogId) {
          subscription.unsubscribe();
          this.confirmDialogSubject.next(null);
          this.confirmResponseSubject.next(null);
          resolve(response.confirmed);
        }
      });
    });
  }

  removeNotification(id: string): void {
    const current = this.notificationsSubject.value;
    this.notificationsSubject.next(current.filter(n => n.id !== id));
  }

  private addNotification(notification: Notification): void {
    const current = this.notificationsSubject.value;
    this.notificationsSubject.next([...current, notification]);

    // Auto-remover después de la duración
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        this.removeNotification(notification.id);
      }, notification.duration);
    }
  }

  confirmResponse(id: string, confirmed: boolean): void {
    this.confirmResponseSubject.next({ id, confirmed });
  }

  private generateId(): string {
    return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
