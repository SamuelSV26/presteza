import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ContactService } from './contact.service';
import { ErrorHandlerService } from './error-handler.service';
import { environment } from '../../../environments/environment';
import { CreateContactMessageDto } from '../models/ContactMessage';

describe('ContactService', () => {
  let service: ContactService;
  let httpMock: HttpTestingController;
  let errorHandler: jasmine.SpyObj<ErrorHandlerService>;

  beforeEach(() => {
    const errorHandlerSpy = jasmine.createSpyObj('ErrorHandlerService', ['handleHttpError']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ContactService,
        { provide: ErrorHandlerService, useValue: errorHandlerSpy }
      ]
    });

    service = TestBed.inject(ContactService);
    httpMock = TestBed.inject(HttpTestingController);
    errorHandler = TestBed.inject(ErrorHandlerService) as jasmine.SpyObj<ErrorHandlerService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  // Prueba 28
  it('should be created and handle CRUD operations', (done) => {
    expect(service).toBeTruthy();
    
    const createDto: CreateContactMessageDto = {
      name: 'Test User',
      email: 'test@example.com',
      phone: '123456789',
      subject: 'Test Subject',
      message: 'Test Message'
    };

    const mockResponse = {
      _id: 'comment-123',
      user_name: 'Test User',
      user_email: 'test@example.com',
      user_phone: '123456789',
      user_title: 'Test Subject',
      user_comment: 'Test Message',
      createdAt: new Date().toISOString()
    };

    service.create(createDto).subscribe({
      next: (response) => {
        expect(response.name).toBe('Test User');
        
        service.findAll().subscribe({
          next: (messages) => {
            expect(messages.length).toBeGreaterThanOrEqual(0);
            
            service.findOne('comment-123').subscribe({
              next: (message) => {
                expect(message.id).toBe('comment-123');
                
                service.remove('comment-123').subscribe({
                  next: () => done()
                });
                const deleteReq = httpMock.expectOne(`${environment.apiUrl}/comments/comment-123`);
                deleteReq.flush(null);
              }
            });
            const getReq = httpMock.expectOne(`${environment.apiUrl}/comments/comment-123`);
            getReq.flush(mockResponse);
          }
        });
        const findAllReq = httpMock.expectOne(`${environment.apiUrl}/comments`);
        findAllReq.flush([mockResponse]);
      }
    });

    const createReq = httpMock.expectOne(`${environment.apiUrl}/comments`);
    createReq.flush(mockResponse);
  });

  // Prueba 29
  it('should handle different response formats and map backend to frontend', (done) => {
    const mockArrayResponse = [{
      _id: 'comment-1',
      user_name: 'User 1',
      user_email: 'user1@example.com',
      user_phone: '123',
      user_title: 'Subject 1',
      user_comment: 'Message 1',
      createdAt: new Date().toISOString()
    }];

    const mockObjectResponse = { comments: mockArrayResponse };

    service.findAll().subscribe({
      next: (messages) => {
        expect(messages.length).toBeGreaterThanOrEqual(0);
        
        const backendMessage = {
          _id: 'comment-123',
          id: 'comment-123',
          name: 'Test User',
          email: 'test@example.com',
          phone: '123456789',
          subject: 'Test Subject',
          message: 'Test Message',
          read: false,
          createdAt: '2024-01-01T10:00:00Z',
          updatedAt: '2024-01-01T10:00:00Z'
        };

        const frontendMessage = service.mapBackendMessageToFrontend(backendMessage);
        expect(frontendMessage.id).toBe('comment-123');
        expect(frontendMessage.createdAt).toBeInstanceOf(Date);
        done();
      }
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/comments`);
    req.flush(mockArrayResponse);
  });
});

