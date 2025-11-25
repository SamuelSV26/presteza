import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css']
})
export class ResetPasswordComponent implements OnInit {
  resetPasswordForm: FormGroup;
  token: string | null = null;
  isLoading = false;
  error: string | null = null;
  success = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {
    this.resetPasswordForm = this.fb.group({
      newPassword: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
      ]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  ngOnInit(): void {
    // Obtener el token de la URL (puede venir como query param o route param)
    this.token = this.route.snapshot.queryParams['token'] || 
                 this.route.snapshot.params['token'] ||
                 this.route.snapshot.queryParams['resetToken'] ||
                 this.route.snapshot.params['resetToken'];
    
    console.log('Token obtenido:', this.token);
    console.log('Query params:', this.route.snapshot.queryParams);
    console.log('Route params:', this.route.snapshot.params);
    
    if (!this.token) {
      this.error = 'Token de recuperación no válido o faltante. Por favor, solicita un nuevo enlace de recuperación.';
      this.notificationService.showError('Token de recuperación no válido');
    }
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('newPassword');
    const confirmPassword = form.get('confirmPassword');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    if (confirmPassword && confirmPassword.hasError('passwordMismatch')) {
      confirmPassword.setErrors(null);
    }
    
    return null;
  }

  getPasswordErrors(): string {
    const passwordControl = this.resetPasswordForm.get('newPassword');
    if (!passwordControl || !passwordControl.errors || !passwordControl.touched) {
      return '';
    }

    if (passwordControl.errors['required']) {
      return 'La contraseña es requerida';
    }
    if (passwordControl.errors['minlength']) {
      return 'La contraseña debe tener al menos 8 caracteres';
    }
    if (passwordControl.errors['pattern']) {
      return 'La contraseña debe contener al menos una mayúscula, una minúscula y un número';
    }
    return '';
  }

  getConfirmPasswordErrors(): string {
    const confirmPasswordControl = this.resetPasswordForm.get('confirmPassword');
    if (!confirmPasswordControl || !confirmPasswordControl.errors || !confirmPasswordControl.touched) {
      return '';
    }

    if (confirmPasswordControl.errors['required']) {
      return 'Por favor confirma tu contraseña';
    }
    if (confirmPasswordControl.errors['passwordMismatch']) {
      return 'Las contraseñas no coinciden';
    }
    return '';
  }

  onSubmit(): void {
    if (!this.token) {
      this.error = 'Token de recuperación no válido. Por favor, solicita un nuevo enlace.';
      return;
    }

    if (this.resetPasswordForm.invalid) {
      this.resetPasswordForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.error = null;

    const newPassword = this.resetPasswordForm.get('newPassword')?.value;

    this.authService.resetPassword(this.token, newPassword).subscribe({
      next: (response) => {
        console.log('Respuesta del servidor:', response);
        this.isLoading = false;
        this.success = true;
        this.notificationService.showSuccess('Contraseña restablecida exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.');
        
        // Redirigir al login después de 2 segundos
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      },
      error: (error) => {
        console.error('Error en resetPassword:', error);
        this.isLoading = false;
        const errorMessage = error?.message || error?.error?.message || 'Error al restablecer la contraseña. El token puede haber expirado. Por favor, solicita un nuevo enlace.';
        this.error = errorMessage;
        this.notificationService.showError(errorMessage);
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  requestNewLink(): void {
    this.router.navigate(['/login']);
  }
}

