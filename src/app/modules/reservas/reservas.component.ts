import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { ReservationsService } from '../../core/services/reservations.service';
import { CreateReservationDto } from '../../core/models/CreateReservationDto';
import { Reservation } from '../../core/models/ReservationResponse';
import { interval, Subscription, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface Table {
  id: string;
  capacity: number;
  x: number;
  y: number;
  available: boolean;
  selected?: boolean;
}

@Component({
  selector: 'app-reservas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './reservas.component.html',
  styleUrls: ['./reservas.component.css']
})
export class ReservasComponent implements OnInit, OnDestroy {
  reservationForm: FormGroup;
  submitted = false;
  formSuccess = false;
  selectedTable: Table | null = null;
  selectedBar: boolean = false;
  customCapacity: number = 7;
  showCustomInput = false;
  isLoading = false;
  minDate: string = '';
  confirmedReservations: Reservation[] = [];
  private refreshSubscription?: Subscription;
  private lastUpdateTime: number = 0;

  tables: Table[] = [
    { id: 'T1', capacity: 1, x: 8, y: 20, available: true },
    { id: 'T2', capacity: 1, x: 18, y: 20, available: true },
    { id: 'T3', capacity: 1, x: 28, y: 20, available: true },
    { id: 'T4', capacity: 2, x: 38, y: 20, available: true },
    { id: 'T5', capacity: 2, x: 48, y: 20, available: true },
    { id: 'T6', capacity: 2, x: 58, y: 20, available: true },
    { id: 'T7', capacity: 3, x: 8, y: 35, available: true },
    { id: 'T8', capacity: 3, x: 20, y: 35, available: true },
    { id: 'T9', capacity: 3, x: 32, y: 35, available: true },
    { id: 'T10', capacity: 3, x: 44, y: 35, available: true },
    { id: 'T11', capacity: 3, x: 56, y: 35, available: true },
    { id: 'T12', capacity: 4, x: 8, y: 50, available: true },
    { id: 'T13', capacity: 4, x: 20, y: 50, available: true },
    { id: 'T14', capacity: 4, x: 32, y: 50, available: true },
    { id: 'T15', capacity: 4, x: 44, y: 50, available: true },
    { id: 'T16', capacity: 4, x: 56, y: 50, available: true },
    { id: 'T17', capacity: 4, x: 68, y: 50, available: true },
    { id: 'T18', capacity: 5, x: 10, y: 65, available: true },
    { id: 'T19', capacity: 5, x: 24, y: 65, available: true },
    { id: 'T20', capacity: 5, x: 38, y: 65, available: true },
    { id: 'T21', capacity: 5, x: 52, y: 65, available: true },
    { id: 'T22', capacity: 5, x: 66, y: 65, available: true },
    { id: 'T23', capacity: 6, x: 12, y: 80, available: true },
    { id: 'T24', capacity: 6, x: 28, y: 80, available: true },
    { id: 'T25', capacity: 6, x: 44, y: 80, available: true },
    { id: 'T26', capacity: 6, x: 60, y: 80, available: true },
    { id: 'T27', capacity: 6, x: 76, y: 80, available: true },
  ];

  constructor(
    private fb: FormBuilder,
    private reservationsService: ReservationsService,
    private authService: AuthService,
    private router: Router,
    private notificationService: NotificationService
  ) {
    this.reservationForm = this.fb.group({
      date: ['', [Validators.required]],
      time: ['', [Validators.required]],
      guests: [2, [Validators.required, Validators.min(1), Validators.max(20)]],
      specialRequests: ['']
    });
  }

  ngOnInit() {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/reservas' } });
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    this.minDate = today;
    this.reservationForm.patchValue({ date: today });

    this.loadConfirmedReservations();

    this.refreshSubscription = interval(10000).subscribe(() => {
      this.loadConfirmedReservations();
    });

    this.reservationForm.get('date')?.valueChanges.subscribe(() => {
      setTimeout(() => {
        this.loadConfirmedReservations();
        this.checkTableAvailability();
      }, 500);
    });

    this.reservationForm.get('time')?.valueChanges.subscribe(() => {
      setTimeout(() => {
        this.loadConfirmedReservations();
        this.checkTableAvailability();
      }, 500);
    });
  }

  ngOnDestroy(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  @HostListener('window:focus', ['$event'])
  onWindowFocus(): void {
    this.loadConfirmedReservations();
  }

  onFormInteraction(): void {
    const now = Date.now();
    if (!this.lastUpdateTime || (now - this.lastUpdateTime) > 3000) {
      this.loadConfirmedReservations();
      this.lastUpdateTime = now;
    }
  }

  selectTable(table: Table) {
    if (!table.available) return;

    this.tables.forEach(t => t.selected = false);
    this.selectedBar = false;

    table.selected = true;
    this.selectedTable = table;
    this.reservationForm.patchValue({ guests: table.capacity });
    this.showCustomInput = false;

    if (table.capacity === 1) {
      this.customCapacity = 1;
    } else {
      this.customCapacity = table.capacity;
    }
  }

  selectBar() {
    this.tables.forEach(t => t.selected = false);
    this.selectedTable = null;
    this.selectedBar = true;
    this.showCustomInput = false;
    this.reservationForm.patchValue({ guests: 1 });
    this.customCapacity = 1;
  }

  selectCustomCapacity() {
    this.tables.forEach(t => t.selected = false);
    this.selectedTable = null;
    this.selectedBar = false;
    this.showCustomInput = true;
    this.reservationForm.patchValue({ guests: this.customCapacity });
  }

  onCustomCapacityChange() {
    if (this.customCapacity >= 1 && this.customCapacity <= 20) {
      this.reservationForm.patchValue({ guests: this.customCapacity });
    }
  }

  onGuestsChange() {
    const guests = this.reservationForm.get('guests')?.value;
    if (guests >= 1 && guests <= 20) {
      this.customCapacity = guests;
    }
  }

  getTableClass(table: Table): string {
    let classes = 'table-container';
    if (!table.available) {
      classes += ' unavailable';
    } else if (table.selected) {
      classes += ' selected';
    } else {
      classes += ' available';
    }
    return classes;
  }

  getTableIcon(capacity: number): string {
    switch (capacity) {
      case 2: return 'bi-people';
      case 3: return 'bi-people';
      case 4: return 'bi-people-fill';
      case 5: return 'bi-people-fill';
      case 6: return 'bi-people-fill';
      default: return 'bi-people-fill';
    }
  }

  getTableShape(capacity: number): string {
    if (capacity <= 2) {
      return 'table-round-small';
    } else if (capacity <= 4) {
      return 'table-round';
    } else if (capacity <= 5) {
      return 'table-rectangle';
    } else {
      return 'table-rectangle-large';
    }
  }

  getChairsForTable(capacity: number): number[] {
    return Array(capacity).fill(0).map((_, i) => i);
  }

  getChairPosition(index: number, capacity: number): string {
    const angle = (360 / capacity) * index;
    const radius = capacity <= 2 ? 35 : capacity <= 4 ? 40 : 45;
    const radian = (angle * Math.PI) / 180;
    const x = Math.cos(radian) * radius;
    const y = Math.sin(radian) * radius;
    return `translate(${x}px, ${y}px)`;
  }

  private formatDateToDDMMYYYY(dateString: string): string {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  }

  private formatTimeToAMPM(timeString: string): string {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    let period: string;
    let displayHour: number;

    if (hour === 0) {
      period = 'a. m.';
      displayHour = 12;
    } else if (hour === 12) {
      period = 'p. m.';
      displayHour = 12;
    } else if (hour > 12) {
      period = 'p. m.';
      displayHour = hour - 12;
    } else {
      period = 'a. m.';
      displayHour = hour;
    }

    return `${displayHour}:${minutes} ${period}`;
  }

  onSubmit() {
    this.submitted = true;

    if (this.reservationForm.invalid) {
      return;
    }

    if (!this.selectedTable) {
      this.notificationService.showError('Por favor selecciona una mesa para realizar la reserva');
      return;
    }

    this.isLoading = true;

    const formValue = this.reservationForm.value;

    const createReservationDto: CreateReservationDto = {
      tableNumber: this.selectedTable.id,
      date: this.formatDateToDDMMYYYY(formValue.date),
      time: this.formatTimeToAMPM(formValue.time),
      numberOfPeople: formValue.guests,
      specialRequests: formValue.specialRequests || undefined
    };

    this.reservationsService.create(createReservationDto).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.formSuccess = true;
        this.reservationForm.reset();
        this.selectedTable = null;
        this.selectedBar = false;
        this.tables.forEach(t => t.selected = false);
        this.showCustomInput = false;
        this.submitted = false;

        const today = new Date().toISOString().split('T')[0];
        this.reservationForm.patchValue({ date: today });

        setTimeout(() => {
          this.loadConfirmedReservations();
        }, 1000);

        this.notificationService.showSuccess('¡Reserva realizada exitosamente!');

        setTimeout(() => {
          this.formSuccess = false;
        }, 5000);
      },
      error: (error) => {
        this.isLoading = false;
        const errorMessage = error?.message || error?.error?.message || 'Error al realizar la reserva. Por favor intenta nuevamente.';
        this.notificationService.showError(errorMessage);
      }
    });
  }

  get f() {
    return this.reservationForm.controls;
  }

  loadConfirmedReservations(): void {
    this.reservationsService.findAll().pipe(
      catchError((error) => {
        return of([]);
      })
    ).subscribe({
      next: (reservations) => {
        this.confirmedReservations = reservations
          .filter(r => r.status === 'confirmed' || r.status === 'pending')
          .map(r => this.reservationsService.mapBackendReservationToFrontend(r));

        this.checkTableAvailability();
      }
    });
  }

  checkTableAvailability(): void {
    const selectedDate = this.reservationForm.get('date')?.value;
    const selectedTime = this.reservationForm.get('time')?.value;

    if (!selectedDate || !selectedTime) {
      this.tables.forEach(table => table.available = true);
      return;
    }

    const formattedSelectedDate = this.formatDateToDDMMYYYY(selectedDate);
    const selectedTimeInMinutes = this.timeToMinutes(selectedTime);

    this.tables.forEach(table => table.available = true);

    this.confirmedReservations.forEach(reservation => {
      const datesMatch = reservation.date === formattedSelectedDate;

      if (datesMatch) {
        const reservationTimeInMinutes = this.timeToMinutesFromAMPM(reservation.time);
        const reservationEndTimeInMinutes = reservationTimeInMinutes + 30;
        const isTimeInRange = selectedTimeInMinutes >= reservationTimeInMinutes &&
          selectedTimeInMinutes < reservationEndTimeInMinutes;

        if (isTimeInRange) {
          const table = this.tables.find(t => t.id === reservation.tableNumber);
          if (table) {
            table.available = false;
            console.log(`✓ Mesa ${table.id} marcada como OCUPADA (reserva: ${reservation.time}, rango: ${reservationTimeInMinutes}-${reservationEndTimeInMinutes} min, seleccionado: ${selectedTimeInMinutes} min)`);
            if (table.selected) {
              table.selected = false;
              this.selectedTable = null;
            }
          } else {
            console.warn(`⚠ No se encontró la mesa ${reservation.tableNumber} en el array de mesas`);
          }
        }
      }
    });
  }

  private timeToMinutes(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private timeToMinutesFromAMPM(timeString: string): number {
    const normalized = this.normalizeTime(timeString);
    const match = normalized.match(/(\d+):(\d+)\s+(a\.\s*m\.|p\.\s*m\.)/i);
    if (!match) {
      return this.timeToMinutes(timeString);
    }

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toLowerCase();

    if (period.includes('p') && hours !== 12) {
      hours += 12;
    } else if (period.includes('a') && hours === 12) {
      hours = 0;
    }

    return hours * 60 + minutes;
  }

  private normalizeTime(time: string): string {
    if (time.match(/^\d{1,2}:\d{2}$/)) {
      return this.formatTimeToAMPM(time);
    }
    return time.trim().replace(/\s+/g, ' ');
  }
}
