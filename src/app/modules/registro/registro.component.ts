import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TokenService } from '../../core/services/token.service';
import { Meta, Title } from '@angular/platform-browser';

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
    private authService: AuthService,
    private tokenService: TokenService,
    private title : Title,
    private meta : Meta
  ) {
    this.title.setTitle('Registro - PRESTEZA');
    this.meta.updateTag({ name: 'description', content: 'Regístrate para disfrutar de nuestros servicios.' });
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
        role: 'client'
      };

      this.authService.register(registerData).subscribe({
        next: (response) => {
          this.isLoading = false;
          this.formSuccess = true;
          if (response && (response.message || response.userId)) {
            setTimeout(() => {
              this.authService.login(registerData.email, registerData.password, false).subscribe({
                next: () => {
                  const performRedirect = () => {
                    const token = this.tokenService.getToken();
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
                        if (normalizedRole === 'admin') {
                          this.router.navigateByUrl('/admin').then(() => {}).catch(() => {});
                        } else {
                          this.router.navigateByUrl('/perfil').then(success => {
                            if (!success) {
                              setTimeout(() => {
                                this.router.navigateByUrl('/perfil');
                              }, 500);
                            }
                          }).catch(() => {});
                        }
                      } catch (error) {
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
                      this.router.navigateByUrl('/perfil');
                    }
                  };
                  let attempts = 0;
                  const maxAttempts = 10;
                  const checkTokenAndRedirect = () => {
                    const token = this.tokenService.getToken();
                    if (token || attempts >= maxAttempts) {
                      performRedirect();
                    } else {
                      attempts++;
                      setTimeout(checkTokenAndRedirect, 100);
                    }
                  };
                  checkTokenAndRedirect();
                },
                error: () => {
                  this.router.navigate(['/login']);
                }
              });
            }, 1500);
          } else {
            this.formError = 'Registro completado pero respuesta inesperada del servidor';
          }
        },
        error: (error) => {
          this.isLoading = false;
          this.formError = error.message || 'Error al registrar. Por favor intenta nuevamente.';
        }
      });
    }
  }

  get f() {
    return this.registroForm.controls;
  }

  ngOnInit() {
  }

  navigateToLogin(event?: Event) {
    if (event) {
      event.preventDefault();
    }
    this.router.navigate(['/login']);
  }
}

