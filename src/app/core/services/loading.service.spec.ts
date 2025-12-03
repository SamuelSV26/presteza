import { TestBed } from '@angular/core/testing';
import { LoadingService } from './loading.service';
import { take } from 'rxjs/operators';

describe('LoadingService', () => {
  let service: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoadingService);
  });

  // Prueba 34
  it('should be created and manage loading state', (done) => {
    expect(service).toBeTruthy();
    
    const message = 'Cargando datos...';
    service.startLoading(message);
    
    service.loading$.pipe(take(1)).subscribe(loading => {
      expect(loading).toBe(true);
      
      service.loadingMessage$.pipe(take(1)).subscribe(loadingMessage => {
        expect(loadingMessage).toBe(message);
        
        service.stopLoading();
        service.loading$.pipe(take(1)).subscribe(stopped => {
          expect(stopped).toBe(false);
          done();
        });
      });
    });
  });

  // Prueba 35
  it('should handle multiple loading requests and force stop', (done) => {
    service.startLoading();
    service.startLoading();
    service.startLoading();
    
    expect(service.isLoading).toBe(true);
    
    service.stopLoading();
    expect(service.isLoading).toBe(true);
    
    service.forceStopLoading();
    
    service.loading$.pipe(take(1)).subscribe(loading => {
      expect(loading).toBe(false);
      
      service.loadingMessage$.pipe(take(1)).subscribe(message => {
        expect(message).toBe('');
        done();
      });
    });
  });

  // Prueba 36
  it('should execute functions with loading and handle errors', async () => {
    const testFunction = async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return 'result';
    };

    const result = await service.executeWithLoading(testFunction, 'Ejecutando...');
    expect(result).toBe('result');
    expect(service.isLoading).toBe(false);

    const errorFunction = async () => {
      throw new Error('Test error');
    };

    try {
      await service.executeWithLoading(errorFunction, 'Ejecutando...');
    } catch (error) {
      expect(error).toBeDefined();
    }
    
    expect(service.isLoading).toBe(false);
  });
});

