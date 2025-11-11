import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CartService, CartItem } from '../../core/services/cart.service';
import { Observable, Subject, combineLatest } from 'rxjs';
import { takeUntil, map } from 'rxjs/operators';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { OrderService } from '../../core/services/order.service';
import { PaymentMethod as SavedPaymentMethod } from '../../core/models/PaymentMethod';
import { Address } from '../../core/models/Address';
import { Order } from '../../core/models/Order';
import { CreateOrderDto } from '../../core/models/CreateOrderDto';

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

  // Costos adicionales
  readonly DISPOSABLES_FEE = 1000; // Para recoger en restaurante
  readonly DELIVERY_FEE = 4000; // Para entrega a domicilio

  // Totales
  subtotal = 0;
  additionalFees = 0;
  total = 0;

  // Formularios
  deliveryForm: FormGroup;
  paymentForm: FormGroup;

  isLoading = false;
  showPaymentModal = false;

  // Información de pago digital
  paymentLink: string = '';
  paymentCode: string = '';
  paymentReference: string = '';
  bankAccount: any = null;
  showPaymentInfo = false;

  // Métodos de pago guardados
  savedPaymentMethods: SavedPaymentMethod[] = [];
  selectedSavedMethod: string | null = null;
  useSavedCard = false;

  // Direcciones guardadas
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
    private orderService: OrderService
  ) {
    // Formulario de entrega
    this.deliveryForm = this.fb.group({
      address: ['', [Validators.required]],
      neighborhood: ['', [Validators.required]],
      city: ['Manizales', [Validators.required]],
      postalCode: ['170001', [Validators.required]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      deliveryInstructions: ['']
    });

    // Formulario de pago (solo para tarjeta)
    this.paymentForm = this.fb.group({
      cardNumber: ['', [Validators.required, Validators.pattern(/^[0-9\s]{16,19}$/)]],
      cardHolder: ['', [Validators.required]],
      expiryDate: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/[0-9]{2}$/)]],
      cvv: ['', [Validators.required, Validators.pattern(/^[0-9]{3,4}$/)]]
    });
  }

  ngOnInit(): void {
    // Verificar que el usuario esté autenticado
    if (!this.authService.isAuthenticated()) {
      this.notificationService.showWarning('Debes iniciar sesión para realizar un pedido');
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/checkout' } });
      return;
    }

    // Verificar que haya items en el carrito
    this.cartItems$ = this.cartService.cartItems$;
    this.cartItems$.pipe(takeUntil(this.destroy$)).subscribe(items => {
      // No mostrar alerta si el carrito se vació por un pago exitoso reciente
      const orderJustPlaced = sessionStorage.getItem('orderJustPlaced');
      if (items.length === 0 && !orderJustPlaced) {
        this.notificationService.showWarning('Tu carrito está vacío');
        this.router.navigate(['/menu']);
      } else if (orderJustPlaced) {
        // Limpiar la bandera después de usarla
        sessionStorage.removeItem('orderJustPlaced');
      }
    });

    // Calcular subtotal
    this.subtotal$ = this.cartService.getTotalPrice();

    // Calcular totales
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

    // Cargar datos del usuario si está autenticado
    const userInfo = this.authService.getUserInfo();
    if (userInfo) {
      const userPhone = localStorage.getItem('userPhone') || '';
      this.deliveryForm.patchValue({
        phone: userPhone
      });
    }

    // Cargar métodos de pago guardados
    this.loadSavedPaymentMethods();

    // Cargar direcciones guardadas
    this.loadSavedAddresses();
  }

  loadSavedPaymentMethods(): void {
    this.userService.getPaymentMethods().pipe(takeUntil(this.destroy$)).subscribe(methods => {
      this.savedPaymentMethods = methods;
      // Si hay un método principal, seleccionarlo por defecto
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
      // Pre-llenar el formulario con los datos de la tarjeta guardada
      // Nota: Solo tenemos los últimos 4 dígitos, así que mostramos un placeholder
      this.paymentForm.patchValue({
        cardNumber: `**** **** **** ${method.last4}`,
        cardHolder: 'Titular guardado' // No guardamos el nombre completo por seguridad
      });
      // Marcar como válido ya que es una tarjeta guardada
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
    // Restaurar validadores
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
      // Si hay una dirección principal, seleccionarla por defecto
      const defaultAddress = addresses.find(a => a.isDefault);
      if (defaultAddress && this.orderType === 'delivery') {
        this.selectedSavedAddress = defaultAddress.id;
        this.useSavedAddress = true;
        this.loadSavedAddressData(defaultAddress);
      }
    });
  }

  loadSavedAddressData(address: Address): void {
    this.deliveryForm.patchValue({
      address: address.address,
      neighborhood: address.neighborhood || '',
      city: address.city,
      postalCode: address.postalCode,
      phone: '' // El teléfono no se guarda en la dirección, se mantiene del perfil
    });
    // Marcar como válido ya que es una dirección guardada
    this.deliveryForm.get('address')?.clearValidators();
    this.deliveryForm.get('neighborhood')?.clearValidators();
    this.deliveryForm.get('address')?.updateValueAndValidity();
    this.deliveryForm.get('neighborhood')?.updateValueAndValidity();
  }

  onSavedAddressSelect(addressId: string): void {
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
    // Restaurar validadores
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

    // Limpiar validaciones según el tipo
    if (type === 'pickup') {
      this.useSavedAddress = false;
      this.selectedSavedAddress = null;
      this.deliveryForm.get('address')?.clearValidators();
      this.deliveryForm.get('neighborhood')?.clearValidators();
      this.deliveryForm.get('address')?.updateValueAndValidity();
      this.deliveryForm.get('neighborhood')?.updateValueAndValidity();
    } else {
      // Si cambia a delivery, verificar si hay direcciones guardadas
      if (this.savedAddresses.length > 0 && !this.selectedSavedAddress) {
        const defaultAddress = this.savedAddresses.find(a => a.isDefault);
        if (defaultAddress) {
          this.onSavedAddressSelect(defaultAddress.id);
        } else {
          // Si no hay dirección principal, requerir validación del formulario
          if (!this.useSavedAddress) {
            this.deliveryForm.get('address')?.setValidators([Validators.required]);
            this.deliveryForm.get('neighborhood')?.setValidators([Validators.required]);
            this.deliveryForm.get('address')?.updateValueAndValidity();
            this.deliveryForm.get('neighborhood')?.updateValueAndValidity();
          }
        }
      } else {
        // Si no hay direcciones guardadas o no usa una, requerir validación
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

    // Si es Nequi, Daviplata o Transferencia, generar la información inmediatamente
    if (method === 'nequi' || method === 'daviplata' || method === 'transfer') {
      this.generatePaymentInfo();
      // Hacer scroll suave a la información después de un pequeño delay
      setTimeout(() => {
        const paymentInfoElement = document.querySelector('.payment-info-card');
        if (paymentInfoElement) {
          paymentInfoElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    } else {
      // Limpiar información si se cambia a otro método
      this.showPaymentInfo = false;
      this.paymentLink = '';
      this.paymentCode = '';
      this.paymentReference = '';
      this.bankAccount = null;
    }

    // Si cambia a tarjeta, restaurar validadores si no usa tarjeta guardada
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
      // Generar enlace de pago Nequi
      this.paymentLink = `https://nequi.com/pago/${timestamp}-${random}`;
      this.paymentCode = `NEQ${timestamp.toString().slice(-8)}${random.toString().padStart(4, '0')}`;
      this.paymentReference = `REF-${timestamp}-${random}`;
    } else if (this.paymentMethod === 'daviplata') {
      // Generar enlace de pago Daviplata
      this.paymentLink = `https://daviplata.com/pago/${timestamp}-${random}`;
      this.paymentCode = `DAV${timestamp.toString().slice(-8)}${random.toString().padStart(4, '0')}`;
      this.paymentReference = `REF-${timestamp}-${random}`;
    } else if (this.paymentMethod === 'transfer') {
      // Generar datos bancarios
      this.bankAccount = {
        bank: 'Bancolombia',
        accountType: 'Ahorros',
        accountNumber: `3456789012345678`,
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
    // Validar formulario de entrega si es a domicilio (solo si no usa dirección guardada)
    if (this.orderType === 'delivery' && !this.useSavedAddress && this.deliveryForm.invalid) {
      this.notificationService.showError('Por favor completa todos los campos de entrega o selecciona una dirección guardada');
      return;
    }

    // Validar formulario de pago si es tarjeta (solo si no usa tarjeta guardada)
    if (this.paymentMethod === 'card' && !this.useSavedCard && this.paymentForm.invalid) {
      this.notificationService.showError('Por favor completa todos los datos de la tarjeta o selecciona una tarjeta guardada');
      return;
    }

    // Si es Nequi, Daviplata o Transferencia y no se ha generado la información, generarla
    if ((this.paymentMethod === 'nequi' || this.paymentMethod === 'daviplata' || this.paymentMethod === 'transfer') && !this.showPaymentInfo) {
      this.generatePaymentInfo();
      // Hacer scroll suave a la información
      setTimeout(() => {
        const paymentInfoElement = document.querySelector('.payment-info-card');
        if (paymentInfoElement) {
          paymentInfoElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);

      // Mostrar notificación informando que la información está disponible
      this.notificationService.showInfo(
        'Revisa la información de pago abajo. Cuando estés listo, confirma nuevamente.',
        'Información de Pago Generada'
      );
      return; // No procesar aún, esperar que el usuario confirme de nuevo
    }

    // Procesar el pedido
    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
      this.processPayment();
    }, 2000);
  }

  processPayment(): void {
    // Obtener items del carrito de forma síncrona
    let items: CartItem[] = [];
    const subscription = this.cartService.cartItems$.subscribe(cartItems => {
      items = cartItems;
    });
    subscription.unsubscribe();

    // Obtener información del usuario
    const userInfo = this.authService.getUserInfo();
    if (!userInfo || !userInfo.userId) {
      this.notificationService.showError('No se pudo obtener la información del usuario. Por favor, inicia sesión nuevamente.');
      this.router.navigate(['/login']);
      return;
    }

    // Preparar información de pago según el método
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

    // Mapear payment method al formato del backend
    const paymentMethodBackend = this.orderService.mapPaymentMethodToBackend(this.paymentMethod);

    // Extraer los IDs de los productos del carrito
    const productIds = items.map(item => String(item.productId));

    // Crear el DTO para el backend
    const createOrderDto: CreateOrderDto = {
      usuarioId: userInfo.userId,
      total: this.total,
      payment_method: paymentMethodBackend,
      products: productIds,
      status: 'pendiente',
      user_name: userInfo.name || userInfo.email || 'Usuario'
    };

    console.log('📦 Creando orden en el backend:', createOrderDto);

    // Crear la orden en el backend
    this.orderService.createOrder(createOrderDto).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        console.log('✅ Orden creada exitosamente:', response);
        
        // Guardar también en localStorage como respaldo
        this.saveOrderLocally(items, paymentInfo, response.order);

        // Mostrar confirmación según el método de pago
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

        // Marcar que se acaba de realizar un pago exitoso para evitar mostrar alerta de carrito vacío
        sessionStorage.setItem('orderJustPlaced', 'true');

        // Limpiar carrito
        this.cartService.clearCart();

        // Redirigir a página de confirmación o perfil
        setTimeout(() => {
          this.router.navigate(['/perfil']);
        }, 2000);
      },
      error: (error) => {
        console.error('❌ Error al crear la orden:', error);
        this.isLoading = false;
        
        // Mostrar mensaje de error
        this.notificationService.showError(
          error.message || 'Hubo un error al procesar tu pedido. Por favor, intenta nuevamente.',
          'Error al Procesar Pedido'
        );
      }
    });
  }

  /**
   * Guardar orden en localStorage como respaldo (después de crear en el backend)
   */
  private saveOrderLocally(items: CartItem[], paymentInfo: any, backendOrder: any): void {
    const userInfo = this.authService.getUserInfo();
    const userId = userInfo?.userId || userInfo?.email || 'guest';

    // Generar código de seguimiento único
    const trackingCode = this.generateTrackingCode();

    // Calcular tiempo estimado
    const estimatedPrepTime = this.calculateEstimatedPrepTime(items);
    const estimatedDeliveryTime = new Date();
    estimatedDeliveryTime.setMinutes(estimatedDeliveryTime.getMinutes() + estimatedPrepTime);
    if (this.orderType === 'delivery') {
      estimatedDeliveryTime.setMinutes(estimatedDeliveryTime.getMinutes() + 20); // +20 min para entrega
    }

    // Crear historial de estados inicial
    const statusHistory: any[] = [{
      status: 'pending',
      timestamp: new Date(),
      message: 'Pedido recibido y confirmado'
    }];

    // Mapear la orden del backend al formato del frontend
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
      canCancel: true // Puede cancelarse durante los primeros 5 minutos
    };

    const orders = JSON.parse(localStorage.getItem(`userOrders_${userId}`) || '[]');
    orders.unshift(newOrder); // Agregar al inicio

    localStorage.setItem(`userOrders_${userId}`, JSON.stringify(orders));

    // Guardar también en el servicio de usuarios
    this.userService.saveOrder(newOrder);
  }

  generateTrackingCode(): string {
    // Generar código único: PRE + timestamp + random
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `PRE${timestamp}${random}`.toUpperCase();
  }

  calculateEstimatedPrepTime(items: any[]): number {
    // Calcular tiempo estimado basado en cantidad de items
    // Base: 15 minutos, +5 por cada item adicional
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

