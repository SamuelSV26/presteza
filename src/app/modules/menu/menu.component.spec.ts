import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MenuComponent } from './menu.component';
import { MenuService } from '../../core/services/menu.service';
import { AuthService } from '../../core/services/auth.service';
import { MenuCategory } from '../../core/models/MenuCategory';

describe('MenuComponent', () => {
  let component: MenuComponent;
  let fixture: ComponentFixture<MenuComponent>;
  let menuService: jasmine.SpyObj<MenuService>;
  let router: jasmine.SpyObj<Router>;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    const menuSpy = jasmine.createSpyObj('MenuService', ['getCategories'], {
      userInfo$: of(null)
    });
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    const authSpy = jasmine.createSpyObj('AuthService', ['isAuthenticated'], {
      userInfo$: of(null)
    });

    await TestBed.configureTestingModule({
      imports: [MenuComponent],
      providers: [
        { provide: MenuService, useValue: menuSpy },
        { provide: Router, useValue: routerSpy },
        { provide: AuthService, useValue: authSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MenuComponent);
    component = fixture.componentInstance;
    menuService = TestBed.inject(MenuService) as jasmine.SpyObj<MenuService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
  });

  // Prueba 98
  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Prueba 99
  it('should load categories on init', (done) => {
    const mockCategories: MenuCategory[] = [
      { id: '1', name: 'Bebidas', description: 'Bebidas frías y calientes', icon: '', imageUrl: '' },
      { id: '2', name: 'Comidas', description: 'Platos principales', icon: '', imageUrl: '' }
    ];

    menuService.getCategories.and.returnValue(of(mockCategories));
    authService.isAuthenticated.and.returnValue(false);

    fixture.detectChanges();

    component.categories$.subscribe(categories => {
      expect(categories.length).toBe(2);
      expect(component.loading).toBe(false);
      done();
    });
  });

  // Prueba 100
  it('should handle error when loading categories', (done) => {
    menuService.getCategories.and.returnValue(throwError(() => new Error('Network error')));
    authService.isAuthenticated.and.returnValue(false);

    fixture.detectChanges();

    component.categories$.subscribe(categories => {
      expect(categories).toEqual([]);
      expect(component.error).toBe('Error al cargar las categorías. Por favor, intenta nuevamente.');
      expect(component.loading).toBe(false);
      done();
    });
  });

  // Prueba 101
  it('should filter categories by search term', (done) => {
    const mockCategories: MenuCategory[] = [
      { id: '1', name: 'Bebidas', description: 'Bebidas frías', icon: '', imageUrl: '' },
      { id: '2', name: 'Comidas', description: 'Platos principales', icon: '', imageUrl: '' }
    ];

    menuService.getCategories.and.returnValue(of(mockCategories));
    authService.isAuthenticated.and.returnValue(false);
    fixture.detectChanges();

    component.searchTerm = 'Bebidas';
    component.onSearchChange();

    component.filteredCategories$.subscribe(filtered => {
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Bebidas');
      done();
    });
  });

  // Prueba 102
  it('should clear search and reset filtered categories', (done) => {
    const mockCategories: MenuCategory[] = [
      { id: '1', name: 'Bebidas', description: 'Bebidas frías', icon: '', imageUrl: '' }
    ];

    menuService.getCategories.and.returnValue(of(mockCategories));
    authService.isAuthenticated.and.returnValue(false);
    fixture.detectChanges();

    component.searchTerm = 'Bebidas';
    component.clearSearch();

    expect(component.searchTerm).toBe('');
    component.filteredCategories$.subscribe(filtered => {
      expect(filtered.length).toBe(1);
      done();
    });
  });

  // Prueba 103
  it('should navigate to category', () => {
    const mockCategories: MenuCategory[] = [];
    menuService.getCategories.and.returnValue(of(mockCategories));
    authService.isAuthenticated.and.returnValue(false);
    fixture.detectChanges();

    component.navigateToCategory('category-1');

    expect(router.navigate).toHaveBeenCalledWith(['/menu', 'category-1']);
  });

  // Prueba 104
  it('should not navigate if category id is empty', () => {
    const mockCategories: MenuCategory[] = [];
    menuService.getCategories.and.returnValue(of(mockCategories));
    authService.isAuthenticated.and.returnValue(false);
    fixture.detectChanges();

    component.navigateToCategory('');

    expect(router.navigate).not.toHaveBeenCalled();
  });

  // Prueba 105
  it('should get category background image with imageUrl', () => {
    const mockCategories: MenuCategory[] = [];
    menuService.getCategories.and.returnValue(of(mockCategories));
    authService.isAuthenticated.and.returnValue(false);
    fixture.detectChanges();

    const category: MenuCategory = {
      id: '1',
      name: 'Bebidas',
      description: 'Test',
      icon: '',
      imageUrl: 'https://example.com/image.jpg'
    };

    const background = component.getCategoryBackgroundImage(category);
    expect(background).toContain('https://example.com/image.jpg');
  });

  // Prueba 106
  it('should get default category background image when imageUrl is not provided', () => {
    const mockCategories: MenuCategory[] = [];
    menuService.getCategories.and.returnValue(of(mockCategories));
    authService.isAuthenticated.and.returnValue(false);
    fixture.detectChanges();

    const category: MenuCategory = {
      id: '1',
      name: 'Bebidas',
      description: 'Test',
      icon: '',
      imageUrl: undefined
    };

    const background = component.getCategoryBackgroundImage(category);
    expect(background).toContain('linear-gradient');
  });

  // Prueba 107
  it('should initialize authentication status', () => {
    const mockCategories: MenuCategory[] = [];
    menuService.getCategories.and.returnValue(of(mockCategories));
    authService.isAuthenticated.and.returnValue(true);
    fixture.detectChanges();

    expect(component.isAuthenticated).toBe(true);
  });
});


