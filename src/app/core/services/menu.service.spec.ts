import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MenuService } from './menu.service';
import { SupplyService } from './supply.service';
import { of } from 'rxjs';

describe('MenuService', () => {
  let service: MenuService;
  let httpMock: HttpTestingController;
  let supplyService: jasmine.SpyObj<SupplyService>;

  beforeEach(() => {
    const supplyServiceSpy = jasmine.createSpyObj('SupplyService', ['findAll']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        MenuService,
        { provide: SupplyService, useValue: supplyServiceSpy }
      ]
    });

    service = TestBed.inject(MenuService);
    httpMock = TestBed.inject(HttpTestingController);
    supplyService = TestBed.inject(SupplyService) as jasmine.SpyObj<SupplyService>;
    supplyService.findAll.and.returnValue(of({ supplies: [], message: 'Success', count: 0 }));
  });

  afterEach(() => {
    httpMock.verify();
  });

  // Prueba 37
  it('should be created and handle categories operations', (done) => {
    expect(service).toBeTruthy();
    
    const mockCategories = [
      { id: '1', name: 'Bebidas', description: 'Bebidas frías y calientes' },
      { id: '2', name: 'Comidas', description: 'Platos principales' }
    ];

    service.getCategories().subscribe({
      next: (categories) => {
        expect(categories.length).toBe(2);
        
        service.getCategoryById('1').subscribe({
          next: (category) => {
            expect(category?.name).toBe('Bebidas');
            
            service.getCategoryById(null).subscribe({
              next: (nullCategory) => {
                expect(nullCategory).toBeUndefined();
                
                const categoryData = { name: 'New Category', description: 'A new category' };
                service.createCategory(categoryData).subscribe({
                  next: (newCategory) => {
                    expect(newCategory).toBeDefined();
                    
                    service.updateCategory('1', { name: 'Updated Category' }).subscribe({
                      next: (updated) => {
                        expect(updated).toBeDefined();
                        
                        service.deleteCategory('1').subscribe({
                          next: () => done()
                        });
                        const deleteReq = httpMock.expectOne('http://localhost:4000/categories/1');
                        deleteReq.flush(null);
                      }
                    });
                    const updateReq = httpMock.expectOne('http://localhost:4000/categories/1');
                    updateReq.flush({ category: { id: '1', name: 'Updated Category' } });
                  }
                });
                const createReq = httpMock.expectOne('http://localhost:4000/categories');
                createReq.flush({ category: { id: 'new-cat', ...categoryData } });
              }
            });
          }
        });
        const getByIdReq = httpMock.expectOne('http://localhost:4000/categories/1');
        getByIdReq.flush({ category: mockCategories[0] });
      }
    });

    const req = httpMock.expectOne('http://localhost:4000/categories');
    req.flush({ categories: mockCategories });
  });

  // Prueba 38
  it('should handle dishes CRUD operations', (done) => {
    const mockDishes = [
      { id: '1', name: 'Coca Cola', price: 5.99, categoryId: '1', available: true }
    ];

    service.getItemsByCategory('1').subscribe({
      next: () => {
        service.getItemsByCategory(null).subscribe({
          next: (nullItems) => {
            expect(nullItems).toEqual([]);
            
            service.getItemById('1').subscribe({
              next: () => {
                service.getAllDishes().subscribe({
                  next: () => {
                    service.getFeaturedItems().subscribe({
                      next: () => {
                        const dishData = { name: 'New Dish', description: 'A new dish', price: 15.99, categoryId: '1', available: true };
                        service.createDish(dishData).subscribe({
                          next: () => {
                            service.updateDish('1', { name: 'Updated Dish', price: 20.99 }).subscribe({
                              next: () => {
                                service.updateDishAvailability('1', false).subscribe({
                                  next: () => {
                                    service.deleteDish('1').subscribe({
                                      next: () => done()
                                    });
                                    const deleteReq = httpMock.expectOne('http://localhost:4000/dishes/1');
                                    deleteReq.flush(null);
                                  }
                                });
                                const availReq = httpMock.expectOne('http://localhost:4000/dishes/1');
                                availReq.flush({ dish: { id: '1', available: false } });
                              }
                            });
                            const updateReq = httpMock.expectOne('http://localhost:4000/dishes/1');
                            updateReq.flush({ dish: { id: '1', name: 'Updated Dish', price: 20.99 } });
                          }
                        });
                        const createReq = httpMock.expectOne('http://localhost:4000/dishes');
                        createReq.flush({ dish: { id: 'new-1', ...dishData } });
                      }
                    });
                    const featuredReq = httpMock.expectOne('http://localhost:4000/dishes');
                    featuredReq.flush({ dishes: mockDishes });
                  }
                });
                const allDishesReq = httpMock.expectOne('http://localhost:4000/dishes');
                allDishesReq.flush({ dishes: mockDishes });
              }
            });
            const getByIdReq = httpMock.expectOne('http://localhost:4000/dishes/1');
            getByIdReq.flush({ dish: mockDishes[0] });
          }
        });
      }
    });

    const req = httpMock.expectOne('http://localhost:4000/dishes/category/1');
    req.flush({ dishes: mockDishes });
  });
});

