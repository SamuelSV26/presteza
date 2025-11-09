import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { UserService, UserProfile, Order, Address, PaymentMethod } from '../../core/services/user.service';
import { MenuService, MenuItem } from '../../core/services/menu.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { CartService } from '../../core/services/cart.service';
import { forkJoin, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.css']
})
export class PerfilComponent implements OnInit, OnDestroy {
  activeTab: 'profile' | 'orders' | 'addresses' | 'payment' | 'settings' = 'profile';
  userProfile: UserProfile | null = null;
  orders: Order[] = [];
  addresses: Address[] = [];
  paymentMethods: PaymentMethod[] = [];
  recommendedDishes: MenuItem[] = [];
  favoriteDishes: MenuItem[] = [];
  
  profileForm: FormGroup;
  addressForm: FormGroup;
  passwordForm: FormGroup;
  paymentMethodForm: FormGroup;
  
  showAddressModal = false;
  showPasswordModal = false;
  showProfileModal = false;
  showEditAddressModal = false;
  showPaymentMethodModal = false;
  editingAddress: Address | null = null;
  editingPaymentMethod: PaymentMethod | null = null;
  submitted = false;
  expandedOrders: Set<string> = new Set<string>();
  
  private destroy$ = new Subject<void>();
  
  constructor(
    private userService: UserService,
    public router: Router,
    private fb: FormBuilder,
    private menuService: MenuService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private cartService: CartService
  ) {
    this.profileForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]]
    });

    this.addressForm = this.fb.group({
      title: ['', [Validators.required]],
      address: ['', [Validators.required]],
      neighborhood: ['', [Validators.required]],
      city: ['Manizales', [Validators.required, this.cityValidator.bind(this)]],
      postalCode: ['170001', [Validators.required]],
      isDefault: [false]
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validator: this.passwordMatchValidator });

    this.paymentMethodForm = this.fb.group({
      type: ['card', [Validators.required]],
      cardNumber: ['', []], // Validación condicional
      cardHolder: ['', []], // Validación condicional
      expiryMonth: ['', []], // Validación condicional
      expiryYear: ['', []], // Validación condicional
      cvv: ['', []], // Validación condicional
      brand: ['Visa', [Validators.required]],
      isDefault: [false]
    });
    
    // Validación condicional: solo requerir campos de tarjeta si el tipo es 'card'
    this.paymentMethodForm.get('type')?.valueChanges.subscribe(type => {
      if (type === 'card') {
        this.paymentMethodForm.get('cardNumber')?.setValidators([Validators.required, Validators.pattern(/^[0-9\s]{13,19}$/)]);
        this.paymentMethodForm.get('cardHolder')?.setValidators([Validators.required]);
        this.paymentMethodForm.get('expiryMonth')?.setValidators([Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])$/)]);
        this.paymentMethodForm.get('expiryYear')?.setValidators([Validators.required, Validators.pattern(/^[0-9]{2}$/)]);
        this.paymentMethodForm.get('cvv')?.setValidators([Validators.required, Validators.pattern(/^[0-9]{3,4}$/)]);
      } else {
        this.paymentMethodForm.get('cardNumber')?.clearValidators();
        this.paymentMethodForm.get('cardHolder')?.clearValidators();
        this.paymentMethodForm.get('expiryMonth')?.clearValidators();
        this.paymentMethodForm.get('expiryYear')?.clearValidators();
        this.paymentMethodForm.get('cvv')?.clearValidators();
      }
      this.paymentMethodForm.get('cardNumber')?.updateValueAndValidity();
      this.paymentMethodForm.get('cardHolder')?.updateValueAndValidity();
      this.paymentMethodForm.get('expiryMonth')?.updateValueAndValidity();
      this.paymentMethodForm.get('expiryYear')?.updateValueAndValidity();
      this.paymentMethodForm.get('cvv')?.updateValueAndValidity();
    });
  }

  ngOnInit() {
    this.loadUserProfile();

    // Suscribirse a cambios en la información del usuario
    this.authService.userInfo$.pipe(takeUntil(this.destroy$)).subscribe(userInfo => {
      if (userInfo) {
        console.log('🔄 userInfo$ cambió, recargando perfil completo...');
        this.loadUserProfile();
        this.loadFavoriteDishes();
        this.loadAddresses();
      }
    });
    
    // Escuchar evento personalizado cuando el usuario inicia sesión
    window.addEventListener('userInfoUpdated', () => {
      console.log('🔄 userInfoUpdated en PerfilComponent, recargando datos...');
      this.loadUserProfile();
      this.loadFavoriteDishes();
      this.loadAddresses();
      this.loadPaymentMethods();
    });

    // Cargar platos recomendados y favoritos
    this.loadRecommendedDishes();
    this.loadFavoriteDishes();
    this.loadAddresses();
    
    // Suscribirse a cambios en favoritos (revisar cada vez que cambie localStorage)
    this.setupFavoriteListener();
  }
  
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  private setupFavoriteListener() {
    // Escuchar eventos personalizados cuando se agregan/eliminan favoritos
    window.addEventListener('favoritesChanged', () => {
      this.loadFavoriteDishes();
    });
  }

  private loadUserProfile() {
    // Obtener información del usuario autenticado directamente del token
    const userInfo = this.authService.getUserInfo();
    
    if (!userInfo) {
      // No hay usuario autenticado, no cargar datos
      // El usuario debería estar autenticado para ver el perfil
      return;
    }
    
    // Obtener fecha de registro guardada
    const userId = userInfo.userId || userInfo.email;
    let registrationDate: Date = new Date(); // Por defecto fecha actual
    
    // Intentar obtener la fecha de registro guardada
    const savedDateStr = localStorage.getItem(`userRegistrationDate_${userId}`) || 
                         localStorage.getItem(`userRegistrationDate_${userInfo.email}`);
    
    if (savedDateStr) {
      try {
        registrationDate = new Date(savedDateStr);
        // Validar que la fecha sea válida
        if (isNaN(registrationDate.getTime())) {
          registrationDate = new Date();
        }
      } catch (e) {
        console.error('Error al parsear fecha de registro:', e);
        registrationDate = new Date();
      }
    } else {
      // Si no hay fecha guardada, guardar la fecha actual como fecha de registro
      localStorage.setItem(`userRegistrationDate_${userId}`, registrationDate.toISOString());
      localStorage.setItem(`userRegistrationDate_${userInfo.email}`, registrationDate.toISOString());
    }
    
    // Usar SOLO los datos del token/UserInfo, no de localStorage que puede tener datos viejos
    const userProfile: UserProfile = {
      id: userInfo.userId || 'user_' + Date.now(),
      fullName: userInfo.name || 'Usuario',
      email: userInfo.email || '',
      phone: localStorage.getItem('userPhone') || '', // Solo el teléfono puede venir de localStorage
      memberSince: registrationDate, // Usar la fecha de registro guardada
      preferences: {
        notifications: true,
        emailNotifications: true,
        smsNotifications: false,
        favoriteCategories: []
      }
    };

    // Intentar obtener el perfil guardado del servicio, pero validar que sea del usuario actual
    this.userService.getUserProfile().subscribe(profile => {
      // Verificar que el perfil guardado pertenezca al usuario actual
      if (profile && (profile.email === userInfo.email || profile.id === userInfo.userId)) {
        // Asegurar que la fecha de registro se preserve desde localStorage
        const savedDateStr = localStorage.getItem(`userRegistrationDate_${userId}`) || 
                             localStorage.getItem(`userRegistrationDate_${userInfo.email}`);
        if (savedDateStr) {
          try {
            const savedDate = new Date(savedDateStr);
            if (!isNaN(savedDate.getTime())) {
              profile.memberSince = savedDate;
            }
          } catch (e) {
            console.error('Error al actualizar fecha de registro:', e);
          }
        }
        
        this.userProfile = profile;
        this.profileForm.patchValue({
          fullName: profile.fullName,
          email: profile.email,
          phone: profile.phone
        });
      } else {
        // Si no hay perfil o es de otro usuario, usar el perfil del token
        this.userProfile = userProfile;
        this.profileForm.patchValue({
          fullName: userProfile.fullName,
          email: userProfile.email,
          phone: userProfile.phone
        });
        // Inicializar el perfil en el servicio
        this.userService.initializeUserProfile(userProfile);
      }
    });

    this.loadOrders();
    this.loadAddresses();
    this.loadPaymentMethods();
  }

  private loadRecommendedDishes() {
    // Cargar productos destacados como recomendados
    this.menuService.getFeaturedItems().subscribe(items => {
      this.recommendedDishes = items.slice(0, 4);
    });
  }

  private loadFavoriteDishes() {
    // Cargar favoritos desde el servicio
    this.userService.getFavoriteDishes().pipe(takeUntil(this.destroy$)).subscribe(favoriteIds => {
      if (favoriteIds && favoriteIds.length > 0) {
        // Cargar todos los items de favoritos usando forkJoin para manejar múltiples suscripciones
        const favoriteObservables = favoriteIds.map(id => 
          this.menuService.getItemById(id)
        );
        
        forkJoin(favoriteObservables).pipe(takeUntil(this.destroy$)).subscribe(items => {
          // Filtrar items nulos/undefined y asegurarse de que solo incluya los que existen
          this.favoriteDishes = items.filter(item => item !== null && item !== undefined) as MenuItem[];
        });
      } else {
        // Si no hay favoritos guardados, mostrar array vacío
        this.favoriteDishes = [];
      }
    });
  }

  passwordMatchValidator(form: FormGroup) {
    return form.get('newPassword')?.value === form.get('confirmPassword')?.value
      ? null : { 'mismatch': true };
  }

  cityValidator(control: AbstractControl): ValidationErrors | null {
    const city = control.value;
    if (!city || city.trim().toLowerCase() !== 'manizales') {
      return { 'invalidCity': true };
    }
    return null;
  }

  setActiveTab(tab: 'profile' | 'orders' | 'addresses' | 'payment' | 'settings') {
    this.activeTab = tab;
  }

  loadOrders() {
    this.userService.getOrders().subscribe(orders => {
      this.orders = orders;
    });
  }

  loadAddresses() {
    this.userService.getAddresses().subscribe(addresses => {
      this.addresses = addresses;
    });
  }

  loadPaymentMethods() {
    this.userService.getPaymentMethods().subscribe(methods => {
      this.paymentMethods = methods;
    });
  }

  openPaymentMethodModal() {
    this.showPaymentMethodModal = true;
    this.editingPaymentMethod = null;
    this.paymentMethodForm.reset();
    this.paymentMethodForm.patchValue({
      type: 'card',
      isDefault: this.paymentMethods.length === 0
    });
  }

  closePaymentMethodModal() {
    this.showPaymentMethodModal = false;
    this.editingPaymentMethod = null;
    this.paymentMethodForm.reset();
    this.submitted = false;
  }

  onPaymentMethodSubmit() {
    this.submitted = true;
    
    // Validar según el tipo de método
    const formValue = this.paymentMethodForm.value;
    if (formValue.type === 'card') {
      // Validar campos de tarjeta
      if (!this.paymentMethodForm.get('cardNumber')?.valid || 
          !this.paymentMethodForm.get('cardHolder')?.valid ||
          !this.paymentMethodForm.get('expiryMonth')?.valid ||
          !this.paymentMethodForm.get('expiryYear')?.valid ||
          !this.paymentMethodForm.get('cvv')?.valid) {
        this.notificationService.showError('Por favor, completa todos los campos de la tarjeta correctamente');
        return;
      }
    }
    
    if (this.paymentMethodForm.valid || formValue.type === 'cash') {
      const isDefault = formValue.isDefault || this.paymentMethods.length === 0;
      
      if (this.editingPaymentMethod) {
        // Editar método existente
        const updatedMethod: PaymentMethod = {
          ...this.editingPaymentMethod,
          type: formValue.type,
          last4: formValue.cardNumber ? formValue.cardNumber.replace(/\s/g, '').slice(-4) : undefined,
          brand: formValue.brand || 'Visa',
          isDefault: isDefault
        };
        
        // Si se marca como principal, quitar el estado de los demás
        if (isDefault) {
          this.paymentMethods.forEach(m => {
            if (m.id !== updatedMethod.id && m.isDefault) {
              const nonDefaultMethod = { ...m, isDefault: false };
              this.userService.updatePaymentMethod(nonDefaultMethod);
            }
          });
        }
        
        this.userService.updatePaymentMethod(updatedMethod);
        this.notificationService.showSuccess('Método de pago actualizado correctamente');
      } else {
        // Crear nuevo método
        const newMethod: PaymentMethod = {
          id: 'pm_' + Date.now(),
          type: formValue.type,
          last4: formValue.cardNumber ? formValue.cardNumber.replace(/\s/g, '').slice(-4) : undefined,
          brand: formValue.brand || 'Visa',
          isDefault: isDefault
        };
        
        // Si se marca como principal, quitar el estado de los demás
        if (isDefault) {
          this.paymentMethods.forEach(m => {
            if (m.isDefault) {
              const nonDefaultMethod = { ...m, isDefault: false };
              this.userService.updatePaymentMethod(nonDefaultMethod);
            }
          });
        }
        
        this.userService.savePaymentMethod(newMethod);
        this.notificationService.showSuccess('Método de pago agregado correctamente');
      }
      
      this.loadPaymentMethods();
      this.closePaymentMethodModal();
    } else {
      this.notificationService.showError('Por favor, completa todos los campos correctamente');
    }
  }

  editPaymentMethod(method: PaymentMethod) {
    this.editingPaymentMethod = method;
    this.showPaymentMethodModal = true;
    this.paymentMethodForm.patchValue({
      type: method.type,
      cardNumber: method.last4 ? '**** **** **** ' + method.last4 : '',
      brand: method.brand || 'Visa',
      isDefault: method.isDefault
    });
  }

  deletePaymentMethod(method: PaymentMethod) {
    this.notificationService.confirm(
      'Eliminar Método de Pago',
      `¿Estás seguro de que deseas eliminar este método de pago?`,
      'Eliminar',
      'Cancelar'
    ).then(confirmed => {
      if (confirmed) {
        this.userService.deletePaymentMethod(method.id);
        this.loadPaymentMethods();
        this.notificationService.showSuccess('Método de pago eliminado correctamente');
      }
    });
  }

  formatCardNumber(event: Event) {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\s/g, '').replace(/[^0-9]/gi, '');
    const formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
    this.paymentMethodForm.patchValue({ cardNumber: formattedValue }, { emitEvent: false });
  }

  onProfileSubmit() {
    this.submitted = true;
    if (this.profileForm.valid) {
      // Actualizar el perfil en el servicio
      this.userService.updateUserProfile(this.profileForm.value);
      
      // Actualizar el perfil local también
      this.userService.getUserProfile().subscribe(updatedProfile => {
        if (updatedProfile) {
          this.userProfile = updatedProfile;
          // Actualizar el formulario con los valores guardados
          this.profileForm.patchValue({
            fullName: updatedProfile.fullName,
            email: updatedProfile.email,
            phone: updatedProfile.phone
          });
        }
      });
      
      this.notificationService.showSuccess('Perfil actualizado correctamente');
      this.submitted = false;
      this.showProfileModal = false;
    } else {
      // Mostrar errores de validación
      this.notificationService.showError('Por favor, completa todos los campos correctamente');
    }
  }

  onAddressSubmit() {
    this.submitted = true;
    if (this.addressForm.valid) {
      const isDefault = this.addressForm.get('isDefault')?.value || false;
      
      this.userService.getAddresses().subscribe(addresses => {
        if (this.editingAddress) {
          // Editar dirección existente
          const updatedAddress: Address = {
            ...this.editingAddress,
            ...this.addressForm.value,
            isDefault: isDefault
          };
          
          // Si se marca como principal, quitar el estado de las demás
          if (isDefault) {
            addresses.forEach(addr => {
              if (addr.id !== updatedAddress.id && addr.isDefault) {
                const nonDefaultAddr = { ...addr, isDefault: false };
                this.userService.updateAddress(nonDefaultAddr);
              }
            });
          }
          this.updateAddress(updatedAddress);
        } else {
          // Crear nueva dirección
          const newAddress: Address = {
            id: 'addr_' + Date.now(),
            ...this.addressForm.value,
            isDefault: isDefault || addresses.length === 0 // Si no hay direcciones, esta será la principal
          };
          
          // Si se marca como principal, quitar el estado de las demás
          if (isDefault) {
            addresses.forEach(addr => {
              if (addr.isDefault) {
                const nonDefaultAddr = { ...addr, isDefault: false };
                this.userService.updateAddress(nonDefaultAddr);
              }
            });
          }
          this.userService.saveAddress(newAddress);
        }
        
        // Recargar direcciones después de guardar
        this.loadAddresses();
        
        // Cerrar modal y limpiar formulario
        this.addressForm.reset();
        this.addressForm.patchValue({ 
          city: 'Manizales',
          postalCode: '170001',
          isDefault: false
        });
        this.showAddressModal = false;
        this.showEditAddressModal = false;
        this.editingAddress = null;
        this.submitted = false;
        this.notificationService.showSuccess('Dirección guardada correctamente');
      });
    }
  }

  editAddress(address: Address) {
    this.editingAddress = address;
    this.addressForm.patchValue({
      title: address.title,
      address: address.address,
      neighborhood: address.neighborhood || '',
      city: 'Manizales', // Forzar Manizales al editar
      postalCode: '170001', // Forzar código postal al editar
      isDefault: address.isDefault || false
    });
    this.showEditAddressModal = true;
  }

  closeAddressModal() {
    this.addressForm.reset();
    this.addressForm.patchValue({ 
      city: 'Manizales',
      postalCode: '170001',
      isDefault: false
    });
    this.showAddressModal = false;
    this.showEditAddressModal = false;
    this.editingAddress = null;
    this.submitted = false;
  }

  setDefaultAddress(address: Address) {
    this.userService.getAddresses().subscribe(addresses => {
      // Actualizar todas las direcciones: quitar principal de todas y ponerla solo en la seleccionada
      const updatedAddresses = addresses.map(a => {
        if (a.id === address.id) {
          return { ...a, isDefault: true };
        } else {
          return { ...a, isDefault: false };
        }
      });
      
      // Guardar usando el servicio que ya maneja el userId
      updatedAddresses.forEach(addr => {
        this.userService.updateAddress(addr);
      });
      
      // Recargar las direcciones para actualizar la vista
      this.loadAddresses();
      this.notificationService.showSuccess('Dirección principal actualizada');
    });
  }

  async deleteAddress(address: Address) {
    const confirmed = await this.notificationService.confirm(
      'Eliminar Dirección',
      '¿Estás seguro de que deseas eliminar esta dirección?'
    );
    
    if (confirmed) {
      // Obtener userId del usuario actual
      const userInfoStr = localStorage.getItem('userInfo');
      if (!userInfoStr) {
        this.notificationService.showError('Error: No se encontró información del usuario');
        return;
      }
      
      try {
        const userInfo = JSON.parse(userInfoStr);
        const userId = userInfo.userId || userInfo.email;
        
        this.userService.getAddresses().subscribe(addresses => {
          const updatedAddresses = addresses.filter(a => a.id !== address.id);
          localStorage.setItem(`userAddresses_${userId}`, JSON.stringify(updatedAddresses));
          this.loadAddresses();
          this.notificationService.showSuccess('Dirección eliminada correctamente');
        });
      } catch (e) {
        console.error('Error al eliminar dirección:', e);
        this.notificationService.showError('Error al eliminar la dirección');
      }
    }
  }

  updateAddress(updatedAddress: Address) {
    // Usar el método del servicio que ya maneja el userId
    this.userService.updateAddress(updatedAddress);
  }

  openProfileEdit() {
    if (this.userProfile) {
      this.profileForm.patchValue({
        fullName: this.userProfile.fullName,
        email: this.userProfile.email,
        phone: this.userProfile.phone
      });
    }
    this.showProfileModal = true;
  }

  closeProfileEdit() {
    this.showProfileModal = false;
    this.submitted = false;
    this.profileForm.reset();
    if (this.userProfile) {
      this.profileForm.patchValue({
        fullName: this.userProfile.fullName,
        email: this.userProfile.email,
        phone: this.userProfile.phone
      });
    }
  }

  onPasswordSubmit() {
    this.submitted = true;
    if (this.passwordForm.valid) {
      // Aquí iría la lógica de cambio de contraseña
      this.notificationService.showSuccess('Contraseña actualizada correctamente');
      this.passwordForm.reset();
      this.showPasswordModal = false;
      this.submitted = false;
    }
  }

  getOrderStatusClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'pending': 'status-pending',
      'preparing': 'status-preparing',
      'ready': 'status-ready',
      'delivered': 'status-delivered',
      'cancelled': 'status-cancelled'
    };
    return statusClasses[status] || '';
  }

  getOrderStatusText(status: string): string {
    const statusTexts: { [key: string]: string } = {
      'pending': 'Pendiente',
      'preparing': 'Preparando',
      'ready': 'Listo',
      'delivered': 'Entregado',
      'cancelled': 'Cancelado'
    };
    return statusTexts[status] || status;
  }

  getOrderStatusIcon(status: string): string {
    const statusIcons: { [key: string]: string } = {
      'pending': 'bi-clock-history',
      'preparing': 'bi-hourglass-split',
      'ready': 'bi-check-circle',
      'delivered': 'bi-truck',
      'cancelled': 'bi-x-circle'
    };
    return statusIcons[status] || 'bi-circle';
  }
  
  formatEstimatedTime(order: Order): string {
    if (!order.estimatedDeliveryTime) return '';
    const now = new Date();
    const estimated = new Date(order.estimatedDeliveryTime);
    const diffMs = estimated.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));
    
    if (diffMins <= 0) {
      return 'Tiempo estimado cumplido';
    } else if (diffMins < 60) {
      return `Aprox. ${diffMins} min`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `Aprox. ${hours}h ${mins}min`;
    }
  }
  
  getTrackingCode(order: Order): string {
    return order.trackingCode || order.id.slice(-8).toUpperCase();
  }
  
  cancelOrder(order: Order): void {
    this.notificationService.confirm(
      'Cancelar Pedido',
      `¿Estás seguro de que deseas cancelar este pedido? Esta acción no se puede deshacer.`,
      'Cancelar Pedido',
      'Volver'
    ).then(confirmed => {
      if (confirmed) {
        this.userService.cancelOrder(order.id).subscribe(success => {
          if (success) {
            this.notificationService.showSuccess('Pedido cancelado exitosamente');
            this.loadOrders();
          } else {
            this.notificationService.showError('No se pudo cancelar el pedido. El tiempo límite ha expirado o el pedido ya está en preparación.');
          }
        });
      }
    });
  }
  
  reorder(order: Order): void {
    // Agregar todos los items del pedido al carrito
    let itemsAdded = 0;
    const totalItems = order.items.reduce((sum, it) => sum + it.quantity, 0);
    
    order.items.forEach(item => {
      // Buscar el producto en el menú
      this.menuService.getItemById(item.id).subscribe(product => {
        if (product) {
          // Mapear las opciones para incluir el id requerido por CartItemOption
          const cartOptions = (item.selectedOptions || []).map((opt, index) => ({
            id: opt.id || `opt_${item.id}_${index}`,
            name: opt.name,
            price: opt.price
          }));
          
          for (let i = 0; i < item.quantity; i++) {
            this.cartService.addItem({
              productId: product.id,
              productName: product.name,
              productDescription: product.description || '',
              basePrice: product.price,
              selectedOptions: cartOptions,
              quantity: 1,
              imageUrl: product.imageUrl
            });
            itemsAdded++;
          }
          if (itemsAdded === totalItems) {
            this.notificationService.showSuccess(`Se agregaron ${itemsAdded} item(s) al carrito`);
            setTimeout(() => {
              this.router.navigate(['/menu']);
            }, 1000);
          }
        } else {
          // Si no se encuentra el producto, usar la información del pedido
          // Mapear las opciones para incluir el id requerido por CartItemOption
          const cartOptions = (item.selectedOptions || []).map((opt, index) => ({
            id: opt.id || `opt_${item.id}_${index}`,
            name: opt.name,
            price: opt.price
          }));
          
          for (let i = 0; i < item.quantity; i++) {
            this.cartService.addItem({
              productId: item.id,
              productName: item.name,
              productDescription: '',
              basePrice: item.price,
              selectedOptions: cartOptions,
              quantity: 1
            });
            itemsAdded++;
          }
          if (itemsAdded === totalItems) {
            this.notificationService.showSuccess(`Se agregaron ${itemsAdded} item(s) al carrito`);
            setTimeout(() => {
              this.router.navigate(['/menu']);
            }, 1000);
          }
        }
      });
    });
  }
  
  getOrderStatusSteps(order: Order): Array<{status: string, label: string, icon: string, completed: boolean, current: boolean}> {
    const steps = [
      { status: 'pending', label: 'Confirmado', icon: 'bi-check-circle', completed: true, current: false },
      { status: 'preparing', label: 'Preparando', icon: 'bi-hourglass-split', completed: false, current: false },
      { status: 'ready', label: 'Listo', icon: 'bi-check-circle', completed: false, current: false },
      { status: 'delivered', label: 'Entregado', icon: 'bi-truck', completed: false, current: false }
    ];
    
    const statusOrder = ['pending', 'preparing', 'ready', 'delivered'];
    const currentIndex = statusOrder.indexOf(order.status);
    
    steps.forEach((step, index) => {
      if (index <= currentIndex) {
        step.completed = true;
      }
      if (index === currentIndex) {
        step.current = true;
      }
    });
    
    if (order.status === 'cancelled') {
      return steps.map(s => ({ ...s, completed: false, current: false }));
    }
    
    return steps;
  }
  
  expandOrderDetails(order: Order): void {
    // Toggle para expandir/colapsar detalles del pedido
    if (!this.expandedOrders) {
      this.expandedOrders = new Set<string>();
    }
    if (this.expandedOrders.has(order.id)) {
      this.expandedOrders.delete(order.id);
    } else {
      this.expandedOrders.add(order.id);
    }
  }
  
  isOrderExpanded(order: Order): boolean {
    return this.expandedOrders?.has(order.id) || false;
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  async logout() {
    const confirmed = await this.notificationService.confirm(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas cerrar sesión?'
    );
    
    if (confirmed) {
      // Usar authService.logout() que limpia todo correctamente y actualiza los observables
      this.authService.logout();
    }
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }
  
  getPaymentMethodName(method: string): string {
    const methods: { [key: string]: string } = {
      'card': 'Tarjeta',
      'cash': 'Efectivo',
      'nequi': 'Nequi',
      'daviplata': 'Daviplata',
      'transfer': 'Transferencia Bancaria'
    };
    return methods[method] || method;
  }
}

