import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ReservasComponent } from './reservas.component';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { ReservationsService } from '../../core/services/reservations.service';

describe('ReservasComponent', () => {
  let component: ReservasComponent;
  let fixture: ComponentFixture<ReservasComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let notificationService: jasmine.SpyObj<NotificationService>;
  let reservationsService: jasmine.SpyObj<ReservationsService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    const authSpy = jasmine.createSpyObj('AuthService', ['isAuthenticated']);
    const notificationSpy = jasmine.createSpyObj('NotificationService', ['showSuccess', 'showError']);
    const reservationsSpy = jasmine.createSpyObj('ReservationsService', ['create']);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [ReservasComponent, ReactiveFormsModule],
      providers: [
        FormBuilder,
        { provide: AuthService, useValue: authSpy },
        { provide: NotificationService, useValue: notificationSpy },
        { provide: ReservationsService, useValue: reservationsSpy },
        { provide: Router, useValue: routerSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ReservasComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    notificationService = TestBed.inject(NotificationService) as jasmine.SpyObj<NotificationService>;
    reservationsService = TestBed.inject(ReservationsService) as jasmine.SpyObj<ReservationsService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  });

  // Prueba 65
  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Prueba 66
  it('should initialize form with default values', () => {
    authService.isAuthenticated.and.returnValue(true);
    fixture.detectChanges();

    expect(component.reservationForm).toBeDefined();
    expect(component.reservationForm.get('guests')?.value).toBe(2);
  });

  // Prueba 67
  it('should redirect to login if not authenticated', () => {
    authService.isAuthenticated.and.returnValue(false);
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/reservas' } });
  });

  // Prueba 68
  it('should select a table', () => {
    authService.isAuthenticated.and.returnValue(true);
    fixture.detectChanges();

    const table = component.tables[0];
    component.selectTable(table);

    expect(component.selectedTable).toBe(table);
    expect(table.selected).toBe(true);
    expect(component.reservationForm.get('guests')?.value).toBe(table.capacity);
  });

  // Prueba 69
  it('should not select unavailable table', () => {
    authService.isAuthenticated.and.returnValue(true);
    fixture.detectChanges();

    const table = component.tables[0];
    table.available = false;
    component.selectTable(table);

    expect(component.selectedTable).not.toBe(table);
  });

  // Prueba 70
  it('should select bar', () => {
    authService.isAuthenticated.and.returnValue(true);
    fixture.detectChanges();

    component.selectBar();

    expect(component.selectedBar).toBe(true);
    expect(component.selectedTable).toBeNull();
    expect(component.reservationForm.get('guests')?.value).toBe(1);
  });

  // Prueba 71
  it('should select custom capacity', () => {
    authService.isAuthenticated.and.returnValue(true);
    fixture.detectChanges();

    component.customCapacity = 8;
    component.selectCustomCapacity();

    expect(component.showCustomInput).toBe(true);
    expect(component.reservationForm.get('guests')?.value).toBe(8);
  });

  // Prueba 72
  it('should update guests when custom capacity changes', () => {
    authService.isAuthenticated.and.returnValue(true);
    fixture.detectChanges();

    component.customCapacity = 10;
    component.onCustomCapacityChange();

    expect(component.reservationForm.get('guests')?.value).toBe(10);
  });

  // Prueba 73
  it('should not update guests if custom capacity is out of range', () => {
    authService.isAuthenticated.and.returnValue(true);
    fixture.detectChanges();

    const initialValue = component.reservationForm.get('guests')?.value;
    component.customCapacity = 25;
    component.onCustomCapacityChange();

    expect(component.reservationForm.get('guests')?.value).toBe(initialValue);
  });

  // Prueba 74
  it('should get table class correctly', () => {
    authService.isAuthenticated.and.returnValue(true);
    fixture.detectChanges();

    const table = component.tables[0];
    table.available = true;
    table.selected = false;

    expect(component.getTableClass(table)).toContain('available');

    table.selected = true;
    expect(component.getTableClass(table)).toContain('selected');

    table.available = false;
    expect(component.getTableClass(table)).toContain('unavailable');
  });

  // Prueba 75
  it('should get table icon based on capacity', () => {
    authService.isAuthenticated.and.returnValue(true);
    fixture.detectChanges();

    expect(component.getTableIcon(2)).toBe('bi-people');
    expect(component.getTableIcon(4)).toBe('bi-people-fill');
    expect(component.getTableIcon(6)).toBe('bi-people-fill');
  });

  // Prueba 76
  it('should get table shape based on capacity', () => {
    authService.isAuthenticated.and.returnValue(true);
    fixture.detectChanges();

    expect(component.getTableShape(1)).toBe('table-round-small');
    expect(component.getTableShape(3)).toBe('table-round');
    expect(component.getTableShape(5)).toBe('table-rectangle');
    expect(component.getTableShape(6)).toBe('table-rectangle-large');
  });

  // Prueba 77
  it('should get chairs for table', () => {
    authService.isAuthenticated.and.returnValue(true);
    fixture.detectChanges();

    const chairs = component.getChairsForTable(4);
    expect(chairs.length).toBe(4);
  });

  // Prueba 78
  it('should format date to DD/MM/YYYY', () => {
    authService.isAuthenticated.and.returnValue(true);
    fixture.detectChanges();

    const formatted = (component as any).formatDateToDDMMYYYY('2024-01-15');
    expect(formatted).toBe('15/01/2024');
  });

  // Prueba 79
  it('should format time to AM/PM', () => {
    authService.isAuthenticated.and.returnValue(true);
    fixture.detectChanges();

    expect((component as any).formatTimeToAMPM('14:30')).toBe('2:30 p. m.');
    expect((component as any).formatTimeToAMPM('09:15')).toBe('9:15 a. m.');
    expect((component as any).formatTimeToAMPM('00:00')).toBe('12:00 a. m.');
    expect((component as any).formatTimeToAMPM('12:00')).toBe('12:00 p. m.');
  });

  // Prueba 80
  it('should not submit invalid form', () => {
    authService.isAuthenticated.and.returnValue(true);
    fixture.detectChanges();

    component.onSubmit();

    expect(component.submitted).toBe(true);
    expect(reservationsService.create).not.toHaveBeenCalled();
  });

  // Prueba 81
  it('should show error if no table is selected', () => {
    authService.isAuthenticated.and.returnValue(true);
    fixture.detectChanges();

    component.reservationForm.patchValue({
      date: '2024-01-15',
      time: '14:00',
      guests: 2
    });

    component.onSubmit();

    expect(notificationService.showError).toHaveBeenCalled();
    expect(reservationsService.create).not.toHaveBeenCalled();
  });

  // Prueba 82
  it('should submit reservation successfully', (done) => {
    authService.isAuthenticated.and.returnValue(true);
    fixture.detectChanges();

    const table = component.tables[0];
    component.selectTable(table);
    component.reservationForm.patchValue({
      date: '2024-01-15',
      time: '14:00',
      guests: table.capacity,
      specialRequests: 'Window seat'
    });

    reservationsService.create.and.returnValue(of({ 
      _id: '123', 
      tableNumber: table.id,
      date: '15/01/2024',
      time: '2:00 p. m.',
      numberOfPeople: table.capacity,
      userId: 'user-123',
      userName: 'Test User',
      userEmail: 'test@example.com',
      status: 'pending'
    }));

    component.onSubmit();

    setTimeout(() => {
      expect(reservationsService.create).toHaveBeenCalled();
      expect(component.formSuccess).toBe(true);
      expect(notificationService.showSuccess).toHaveBeenCalled();
      done();
    }, 100);
  });

  // Prueba 83
  it('should handle reservation error', (done) => {
    authService.isAuthenticated.and.returnValue(true);
    fixture.detectChanges();

    const table = component.tables[0];
    component.selectTable(table);
    component.reservationForm.patchValue({
      date: '2024-01-15',
      time: '14:00',
      guests: table.capacity
    });

    reservationsService.create.and.returnValue(throwError(() => ({ message: 'Error message' })));

    component.onSubmit();

    setTimeout(() => {
      expect(component.isLoading).toBe(false);
      expect(notificationService.showError).toHaveBeenCalled();
      done();
    }, 100);
  });
});

