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

  // Prueba 43
  it('should be created and handle CRUD operations', (done) => {
    expect(service).toBeTruthy();
    
    const createDto: CreateReservationDto = {
      tableNumber: 'T1',
      date: '01/01/2024',
      time: '12:00 p. m.',
      numberOfPeople: 2,
      specialRequests: 'Window seat please'
    };

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

    service.create(createDto).subscribe({
      next: (response) => {
        expect(response).toEqual(mockReservation);
        
        service.findAll().subscribe({
          next: (allReservations) => {
            expect(allReservations.length).toBeGreaterThanOrEqual(0);
            
            service.findMyReservations().subscribe({
              next: () => {
                service.findOne('reservation-123').subscribe({
                  next: () => {
                    const updateDto: UpdateReservationDto = { numberOfPeople: 4, specialRequests: 'Updated request' };
                    service.update('reservation-123', updateDto).subscribe({
                      next: () => {
                        service.updateStatus('reservation-123', 'confirmed').subscribe({
                          next: () => {
                            service.remove('reservation-123').subscribe({
                              next: () => done()
                            });
                            const deleteReq = httpMock.expectOne(`${environment.apiUrl}/reservations/reservation-123`);
                            deleteReq.flush(null);
                          }
                        });
                        const statusReq = httpMock.expectOne(`${environment.apiUrl}/reservations/reservation-123/status`);
                        statusReq.flush({ ...mockReservation, status: 'confirmed' as const });
                      }
                    });
                    const updateReq = httpMock.expectOne(`${environment.apiUrl}/reservations/reservation-123`);
                    updateReq.flush({ ...mockReservation, numberOfPeople: 4, specialRequests: 'Updated request' });
                  }
                });
                const getOneReq = httpMock.expectOne(`${environment.apiUrl}/reservations/reservation-123`);
                getOneReq.flush(mockReservation);
              }
            });
            const myReservationsReq = httpMock.expectOne(`${environment.apiUrl}/reservations/my-reservations`);
            myReservationsReq.flush([mockReservation]);
          }
        });
        const findAllReq = httpMock.expectOne(`${environment.apiUrl}/reservations`);
        findAllReq.flush([mockReservation]);
      }
    });

    const createReq = httpMock.expectOne(`${environment.apiUrl}/reservations`);
    createReq.flush(mockReservation);
  });

  // Prueba 44
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

