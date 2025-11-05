import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

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
  rememberMe = false;
  loginError: string | null = null;
  isLoading = false;
  
  // Modal de recuperación de contraseña
  showForgotPasswordModal = false;
  forgotPasswordEmail = '';
  forgotPasswordError: string | null = null;
  isSendingReset = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    // Si el usuario ya está autenticado, redirigir según su rol
    if (this.authService.isAuthenticated()) {
      const userRole = this.authService.getRole();
      const normalizedRole = userRole ? userRole.toString().toLowerCase().trim() : null;
      
      if (normalizedRole === 'admin') {
        this.router.navigate(['/admin']);
      } else {
        this.router.navigate(['/perfil']);
      }
    }
  }

  onLoginSubmit() {
    if (!this.loginEmail || !this.loginPassword) {
      this.loginError = 'Por favor completa todos los campos';
      return;
    }

    this.isLoading = true;
    this.loginError = null;

    // Obtener el returnUrl de los query params o sessionStorage
    const returnUrl = this.route.snapshot.queryParams['returnUrl'] || sessionStorage.getItem('returnUrl');

    this.authService.login(this.loginEmail, this.loginPassword, this.rememberMe).subscribe({
      next: () => {
        this.isLoading = false;
        
        // Limpiar el returnUrl de sessionStorage
        if (returnUrl) {
          sessionStorage.removeItem('returnUrl');
          this.router.navigateByUrl(returnUrl);
        } else {
          // Si no hay returnUrl, redirigir según el rol del usuario
          const userRole = this.authService.getRole();
          const normalizedRole = userRole ? userRole.toString().toLowerCase().trim() : null;
          
          if (normalizedRole === 'admin') {
            this.router.navigate(['/admin']);
          } else {
            this.router.navigate(['/perfil']);
          }
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.loginError = error.message || 'Error al iniciar sesión. Verifica tus credenciales.';
      }
    });
  }

  navigateToRegistro() {
    this.router.navigate(['/registro']);
  }

  goBack() {
    this.router.navigate(['/']);
  }

  onForgotPassword(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    // Usar el email del login si está disponible, sino dejarlo vacío
    this.forgotPasswordEmail = this.loginEmail || '';
    this.forgotPasswordError = null;
    this.showForgotPasswordModal = true;
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

    // Validar formato de email
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
