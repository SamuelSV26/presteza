import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './registro.component.html',
  styleUrls: ['./registro.component.css']
})
export class RegistroComponent {
  registroForm: FormGroup;
  submitted = false;
  formSuccess = false;
  formError: string | null = null;
  isLoading = false;

  constructor(
    private fb: FormBuilder, 
    private router: Router,
    private authService: AuthService
  ) {
    this.registroForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      password: ['', [Validators.required, Validators.minLength(8), 
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)]],
      confirmPassword: ['', [Validators.required]],
      acceptTerms: [false, [Validators.requiredTrue]]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  onSubmit() {
    this.submitted = true;
    this.formError = null;
    
    if (this.registroForm.valid) {
      this.isLoading = true;
      
      const registerData = {
        complete_name: this.registroForm.value.name,
        email: this.registroForm.value.email,
        phone_number: this.registroForm.value.phone,
        password: this.registroForm.value.password,
        role: 'client' // Por defecto cliente
      };

      this.authService.register(registerData).subscribe({
        next: (response) => {
          console.log('Registro exitoso, respuesta:', response);
          this.isLoading = false;
          this.formSuccess = true;
          
          // Guardar nombre, email y teléfono temporalmente en localStorage antes del login
          localStorage.setItem('userName', registerData.complete_name);
          localStorage.setItem('userEmail', registerData.email);
          localStorage.setItem('userPhone', registerData.phone_number);
          
          // Verificar que la respuesta sea válida
          if (response && (response.message || response.userId)) {
            console.log('Usuario registrado correctamente en la base de datos');
            
            // Opcional: hacer login automático después del registro
            setTimeout(() => {
              this.authService.login(registerData.email, registerData.password).subscribe({
                next: () => {
                  console.log('Login automático exitoso después del registro');
                  // La redirección se maneja automáticamente en el AuthService según el rol
                },
                error: (loginError) => {
                  console.error('Error en login automático:', loginError);
                  // Si el login automático falla, redirigir al perfil por defecto
                  this.router.navigate(['/perfil']);
                }
              });
            }, 1500);
          } else {
            console.warn('Registro completado pero respuesta inesperada:', response);
            this.formError = 'Registro completado pero respuesta inesperada del servidor';
          }
        },
        error: (error) => {
          console.error('Error completo en el registro:', error);
          this.isLoading = false;
          this.formError = error.message || 'Error al registrar. Por favor intenta nuevamente.';
          
          // Mostrar detalles adicionales del error para debugging
          if (error.error) {
            console.error('Detalles del error:', error.error);
          }
        }
      });
    }
  }

  get f() {
    return this.registroForm.controls;
  }

  navigateToLogin() {
    // Cerrar el modal de registro y mostrar el modal de login desde el navbar
    // Por ahora redirigimos al home y el usuario puede hacer clic en el icono de usuario
    this.router.navigate(['/']);
  }
}

