import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { forkJoin, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { UserProfile } from '../../core/models/UserProfile';
import { Order } from '../../core/models/Order';
import { Address } from '../../core/models/Address';
import { PaymentMethod } from '../../core/models/PaymentMethod';
import { MenuItem } from '../../core/models/MenuItem';
import { UserService } from '../../core/services/user.service';
import { MenuService } from '../../core/services/menu.service';

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

  showAddressModal = false;
  showPasswordModal = false;
  showProfileModal = false;
  showEditAddressModal = false;
  editingAddress: Address | null = null;
  submitted = false;

  private destroy$ = new Subject<void>();

  constructor(
    private userService: UserService,
    public router: Router,
    private fb: FormBuilder,
    private menuService: MenuService,
    private authService: AuthService,
    private notificationService: NotificationService
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
  }

  ngOnInit() {
    this.loadUserProfile();

    // Suscribirse a cambios en la información del usuario
    this.authService.userInfo$.pipe(takeUntil(this.destroy$)).subscribe(userInfo => {
      this.loadUserProfile();
    });

    // Cargar platos recomendados y favoritos
    this.loadRecommendedDishes();
    this.loadFavoriteDishes();

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
      // No hay usuario autenticado, mostrar datos de prueba
      this.loadMockData();
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

  private loadMockData() {
    // Cargar datos de prueba para visualización
    const mockProfile: UserProfile = {
      id: 'demo_user_001',
      fullName: 'Juan Pérez',
      email: 'juan.perez@email.com',
      phone: '3104941839',
      memberSince: new Date('2024-01-15'),
      preferences: {
        notifications: true,
        emailNotifications: true,
        smsNotifications: false,
        favoriteCategories: ['hamburguesas', 'bebidas', 'postres']
      }
    };

    this.userProfile = mockProfile;
    this.profileForm.patchValue({
      fullName: mockProfile.fullName,
      email: mockProfile.email,
      phone: mockProfile.phone
    });

    // Pedidos de prueba
    this.orders = [
      {
        id: 'ORD-001',
        date: new Date('2024-12-15'),
        items: [
          { id: 1, name: 'Bandeja Paisa Presteza', quantity: 1, price: 25000 },
          { id: 16, name: 'Limonada de Coco', quantity: 2, price: 8000 }
        ],
        total: 41000,
        status: 'delivered',
        deliveryAddress: 'Carrera 23 # 70B - 57, Milan, Manizales'
      },
      {
        id: 'ORD-002',
        date: new Date('2024-12-20'),
        items: [
          { id: 6, name: 'Hamburguesa Presteza', quantity: 1, price: 22000 },
          { id: 11, name: 'Papas Fritas', quantity: 1, price: 8000 }
        ],
        total: 30000,
        status: 'ready',
        deliveryAddress: 'Carrera 23 # 70B - 57, Milan, Manizales'
      },
      {
        id: 'ORD-003',
        date: new Date('2024-12-22'),
        items: [
          { id: 17, name: 'Tres Leches', quantity: 2, price: 12000 },
          { id: 14, name: 'Gaseosa', quantity: 2, price: 5000 }
        ],
        total: 34000,
        status: 'preparing',
        deliveryAddress: 'Carrera 23 # 70B - 57, Milan, Manizales'
      }
    ];

    // Direcciones de prueba
    this.addresses = [
      {
        id: 'addr_001',
        title: 'Casa',
        address: 'Carrera 23 # 70B - 57, Milan',
        city: 'Manizales',
        postalCode: '170001',
        isDefault: true
      },
      {
        id: 'addr_002',
        title: 'Trabajo',
        address: 'Calle 50 # 23-45, Centro',
        city: 'Manizales',
        postalCode: '170002',
        isDefault: false
      }
    ];

    // Métodos de pago de prueba
    this.paymentMethods = [
      {
        id: 'pm_001',
        type: 'card',
        last4: '4242',
        brand: 'Visa',
        isDefault: true
      },
      {
        id: 'pm_002',
        type: 'cash',
        isDefault: false
      }
    ];
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
}

