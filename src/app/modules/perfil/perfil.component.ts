import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { UserService, UserProfile, Order, Address, PaymentMethod } from '../../core/services/user.service';
import { MenuService, MenuItem } from '../../core/services/menu.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.css']
})
export class PerfilComponent implements OnInit {
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
  
  constructor(
    private userService: UserService,
    public router: Router,
    private fb: FormBuilder,
    private menuService: MenuService,
    private authService: AuthService
  ) {
    this.profileForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]]
    });

    this.addressForm = this.fb.group({
      title: ['', [Validators.required]],
      address: ['', [Validators.required]],
      city: ['', [Validators.required]],
      postalCode: ['', [Validators.required]]
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
    this.authService.userInfo$.subscribe(userInfo => {
      this.loadUserProfile();
    });

    // Cargar platos recomendados y favoritos
    this.loadRecommendedDishes();
    this.loadFavoriteDishes();
  }

  private loadUserProfile() {
    // Obtener información del usuario autenticado
    const userInfo = this.authService.getUserInfo();
    const userName = localStorage.getItem('userName');
    const userEmail = localStorage.getItem('userEmail');
    const userPhone = localStorage.getItem('userPhone');
    
    if (userInfo || userName) {
      // Crear perfil con datos del usuario autenticado
      const userProfile: UserProfile = {
        id: userInfo?.userId || 'user_' + Date.now(),
        fullName: userInfo?.name || userName || 'Usuario',
        email: userInfo?.email || userEmail || '',
        phone: userPhone || '',
        memberSince: new Date(), // Se puede obtener del token JWT si está disponible
        preferences: {
          notifications: true,
          emailNotifications: true,
          smsNotifications: false,
          favoriteCategories: []
        }
      };

      this.userProfile = userProfile;
      this.profileForm.patchValue({
        fullName: userProfile.fullName,
        email: userProfile.email,
        phone: userProfile.phone
      });

      // Intentar obtener el perfil completo del servicio
      this.userService.getUserProfile().subscribe(profile => {
        if (profile) {
          this.userProfile = profile;
          this.profileForm.patchValue({
            fullName: profile.fullName,
            email: profile.email,
            phone: profile.phone
          });
        }
      });

      this.loadOrders();
      this.loadAddresses();
      this.loadPaymentMethods();
    } else {
      // No hay usuario logueado, mostrar datos de prueba
      console.log('Modo de demostración: mostrando datos de prueba');
      this.loadMockData();
    }
  }

  private loadRecommendedDishes() {
    // Cargar productos destacados como recomendados
    this.menuService.getFeaturedItems().subscribe(items => {
      this.recommendedDishes = items.slice(0, 4);
    });
  }

  private loadFavoriteDishes() {
    // Cargar favoritos desde el servicio
    this.userService.getFavoriteDishes().subscribe(favoriteIds => {
      if (favoriteIds.length > 0) {
        // Cargar items de favoritos
        const loadedItems: MenuItem[] = [];
        favoriteIds.forEach(id => {
          this.menuService.getItemById(id).subscribe(item => {
            if (item) {
              loadedItems.push(item);
              this.favoriteDishes = [...loadedItems];
            }
          });
        });
      } else {
        // Si no hay favoritos guardados, usar items populares
        this.menuService.getFeaturedItems().subscribe(items => {
          this.favoriteDishes = items.slice(0, 6);
        });
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
    if (this.profileForm.valid && this.userProfile) {
      this.userService.updateUserProfile(this.profileForm.value);
      // Actualizar el perfil local también
      this.userService.getUserProfile().subscribe(updatedProfile => {
        if (updatedProfile) {
          this.userProfile = updatedProfile;
        }
      });
      alert('Perfil actualizado correctamente');
      this.submitted = false;
      this.showProfileModal = false;
    }
  }

  onAddressSubmit() {
    this.submitted = true;
    if (this.addressForm.valid) {
      if (this.editingAddress) {
        // Editar dirección existente
        const updatedAddress: Address = {
          ...this.editingAddress,
          ...this.addressForm.value
        };
        this.updateAddress(updatedAddress);
      } else {
        // Crear nueva dirección
        const newAddress: Address = {
          id: 'addr_' + Date.now(),
          ...this.addressForm.value,
          isDefault: this.addresses.length === 0
        };
        this.userService.saveAddress(newAddress);
      }
      this.loadAddresses();
      this.addressForm.reset();
      this.showAddressModal = false;
      this.showEditAddressModal = false;
      this.editingAddress = null;
      this.submitted = false;
      alert('Dirección guardada correctamente');
    }
  }

  editAddress(address: Address) {
    this.editingAddress = address;
    this.addressForm.patchValue({
      title: address.title,
      address: address.address,
      city: address.city,
      postalCode: address.postalCode
    });
    this.showEditAddressModal = true;
  }

  deleteAddress(address: Address) {
    if (confirm('¿Estás seguro de que deseas eliminar esta dirección?')) {
      this.userService.getAddresses().subscribe(addresses => {
        const updatedAddresses = addresses.filter(a => a.id !== address.id);
        localStorage.setItem('userAddresses', JSON.stringify(updatedAddresses));
        this.loadAddresses();
      });
    }
  }

  setDefaultAddress(address: Address) {
    this.userService.getAddresses().subscribe(addresses => {
      const updatedAddresses = addresses.map(a => ({
        ...a,
        isDefault: a.id === address.id
      }));
      localStorage.setItem('userAddresses', JSON.stringify(updatedAddresses));
      this.loadAddresses();
    });
  }

  updateAddress(updatedAddress: Address) {
    this.userService.getAddresses().subscribe(addresses => {
      const index = addresses.findIndex(a => a.id === updatedAddress.id);
      if (index !== -1) {
        addresses[index] = updatedAddress;
        localStorage.setItem('userAddresses', JSON.stringify(addresses));
      }
    });
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
      alert('Contraseña actualizada correctamente');
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

  logout() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      // Usar authService.logout() que limpia todo correctamente y actualiza los observables
      this.authService.logout();
    }
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }
}

