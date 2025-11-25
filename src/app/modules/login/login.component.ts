import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { filter, take } from 'rxjs/operators';
import { timeout } from 'rxjs';
import { TokenService } from '../../core/services/token.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  loginEmail = '';
  loginPassword = '';
  loginError: string | null = null;
  isLoading = false;
  showForgotPasswordModal = false;
  forgotPasswordEmail = '';
  forgotPasswordError: string | null = null;
  isSendingReset = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private notificationService: NotificationService,
    private tokenService: TokenService
  ) {}

  ngOnInit() {
    // Solo redirigir si el usuario está autenticado Y está en la página de login
    // No redirigir automáticamente desde otras rutas
    const currentUrl = this.router.url;
    if (currentUrl === '/login' && this.authService.isAuthenticated()) {
      const userRole = this.authService.getRole();
      const normalizedRole = userRole ? userRole.toString().toLowerCase().trim() : null;
      if (normalizedRole === 'admin') {
        this.router.navigate(['/admin']);
      } else {
        this.router.navigate(['/perfil']);
      }
    }
    const handleUserLoggedIn = (event: Event) => {
      setTimeout(() => {
        this.handlePostLoginRedirect();
      }, 300);
    };
    window.addEventListener('userLoggedIn', handleUserLoggedIn);
  }

  private handlePostLoginRedirect() {
    const token = this.tokenService.getToken();
    if (!token) {
      setTimeout(() => this.handlePostLoginRedirect(), 200);
      return;
    }
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      const payload = JSON.parse(jsonPayload);
      const userRole = payload?.role || payload?.userRole || payload?.rol || payload?.type || 'client';
      const normalizedRole = userRole ? userRole.toString().toLowerCase().trim() : 'client';
      if (normalizedRole === 'admin') {
        sessionStorage.removeItem('returnUrl');
        this.router.navigateByUrl('/admin');
      } else {
        sessionStorage.removeItem('returnUrl');
        this.router.navigateByUrl('/perfil').then(success => {
          if (!success) {
            window.location.href = '/perfil';
          }
        });
      }
    } catch {
      sessionStorage.removeItem('returnUrl');
      this.router.navigateByUrl('/perfil');
    }
  }

  onLoginSubmit() {
    if (!this.loginEmail || !this.loginPassword) {
      this.loginError = 'Por favor completa todos los campos';
      return;
    }
    this.isLoading = true;
    this.loginError = null;
    const returnUrl = this.route.snapshot.queryParams['returnUrl'] || sessionStorage.getItem('returnUrl');
    this.authService.login(this.loginEmail, this.loginPassword, false).subscribe({
      next: (response) => {
        this.isLoading = false;
        const performRedirect = (userInfo: any) => {
          const userRole = userInfo?.role || this.authService.getRole();
          const normalizedRole = userRole ? userRole.toString().toLowerCase().trim() : 'client';
          sessionStorage.removeItem('returnUrl');
          if (normalizedRole === 'admin') {
            this.router.navigateByUrl('/admin').then(success => {
              if (!success) {
                window.location.href = '/admin';
              }
            }).catch(() => {
              window.location.href = '/admin';
            });
          } else {
            this.router.navigateByUrl('/perfil').then(success => {
              if (!success) {
                window.location.href = '/perfil';
              }
            }).catch(() => {
              window.location.href = '/perfil';
            });
          }
        };
        const currentUserInfo = this.authService.getUserInfo();
        if (currentUserInfo) {
          performRedirect(currentUserInfo);
        } else {
          this.authService.userInfo$
            .pipe(
              filter(userInfo => userInfo !== null),
              take(1),
              timeout(1000)
            )
            .subscribe({
              next: (userInfo) => {
                performRedirect(userInfo);
              },
              error: () => {
                const fallbackUserInfo = this.authService.getUserInfo();
                performRedirect(fallbackUserInfo);
              }
            });
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.loginError = error.message || 'Error al iniciar sesión. Verifica tus credenciales.';
      },
      complete: () => {}
    });
  }

  navigateToRegistro() {
    this.router.navigate(['/registro']);
  }

  goBack() {
    this.router.navigate(['/']);
  }

  onForgotPassword(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.router.navigateByUrl('/forgot-password');
  }

  closeForgotPasswordModal() {
    this.showForgotPasswordModal = false;
    this.forgotPasswordEmail = '';
    this.forgotPasswordError = null;
  }

  onSubmitForgotPassword() {
    if (!this.forgotPasswordEmail || !this.forgotPasswordEmail.trim()) {
      this.forgotPasswordError = 'Por favor ingresa tu correo electrónico';
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.forgotPasswordEmail)) {
      this.forgotPasswordError = 'Por favor ingresa un correo electrónico válido';
      return;
    }
    this.isSendingReset = true;
    this.forgotPasswordError = null;
    this.authService.forgotPassword(this.forgotPasswordEmail.trim()).subscribe({
      next: (response) => {
        this.isSendingReset = false;
        this.notificationService.showSuccess('Se ha enviado un enlace de recuperación a tu correo electrónico. Por favor revisa tu bandeja de entrada.');
        this.closeForgotPasswordModal();
      },
      error: (error) => {
        this.isSendingReset = false;
        this.forgotPasswordError = error.message || 'Error al solicitar recuperación de contraseña. Verifica tu correo electrónico o intenta nuevamente.';
      }
    });
  }
}
