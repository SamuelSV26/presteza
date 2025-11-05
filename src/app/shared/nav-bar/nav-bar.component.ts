import { Component, HostListener, ElementRef, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartComponent } from './cart/cart.component';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, CartComponent, FormsModule],
  templateUrl: './nav-bar.component.html',
  styleUrls: ['./nav-bar.component.css'],
})
export class NavbarComponent implements OnInit {
  sedesOpen = false;
  selectedSede = '';
  userName: string | null = null;
  userEmail: string | null = null;
  showLoginModal = false;
  showUserDropdown = false;
  loginEmail = '';
  loginPassword = '';
  rememberMe = false;
  loginError: string | null = null;
  isLoading = false;

  constructor(
    private router: Router, 
    private el: ElementRef,
    private authService: AuthService
  ) {}

  ngOnInit() {
    // Verificar si hay usuario autenticado
    const userInfo = this.authService.getUserInfo();
    if (userInfo) {
      this.userName = userInfo.name;
      this.userEmail = userInfo.email;
    } else {
      const storedUser = localStorage.getItem('userName');
      const storedEmail = localStorage.getItem('userEmail');
      this.userName = storedUser ? storedUser : null;
      this.userEmail = storedEmail ? storedEmail : null;
    }
    
    // Escuchar cambios en el token
    this.authService.userInfo$.subscribe(userInfo => {
      if (userInfo) {
        this.userName = userInfo.name;
        this.userEmail = userInfo.email;
      } else {
        this.userName = null;
        this.userEmail = null;
      }
    });
    
    // Escuchar evento para mostrar modal de login desde otros componentes
    window.addEventListener('showLoginModal', () => {
      this.showLoginModal = true;
    });

    // Escuchar evento de login exitoso
    window.addEventListener('userLoggedIn', () => {
      const userInfo = this.authService.getUserInfo();
      if (userInfo) {
        this.userName = userInfo.name;
        this.userEmail = userInfo.email;
      }
    });
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    const navbar = document.querySelector('.glass-navbar');
    if (window.scrollY > 50) {
      navbar?.classList.add('scrolled');
    } else {
      navbar?.classList.remove('scrolled');
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as Node;
    if (!this.el.nativeElement.contains(target)) {
      this.sedesOpen = false;
      this.showLoginModal = false;
      this.showUserDropdown = false;
      document.body.style.overflow = '';
    }
  }

  toggleSedes(event: Event) {
    event.stopPropagation();
    this.sedesOpen = !this.sedesOpen;
  }

  selectSede(name: string, path: string) {
    this.selectedSede = name;
    this.sedesOpen = false;
    this.router.navigate([path]);
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }

  onAccountClick(event: Event) {
    event.stopPropagation();
    // Verificar si el usuario está autenticado
    const isAuthenticated = this.authService.isAuthenticated();
    const userInfo = this.authService.getUserInfo();
    
    if (isAuthenticated && userInfo && this.userName) {
      // Si está autenticado, mostrar/ocultar el dropdown del usuario
      this.showUserDropdown = !this.showUserDropdown;
      this.showLoginModal = false;
    } else {
      // Si no está autenticado, mostrar el modal de login
      this.showLoginModal = !this.showLoginModal;
      this.showUserDropdown = false;
    }
  }

  navigateToProfile() {
    this.showUserDropdown = false;
    // Verificar el rol del usuario para redirigir correctamente
    const userRole = this.authService.getRole();
    const normalizedRole = userRole ? userRole.toString().toLowerCase().trim() : null;
    
    if (normalizedRole === 'admin') {
      this.router.navigate(['/admin']);
    } else {
      this.router.navigate(['/perfil']);
    }
  }

  closeLoginModal() {
    this.showLoginModal = false;
    this.loginError = null;
    this.loginEmail = '';
    this.loginPassword = '';
  }

  navigateToRegistro() {
    this.closeLoginModal();
    this.router.navigate(['/registro']);
  }

  onLoginSubmit() {
    if (!this.loginEmail || !this.loginPassword) {
      this.loginError = 'Por favor completa todos los campos';
      return;
    }

    this.isLoading = true;
    this.loginError = null;

    this.authService.login(this.loginEmail, this.loginPassword).subscribe({
      next: () => {
        this.isLoading = false;
        this.closeLoginModal();
        this.loginEmail = '';
        this.loginPassword = '';
        
        // El userName se actualizará automáticamente a través del observable
        const userInfo = this.authService.getUserInfo();
        if (userInfo) {
          this.userName = userInfo.name;
        }
        
        // La redirección se maneja automáticamente en el AuthService según el rol
      },
      error: (error) => {
        this.isLoading = false;
        this.loginError = error.message || 'Error al iniciar sesión. Verifica tus credenciales.';
      }
    });
  }

  logout() {
    this.showUserDropdown = false;
    this.authService.logout();
    this.userName = null;
    this.userEmail = null;
  }

  @Input() name: string = '';
  @Input() description: string = '';
  @Input() price: number = 0;
  @Input() imageUrl: string | undefined = '';
  @Input() available: boolean = true;
}
