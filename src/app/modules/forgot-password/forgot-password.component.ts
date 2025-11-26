import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Meta, Title } from '@angular/platform-browser';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css'
})
export class ForgotPasswordComponent {
  email = '';
  error: string | null = null;
  isLoading = false;
  success = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private notificationService: NotificationService,
    private title: Title,
    private meta: Meta
  ) {
    this.title.setTitle('Recuperar Contraseña - PRESTEZA');
    this.meta.updateTag({ name: 'description', content: 'Recupera tu contraseña.' });
  }

  onSubmit() {
    if (!this.email || !this.email.trim()) {
      this.error = 'Por favor ingresa tu correo electrónico';
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.error = 'Por favor ingresa un correo electrónico válido';
      return;
    }

    this.isLoading = true;
    this.error = null;

    this.authService.forgotPassword(this.email.trim()).subscribe({
      next: (response) => {
        console.log('Respuesta del servidor:', response);
        console.log('Email enviado a:', this.email.trim());
        this.isLoading = false;
        this.success = true;
        // Mostrar mensaje más detallado
        const message = response?.message || 'Se ha enviado un enlace de recuperación a tu correo electrónico. Por favor revisa tu bandeja de entrada y también la carpeta de spam.';
        this.notificationService.showSuccess(message);

        // Advertencia en desarrollo
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          console.warn('⚠️ MODO DESARROLLO: Si no recibes el correo, verifica que el backend tenga configurado el servicio de envío de correos (SMTP).');
        }
      },
      error: (error) => {
        console.error('Error completo en forgotPassword:', error);
        console.error('Error original:', error?.originalError);
        console.error('Error data:', error?.error);
        this.isLoading = false;

        // Manejo más detallado de errores
        let errorMessage = 'Error al solicitar recuperación de contraseña.';

        if (error?.originalError) {
          const originalError = error.originalError;
          if (originalError.status === 0) {
            errorMessage = 'No se pudo conectar con el servidor. Verifica que el backend esté corriendo.';
          } else if (originalError.status === 404) {
            errorMessage = 'El correo electrónico no está registrado en el sistema.';
          } else if (originalError.status === 500) {
            errorMessage = 'Error en el servidor. Por favor, intenta más tarde o contacta al administrador.';
          } else if (originalError.error?.message) {
            errorMessage = originalError.error.message;
          } else if (originalError.status) {
            errorMessage = `Error ${originalError.status}: ${originalError.statusText || 'Error desconocido'}`;
          }
        } else if (error?.message) {
          errorMessage = error.message;
        } else if (error?.error?.message) {
          errorMessage = error.error.message;
        }

        this.error = errorMessage;
        this.notificationService.showError(errorMessage);
      }
    });
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
