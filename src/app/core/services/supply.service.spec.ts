import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SupplyService } from './supply.service';
import { ErrorHandlerService } from './error-handler.service';
import { environment } from '../../../environments/environment';
import { CreateSupplyDto, UpdateSupplyDto } from '../models/Supply';

describe('SupplyService', () => {
  let service: SupplyService;
  let httpMock: HttpTestingController;
  let errorHandler: jasmine.SpyObj<ErrorHandlerService>;

  beforeEach(() => {
    const errorHandlerSpy = jasmine.createSpyObj('ErrorHandlerService', ['handleHttpError']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        SupplyService,
        { provide: ErrorHandlerService, useValue: errorHandlerSpy }
      ]
    });

    service = TestBed.inject(SupplyService);
    httpMock = TestBed.inject(HttpTestingController);
    errorHandler = TestBed.inject(ErrorHandlerService) as jasmine.SpyObj<ErrorHandlerService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  // Prueba 45
  it('should be created and handle CRUD operations', (done) => {
    expect(service).toBeTruthy();
    
    const createDto: CreateSupplyDto = {
      name: 'Test Supply',
      description: 'Test Description',
      unit_price: 10.5,
      quantity: 100
    };

    const mockResponse = {
      supply: {
        _id: 'supply-123',
        name: 'Test Supply',
        quantity: 100,
        unit: 'kg'
      }
    };

    service.create(createDto).subscribe({
      next: (response) => {
        expect(response).toBeDefined();
        
        service.findAll().subscribe({
          next: (allSupplies) => {
            expect(allSupplies).toBeDefined();
            
            service.findOne('supply-123').subscribe({
              next: (supply) => {
                expect(supply).toBeDefined();
                
                const updateDto: UpdateSupplyDto = { quantity: 150 };
                service.update('supply-123', updateDto).subscribe({
                  next: (updated) => {
                    expect(updated).toBeDefined();
                    
                    service.remove('supply-123').subscribe({
                      next: () => done()
                    });
                    const deleteReq = httpMock.expectOne(`${environment.apiUrl}/supplies/supply-123`);
                    deleteReq.flush(mockResponse);
                  }
                });
                const updateReq = httpMock.expectOne(`${environment.apiUrl}/supplies/supply-123`);
                updateReq.flush({ ...mockResponse, supply: { ...mockResponse.supply, quantity: 150 } });
              }
            });
            const getReq = httpMock.expectOne(`${environment.apiUrl}/supplies/supply-123`);
            getReq.flush(mockResponse);
          }
        });
        const findAllReq = httpMock.expectOne(`${environment.apiUrl}/supplies`);
        findAllReq.flush({ supplies: [mockResponse.supply], count: 1 });
      }
    });

    const createReq = httpMock.expectOne(`${environment.apiUrl}/supplies`);
    createReq.flush(mockResponse);
  });

  // Prueba 46
  it('should filter and query supplies by quantity', (done) => {
    const mockResponse = { supplies: [], count: 0 };

    service.findAll(10, 'lt').subscribe({
      next: (response) => {
        expect(response).toBeDefined();
        service.filterByQuantity(10, 'lt').subscribe({
          next: (filtered) => {
            expect(filtered).toBeDefined();
            service.getLowStock(10).subscribe({
              next: (lowStock) => {
                expect(lowStock).toBeDefined();
                service.getOutOfStock().subscribe({
                  next: (outOfStock) => {
                    expect(outOfStock).toBeDefined();
                    done();
                  }
                });
                const outOfStockReq = httpMock.expectOne(`${environment.apiUrl}/supplies/filter/quantity?quantity=0&operator=eq`);
                outOfStockReq.flush(mockResponse);
              }
            });
            const lowStockReq = httpMock.expectOne(`${environment.apiUrl}/supplies/filter/quantity?quantity=10&operator=lt`);
            lowStockReq.flush(mockResponse);
          }
        });
        const filterReq = httpMock.expectOne(`${environment.apiUrl}/supplies/filter/quantity?quantity=10&operator=lt`);
        filterReq.flush(mockResponse);
      }
    });

    const findAllReq = httpMock.expectOne(`${environment.apiUrl}/supplies?quantity=10&operator=lt`);
    findAllReq.flush(mockResponse);
  });
});

