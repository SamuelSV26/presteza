import { TestBed } from '@angular/core/testing';
import { TokenService } from './token.service';

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TokenService);
    // Limpiar cookies antes de cada prueba
    document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;';
  });

  afterEach(() => {
    // Limpiar cookies después de cada prueba
    document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;';
  });

  // Prueba 47
  it('should be created and manage tokens', () => {
    expect(service).toBeTruthy();
    
    expect(service.getToken()).toBeNull();
    
    const token1 = 'test-token-123';
    service.setToken(token1, false);
    expect(service.getToken()).toBe(token1);
    
    const token2 = 'test-token-456';
    service.setToken(token2, true);
    expect(service.getToken()).toBe(token2);
    
    service.deleteToken();
    expect(service.getToken()).toBeNull();
  });

  // Prueba 48
  it('should get token from cookie and overwrite existing tokens', () => {
    const cookieToken = 'test-token-789';
    document.cookie = `authToken=${cookieToken}; path=/;`;
    
    const retrievedToken = service.getToken();
    expect(retrievedToken).toBe(cookieToken);
    
    const newToken = 'new-token';
    service.setToken(newToken, false);
    expect(service.getToken()).toBe(newToken);
  });
});

