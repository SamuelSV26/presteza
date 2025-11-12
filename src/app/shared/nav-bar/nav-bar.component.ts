import { Component, HostListener, ElementRef, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartComponent } from './cart/cart.component';
import { AuthService } from '../../core/services/auth.service';
import { filter } from 'rxjs/operators';

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
  isOnRegistroPage = false;
  loginEmail = '';
  loginPassword = '';
  rememberMe = false;
  loginError: string | null = null;
  isLoading = false;
  isNavbarCollapsed = true;

  constructor(
    private router: Router, 
    private el: ElementRef,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
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
    this.checkCurrentRoute();
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.checkCurrentRoute();
    });
    this.authService.userInfo$.subscribe(userInfo => {
      if (userInfo) {
        this.userName = userInfo.name;
        this.userEmail = userInfo.email;
      } else {
        this.userName = null;
        this.userEmail = null;
      }
    });
    window.addEventListener('showLoginModal', () => {
      this.showLoginModal = true;
      this.cdr.detectChanges();
    });
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

  checkCurrentRoute(): void {
    this.isOnRegistroPage = this.router.url === '/registro';
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
    this.isNavbarCollapsed = true;
  }

  toggleNavbar() {
    this.isNavbarCollapsed = !this.isNavbarCollapsed;
  }

  closeNavbar() {
    this.isNavbarCollapsed = true;
  }

  onAccountClick(event: Event) {
    event.stopPropagation();
    const isAuthenticated = this.authService.isAuthenticated();
    const userInfo = this.authService.getUserInfo();
    if (isAuthenticated && userInfo && this.userName) {
      this.showUserDropdown = !this.showUserDropdown;
      this.showLoginModal = false;
    } else {
      this.showLoginModal = !this.showLoginModal;
      this.showUserDropdown = false;
    }
  }

  navigateToProfile() {
    this.showUserDropdown = false;
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
    window.dispatchEvent(new CustomEvent('closeLoginModal'));
  }

  navigateToRegistro() {
    this.closeLoginModal();
    this.router.navigate(['/registro']);
  }

  navigateToLogin() {
    this.closeLoginModal();
    this.router.navigate(['/login']);
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
        const userInfo = this.authService.getUserInfo();
        if (userInfo) {
          this.userName = userInfo.name;
        }
        setTimeout(() => {
          const role = this.authService.getRole();
          const normalizedRole = role ? role.toString().toLowerCase().trim() : 'client';
          if (normalizedRole === 'admin') {
            this.router.navigate(['/admin']);
          } else {
            sessionStorage.removeItem('returnUrl');
            this.router.navigate(['/perfil']);
          }
        }, 300);
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
