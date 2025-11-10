import { Component, OnInit } from '@angular/core';
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
export class RegistroComponent implements OnInit {
  registroForm: FormGroup;
  submitted = false;
  formSuccess = false;
  formError: string | null = null;
  isLoading = false;
  loginModalOpen = false;

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
            
            // Hacer login automático después del registro
            setTimeout(() => {
              this.authService.login(registerData.email, registerData.password, false).subscribe({
                next: () => {
                  console.log('✅ Login automático exitoso después del registro');
                  
                  // Función para realizar la redirección
                  const performRedirect = () => {
                    // Obtener el rol directamente del token decodificado
                    const token = this.authService.getToken();
                    console.log('🔑 Token obtenido después del registro:', token ? 'Sí' : 'No');
                    
                    if (token) {
                      try {
                        const base64Url = token.split('.')[1];
                        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                        }).join(''));
                        const payload = JSON.parse(jsonPayload);
                        
                        const userRole = payload?.role || payload?.userRole || payload?.rol || payload?.type || 'client';
                        const normalizedRole = userRole ? userRole.toString().toLowerCase().trim() : 'client';
                        
                        console.log('🔍 Rol obtenido después del registro:', normalizedRole);
                        
                        // Redirigir según el rol
                        if (normalizedRole === 'admin') {
                          console.log('✅ Redirigiendo a /admin');
                          this.router.navigateByUrl('/admin').then(success => {
                            console.log('✅ Navegación a /admin:', success ? 'exitosa' : 'fallida');
                            if (!success) {
                              console.error('❌ Error al navegar a /admin');
                            }
                          }).catch(err => {
                            console.error('❌ Excepción al navegar a /admin:', err);
                          });
                        } else {
                          console.log('✅ Redirigiendo a /perfil');
                          this.router.navigateByUrl('/perfil').then(success => {
                            console.log('✅ Navegación a /perfil:', success ? 'exitosa' : 'fallida');
                            if (!success) {
                              console.error('❌ Error al navegar a /perfil');
                              // Intentar de nuevo después de un breve delay
                              setTimeout(() => {
                                console.log('🔄 Reintentando navegación a /perfil...');
                                this.router.navigateByUrl('/perfil');
                              }, 500);
                            }
                          }).catch(err => {
                            console.error('❌ Excepción al navegar a /perfil:', err);
                          });
                        }
                      } catch (error) {
                        console.error('❌ Error al decodificar token para obtener rol:', error);
                        // Fallback: usar el método del servicio
                        const userInfo = this.authService.getUserInfo();
                        const userRole = userInfo?.role || this.authService.getRole();
                        const normalizedRole = userRole ? userRole.toString().toLowerCase().trim() : 'client';
                        
                        if (normalizedRole === 'admin') {
                          this.router.navigateByUrl('/admin');
                        } else {
                          this.router.navigateByUrl('/perfil');
                        }
                      }
                    } else {
                      console.error('❌ No se encontró token después del registro');
                      // Redirigir a perfil por defecto si no hay token
                      this.router.navigateByUrl('/perfil');
                    }
                  };
                  
                  // Verificar que el token esté disponible antes de redirigir
                  let attempts = 0;
                  const maxAttempts = 10;
                  const checkTokenAndRedirect = () => {
                    const token = this.authService.getToken();
                    if (token || attempts >= maxAttempts) {
                      performRedirect();
                    } else {
                      attempts++;
                      console.log(`⏳ Esperando token... Intento ${attempts}/${maxAttempts}`);
                      setTimeout(checkTokenAndRedirect, 100);
                    }
                  };
                  
                  // Iniciar verificación
                  checkTokenAndRedirect();
                },
                error: (loginError) => {
                  console.error('❌ Error en login automático:', loginError);
                  // Si el login automático falla, redirigir al login para que inicie sesión manualmente
                  this.router.navigate(['/login']);
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

  ngOnInit() {
    // No necesita escuchar eventos de modal ahora que tenemos página dedicada
  }

  navigateToLogin(event?: Event) {
    if (event) {
      event.preventDefault();
    }
    
    // Redirigir a la página de login
    this.router.navigate(['/login']);
  }
}

