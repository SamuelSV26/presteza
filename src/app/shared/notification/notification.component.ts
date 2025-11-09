import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, Notification, ConfirmDialog } from '../../core/services/notification.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.css']
})
export class NotificationComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  confirmDialog: ConfirmDialog | null = null;
  private destroy$ = new Subject<void>();

  constructor(private notificationService: NotificationService) {}

  ngOnInit() {
    // Suscribirse a las notificaciones
    this.notificationService.notifications$
      .pipe(takeUntil(this.destroy$))
      .subscribe(notifications => {
        this.notifications = notifications;
      });

    // Suscribirse a los diálogos de confirmación
    this.notificationService.confirmDialog$
      .pipe(takeUntil(this.destroy$))
      .subscribe(dialog => {
        this.confirmDialog = dialog;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  removeNotification(id: string) {
    this.notificationService.removeNotification(id);
  }

  onConfirm(confirmed: boolean) {
    if (this.confirmDialog) {
      this.notificationService.confirmResponse(this.confirmDialog.id, confirmed);
    }
  }

  getIconClass(type: string): string {
    switch (type) {
      case 'success':
        return 'bi-check-circle-fill';
      case 'error':
        return 'bi-x-circle-fill';
      case 'warning':
        return 'bi-exclamation-triangle-fill';
      case 'info':
        return 'bi-info-circle-fill';
      default:
        return 'bi-info-circle-fill';
    }
  }

  trackByNotificationId(index: number, notification: Notification): string {
    return notification.id;
  }
}
