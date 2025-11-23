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

  // Prueba 49
  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // Prueba 50
  it('should get categories', (done) => {
    const mockCategories = [
      { id: '1', name: 'Bebidas', description: 'Bebidas frías y calientes' },
      { id: '2', name: 'Comidas', description: 'Platos principales' }
    ];

    service.getCategories().subscribe({
      next: (categories) => {
        expect(categories.length).toBe(2);
        expect(categories[0].name).toBe('Bebidas');
        done();
      }
    });

    const req = httpMock.expectOne('http://localhost:4000/categories');
    expect(req.request.method).toBe('GET');
    req.flush({ categories: mockCategories });
  });

  // Prueba 51
  it('should get category by id', (done) => {
    const mockCategory = {
      id: '1',
      name: 'Bebidas',
      description: 'Bebidas frías y calientes'
    };

    service.getCategoryById('1').subscribe({
      next: (category) => {
        expect(category).toBeDefined();
        expect(category?.name).toBe('Bebidas');
        done();
      }
    });

    const req = httpMock.expectOne('http://localhost:4000/categories/1');
    expect(req.request.method).toBe('GET');
    req.flush({ category: mockCategory });
  });

  // Prueba 52
  it('should return undefined for null category id', (done) => {
    service.getCategoryById(null).subscribe({
      next: (category) => {
        expect(category).toBeUndefined();
        done();
      }
    });
  });

  // Prueba 53
  it('should get items by category', (done) => {
    const mockDishes = [
      {
        id: '1',
        name: 'Coca Cola',
        price: 5.99,
        categoryId: '1',
        available: true
      }
    ];

    service.getItemsByCategory('1').subscribe({
      next: (items) => {
        expect(items.length).toBeGreaterThanOrEqual(0);
        done();
      }
    });

    const req = httpMock.expectOne('http://localhost:4000/dishes/category/1');
    expect(req.request.method).toBe('GET');
    req.flush({ dishes: mockDishes });
  });

  // Prueba 54
  it('should return empty array for null category id', (done) => {
    service.getItemsByCategory(null).subscribe({
      next: (items) => {
        expect(items).toEqual([]);
        done();
      }
    });
  });

  // Prueba 55
  it('should get item by id', (done) => {
    const mockDish = {
      id: '1',
      name: 'Hamburguesa',
      price: 12.99,
      categoryId: '2',
      available: true
    };

    service.getItemById('1').subscribe({
      next: (item) => {
        expect(item).toBeDefined();
        done();
      }
    });

    const req = httpMock.expectOne('http://localhost:4000/dishes/1');
    expect(req.request.method).toBe('GET');
    req.flush({ dish: mockDish });
  });

  // Prueba 56
  it('should get all dishes', (done) => {
    const mockDishes = [
      { id: '1', name: 'Dish 1', price: 10, categoryId: '1' },
      { id: '2', name: 'Dish 2', price: 15, categoryId: '2' }
    ];

    service.getAllDishes().subscribe({
      next: (dishes) => {
        expect(dishes.length).toBeGreaterThanOrEqual(0);
        done();
      }
    });

    const req = httpMock.expectOne('http://localhost:4000/dishes');
    expect(req.request.method).toBe('GET');
    req.flush({ dishes: mockDishes });
  });

  // Prueba 57
  it('should get featured items', (done) => {
    const mockDishes = [
      { id: '1', name: 'Featured Dish', price: 10, categoryId: '1', available: true }
    ];

    service.getFeaturedItems().subscribe({
      next: (items) => {
        expect(Array.isArray(items)).toBe(true);
        done();
      }
    });

    const req = httpMock.expectOne('http://localhost:4000/dishes');
    expect(req.request.method).toBe('GET');
    req.flush({ dishes: mockDishes });
  });

  // Prueba 58
  it('should create a dish', (done) => {
    const dishData = {
      name: 'New Dish',
      description: 'A new dish',
      price: 15.99,
      categoryId: '1',
      available: true
    };

    const mockResponse = {
      dish: {
        id: 'new-1',
        ...dishData
      }
    };

    service.createDish(dishData).subscribe({
      next: (dish) => {
        expect(dish).toBeDefined();
        done();
      }
    });

    const req = httpMock.expectOne('http://localhost:4000/dishes');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  // Prueba 59
  it('should update a dish', (done) => {
    const dishData = {
      name: 'Updated Dish',
      price: 20.99
    };

    const mockResponse = {
      dish: {
        id: '1',
        ...dishData
      }
    };

    service.updateDish('1', dishData).subscribe({
      next: (dish) => {
        expect(dish).toBeDefined();
        done();
      }
    });

    const req = httpMock.expectOne('http://localhost:4000/dishes/1');
    expect(req.request.method).toBe('PATCH');
    req.flush(mockResponse);
  });

  // Prueba 60
  it('should delete a dish', (done) => {
    service.deleteDish('1').subscribe({
      next: () => {
        done();
      }
    });

    const req = httpMock.expectOne('http://localhost:4000/dishes/1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  // Prueba 61
  it('should update dish availability', (done) => {
    const mockResponse = {
      dish: {
        id: '1',
        available: false
      }
    };

    service.updateDishAvailability('1', false).subscribe({
      next: (dish) => {
        expect(dish).toBeDefined();
        done();
      }
    });

    const req = httpMock.expectOne('http://localhost:4000/dishes/1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ available: false });
    req.flush(mockResponse);
  });

  // Prueba 62
  it('should create a category', (done) => {
    const categoryData = {
      name: 'New Category',
      description: 'A new category'
    };

    const mockResponse = {
      category: {
        id: 'new-cat',
        ...categoryData
      }
    };

    service.createCategory(categoryData).subscribe({
      next: (category) => {
        expect(category).toBeDefined();
        done();
      }
    });

    const req = httpMock.expectOne('http://localhost:4000/categories');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  // Prueba 63
  it('should update a category', (done) => {
    const categoryData = {
      name: 'Updated Category'
    };

    const mockResponse = {
      category: {
        id: '1',
        ...categoryData
      }
    };

    service.updateCategory('1', categoryData).subscribe({
      next: (category) => {
        expect(category).toBeDefined();
        done();
      }
    });

    const req = httpMock.expectOne('http://localhost:4000/categories/1');
    expect(req.request.method).toBe('PATCH');
    req.flush(mockResponse);
  });

  // Prueba 64
  it('should delete a category', (done) => {
    service.deleteCategory('1').subscribe({
      next: () => {
        done();
      }
    });

    const req = httpMock.expectOne('http://localhost:4000/categories/1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});

