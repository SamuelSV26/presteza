import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CartService, CartItem } from '../../core/services/cart.service';
import { Observable, Subject, combineLatest, forkJoin, throwError, of } from 'rxjs';
import { takeUntil, map, switchMap, catchError } from 'rxjs/operators';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { OrderService } from '../../core/services/order.service';
import { AddsService } from '../../core/services/adds.service';
import { MenuService } from '../../core/services/menu.service';
import { PaymentMethod as SavedPaymentMethod } from '../../core/models/PaymentMethod';
import { Address } from '../../core/models/Address';
import { Order } from '../../core/models/Order';
import { CreateOrderDto, ProductOrderItem, AddOrderItem } from '../../core/models/CreateOrderDto';
import { Meta, Title } from '@angular/platform-browser';

export type OrderType = 'pickup' | 'delivery';
export type PaymentMethod = 'card' | 'cash' | 'nequi' | 'daviplata' | 'transfer';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent implements OnInit, OnDestroy {
  cartItems$!: Observable<CartItem[]>;
  subtotal$!: Observable<number>;
  private destroy$ = new Subject<void>();

  orderType: OrderType = 'pickup';
  paymentMethod: PaymentMethod = 'cash';
  readonly DISPOSABLES_FEE = 1000;
  readonly DELIVERY_FEE = 4000;
  subtotal = 0;
  additionalFees = 0;
  total = 0;
  deliveryForm: FormGroup;
  paymentForm: FormGroup;
  isLoading = false;
  showPaymentModal = false;
  paymentLink: string = '';
  paymentCode: string = '';
  paymentReference: string = '';
  bankAccount: any = null;
  showPaymentInfo = false;
  savedPaymentMethods: SavedPaymentMethod[] = [];
  selectedSavedMethod: string | null = null;
  useSavedCard = false;
  savedAddresses: Address[] = [];
  selectedSavedAddress: string | null = null;
  useSavedAddress = false;

  constructor(
    private cartService: CartService,
    private router: Router,
    private fb: FormBuilder,
    private notificationService: NotificationService,
    private authService: AuthService,
    private userService: UserService,
    private orderService: OrderService,
    private addsService: AddsService,
    private menuService: MenuService,
    private title: Title,
    private meta: Meta
  ) {
    this.title.setTitle('Checkout - PRESTEZA');
    this.meta.updateTag({ name: 'description', content: 'Realiza tu pedido en PRESTEZA. Elige entre recogida en tienda o entrega a domicilio.' });
    this.deliveryForm = this.fb.group({
      address: ['', [Validators.required]],
      neighborhood: ['', [Validators.required]],
      city: ['Manizales', [Validators.required]],
      postalCode: ['170001', [Validators.required]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      deliveryInstructions: ['']
    });
    this.paymentForm = this.fb.group({
      cardNumber: ['', [Validators.required, Validators.pattern(/^[0-9\s]{16,19}$/)]],
      cardHolder: ['', [Validators.required]],
      expiryDate: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/[0-9]{2}$/)]],
      cvv: ['', [Validators.required, Validators.pattern(/^[0-9]{3,4}$/)]]
    });
  }

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      this.notificationService.showWarning('Debes iniciar sesión para realizar un pedido');
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/checkout' } });
      return;
    }
    this.cartItems$ = this.cartService.cartItems$;
    this.cartItems$.pipe(takeUntil(this.destroy$)).subscribe(items => {
      const orderJustPlaced = sessionStorage.getItem('orderJustPlaced');
      // Redirigir al menú si el carrito está vacío (sin mostrar notificación)
      if (items.length === 0 && !orderJustPlaced) {
        // Verificar que no estamos en proceso de checkout (evitar redirigir durante la compra)
        const isProcessingOrder = sessionStorage.getItem('processingOrder');
        if (!isProcessingOrder) {
          this.router.navigate(['/menu']);
        }
      } else if (orderJustPlaced) {
        // Limpiar la bandera después de un tiempo para permitir navegación
        setTimeout(() => {
          sessionStorage.removeItem('orderJustPlaced');
        }, 1000);
      }
    });
    this.subtotal$ = this.cartService.getTotalPrice();
    combineLatest([
      this.cartService.getTotalPrice(),
      this.cartItems$
    ]).pipe(
      takeUntil(this.destroy$)
    ).subscribe(([subtotal, items]) => {
      this.subtotal = subtotal;
      this.calculateAdditionalFees();
      this.calculateTotal();
    });
    const userInfo = this.authService.getUserInfo();
    if (userInfo) {
      const acountInfo = localStorage.getItem(`userProfile_${userInfo.userId}`);
      const userPhone = acountInfo ? JSON.parse(acountInfo).phone : '';
      this.deliveryForm.patchValue({
        phone: userPhone
      });
    }
    this.loadSavedPaymentMethods();
    this.loadSavedAddresses();
  }

  loadSavedPaymentMethods(): void {
    this.userService.getPaymentMethods().pipe(takeUntil(this.destroy$)).subscribe(methods => {
      this.savedPaymentMethods = methods;
      const defaultMethod = methods.find(m => m.isDefault);
      if (defaultMethod && defaultMethod.type === 'card') {
        this.selectedSavedMethod = defaultMethod.id;
        this.useSavedCard = true;
        this.paymentMethod = 'card';
        this.loadSavedCardData(defaultMethod);
      } else if (defaultMethod && defaultMethod.type === 'cash') {
        this.paymentMethod = 'cash';
      }
    });
  }

  loadSavedCardData(method: SavedPaymentMethod): void {
    if (method.type === 'card' && method.last4) {
      this.paymentForm.patchValue({
        cardNumber: `**** **** **** ${method.last4}`,
        cardHolder: 'Titular guardado'
      });
      this.paymentForm.get('cardNumber')?.clearValidators();
      this.paymentForm.get('cardHolder')?.clearValidators();
      this.paymentForm.get('expiryDate')?.clearValidators();
      this.paymentForm.get('cvv')?.clearValidators();
      this.paymentForm.updateValueAndValidity();
    }
  }

  onSavedMethodSelect(methodId: string): void {
    const method = this.savedPaymentMethods.find(m => m.id === methodId);
    if (method) {
      this.selectedSavedMethod = methodId;
      if (method.type === 'card') {
        this.paymentMethod = 'card';
        this.useSavedCard = true;
        this.loadSavedCardData(method);
      } else if (method.type === 'cash') {
        this.paymentMethod = 'cash';
        this.useSavedCard = false;
      }
    }
  }

  useNewCard(): void {
    this.useSavedCard = false;
    this.selectedSavedMethod = null;
    this.paymentForm.reset();
    this.paymentForm.get('cardNumber')?.setValidators([Validators.required, Validators.pattern(/^[0-9\s]{16,19}$/)]);
    this.paymentForm.get('cardHolder')?.setValidators([Validators.required]);
    this.paymentForm.get('expiryDate')?.setValidators([Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/[0-9]{2}$/)]);
    this.paymentForm.get('cvv')?.setValidators([Validators.required, Validators.pattern(/^[0-9]{3,4}$/)]);
    this.paymentForm.updateValueAndValidity();
  }

  getSelectedSavedCardInfo(): string {
    if (!this.selectedSavedMethod) return '';
    const method = this.savedPaymentMethods.find(m => m.id === this.selectedSavedMethod);
    if (method && method.type === 'card') {
      return `${method.brand} •••• ${method.last4}`;
    }
    return '';
  }

  loadSavedAddresses(): void {
    this.userService.getAddresses().pipe(takeUntil(this.destroy$)).subscribe(addresses => {
      this.savedAddresses = addresses;
      const defaultAddress = addresses.find(a => a.isDefault);
      if (defaultAddress && this.orderType === 'delivery') {
        if (defaultAddress.id) {
          this.selectedSavedAddress = defaultAddress.id;
          this.useSavedAddress = true;
          this.loadSavedAddressData(defaultAddress);
        }
      }
    });
  }

  loadSavedAddressData(address: Address): void {
    this.deliveryForm.patchValue({
      address: address.address,
      neighborhood: address.neighborhood || '',
      city: address.city,
      postalCode: address.postalCode,
      phone: ''
    });
    this.deliveryForm.get('address')?.clearValidators();
    this.deliveryForm.get('neighborhood')?.clearValidators();
    this.deliveryForm.get('address')?.updateValueAndValidity();
    this.deliveryForm.get('neighborhood')?.updateValueAndValidity();
  }

  onSavedAddressSelect(addressId: string | undefined): void {
    if (!addressId) {
      return;
    }
    const address = this.savedAddresses.find(a => a.id === addressId);
    if (address) {
      this.selectedSavedAddress = addressId;
      this.useSavedAddress = true;
      this.loadSavedAddressData(address);
    }
  }

  useNewAddress(): void {
    this.useSavedAddress = false;
    this.selectedSavedAddress = null;
    this.deliveryForm.patchValue({
      address: '',
      neighborhood: '',
      city: 'Manizales',
      postalCode: '170001'
    });
    this.deliveryForm.get('address')?.setValidators([Validators.required]);
    this.deliveryForm.get('neighborhood')?.setValidators([Validators.required]);
    this.deliveryForm.get('address')?.updateValueAndValidity();
    this.deliveryForm.get('neighborhood')?.updateValueAndValidity();
  }

  getSelectedSavedAddressInfo(): string {
    if (!this.selectedSavedAddress) return '';
    const address = this.savedAddresses.find(a => a.id === this.selectedSavedAddress);
    if (address) {
      return `${address.title}: ${address.address}, ${address.neighborhood || ''}`;
    }
    return '';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onOrderTypeChange(type: OrderType): void {
    this.orderType = type;
    this.calculateAdditionalFees();
    this.calculateTotal();
    if (type === 'pickup') {
      this.useSavedAddress = false;
      this.selectedSavedAddress = null;
      this.deliveryForm.get('address')?.clearValidators();
      this.deliveryForm.get('neighborhood')?.clearValidators();
      this.deliveryForm.get('address')?.updateValueAndValidity();
      this.deliveryForm.get('neighborhood')?.updateValueAndValidity();
    } else {
      if (this.savedAddresses.length > 0 && !this.selectedSavedAddress) {
        const defaultAddress = this.savedAddresses.find(a => a.isDefault);
        if (defaultAddress) {
          if (defaultAddress.id) {
            this.onSavedAddressSelect(defaultAddress.id);
          }
        } else {
          if (!this.useSavedAddress) {
            this.deliveryForm.get('address')?.setValidators([Validators.required]);
            this.deliveryForm.get('neighborhood')?.setValidators([Validators.required]);
            this.deliveryForm.get('address')?.updateValueAndValidity();
            this.deliveryForm.get('neighborhood')?.updateValueAndValidity();
          }
        }
      } else {
        if (!this.useSavedAddress) {
          this.deliveryForm.get('address')?.setValidators([Validators.required]);
          this.deliveryForm.get('neighborhood')?.setValidators([Validators.required]);
          this.deliveryForm.get('address')?.updateValueAndValidity();
          this.deliveryForm.get('neighborhood')?.updateValueAndValidity();
        }
      }
    }
  }

  onPaymentMethodChange(method: PaymentMethod): void {
    this.paymentMethod = method;
    this.useSavedCard = false;
    this.selectedSavedMethod = null;
    if (method === 'nequi' || method === 'daviplata' || method === 'transfer') {
      this.generatePaymentInfo();
      setTimeout(() => {
        const paymentInfoElement = document.querySelector('.payment-info-card');
        if (paymentInfoElement) {
          paymentInfoElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    } else {
      this.showPaymentInfo = false;
      this.paymentLink = '';
      this.paymentCode = '';
      this.paymentReference = '';
      this.bankAccount = null;
    }
    if (method === 'card' && !this.useSavedCard) {
      this.paymentForm.get('cardNumber')?.setValidators([Validators.required, Validators.pattern(/^[0-9\s]{16,19}$/)]);
      this.paymentForm.get('cardHolder')?.setValidators([Validators.required]);
      this.paymentForm.get('expiryDate')?.setValidators([Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/[0-9]{2}$/)]);
      this.paymentForm.get('cvv')?.setValidators([Validators.required, Validators.pattern(/^[0-9]{3,4}$/)]);
      this.paymentForm.updateValueAndValidity();
    } else if (method !== 'card') {
      this.paymentForm.get('cardNumber')?.clearValidators();
      this.paymentForm.get('cardHolder')?.clearValidators();
      this.paymentForm.get('expiryDate')?.clearValidators();
      this.paymentForm.get('cvv')?.clearValidators();
      this.paymentForm.updateValueAndValidity();
    }
  }

  generatePaymentInfo(): void {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);

    if (this.paymentMethod === 'nequi') {
      this.paymentLink = `https://nequi.com/pago/${timestamp}-${random}`;
      this.paymentCode = `NEQ${timestamp.toString().slice(-8)}${random.toString().padStart(4, '0')}`;
      this.paymentReference = `REF-${timestamp}-${random}`;
    } else if (this.paymentMethod === 'daviplata') {
      this.paymentLink = `https://daviplata.com/pago/${timestamp}-${random}`;
      this.paymentCode = `DAV${timestamp.toString().slice(-8)}${random.toString().padStart(4, '0')}`;
      this.paymentReference = `REF-${timestamp}-${random}`;
    } else if (this.paymentMethod === 'transfer') {
      this.bankAccount = {
        bank: 'Bancolombia',
        accountType: 'Ahorros',
        accountNumber: 3456789012345678,
        accountHolder: 'RESTAURANTE PRESTEZA S.A.S.',
        nit: '900123456-7',
        reference: `REF-${timestamp}-${random}`
      };
    }

    this.showPaymentInfo = true;
  }

  copyToClipboard(text: string, type: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.notificationService.showSuccess(`${type} copiado al portapapeles`, '¡Copiado!');
    }).catch(() => {
      this.notificationService.showError('No se pudo copiar al portapapeles');
    });
  }

  openPaymentLink(): void {
    if (this.paymentLink) {
      window.open(this.paymentLink, '_blank');
    }
  }

  calculateAdditionalFees(): void {
    if (this.orderType === 'pickup') {
      this.additionalFees = this.DISPOSABLES_FEE;
    } else if (this.orderType === 'delivery') {
      this.additionalFees = this.DELIVERY_FEE;
    } else {
      this.additionalFees = 0;
    }
  }

  calculateTotal(): void {
    this.total = this.subtotal + this.additionalFees;
  }

  getPaymentMethodName(method: PaymentMethod): string {
    const names: Record<PaymentMethod, string> = {
      'card': 'Tarjeta de Crédito/Débito',
      'cash': 'Efectivo',
      'nequi': 'Nequi',
      'daviplata': 'Daviplata',
      'transfer': 'Transferencia Bancaria'
    };
    return names[method] || method;
  }

  getPaymentMethodIcon(method: PaymentMethod): string {
    const icons: Record<PaymentMethod, string> = {
      'card': 'bi-credit-card-2-front',
      'cash': 'bi-cash-coin',
      'nequi': 'bi-phone',
      'daviplata': 'bi-wallet2',
      'transfer': 'bi-bank'
    };
    return icons[method] || 'bi-credit-card';
  }

  proceedToPayment(): void {
    if (this.orderType === 'delivery' && !this.useSavedAddress && this.deliveryForm.invalid) {
      this.notificationService.showError('Por favor completa todos los campos de entrega o selecciona una dirección guardada');
      return;
    }
    if (this.paymentMethod === 'card' && !this.useSavedCard && this.paymentForm.invalid) {
      this.notificationService.showError('Por favor completa todos los datos de la tarjeta o selecciona una tarjeta guardada');
      return;
    }
    if ((this.paymentMethod === 'nequi' || this.paymentMethod === 'daviplata' || this.paymentMethod === 'transfer') && !this.showPaymentInfo) {
      this.generatePaymentInfo();
      setTimeout(() => {
        const paymentInfoElement = document.querySelector('.payment-info-card');
        if (paymentInfoElement) {
          paymentInfoElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
      this.notificationService.showInfo(
        'Revisa la información de pago abajo. Cuando estés listo, confirma nuevamente.',
        'Información de Pago Generada'
      );
      return;
    }
    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
      this.processPayment();
    }, 2000);
  }

  processPayment(): void {
    let items: CartItem[] = [];
    const subscription = this.cartService.cartItems$.subscribe(cartItems => {
      items = cartItems;
    });
    subscription.unsubscribe();

    // Validar que hay items en el carrito
    if (!items || items.length === 0) {
      this.isLoading = false;
      // Carrito vacío - redirigir sin mostrar notificación
      this.router.navigate(['/menu']);
      return;
    }

    const userInfo = this.authService.getUserInfo();
    if (!userInfo) {
      this.isLoading = false;
      this.notificationService.showError('No se pudo obtener la información del usuario. Por favor, inicia sesión nuevamente.');
      this.router.navigate(['/login']);
      return;
    }

    // Validar userId - puede venir como string o number
    let userId: string;
    if (userInfo.userId) {
      userId = String(userInfo.userId);
    } else if (userInfo.email) {
      userId = userInfo.email;
    } else {
      this.isLoading = false;
      this.notificationService.showError('No se pudo identificar tu usuario. Por favor, inicia sesión nuevamente.');
      this.router.navigate(['/login']);
      return;
    }

    // Recopilar todos los IDs de adicionales que necesitamos mapear
    const frontendAddIds: string[] = [];
    items.forEach(item => {
      if (item.selectedOptions && item.selectedOptions.length > 0) {
        item.selectedOptions.forEach(option => {
          const isAddonOrExtra = option.type === 'addon' || option.type === 'extra' ||
            (!option.type && option.price > 0);
          if (isAddonOrExtra && option.price > 0 && !/^[0-9a-fA-F]{24}$/.test(option.id)) {
            if (!frontendAddIds.includes(option.id)) {
              frontendAddIds.push(option.id);
            }
          }
        });
      }
    });

    // Obtener información de los platos para conocer sus categorías
    const dishObservables = items.map(item => {
      const dishId = String(item.productId);
      return this.menuService.getItemById(dishId).pipe(
        map(dish => ({ item, dish, dishId }))
      );
    });

    // Esperar a que se obtengan todos los platos y luego mapear los adicionales
    forkJoin(dishObservables).pipe(
      takeUntil(this.destroy$),
      switchMap(dishData => {
        // Mapear los IDs del frontend a ObjectIds del backend
        return this.addsService.mapFrontendIdsToBackendIds(frontendAddIds).pipe(
          map(addIdMap => ({ dishData, addIdMap }))
        );
      }),
      switchMap(({ dishData, addIdMap }) => {
        // Obtener los adicionales disponibles por categoría y también todos los adicionales para verificar productos específicos
        const categoryAddsMap = new Map<string, any[]>();
        const allAddsObservable = this.addsService.findAvailable();

        const categoryObservables = dishData.map(({ dish }) => {
          if (!dish || !dish.categoryId) return of(null);
          const categoryId = dish.categoryId;
          if (categoryAddsMap.has(categoryId)) {
            return of(null);
          }
          return this.addsService.findByCategory(categoryId).pipe(
            map(adds => {
              categoryAddsMap.set(categoryId, adds);
              return null;
            }),
            catchError(() => of(null))
          );
        });

        return forkJoin([...categoryObservables, allAddsObservable]).pipe(
          map((results) => {
            const allAdds = results[results.length - 1] as any[];
            return { dishData, addIdMap, categoryAddsMap, allAdds };
          })
        );
      }),
      switchMap(({ dishData, addIdMap, categoryAddsMap, allAdds }) => {
        // Validar que los productos tengan IDs válidos
        // El backend espera un array de objetos con la estructura completa incluyendo adds
        const productItems: ProductOrderItem[] = [];

        dishData.forEach(({ item, dish, dishId }) => {
          if (!dishId || dishId === 'undefined' || dishId === 'null' || dishId === '') {
            console.error('ProductId inválido:', item.productId, 'del item:', item);
            return;
          }

          // Obtener los adicionales disponibles para la categoría del plato
          const categoryId = dish?.categoryId;
          const dishIdStr = dishId;
          const availableAdds = categoryId ? (categoryAddsMap.get(categoryId) || []) : [];

          // Mapear los adicionales (adds) desde selectedOptions
          // Solo incluir addons y extras que pertenezcan a la categoría o producto específico
          const adds: AddOrderItem[] = [];
          if (item.selectedOptions && item.selectedOptions.length > 0) {
            item.selectedOptions.forEach(option => {
              // Solo incluir opciones que sean addons o extras (no removals ni sizes)
              const isAddonOrExtra = option.type === 'addon' || option.type === 'extra' ||
                (!option.type && option.price > 0);
              if (isAddonOrExtra && option.price > 0) {
                // Obtener el ObjectId del backend si existe
                const backendAddId = addIdMap.get(option.id) || option.id;

                // Buscar el adicional en todos los adicionales disponibles
                const add = allAdds.find(a => (a._id || a.id) === backendAddId);

                if (add) {
                  // Verificar si el adicional está asociado a este producto específico
                  const isForThisProduct = add.dishIds && add.dishIds.length > 0 && add.dishIds.includes(dishIdStr);
                  // Verificar si el adicional está asociado a la categoría del plato
                  const isForThisCategory = categoryId && add.categoryIds && add.categoryIds.length > 0 && add.categoryIds.includes(categoryId);

                  // Lógica de validación:
                  // 1. Si tiene productos específicos (dishIds), solo incluir si el producto está en la lista
                  // 2. Si NO tiene productos específicos, incluir si pertenece a la categoría
                  // 3. Si tiene ambos, incluir si el producto está en dishIds O si pertenece a la categoría

                  let shouldInclude = false;

                  if (add.dishIds && add.dishIds.length > 0) {
                    // Tiene productos específicos: solo incluir si este producto está en la lista
                    shouldInclude = isForThisProduct;
                  } else if (categoryId) {
                    // No tiene productos específicos: incluir si pertenece a la categoría
                    shouldInclude = isForThisCategory;
                  }

                  if (!shouldInclude) {
                    console.warn(`El adicional "${option.name}" no está disponible para el producto "${item.productName}". Se omitirá.`);
                    return; // Omitir este adicional
                  }
                } else {
                  // Si no se encuentra el adicional, omitirlo
                  console.warn(`El adicional "${option.name}" no se encontró en los adicionales disponibles. Se omitirá.`);
                  return;
                }

                adds.push({
                  addId: backendAddId,
                  name: option.name,
                  price: option.price,
                  quantity: 1
                });
              }
            });
          }

          // Validar que todos los campos requeridos estén presentes
          if (!dishId || !item.productName || !item.basePrice) {
            console.error('Producto con datos incompletos:', { dishId, name: item.productName, price: item.basePrice });
            return;
          }

          // Asegurar que los valores numéricos sean válidos
          const quantity = Number(item.quantity) || 1;
          const unitPrice = Number(item.basePrice);
          
          if (isNaN(quantity) || quantity <= 0 || isNaN(unitPrice) || unitPrice <= 0) {
            console.error('Producto con valores numéricos inválidos:', { quantity, unitPrice });
            return;
          }

          // Validar que los adds sean objetos válidos
          const validAdds = adds.filter(add => 
            add && 
            typeof add === 'object' && 
            add.addId && 
            add.name && 
            typeof add.price === 'number' && 
            typeof add.quantity === 'number'
          );

          // Agregar el producto con toda su información
          const productItem: ProductOrderItem = {
            dishId: String(dishId),
            name: String(item.productName),
            quantity: quantity,
            unit_price: unitPrice,
            description: String(item.productDescription || ''),
            adds: validAdds.length > 0 ? validAdds : undefined
          };

          // Validar que el objeto sea válido antes de agregarlo
          if (productItem.dishId && productItem.name && productItem.quantity > 0 && productItem.unit_price > 0) {
            productItems.push(productItem);
          } else {
            console.error('Producto inválido omitido:', productItem);
          }
        });

        // Validar que el array de productos no esté vacío y que todos sean objetos válidos
        const validProductItems = productItems.filter(item => 
          item && 
          typeof item === 'object' && 
          item.dishId && 
          item.name && 
          typeof item.quantity === 'number' && 
          typeof item.unit_price === 'number'
        );

        if (validProductItems.length === 0) {
          this.isLoading = false;
          this.notificationService.showError('No se pudieron procesar los productos del pedido. Por favor, intenta nuevamente.', 'Error en Productos');
          return new Observable(observer => {
            observer.complete();
          });
        }

        return this.continueWithProductItems(validProductItems, items, userInfo, userId);
      })
    ).subscribe({
      next: () => {
        // El pedido se procesa en continueWithProductItems
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Error al mapear IDs de adicionales:', error);
        // Si falla el mapeo, intentar continuar sin mapear (usar IDs del frontend)
        this.continueWithoutMapping(items, userInfo, userId);
      }
    });
  }

  private continueWithProductItems(
    productItems: ProductOrderItem[],
    items: CartItem[],
    userInfo: any,
    userId: string
  ): Observable<any> {
    if (productItems.length === 0) {
      this.isLoading = false;
      this.notificationService.showError('Los productos en tu carrito no tienen identificadores válidos. Por favor, vuelve a agregar los productos.', 'Error en Productos');
      return new Observable(observer => {
        observer.complete();
      });
    }

    // Validar total
    if (!this.total || this.total <= 0 || isNaN(this.total)) {
      this.isLoading = false;
      this.notificationService.showError('El total del pedido no es válido. Por favor, verifica tu carrito.', 'Total Inválido');
      return new Observable(observer => {
        observer.complete();
      });
    }

    let paymentInfo: any = null;

    if (this.paymentMethod === 'card') {
      paymentInfo = {
        cardNumber: this.paymentForm.value.cardNumber.replace(/\s/g, '').substring(this.paymentForm.value.cardNumber.replace(/\s/g, '').length - 4),
        cardHolder: this.paymentForm.value.cardHolder,
        status: 'approved'
      };
    } else if (this.paymentMethod === 'nequi' || this.paymentMethod === 'daviplata') {
      paymentInfo = {
        method: this.paymentMethod,
        link: this.paymentLink,
        code: this.paymentCode,
        reference: this.paymentReference,
        status: 'pending_confirmation',
        confirmedByUser: true,
        confirmedAt: new Date().toISOString()
      };
    } else if (this.paymentMethod === 'transfer') {
      paymentInfo = {
        method: 'transfer',
        bankAccount: this.bankAccount,
        reference: this.bankAccount?.reference,
        status: 'pending_confirmation',
        confirmedByUser: true,
        confirmedAt: new Date().toISOString()
      };
    } else if (this.paymentMethod === 'cash') {
      paymentInfo = {
        method: 'cash',
        status: 'pending',
        confirmedByUser: true
      };
    }

    const paymentMethodBackend = this.orderService.mapPaymentMethodToBackend(this.paymentMethod);

    // Validar payment method
    if (!paymentMethodBackend || paymentMethodBackend === this.paymentMethod) {
      // Si el mapeo falla, usar el método original
      console.warn('No se pudo mapear el método de pago, usando el original:', this.paymentMethod);
    }

    // Asegurar que payment_method no sea undefined
    const finalPaymentMethod = paymentMethodBackend || this.paymentMethod || 'cash';

    // Validar y limpiar el array de productos antes de crear el DTO
    const validatedProducts: ProductOrderItem[] = productItems
      .filter(item => {
        // Filtrar solo objetos válidos
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          console.error('Producto inválido (no es objeto):', item, typeof item);
          return false;
        }
        
        // Validar campos requeridos
        if (!item.dishId || typeof item.dishId !== 'string' || item.dishId.trim() === '') {
          console.error('Producto con dishId inválido:', item);
          return false;
        }
        
        if (!item.name || typeof item.name !== 'string' || item.name.trim() === '') {
          console.error('Producto con name inválido:', item);
          return false;
        }
        
        if (typeof item.quantity !== 'number' || item.quantity <= 0 || isNaN(item.quantity)) {
          console.error('Producto con quantity inválido:', item);
          return false;
        }
        
        if (typeof item.unit_price !== 'number' || item.unit_price <= 0 || isNaN(item.unit_price)) {
          console.error('Producto con unit_price inválido:', item);
          return false;
        }
        
        // Validar adds si existen
        if (item.adds !== undefined && item.adds !== null) {
          if (!Array.isArray(item.adds)) {
            console.error('Producto con adds que no es array:', item);
            return false;
          }
        }
        
        return true;
      })
      .map(item => {
        // Crear objeto plano sin propiedades undefined
        const validAdds = item.adds && Array.isArray(item.adds) && item.adds.length > 0
          ? item.adds
              .filter(add => {
                if (!add || typeof add !== 'object' || Array.isArray(add)) return false;
                if (!add.addId || typeof add.addId !== 'string') return false;
                if (!add.name || typeof add.name !== 'string') return false;
                if (typeof add.price !== 'number' || isNaN(add.price)) return false;
                if (typeof add.quantity !== 'number' || isNaN(add.quantity)) return false;
                return true;
              })
              .map(add => ({
                addId: String(add.addId).trim(),
                name: String(add.name).trim(),
                price: Number(add.price),
                quantity: Number(add.quantity)
              }))
          : undefined;

        // Crear objeto producto sin propiedades undefined
        const product: any = {
          dishId: String(item.dishId).trim(),
          name: String(item.name).trim(),
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          description: item.description ? String(item.description).trim() : ''
        };

        // Solo agregar adds si existe y tiene elementos
        if (validAdds && validAdds.length > 0) {
          product.adds = validAdds;
        }

        // Validar que el objeto sea realmente un objeto plano
        if (typeof product !== 'object' || Array.isArray(product)) {
          console.error('Error: producto no es un objeto válido:', product);
          return null;
        }

        return product;
      })
      .filter((item): item is ProductOrderItem => item !== null && typeof item === 'object' && !Array.isArray(item));

    if (validatedProducts.length === 0) {
      this.isLoading = false;
      this.notificationService.showError('No se pudieron validar los productos del pedido. Por favor, intenta nuevamente.', 'Error en Productos');
      return new Observable(observer => {
        observer.complete();
      });
    }

    // Validar que todos los productos sean objetos válidos
    const finalProducts = validatedProducts.filter((product, index) => {
      if (!product || typeof product !== 'object' || Array.isArray(product)) {
        console.error(`Producto en índice ${index} no es un objeto válido:`, product);
        return false;
      }
      
      // Verificar que tenga las propiedades requeridas
      if (!product.dishId || !product.name || typeof product.quantity !== 'number' || typeof product.unit_price !== 'number') {
        console.error(`Producto en índice ${index} tiene propiedades inválidas:`, product);
        return false;
      }
      
      // Validar adds si existen
      if (product.adds !== undefined) {
        if (!Array.isArray(product.adds)) {
          console.error(`Producto en índice ${index} tiene adds que no es array:`, product);
          return false;
        }
        // Validar cada add
        for (const add of product.adds) {
          if (!add || typeof add !== 'object' || Array.isArray(add)) {
            console.error(`Add inválido en producto ${index}:`, add);
            return false;
          }
        }
      }
      
      return true;
    });

    if (finalProducts.length === 0) {
      this.isLoading = false;
      this.notificationService.showError('No se pudieron validar los productos del pedido. Por favor, intenta nuevamente.', 'Error en Productos');
      return new Observable(observer => {
        observer.complete();
      });
    }

    // Crear DTO sin propiedades undefined
    const createOrderDto: any = {
      usuarioId: String(userId).trim(),
      total: Number(this.total.toFixed(2)),
      payment_method: String(finalPaymentMethod).trim(),
      products: finalProducts,
      status: 'pendiente',
      user_name: String(userInfo.name || userInfo.email || 'Usuario').trim()
    };

    // Eliminar cualquier propiedad undefined del DTO
    Object.keys(createOrderDto).forEach(key => {
      if (createOrderDto[key] === undefined) {
        delete createOrderDto[key];
      }
    });

    // Validación final antes de enviar
    if (!createOrderDto.usuarioId || createOrderDto.usuarioId.trim() === '') {
      this.isLoading = false;
      this.notificationService.showError('El ID de usuario no es válido. Por favor, inicia sesión nuevamente.', 'Error de Usuario');
      return new Observable(observer => {
        observer.complete();
      });
    }

    if (!createOrderDto.products || createOrderDto.products.length === 0) {
      this.isLoading = false;
      // No hay productos válidos - redirigir sin mostrar notificación
      this.router.navigate(['/menu']);
      return new Observable(observer => {
        observer.complete();
      });
    }

    if (!createOrderDto.payment_method || createOrderDto.payment_method.trim() === '') {
      this.isLoading = false;
      this.notificationService.showError('Por favor, selecciona un método de pago.', 'Método de Pago Requerido');
      return new Observable(observer => {
        observer.complete();
      });
    }

    // Función helper para limpiar objetos de propiedades undefined
    const cleanObject = (obj: any): any => {
      if (obj === null || obj === undefined) {
        return obj;
      }
      
      if (Array.isArray(obj)) {
        return obj.map(item => cleanObject(item)).filter(item => item !== undefined);
      }
      
      if (typeof obj === 'object') {
        const cleaned: any = {};
        for (const key in obj) {
          if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
            cleaned[key] = cleanObject(obj[key]);
          }
        }
        return cleaned;
      }
      
      return obj;
    };

    // Limpiar el DTO de propiedades undefined
    const cleanedDto = cleanObject(createOrderDto);

    // Validar cada producto individualmente y convertirlos a objetos planos
    // Crear objetos que coincidan exactamente con el schema de Mongoose (OrderProduct)
    const plainProducts = cleanedDto.products.map((product: any, index: number) => {
      if (!product || typeof product !== 'object' || Array.isArray(product)) {
        console.error(`ERROR: Producto en índice ${index} no es un objeto válido:`, product, typeof product);
        return null;
      }

      // Validar campos requeridos antes de crear el objeto
      const dishId = String(product.dishId || '').trim();
      const name = String(product.name || '').trim();
      const quantity = Number(product.quantity || 1);
      const unitPrice = Number(product.unit_price || 0);
      const description = String(product.description || '').trim();

      if (!dishId || !name || quantity <= 0 || unitPrice <= 0) {
        console.error(`ERROR: Producto en índice ${index} tiene campos inválidos:`, { dishId, name, quantity, unitPrice });
        return null;
      }

      // Crear objeto producto siguiendo exactamente el schema OrderProduct
      const orderProduct: any = {
        dishId: dishId,
        name: name,
        quantity: quantity,
        unit_price: unitPrice,
        description: description
      };

      // Procesar adds si existen - deben seguir el schema OrderAdd
      if (product.adds && Array.isArray(product.adds) && product.adds.length > 0) {
        const validAdds = product.adds
          .filter((add: any) => {
            if (!add || typeof add !== 'object' || Array.isArray(add)) return false;
            const addId = String(add.addId || '').trim();
            const addName = String(add.name || '').trim();
            const addPrice = Number(add.price || 0);
            const addQuantity = Number(add.quantity || 1);
            return addId && addName && addPrice > 0 && addQuantity > 0;
          })
          .map((add: any) => {
            // Crear objeto add siguiendo exactamente el schema OrderAdd
            return {
              addId: String(add.addId || '').trim(),
              name: String(add.name || '').trim(),
              price: Number(add.price || 0),
              quantity: Number(add.quantity || 1)
            };
          });

        // Solo agregar adds si hay al menos uno válido
        if (validAdds.length > 0) {
          orderProduct.adds = validAdds;
        }
      }

      // Retornar objeto plano - no usar JSON.parse/stringify aquí para evitar problemas
      // El objeto ya es plano porque lo creamos con object literal
      return orderProduct;
    }).filter((product: any) => product !== null && typeof product === 'object' && !Array.isArray(product));

    if (plainProducts.length === 0) {
      this.isLoading = false;
      this.notificationService.showError('No se pudieron validar los productos del pedido. Por favor, intenta nuevamente.', 'Error en Productos');
      return new Observable(observer => {
        observer.complete();
      });
    }

    // Función helper para crear objetos completamente planos sin prototipos
    // Esto es necesario para que class-transformer de NestJS pueda transformar correctamente
    const createPlainObject = (obj: any): any => {
      if (obj === null || obj === undefined) {
        return obj;
      }
      if (Array.isArray(obj)) {
        return obj.map(item => createPlainObject(item));
      }
      if (typeof obj === 'object') {
        const plain: any = {};
        for (const key in obj) {
          if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
            plain[key] = createPlainObject(obj[key]);
          }
        }
        return plain;
      }
      return obj;
    };

    // Crear el DTO final con estructura exacta que espera el backend
    // Usar createPlainObject para asegurar objetos sin prototipos
    const finalDto: any = createPlainObject({
      usuarioId: String(cleanedDto.usuarioId || userId).trim(),
      total: Number(cleanedDto.total || this.total.toFixed(2)),
      payment_method: String(cleanedDto.payment_method || finalPaymentMethod).trim(),
      products: plainProducts.map((p: any) => {
        // Crear un objeto completamente nuevo para cada producto
        const productObj: any = {
          dishId: String(p.dishId).trim(),
          name: String(p.name).trim(),
          quantity: Number(p.quantity),
          unit_price: Number(p.unit_price),
          description: String(p.description || '').trim()
        };
        
        // Agregar adds si existen y son válidos
        if (p.adds && Array.isArray(p.adds) && p.adds.length > 0) {
          const validAdds = p.adds
            .filter((add: any) => add && typeof add === 'object' && !Array.isArray(add))
            .map((add: any) => ({
              addId: String(add.addId || '').trim(),
              name: String(add.name || '').trim(),
              price: Number(add.price || 0),
              quantity: Number(add.quantity || 1)
            }))
            .filter((add: any) => add.addId && add.name && !isNaN(add.price) && add.price > 0 && !isNaN(add.quantity) && add.quantity > 0);
          
          if (validAdds.length > 0) {
            productObj.adds = validAdds;
          }
        }
        
        return productObj;
      }),
      status: String(cleanedDto.status || 'pendiente').trim(),
      user_name: String(cleanedDto.user_name || userInfo.name || userInfo.email || 'Usuario').trim()
    });

    // Validación final crítica: asegurar que products sea un array de objetos válidos
    if (!Array.isArray(finalDto.products)) {
      console.error('ERROR CRÍTICO: products no es un array:', finalDto.products, typeof finalDto.products);
      this.isLoading = false;
      this.notificationService.showError('Error en la estructura de productos. Por favor, intenta nuevamente.', 'Error en Productos');
      return new Observable(observer => {
        observer.complete();
      });
    }

    // Validar cada producto individualmente
    for (let i = 0; i < finalDto.products.length; i++) {
      const product = finalDto.products[i];
      
      // Verificar que sea un objeto válido
      if (!product || typeof product !== 'object' || Array.isArray(product)) {
        console.error(`ERROR CRÍTICO: Producto ${i} no es un objeto válido:`, product, typeof product, Array.isArray(product));
        this.isLoading = false;
        this.notificationService.showError(`Error en el producto ${i + 1}. Por favor, intenta nuevamente.`, 'Error en Productos');
        return new Observable(observer => {
          observer.complete();
        });
      }
      
      // Verificar propiedades requeridas
      if (!product.dishId || typeof product.dishId !== 'string' ||
          !product.name || typeof product.name !== 'string' ||
          typeof product.quantity !== 'number' || isNaN(product.quantity) ||
          typeof product.unit_price !== 'number' || isNaN(product.unit_price) ||
          typeof product.description !== 'string') {
        console.error(`ERROR CRÍTICO: Producto ${i} tiene propiedades inválidas:`, product);
        this.isLoading = false;
        this.notificationService.showError(`Error en el producto ${i + 1}. Por favor, intenta nuevamente.`, 'Error en Productos');
        return new Observable(observer => {
          observer.complete();
        });
      }
      
      // Validar adds si existen
      if (product.adds !== undefined) {
        if (!Array.isArray(product.adds)) {
          console.error(`ERROR CRÍTICO: Producto ${i} tiene adds que no es array:`, product.adds);
          this.isLoading = false;
          this.notificationService.showError(`Error en los adicionales del producto ${i + 1}. Por favor, intenta nuevamente.`, 'Error en Productos');
          return new Observable(observer => {
            observer.complete();
          });
        }
        
        // Validar cada add
        for (let j = 0; j < product.adds.length; j++) {
          const add = product.adds[j];
          if (!add || typeof add !== 'object' || Array.isArray(add)) {
            console.error(`ERROR CRÍTICO: Add ${j} del producto ${i} no es un objeto válido:`, add);
            this.isLoading = false;
            this.notificationService.showError(`Error en los adicionales del producto ${i + 1}. Por favor, intenta nuevamente.`, 'Error en Productos');
            return new Observable(observer => {
              observer.complete();
            });
          }
        }
      }
    }

    // Log para debugging - mostrar todos los datos
    console.log('=== DATOS DEL PEDIDO ===');
    console.log('Items del carrito:', items);
    console.log('Items detalle:', items.map(item => ({
      productId: item.productId,
      productIdType: typeof item.productId,
      quantity: item.quantity,
      productName: item.productName
    })));
    console.log('UserInfo:', userInfo);
    console.log('ProductItems (array):', productItems);
    console.log('ProductItems (detalle):', productItems.map((item, index) => ({ index, dishId: item.dishId, quantity: item.quantity })));
    console.log('Total:', this.total, 'Tipo:', typeof this.total);
    console.log('Payment Method:', paymentMethodBackend);
    console.log('UsuarioId:', userId, 'Tipo:', typeof userId);
    console.log('CreateOrderDto completo:', finalDto);
    console.log('CreateOrderDto (JSON):', JSON.stringify(finalDto, null, 2));
    console.log('Products array expandido:', JSON.stringify(finalDto.products, null, 2));
    console.log('Products array tipo:', Array.isArray(finalDto.products));
    console.log('Products array length:', finalDto.products.length);
    finalDto.products.forEach((p: any, i: number) => {
      console.log(`Producto ${i}:`, p, 'tipo:', typeof p, 'es objeto:', typeof p === 'object' && !Array.isArray(p));
      console.log(`Producto ${i} keys:`, Object.keys(p));
      console.log(`Producto ${i} constructor:`, p.constructor?.name);
      console.log(`Producto ${i} es instancia de Object:`, p instanceof Object);
      console.log(`Producto ${i} Object.getPrototypeOf:`, Object.getPrototypeOf(p));
      console.log(`Producto ${i} JSON.stringify:`, JSON.stringify(p));
    });

    // Serialización final para asegurar que el objeto sea completamente plano
    // Esto es necesario para que class-transformer de NestJS pueda transformar correctamente
    const serializedDto = JSON.parse(JSON.stringify(finalDto)) as CreateOrderDto;
    
    // Validación final después de serialización
    if (!Array.isArray(serializedDto.products)) {
      console.error('ERROR DESPUÉS DE SERIALIZACIÓN: products no es un array');
      this.isLoading = false;
      this.notificationService.showError('Error en la estructura de productos. Por favor, intenta nuevamente.', 'Error en Productos');
      return new Observable(observer => {
        observer.complete();
      });
    }
    
    // Verificar que cada producto sea un objeto después de serialización
    for (let i = 0; i < serializedDto.products.length; i++) {
      const product = serializedDto.products[i];
      if (!product || typeof product !== 'object' || Array.isArray(product)) {
        console.error(`ERROR DESPUÉS DE SERIALIZACIÓN: Producto ${i} no es un objeto válido:`, product);
        this.isLoading = false;
        this.notificationService.showError(`Error en el producto ${i + 1}. Por favor, intenta nuevamente.`, 'Error en Productos');
        return new Observable(observer => {
          observer.complete();
        });
      }
    }
    
    console.log('DTO después de serialización:', serializedDto);
    console.log('Products después de serialización:', serializedDto.products);
    console.log('JSON final que se enviará:', JSON.stringify(serializedDto, null, 2));

    return this.orderService.createOrder(serializedDto).pipe(
      takeUntil(this.destroy$),
      map(response => {
        console.log('Pedido creado exitosamente:', response);
        this.saveOrderLocally(items, paymentInfo, response.order);
        let successMessage = '';
        let successTitle = '';

        if (this.paymentMethod === 'nequi' || this.paymentMethod === 'daviplata') {
          successTitle = '¡Pago Confirmado!';
          successMessage = `Tu pedido ha sido confirmado. Total: ${this.total.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}. Recibirás un correo con los detalles de tu pedido.`;
        } else if (this.paymentMethod === 'transfer') {
          successTitle = '¡Pago Confirmado!';
          successMessage = `Tu pedido ha sido confirmado. Total: ${this.total.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}. Verificaremos tu transferencia y te notificaremos.`;
        } else {
          successTitle = '¡Pedido Confirmado!';
          successMessage = `Tu pedido ha sido realizado exitosamente. Total: ${this.total.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}.`;
        }

        this.notificationService.showSuccess(successMessage, successTitle);
        // Establecer banderas antes de limpiar el carrito
        sessionStorage.setItem('orderJustPlaced', 'true');
        sessionStorage.setItem('processingOrder', 'true');
        // Limpiar el carrito después de un pequeño delay para evitar que se muestre el mensaje
        setTimeout(() => {
          this.cartService.clearCart();
          sessionStorage.removeItem('processingOrder');
          // Navegar después de limpiar el carrito
          setTimeout(() => {
            this.router.navigate(['/perfil']);
          }, 500);
        }, 100);
        return response;
      }),
      catchError((error) => {
        this.isLoading = false;
        console.error('=== ERROR AL CREAR PEDIDO ===');
        console.error('Error completo:', error);
        console.error('Error status:', error.status);
        console.error('Error statusText:', error.statusText);
        console.error('Error error (objeto):', error.error);
        console.error('Error error (JSON):', JSON.stringify(error.error, null, 2));
        console.error('Error message:', error.message);
        console.error('Error url:', error.url);
        console.error('Datos enviados:', finalDto);
        console.error('Datos enviados (JSON):', JSON.stringify(finalDto, null, 2));

        // Mensaje de error más específico
        let errorMessage = 'Hubo un error al procesar tu pedido. Por favor, intenta nuevamente.';

        // Intentar obtener el mensaje de error del backend
        if (error.error) {
          if (typeof error.error === 'string') {
            errorMessage = error.error;
          } else if (error.error.message) {
            errorMessage = error.error.message;
          } else if (error.error.error) {
            errorMessage = error.error.error;
          }
        } else if (error.message) {
          errorMessage = error.message;
        }

        // Mensajes específicos según el código de estado
        if (error.status === 400) {
          if (!errorMessage || errorMessage.includes('Hubo un error')) {
            // Intentar obtener un mensaje más específico del backend
            if (error.error?.message) {
              const backendMsg = error.error.message.toLowerCase();
              if (backendMsg.includes('add') || backendMsg.includes('adicional') || backendMsg.includes('adds') || backendMsg.includes('addid')) {
                errorMessage = 'Error con los adicionales del pedido. Verifica que los adicionales seleccionados sean válidos.';
              } else {
                errorMessage = error.error.message;
              }
            } else {
              errorMessage = 'Solicitud incorrecta. Por favor, verifica los datos enviados. Revisa la consola para más detalles.';
            }
          }
        } else if (error.status === 401) {
          errorMessage = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
          this.router.navigate(['/login']);
        } else if (error.status === 500) {
          errorMessage = 'Error del servidor. Por favor, intenta más tarde.';
        } else if (error.status === 0) {
          errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
        }

        this.notificationService.showError(errorMessage, 'Error al Procesar Pedido');
        return throwError(() => error);
      })
    );
  }

  private continueWithoutMapping(
    items: CartItem[],
    userInfo: any,
    userId: string
  ): void {
    // Si falla el mapeo, intentar enviar con los IDs del frontend tal cual
    // Esto podría fallar si el backend valida los IDs, pero es un fallback
    const productItems: ProductOrderItem[] = [];
    items.forEach(item => {
      if (!item.productId && item.productId !== 0) {
        return;
      }
      const dishId = String(item.productId);
      if (dishId === 'undefined' || dishId === 'null' || dishId === '' || !dishId.trim()) {
        return;
      }

      // Validar campos requeridos
      if (!item.productName || !item.basePrice) {
        console.error('Item con datos incompletos:', item);
        return;
      }

      // Asegurar que los valores numéricos sean válidos
      const quantity = Number(item.quantity) || 1;
      const unitPrice = Number(item.basePrice);
      
      if (isNaN(quantity) || quantity <= 0 || isNaN(unitPrice) || unitPrice <= 0) {
        console.error('Item con valores numéricos inválidos:', { quantity, unitPrice });
        return;
      }

      const adds: AddOrderItem[] = [];
      if (item.selectedOptions && item.selectedOptions.length > 0) {
        item.selectedOptions.forEach(option => {
          const isAddonOrExtra = option.type === 'addon' || option.type === 'extra' ||
            (!option.type && option.price > 0);
          if (isAddonOrExtra && option.price > 0 && option.id && option.name) {
            // Validar que el add tenga todos los campos requeridos
            const addId = String(option.id).trim();
            const addName = String(option.name).trim();
            const addPrice = Number(option.price);
            
            if (addId && addName && !isNaN(addPrice) && addPrice > 0) {
              adds.push({
                addId: addId,
                name: addName,
                price: addPrice,
                quantity: 1
              });
            }
          }
        });
      }

      // Crear el producto con validación
      const productItem: ProductOrderItem = {
        dishId: dishId.trim(),
        name: String(item.productName).trim(),
        quantity: quantity,
        unit_price: unitPrice,
        description: item.productDescription ? String(item.productDescription).trim() : '',
        adds: adds.length > 0 ? adds : undefined
      };

      // Validar que el objeto sea válido antes de agregarlo
      if (productItem.dishId && productItem.name && productItem.quantity > 0 && productItem.unit_price > 0) {
        productItems.push(productItem);
      } else {
        console.error('Producto inválido omitido:', productItem);
      }
    });

    // Validar que haya productos válidos
    if (productItems.length === 0) {
      this.isLoading = false;
      this.notificationService.showError('No se pudieron procesar los productos del pedido. Por favor, intenta nuevamente.', 'Error en Productos');
      return;
    }

    this.continueWithProductItems(productItems, items, userInfo, userId).subscribe();
  }

  private saveOrderLocally(items: CartItem[], paymentInfo: any, backendOrder: any): void {
    const userInfo = this.authService.getUserInfo();
    const userId = userInfo?.userId || userInfo?.email || 'guest';
    const trackingCode = this.generateTrackingCode();
    const estimatedPrepTime = this.calculateEstimatedPrepTime(items);
    const estimatedDeliveryTime = new Date();
    estimatedDeliveryTime.setMinutes(estimatedDeliveryTime.getMinutes() + estimatedPrepTime);
    if (this.orderType === 'delivery') {
      estimatedDeliveryTime.setMinutes(estimatedDeliveryTime.getMinutes() + 20);
    }
    const statusHistory: any[] = [{
      status: 'pending',
      timestamp: new Date(),
      message: 'Pedido recibido y confirmado'
    }];
    const orderId = backendOrder._id || backendOrder.id || `order_${Date.now()}`;
    const newOrder: Order = {
      id: orderId,
      trackingCode: trackingCode,
      date: backendOrder.createdAt ? new Date(backendOrder.createdAt) : new Date(),
      items: items.map((item: CartItem) => ({
        id: Number(item.productId) || 0,
        name: item.productName,
        quantity: item.quantity,
        price: item.basePrice,
        selectedOptions: item.selectedOptions.map(opt => ({
          id: opt.id,
          name: opt.name,
          price: opt.price
        })),
        notes: ''
      })),
      subtotal: this.subtotal,
      additionalFees: this.additionalFees,
      total: this.total,
      status: 'pending' as const,
      orderType: this.orderType,
      deliveryAddress: this.orderType === 'delivery' ? this.deliveryForm.value.address : undefined,
      deliveryNeighborhood: this.orderType === 'delivery' ? this.deliveryForm.value.neighborhood : undefined,
      deliveryPhone: this.orderType === 'delivery' ? this.deliveryForm.value.phone : undefined,
      deliveryInstructions: this.orderType === 'delivery' ? this.deliveryForm.value.deliveryInstructions : undefined,
      paymentMethod: this.paymentMethod,
      paymentInfo: paymentInfo,
      estimatedPrepTime: estimatedPrepTime,
      estimatedDeliveryTime: estimatedDeliveryTime,
      statusHistory: statusHistory,
      canCancel: true
    };
    const orders = JSON.parse(localStorage.getItem(`userOrders_${userId}`) || '[]');
    orders.unshift(newOrder);
    localStorage.setItem(`userOrders_${userId}`, JSON.stringify(orders));
    this.userService.saveOrder(newOrder);
  }

  generateTrackingCode(): string {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `PRE${timestamp}${random}`.toUpperCase();
  }

  calculateEstimatedPrepTime(items: any[]): number {
    const baseTime = 15;
    const itemsCount = items.reduce((sum, item) => sum + item.quantity, 0);
    return baseTime + (itemsCount - 1) * 5;
  }

  formatCardNumber(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\s/g, '').replace(/[^0-9]/gi, '');
    const formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
    this.paymentForm.patchValue({ cardNumber: formattedValue }, { emitEvent: false });
  }

  formatExpiryDate(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    if (value.length >= 2) {
      value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    this.paymentForm.patchValue({ expiryDate: value }, { emitEvent: false });
  }

  goBack(): void {
    this.router.navigate(['/menu']);
  }
}
