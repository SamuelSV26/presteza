import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
    jasmine.clock().install();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  // Prueba 28
  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // Prueba 29
  it('should show success notification', (done) => {
    service.showSuccess('Test success message');

    service.notifications$.subscribe(notifications => {
      if (notifications.length > 0) {
        expect(notifications[0].type).toBe('success');
        expect(notifications[0].message).toBe('Test success message');
        done();
      }
    });
  });

  // Prueba 30
  it('should show error notification', (done) => {
    service.showError('Test error message');

    service.notifications$.subscribe(notifications => {
      if (notifications.length > 0) {
        expect(notifications[0].type).toBe('error');
        expect(notifications[0].message).toBe('Test error message');
        done();
      }
    });
  });

  // Prueba 31
  it('should show info notification', (done) => {
    service.showInfo('Test info message');

    service.notifications$.subscribe(notifications => {
      if (notifications.length > 0) {
        expect(notifications[0].type).toBe('info');
        expect(notifications[0].message).toBe('Test info message');
        done();
      }
    });
  });

  // Prueba 32
  it('should show warning notification', (done) => {
    service.showWarning('Test warning message');

    service.notifications$.subscribe(notifications => {
      if (notifications.length > 0) {
        expect(notifications[0].type).toBe('warning');
        expect(notifications[0].message).toBe('Test warning message');
        done();
      }
    });
  });

  // Prueba 33
  it('should remove notification after duration', (done) => {
    service.showSuccess('Test message', undefined, 1000);

    service.notifications$.subscribe(notifications => {
      if (notifications.length > 0) {
        jasmine.clock().tick(1100);
        service.notifications$.subscribe(updatedNotifications => {
          expect(updatedNotifications.length).toBe(0);
          done();
        });
      }
    });
  });

  // Prueba 34
  it('should remove notification by id', (done) => {
    service.showSuccess('Test message');

    let notificationId: string;
    service.notifications$.subscribe(notifications => {
      if (notifications.length > 0 && !notificationId) {
        notificationId = notifications[0].id;
        service.removeNotification(notificationId);
      }
      if (notifications.length === 0 && notificationId) {
        expect(notifications.length).toBe(0);
        done();
      }
    });
  });

  // Prueba 35
  it('should show notification with custom title', (done) => {
    service.showSuccess('Test message', 'Custom Title');

    service.notifications$.subscribe(notifications => {
      if (notifications.length > 0) {
        expect(notifications[0].title).toBe('Custom Title');
        done();
      }
    });
  });

  // Prueba 36
  it('should create confirm dialog', (done) => {
    const promise = service.confirm('Test Title', 'Test Message', 'Yes', 'No');

    service.confirmDialog$.subscribe(dialog => {
      if (dialog) {
        expect(dialog.title).toBe('Test Title');
        expect(dialog.message).toBe('Test Message');
        expect(dialog.confirmText).toBe('Yes');
        expect(dialog.cancelText).toBe('No');
        done();
      }
    });
  });

  // Prueba 37
  it('should resolve confirm dialog with true when confirmed', (done) => {
    const promise = service.confirm('Test Title', 'Test Message');

    service.confirmDialog$.subscribe(dialog => {
      if (dialog) {
        service.confirmResponse(dialog.id, true);
        promise.then(result => {
          expect(result).toBe(true);
          done();
        });
      }
    });
  });

  // Prueba 38
  it('should resolve confirm dialog with false when cancelled', (done) => {
    const promise = service.confirm('Test Title', 'Test Message');

    service.confirmDialog$.subscribe(dialog => {
      if (dialog) {
        service.confirmResponse(dialog.id, false);
        promise.then(result => {
          expect(result).toBe(false);
          done();
        });
      }
    });
  });

  // Prueba 39
  it('should generate unique notification IDs', () => {
    service.showSuccess('Message 1');
    service.showError('Message 2');

    let ids: string[] = [];
    service.notifications$.subscribe(notifications => {
      if (notifications.length === 2) {
        ids = notifications.map(n => n.id);
        expect(ids[0]).not.toBe(ids[1]);
      }
    });
  });
});


