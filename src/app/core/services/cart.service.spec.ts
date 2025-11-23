import { TestBed } from '@angular/core/testing';
import { CartService } from './cart.service';
import { CartItem } from '../models/CartItem';
import { take } from 'rxjs/operators';

describe('CartService', () => {
  let service: CartService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CartService);
  });

  // Prueba 18
  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // Prueba 19
  it('should add item to cart', (done) => {
    const item = {
      productId: '1',
      productName: 'Test Product',
      productDescription: 'Test Description',
      basePrice: 10.99,
      quantity: 2,
      selectedOptions: []
    };

    service.addItem(item);

    service.cartItems$.pipe(take(1)).subscribe(items => {
      expect(items.length).toBe(1);
      expect(items[0].productName).toBe('Test Product');
      expect(items[0].quantity).toBe(2);
      expect(items[0].totalPrice).toBe(21.98);
      done();
    });
  });

  // Prueba 20
  it('should calculate total price with options', (done) => {
    const item = {
      productId: '1',
      productName: 'Test Product',
      productDescription: 'Test Description',
      basePrice: 10.99,
      quantity: 1,
      selectedOptions: [
        { id: 'opt1', name: 'Extra Cheese', price: 2.50 },
        { id: 'opt2', name: 'Bacon', price: 3.00 }
      ]
    };

    service.addItem(item);

    service.cartItems$.pipe(take(1)).subscribe(items => {
      expect(items[0].totalPrice).toBeCloseTo(16.49, 2); // 10.99 + 2.50 + 3.00
      done();
    });
  });

  // Prueba 21
  it('should remove item from cart', (done) => {
    const item1 = {
      productId: '1',
      productName: 'Product 1',
      productDescription: 'Description 1',
      basePrice: 10,
      quantity: 1,
      selectedOptions: []
    };
    const item2 = {
      productId: '2',
      productName: 'Product 2',
      productDescription: 'Description 2',
      basePrice: 20,
      quantity: 1,
      selectedOptions: []
    };

    service.addItem(item1);
    service.addItem(item2);

    service.cartItems$.pipe(take(1)).subscribe(items => {
      if (items.length === 2) {
        const itemId = items[0].id;
        service.removeItem(itemId);

        service.cartItems$.pipe(take(1)).subscribe(updatedItems => {
          expect(updatedItems.length).toBe(1);
          expect(updatedItems[0].productId).toBe('2');
          done();
        });
      }
    });
  });

  // Prueba 22
  it('should update item quantity', (done) => {
    const item = {
      productId: '1',
      productName: 'Test Product',
      productDescription: 'Test Description',
      basePrice: 10,
      quantity: 1,
      selectedOptions: []
    };

    service.addItem(item);

    service.cartItems$.pipe(take(1)).subscribe(items => {
      const itemId = items[0].id;
      service.updateQuantity(itemId, 5);

      service.cartItems$.pipe(take(1)).subscribe(updatedItems => {
        expect(updatedItems[0].quantity).toBe(5);
        expect(updatedItems[0].totalPrice).toBe(50);
        done();
      });
    });
  });

  // Prueba 23
  it('should not allow quantity less than 1', (done) => {
    const item = {
      productId: '1',
      productName: 'Test Product',
      productDescription: 'Test Description',
      basePrice: 10,
      quantity: 1,
      selectedOptions: []
    };

    service.addItem(item);

    service.cartItems$.pipe(take(1)).subscribe(items => {
      const itemId = items[0].id;
      service.updateQuantity(itemId, 0);

      service.cartItems$.pipe(take(1)).subscribe(updatedItems => {
        expect(updatedItems[0].quantity).toBeGreaterThanOrEqual(1);
        done();
      });
    });
  });

  // Prueba 24
  it('should calculate total items correctly', (done) => {
    const item1 = {
      productId: '1',
      productName: 'Product 1',
      productDescription: 'Description 1',
      basePrice: 10,
      quantity: 2,
      selectedOptions: []
    };
    const item2 = {
      productId: '2',
      productName: 'Product 2',
      productDescription: 'Description 2',
      basePrice: 20,
      quantity: 3,
      selectedOptions: []
    };

    service.addItem(item1);
    service.addItem(item2);

    service.getTotalItems().subscribe(total => {
      expect(total).toBe(5); // 2 + 3
      done();
    });
  });

  // Prueba 25
  it('should calculate total price correctly', (done) => {
    const item1 = {
      productId: '1',
      productName: 'Product 1',
      productDescription: 'Description 1',
      basePrice: 10,
      quantity: 2,
      selectedOptions: []
    };
    const item2 = {
      productId: '2',
      productName: 'Product 2',
      productDescription: 'Description 2',
      basePrice: 20,
      quantity: 1,
      selectedOptions: [{ id: 'opt1', name: 'Extra', price: 5 }]
    };

    service.addItem(item1);
    service.addItem(item2);

    service.getTotalPrice().pipe(take(1)).subscribe(total => {
      expect(total).toBe(45); // (10 * 2) + (20 + 5) * 1 = 20 + 25 = 45
      done();
    });
  });

  // Prueba 26
  it('should clear cart', (done) => {
    const item = {
      productId: '1',
      productName: 'Test Product',
      productDescription: 'Test Description',
      basePrice: 10,
      quantity: 1,
      selectedOptions: []
    };

    service.addItem(item);
    service.clearCart();

    service.cartItems$.pipe(take(1)).subscribe(items => {
      expect(items.length).toBe(0);
      done();
    });
  });

  // Prueba 27
  it('should generate unique IDs for items', (done) => {
    const item = {
      productId: '1',
      productName: 'Test Product',
      productDescription: 'Test Description',
      basePrice: 10,
      quantity: 1,
      selectedOptions: []
    };

    service.addItem(item);
    service.addItem(item);

    service.cartItems$.pipe(take(1)).subscribe(items => {
      expect(items.length).toBe(2);
      expect(items[0].id).not.toBe(items[1].id);
      done();
    });
  });
});

