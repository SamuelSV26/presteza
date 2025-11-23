import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ReservationsService } from './reservations.service';
import { ErrorHandlerService } from './error-handler.service';
import { environment } from '../../../environments/environment';
import { CreateReservationDto } from '../models/CreateReservationDto';
import { UpdateReservationDto } from '../models/UpdateReservationDto';

describe('ReservationsService', () => {
  let service: ReservationsService;
  let httpMock: HttpTestingController;
  let errorHandler: jasmine.SpyObj<ErrorHandlerService>;

  beforeEach(() => {
    const errorHandlerSpy = jasmine.createSpyObj('ErrorHandlerService', ['handleHttpError']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ReservationsService,
        { provide: ErrorHandlerService, useValue: errorHandlerSpy }
      ]
    });

    service = TestBed.inject(ReservationsService);
    httpMock = TestBed.inject(HttpTestingController);
    errorHandler = TestBed.inject(ErrorHandlerService) as jasmine.SpyObj<ErrorHandlerService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  // Prueba 40
  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // Prueba 41
  it('should create a reservation', (done) => {
    const createDto: CreateReservationDto = {
      tableNumber: 'T1',
      date: '01/01/2024',
      time: '12:00 p. m.',
      numberOfPeople: 2,
      specialRequests: 'Window seat please'
    };

    const mockResponse = {
      _id: 'reservation-123',
      tableNumber: 'T1',
      date: '01/01/2024',
      time: '12:00 p. m.',
      numberOfPeople: 2,
      userId: 'user-123',
      userName: 'Test User',
      userEmail: 'test@example.com',
      status: 'pending' as const
    };

    service.create(createDto).subscribe({
      next: (response) => {
        expect(response).toEqual(mockResponse);
        done();
      }
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/reservations`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(createDto);
    req.flush(mockResponse);
  });

  // Prueba 42
  it('should get all reservations', (done) => {
    const mockReservations = [
      { _id: '1', tableNumber: 'T1', date: '01/01/2024', time: '12:00 p. m.', numberOfPeople: 2, userId: 'user-1', userName: 'User 1', userEmail: 'user1@example.com', status: 'pending' as const },
      { _id: '2', tableNumber: 'T2', date: '02/01/2024', time: '13:00 p. m.', numberOfPeople: 4, userId: 'user-2', userName: 'User 2', userEmail: 'user2@example.com', status: 'confirmed' as const }
    ];

    service.findAll().subscribe({
      next: (response) => {
        expect(response).toEqual(mockReservations);
        done();
      }
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/reservations`);
    expect(req.request.method).toBe('GET');
    req.flush(mockReservations);
  });

  // Prueba 43
  it('should get my reservations', (done) => {
    const mockReservations = [
      { _id: '1', tableNumber: 'T1', date: '01/01/2024', time: '12:00 p. m.', numberOfPeople: 2, userId: 'user-1', userName: 'User 1', userEmail: 'user1@example.com', status: 'pending' as const }
    ];

    service.findMyReservations().subscribe({
      next: (response) => {
        expect(response).toEqual(mockReservations);
        done();
      }
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/reservations/my-reservations`);
    expect(req.request.method).toBe('GET');
    req.flush(mockReservations);
  });

  // Prueba 44
  it('should get one reservation by id', (done) => {
    const mockReservation = {
      _id: 'reservation-123',
      tableNumber: 'T1',
      date: '01/01/2024',
      time: '12:00 p. m.',
      numberOfPeople: 2,
      userId: 'user-123',
      userName: 'Test User',
      userEmail: 'test@example.com',
      status: 'pending' as const
    };

    service.findOne('reservation-123').subscribe({
      next: (response) => {
        expect(response).toEqual(mockReservation);
        done();
      }
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/reservations/reservation-123`);
    expect(req.request.method).toBe('GET');
    req.flush(mockReservation);
  });

  // Prueba 45
  it('should update a reservation', (done) => {
    const updateDto: UpdateReservationDto = {
      numberOfPeople: 4,
      specialRequests: 'Updated request'
    };

    const mockResponse = {
      _id: 'reservation-123',
      tableNumber: 'T1',
      date: '01/01/2024',
      time: '12:00 p. m.',
      numberOfPeople: 4,
      specialRequests: 'Updated request',
      userId: 'user-123',
      userName: 'Test User',
      userEmail: 'test@example.com',
      status: 'pending' as const
    };

    service.update('reservation-123', updateDto).subscribe({
      next: (response) => {
        expect(response).toEqual(mockResponse);
        done();
      }
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/reservations/reservation-123`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(updateDto);
    req.flush(mockResponse);
  });

  // Prueba 46
  it('should update reservation status', (done) => {
    const mockResponse = {
      _id: 'reservation-123',
      tableNumber: 'T1',
      date: '01/01/2024',
      time: '12:00 p. m.',
      numberOfPeople: 2,
      userId: 'user-123',
      userName: 'Test User',
      userEmail: 'test@example.com',
      status: 'confirmed' as const
    };

    service.updateStatus('reservation-123', 'confirmed').subscribe({
      next: (response) => {
        expect(response).toEqual(mockResponse);
        done();
      }
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/reservations/reservation-123/status`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'confirmed' });
    req.flush(mockResponse);
  });

  // Prueba 47
  it('should delete a reservation', (done) => {
    service.remove('reservation-123').subscribe({
      next: () => {
        done();
      }
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/reservations/reservation-123`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  // Prueba 48
  it('should map backend reservation to frontend format', () => {
    const backendReservation = {
      _id: 'reservation-123',
      tableNumber: 'T1',
      date: '01/01/2024',
      time: '12:00 p. m.',
      numberOfPeople: 2,
      specialRequests: 'Window seat',
      userId: 'user-123',
      userName: 'Test User',
      userEmail: 'test@example.com',
      status: 'pending' as const,
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-01T10:00:00Z'
    };

    const frontendReservation = service.mapBackendReservationToFrontend(backendReservation);

    expect(frontendReservation.id).toBe('reservation-123');
    expect(frontendReservation.tableNumber).toBe('T1');
    expect(frontendReservation.date).toBe('01/01/2024');
    expect(frontendReservation.numberOfPeople).toBe(2);
    expect(frontendReservation.status).toBe('pending');
    expect(frontendReservation.createdAt).toBeInstanceOf(Date);
  });
});

