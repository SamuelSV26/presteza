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
  paymentLink = '';
  paymentCode = '';
  paymentReference = '';
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
      if (items.length === 0 && !orderJustPlaced) {
        const isProcessingOrder = sessionStorage.getItem('processingOrder');
        if (!isProcessingOrder) {
          this.router.navigate(['/menu']);
        }
      } else if (orderJustPlaced) {
        setTimeout(() => {
          sessionStorage.removeItem('orderJustPlaced');
        }, 1000);
      }
    });
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
    this.userService.getPaymentMethods().pipe(takeUntil(this.destroy$)).subscribe({
      next: (methods) => {
        this.savedPaymentMethods = methods.filter(m => m.type === 'credit' || m.type === 'debit');
        
        this.savedPaymentMethods.sort((a, b) => {
          const aIsPrimary = a.is_primary || a.isDefault || false;
          const bIsPrimary = b.is_primary || b.isDefault || false;
          if (aIsPrimary && !bIsPrimary) return -1;
          if (!aIsPrimary && bIsPrimary) return 1;
          return 0;
        });
        
        const defaultMethod = this.savedPaymentMethods.find(m => m.is_primary || m.isDefault);
        if (defaultMethod && defaultMethod.id) {
          this.selectedSavedMethod = defaultMethod.id;
          this.useSavedCard = true;
          this.paymentMethod = 'card';
          this.loadSavedCardData(defaultMethod);
        } else if (this.savedPaymentMethods.length > 0 && this.savedPaymentMethods[0].id) {
          this.selectedSavedMethod = this.savedPaymentMethods[0].id;
          this.useSavedCard = true;
          this.paymentMethod = 'card';
          this.loadSavedCardData(this.savedPaymentMethods[0]);
        } else {
          this.paymentMethod = 'cash';
          this.useSavedCard = false;
          this.selectedSavedMethod = null;
        }
      },
      error: () => {
        this.paymentMethod = 'cash';
        this.useSavedCard = false;
        this.selectedSavedMethod = null;
      }
    });
  }

  loadSavedCardData(method: SavedPaymentMethod): void {
    this.useSavedCard = true;
    this.selectedSavedMethod = method.id || null;
    if ((method.type === 'credit' || method.type === 'debit') && method.last_four_digits) {
      this.paymentForm.patchValue({
        cardNumber: `**** **** **** ${method.last_four_digits}`,
        cardHolder: method.cardholder_name || 'Titular guardado'
      });
      this.paymentForm.get('cardNumber')?.clearValidators();
      this.paymentForm.get('cardHolder')?.clearValidators();
      this.paymentForm.get('expiryDate')?.clearValidators();
      this.paymentForm.get('cvv')?.clearValidators();
      this.paymentForm.updateValueAndValidity();
    }
  }

  onSavedMethodSelect(methodId: string | undefined): void {
    if (!methodId) return;
    const method = this.savedPaymentMethods.find(m => m.id === methodId);
    if (method) {
      this.selectedSavedMethod = methodId;
      if (method.type === 'credit' || method.type === 'debit') {
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
    if (method && (method.type === 'credit' || method.type === 'debit') && method.last_four_digits) {
      const brand = method.brand ? method.brand.charAt(0).toUpperCase() + method.brand.slice(1) : 'Tarjeta';
      const type = method.type === 'credit' ? 'Crédito' : 'Débito';
      return `${brand} ${type} •••• ${method.last_four_digits}`;
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

    if (!items || items.length === 0) {
      this.isLoading = false;
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

    const dishObservables = items.map(item => {
      const dishId = String(item.productId);
      return this.menuService.getItemById(dishId).pipe(
        map(dish => ({ item, dish, dishId }))
      );
    });

    forkJoin(dishObservables).pipe(
      takeUntil(this.destroy$),
      switchMap(dishData => {
        return this.addsService.mapFrontendIdsToBackendIds(frontendAddIds).pipe(
          map(addIdMap => ({ dishData, addIdMap }))
        );
      }),
      switchMap(({ dishData, addIdMap }) => {
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
        const productItems: ProductOrderItem[] = [];

        dishData.forEach(({ item, dish, dishId }) => {
          if (!dishId || dishId === 'undefined' || dishId === 'null' || dishId === '') {
            return;
          }

          const categoryId = dish?.categoryId;
          const dishIdStr = dishId;
          const availableAdds = categoryId ? (categoryAddsMap.get(categoryId) || []) : [];

          const adds: AddOrderItem[] = [];
          if (item.selectedOptions && item.selectedOptions.length > 0) {
            item.selectedOptions.forEach(option => {
              const isAddonOrExtra = option.type === 'addon' || option.type === 'extra' ||
                (!option.type && option.price > 0);
              if (isAddonOrExtra && option.price > 0) {
                const backendAddId = addIdMap.get(option.id) || option.id;

                const add = allAdds.find(a => (a._id || a.id) === backendAddId);

                if (add) {
                  const isForThisProduct = add.dishIds && add.dishIds.length > 0 && add.dishIds.includes(dishIdStr);
                  const isForThisCategory = categoryId && add.categoryIds && add.categoryIds.length > 0 && add.categoryIds.includes(categoryId);

                  let shouldInclude = false;

                  if (add.dishIds && add.dishIds.length > 0) {
                    shouldInclude = isForThisProduct;
                  } else if (categoryId) {
                    shouldInclude = isForThisCategory;
                  }

                  if (!shouldInclude) {
                    return;
                  }
                } else {
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

          if (!dishId || !item.productName || !item.basePrice) {
            return;
          }

          const quantity = Number(item.quantity) || 1;
          const unitPrice = Number(item.basePrice);
          
          if (isNaN(quantity) || quantity <= 0 || isNaN(unitPrice) || unitPrice <= 0) {
            return;
          }

          const validAdds = adds.filter(add => 
            add && 
            typeof add === 'object' && 
            add.addId && 
            add.name && 
            typeof add.price === 'number' && 
            typeof add.quantity === 'number'
          );

          const productItem: ProductOrderItem = {
            dishId: String(dishId),
            name: String(item.productName),
            quantity: quantity,
            unit_price: unitPrice,
            description: String(item.productDescription || ''),
            adds: validAdds.length > 0 ? validAdds : undefined
          };

          if (productItem.dishId && productItem.name && productItem.quantity > 0 && productItem.unit_price > 0) {
            productItems.push(productItem);
          }
        });

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
      },
      error: (error) => {
        this.isLoading = false;
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
    const finalPaymentMethod = paymentMethodBackend || this.paymentMethod || 'cash';

    const validatedProducts: ProductOrderItem[] = productItems
      .filter(item => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return false;
        }
        
        if (!item.dishId || typeof item.dishId !== 'string' || item.dishId.trim() === '') {
          return false;
        }
        
        if (!item.name || typeof item.name !== 'string' || item.name.trim() === '') {
          return false;
        }
        
        if (typeof item.quantity !== 'number' || item.quantity <= 0 || isNaN(item.quantity)) {
          return false;
        }
        
        if (typeof item.unit_price !== 'number' || item.unit_price <= 0 || isNaN(item.unit_price)) {
          return false;
        }
        
        if (item.adds !== undefined && item.adds !== null) {
          if (!Array.isArray(item.adds)) {
            return false;
          }
        }
        
        return true;
      })
      .map(item => {
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

        const product: any = {
          dishId: String(item.dishId).trim(),
          name: String(item.name).trim(),
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          description: item.description ? String(item.description).trim() : ''
        };

        if (validAdds && validAdds.length > 0) {
          product.adds = validAdds;
        }

        if (typeof product !== 'object' || Array.isArray(product)) {
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

    const finalProducts = validatedProducts.filter((product) => {
      if (!product || typeof product !== 'object' || Array.isArray(product)) {
        return false;
      }
      
      if (!product.dishId || !product.name || typeof product.quantity !== 'number' || typeof product.unit_price !== 'number') {
        return false;
      }
      
      if (product.adds !== undefined) {
        if (!Array.isArray(product.adds)) {
          return false;
        }
        for (const add of product.adds) {
          if (!add || typeof add !== 'object' || Array.isArray(add)) {
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

    const createOrderDto: any = {
      usuarioId: String(userId).trim(),
      total: Number(this.total.toFixed(2)),
      payment_method: String(finalPaymentMethod).trim(),
      products: finalProducts,
      status: 'pendiente',
      user_name: String(userInfo.name || userInfo.email || 'Usuario').trim()
    };

    Object.keys(createOrderDto).forEach(key => {
      if (createOrderDto[key] === undefined) {
        delete createOrderDto[key];
      }
    });

    if (!createOrderDto.usuarioId || createOrderDto.usuarioId.trim() === '') {
      this.isLoading = false;
      this.notificationService.showError('El ID de usuario no es válido. Por favor, inicia sesión nuevamente.', 'Error de Usuario');
      return new Observable(observer => {
        observer.complete();
      });
    }

    if (!createOrderDto.products || createOrderDto.products.length === 0) {
      this.isLoading = false;
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

    const cleanedDto = cleanObject(createOrderDto);
    
    const plainProducts = cleanedDto.products.map((product: any) => {
      if (!product || typeof product !== 'object' || Array.isArray(product)) {
        return null;
      }

      const dishId = String(product.dishId || '').trim();
      const name = String(product.name || '').trim();
      const quantity = Number(product.quantity || 1);
      const unitPrice = Number(product.unit_price || 0);
      const description = String(product.description || '').trim();

      if (!dishId || !name || quantity <= 0 || unitPrice <= 0) {
        return null;
      }

      const orderProduct: any = {
        dishId: dishId,
        name: name,
        quantity: quantity,
        unit_price: unitPrice,
        description: description
      };

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
            return {
              addId: String(add.addId || '').trim(),
              name: String(add.name || '').trim(),
              price: Number(add.price || 0),
              quantity: Number(add.quantity || 1)
            };
          });

        if (validAdds.length > 0) {
          orderProduct.adds = validAdds;
        }
      }

      return orderProduct;
    }).filter((product: any) => product !== null && typeof product === 'object' && !Array.isArray(product));

    if (plainProducts.length === 0) {
      this.isLoading = false;
      this.notificationService.showError('No se pudieron validar los productos del pedido. Por favor, intenta nuevamente.', 'Error en Productos');
      return new Observable(observer => {
        observer.complete();
      });
    }

    const finalDto: any = cleanObject({
      usuarioId: String(cleanedDto.usuarioId || userId).trim(),
      total: Number(cleanedDto.total || this.total.toFixed(2)),
      payment_method: String(cleanedDto.payment_method || finalPaymentMethod).trim(),
      products: plainProducts.map((p: any) => {
        const productObj: any = {
          dishId: String(p.dishId).trim(),
          name: String(p.name).trim(),
          quantity: Number(p.quantity),
          unit_price: Number(p.unit_price),
          description: String(p.description || '').trim()
        };
        
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

    if (!Array.isArray(finalDto.products)) {
      this.isLoading = false;
      this.notificationService.showError('Error en la estructura de productos. Por favor, intenta nuevamente.', 'Error en Productos');
      return new Observable(observer => {
        observer.complete();
      });
    }

    for (let i = 0; i < finalDto.products.length; i++) {
      const product = finalDto.products[i];
      
      if (!product || typeof product !== 'object' || Array.isArray(product)) {
        this.isLoading = false;
        this.notificationService.showError(`Error en el producto ${i + 1}. Por favor, intenta nuevamente.`, 'Error en Productos');
        return new Observable(observer => {
          observer.complete();
        });
      }
      
      if (!product.dishId || typeof product.dishId !== 'string' ||
          !product.name || typeof product.name !== 'string' ||
          typeof product.quantity !== 'number' || isNaN(product.quantity) ||
          typeof product.unit_price !== 'number' || isNaN(product.unit_price) ||
          typeof product.description !== 'string') {
        this.isLoading = false;
        this.notificationService.showError(`Error en el producto ${i + 1}. Por favor, intenta nuevamente.`, 'Error en Productos');
        return new Observable(observer => {
          observer.complete();
        });
      }
      
      if (product.adds !== undefined) {
        if (!Array.isArray(product.adds)) {
          this.isLoading = false;
          this.notificationService.showError(`Error en los adicionales del producto ${i + 1}. Por favor, intenta nuevamente.`, 'Error en Productos');
          return new Observable(observer => {
            observer.complete();
          });
        }
        
        for (let j = 0; j < product.adds.length; j++) {
          const add = product.adds[j];
          if (!add || typeof add !== 'object' || Array.isArray(add)) {
            this.isLoading = false;
            this.notificationService.showError(`Error en los adicionales del producto ${i + 1}. Por favor, intenta nuevamente.`, 'Error en Productos');
            return new Observable(observer => {
              observer.complete();
            });
          }
        }
      }
    }

    const serializedDto = JSON.parse(JSON.stringify(finalDto)) as CreateOrderDto;
    
    if (!Array.isArray(serializedDto.products)) {
      this.isLoading = false;
      this.notificationService.showError('Error en la estructura de productos. Por favor, intenta nuevamente.', 'Error en Productos');
      return new Observable(observer => {
        observer.complete();
      });
    }
    
    for (let i = 0; i < serializedDto.products.length; i++) {
      const product = serializedDto.products[i];
      if (!product || typeof product !== 'object' || Array.isArray(product)) {
        this.isLoading = false;
        this.notificationService.showError(`Error en el producto ${i + 1}. Por favor, intenta nuevamente.`, 'Error en Productos');
        return new Observable(observer => {
          observer.complete();
        });
      }
    }

    return this.orderService.createOrder(serializedDto).pipe(
      takeUntil(this.destroy$),
      map(response => {
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
        sessionStorage.setItem('orderJustPlaced', 'true');
        sessionStorage.setItem('processingOrder', 'true');
        setTimeout(() => {
          this.cartService.clearCart();
          sessionStorage.removeItem('processingOrder');
          setTimeout(() => {
            this.router.navigate(['/perfil']);
          }, 500);
        }, 100);
        return response;
      }),
      catchError((error) => {
        this.isLoading = false;

        let errorMessage = 'Hubo un error al procesar tu pedido. Por favor, intenta nuevamente.';

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

        if (error.status === 400) {
          if (!errorMessage || errorMessage.includes('Hubo un error')) {
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
    const productItems: ProductOrderItem[] = [];
    items.forEach(item => {
      if (!item.productId && item.productId !== 0) {
        return;
      }
      const dishId = String(item.productId);
      if (dishId === 'undefined' || dishId === 'null' || dishId === '' || !dishId.trim()) {
        return;
      }

      if (!item.productName || !item.basePrice) {
        return;
      }

      const quantity = Number(item.quantity) || 1;
      const unitPrice = Number(item.basePrice);
      
      if (isNaN(quantity) || quantity <= 0 || isNaN(unitPrice) || unitPrice <= 0) {
        return;
      }

      const adds: AddOrderItem[] = [];
      if (item.selectedOptions && item.selectedOptions.length > 0) {
        item.selectedOptions.forEach(option => {
          const isAddonOrExtra = option.type === 'addon' || option.type === 'extra' ||
            (!option.type && option.price > 0);
          if (isAddonOrExtra && option.price > 0 && option.id && option.name) {
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

      const productItem: ProductOrderItem = {
        dishId: dishId.trim(),
        name: String(item.productName).trim(),
        quantity: quantity,
        unit_price: unitPrice,
        description: item.productDescription ? String(item.productDescription).trim() : '',
        adds: adds.length > 0 ? adds : undefined
      };

      if (productItem.dishId && productItem.name && productItem.quantity > 0 && productItem.unit_price > 0) {
        productItems.push(productItem);
      }
    });

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
    const value = input.value.replace(/\s/g, '').replace(/[^0-9]/gi, '');
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
