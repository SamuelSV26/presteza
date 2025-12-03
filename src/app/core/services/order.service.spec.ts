import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { OrderService } from './order.service';
import { ErrorHandlerService } from './error-handler.service';
import { environment } from '../../../environments/environment';
import { CreateOrderDto } from '../models/CreateOrderDto';
import { UpdateOrderDto } from '../models/UpdateOrderDto';

describe('OrderService', () => {
  let service: OrderService;
  let httpMock: HttpTestingController;
  let errorHandler: jasmine.SpyObj<ErrorHandlerService>;

  beforeEach(() => {
    const errorHandlerSpy = jasmine.createSpyObj('ErrorHandlerService', ['handleHttpError']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        OrderService,
        { provide: ErrorHandlerService, useValue: errorHandlerSpy }
      ]
    });

    service = TestBed.inject(OrderService);
    httpMock = TestBed.inject(HttpTestingController);
    errorHandler = TestBed.inject(ErrorHandlerService) as jasmine.SpyObj<ErrorHandlerService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  // Prueba 41
  it('should be created and handle CRUD operations', (done) => {
    expect(service).toBeTruthy();
    
    const createOrderDto: CreateOrderDto = {
      usuarioId: 'user-123',
      products: [],
      total: 100,
      status: 'pendiente',
      payment_method: 'cash',
      user_name: 'Test User'
    };

    const mockOrder: any = {
      _id: 'order-123',
      usuarioId: 'user-123',
      products: [],
      total: 100,
      status: 'pendiente',
      payment_method: 'cash',
      user_name: 'Test User',
      createdAt: new Date().toISOString()
    };

    service.createOrder(createOrderDto).subscribe({
      next: () => {
        service.findAll().subscribe({
          next: () => {
            service.findOne('order-123').subscribe({
              next: () => {
                service.findByUser('user-123').subscribe({
                  next: () => {
                    service.findByStatus('pendiente').subscribe({
                      next: () => {
                        const updateOrderDto: UpdateOrderDto = { status: 'en_proceso' };
                        service.update('order-123', updateOrderDto).subscribe({
                          next: () => {
                            service.updateStatus('order-123', 'listo').subscribe({
                              next: () => {
                                service.remove('order-123').subscribe({
                                  next: () => done()
                                });
                                const deleteReq = httpMock.expectOne(`${environment.apiUrl}/orders/order-123`);
                                deleteReq.flush({ order: mockOrder });
                              }
                            });
                            const statusReq = httpMock.expectOne(`${environment.apiUrl}/orders/order-123/status`);
                            statusReq.flush({ order: { ...mockOrder, status: 'listo' } });
                          }
                        });
                        const updateReq = httpMock.expectOne(`${environment.apiUrl}/orders/order-123`);
                        updateReq.flush({ order: { ...mockOrder, status: 'en_proceso' } });
                      }
                    });
                    const statusReq = httpMock.expectOne(`${environment.apiUrl}/orders/status/pendiente`);
                    statusReq.flush({ orders: [mockOrder] });
                  }
                });
                const userReq = httpMock.expectOne(`${environment.apiUrl}/orders/user/user-123`);
                userReq.flush({ orders: [mockOrder] });
              }
            });
            const getOneReq = httpMock.expectOne(`${environment.apiUrl}/orders/order-123`);
            getOneReq.flush({ order: mockOrder });
          }
        });
        const findAllReq = httpMock.expectOne(`${environment.apiUrl}/orders`);
        findAllReq.flush({ orders: [mockOrder] });
      }
    });

    const createReq = httpMock.expectOne(`${environment.apiUrl}/orders`);
    createReq.flush({ order: mockOrder });
  });

  // Prueba 42
  it('should map between backend and frontend formats correctly', () => {
    const backendOrder: any = {
      _id: 'order-123',
      usuarioId: 'user-123',
      total: 100,
      status: 'pendiente',
      payment_method: 'cash',
      products: [],
      user_name: 'Test User',
      createdAt: '2024-01-01T10:00:00Z'
    };

    const frontendOrder = service.mapBackendOrderToFrontend(backendOrder);
    expect(frontendOrder.id).toBe('order-123');
    expect(frontendOrder.status).toBe('pending');

    const backendOrder2: any = { 
      _id: '2', 
      usuarioId: 'user-123',
      status: 'Preparando', 
      total: 100, 
      payment_method: 'cash', 
      products: [],
      user_name: 'Test User',
      createdAt: new Date().toISOString() 
    };
    expect(service.mapBackendOrderToFrontend(backendOrder2).status).toBe('preparing');

    expect(service.mapFrontendStatusToBackend('pending')).toBe('pendiente');
    expect(service.mapFrontendStatusToBackend('preparing')).toBe('en_proceso');
    expect(service.mapFrontendStatusToStatusEndpoint('ready')).toBe('listo');
    expect(service.mapPaymentMethodToBackend('card')).toBe('card');
    expect(service.mapPaymentMethodToBackend('nequi')).toBe('nequi');
  });
});

