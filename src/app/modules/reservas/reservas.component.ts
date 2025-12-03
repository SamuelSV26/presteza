import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { ReservationsService } from '../../core/services/reservations.service';
import { CreateReservationDto } from '../../core/models/CreateReservationDto';
import { Meta, Title } from '@angular/platform-browser';

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
export class ReservasComponent implements OnInit {
  reservationForm: FormGroup;
  submitted = false;
  formSuccess = false;
  selectedTable: Table | null = null;
  selectedBar = false;
  customCapacity = 7;
  showCustomInput = false;
  isLoading = false;
  minDate = '';

  tables: Table[] = [
    // Mesas de 1 persona - Fila superior
    { id: 'T1', capacity: 1, x: 8, y: 20, available: true },
    { id: 'T2', capacity: 1, x: 18, y: 20, available: true },
    { id: 'T3', capacity: 1, x: 28, y: 20, available: true },
    // Mesas de 2 personas - Fila superior
    { id: 'T4', capacity: 2, x: 38, y: 20, available: true },
    { id: 'T5', capacity: 2, x: 48, y: 20, available: true },
    { id: 'T6', capacity: 2, x: 58, y: 20, available: true },
    // Mesas de 3 personas - Segunda fila
    { id: 'T7', capacity: 3, x: 8, y: 35, available: true },
    { id: 'T8', capacity: 3, x: 20, y: 35, available: true },
    { id: 'T9', capacity: 3, x: 32, y: 35, available: true },
    { id: 'T10', capacity: 3, x: 44, y: 35, available: true },
    { id: 'T11', capacity: 3, x: 56, y: 35, available: true },
    // Mesas de 4 personas - Tercera fila
    { id: 'T12', capacity: 4, x: 8, y: 50, available: true },
    { id: 'T13', capacity: 4, x: 20, y: 50, available: true },
    { id: 'T14', capacity: 4, x: 32, y: 50, available: true },
    { id: 'T15', capacity: 4, x: 44, y: 50, available: true },
    { id: 'T16', capacity: 4, x: 56, y: 50, available: true },
    { id: 'T17', capacity: 4, x: 68, y: 50, available: true },
    // Mesas de 5 personas - Cuarta fila
    { id: 'T18', capacity: 5, x: 10, y: 65, available: true },
    { id: 'T19', capacity: 5, x: 24, y: 65, available: true },
    { id: 'T20', capacity: 5, x: 38, y: 65, available: true },
    { id: 'T21', capacity: 5, x: 52, y: 65, available: true },
    { id: 'T22', capacity: 5, x: 66, y: 65, available: true },
    // Mesas de 6 personas - Fila inferior
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
    private notificationService: NotificationService,
    private title : Title,
    private meta : Meta
  ) {
    this.title.setTitle('Reservas - PRESTEZA');
    this.meta.updateTag({ name: 'description', content: 'Realiza una reserva.' });
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

    if (!this.selectedTable && !this.showCustomInput && !this.selectedBar) {
      this.notificationService.showError('Por favor selecciona una mesa, la barra o especifica el número de personas');
      return;
    }

    this.isLoading = true;

    const formValue = this.reservationForm.value;

    // Determinar el número de mesa
    let tableNumber: string;
    if (this.selectedTable) {
      tableNumber = this.selectedTable.id;
    } else if (this.selectedBar) {
      tableNumber = 'BARRA';
    } else {
      tableNumber = 'CUSTOM';
    }

    const createReservationDto: CreateReservationDto = {
      tableNumber: tableNumber,
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
}
