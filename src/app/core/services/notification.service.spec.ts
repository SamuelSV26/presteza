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

  // Prueba 39
  it('should be created and show all notification types', (done) => {
    expect(service).toBeTruthy();
    
    service.showSuccess('Test success message', 'Success Title');
    service.showError('Test error message');
    service.showInfo('Test info message');
    service.showWarning('Test warning message');

    let count = 0;
    service.notifications$.subscribe(notifications => {
      if (notifications.length >= 4 && count === 0) {
        expect(notifications.find(n => n.type === 'success')?.message).toBe('Test success message');
        expect(notifications.find(n => n.type === 'error')?.message).toBe('Test error message');
        expect(notifications.find(n => n.type === 'info')?.message).toBe('Test info message');
        expect(notifications.find(n => n.type === 'warning')?.message).toBe('Test warning message');
        expect(notifications.find(n => n.title === 'Success Title')?.title).toBe('Success Title');
        
        const ids = notifications.map(n => n.id);
        expect(new Set(ids).size).toBe(ids.length);
        count++;
        done();
      }
    });
  });

  // Prueba 40
  it('should manage notification lifecycle and confirm dialogs', (done) => {
    service.showSuccess('Test message', undefined, 1000);
    
    let notificationId: string;
    let firstDialogHandled = false;
    service.notifications$.subscribe(notifications => {
      if (notifications.length > 0 && !notificationId) {
        notificationId = notifications[0].id;
        service.removeNotification(notificationId);
      }
      if (notifications.length === 0 && notificationId && !firstDialogHandled) {
        firstDialogHandled = true;
        const promise = service.confirm('Test Title', 'Test Message', 'Yes', 'No');
        
        service.confirmDialog$.subscribe(dialog => {
          if (dialog && dialog.title === 'Test Title') {
            expect(dialog.title).toBe('Test Title');
            service.confirmResponse(dialog.id, true);
            promise.then(result => {
              expect(result).toBe(true);
              
              const promise2 = service.confirm('Test Title 2', 'Test Message 2');
              service.confirmDialog$.subscribe(dialog2 => {
                if (dialog2 && dialog2.title === 'Test Title 2') {
                  expect(dialog2.title).toBe('Test Title 2');
                  service.confirmResponse(dialog2.id, false);
                  promise2.then(result2 => {
                    expect(result2).toBe(false);
                    done();
                  });
                }
              });
            });
          }
        });
      }
    });
  });
});


