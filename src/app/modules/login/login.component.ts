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

    // Escuchar el evento de login exitoso como fallback
    const handleUserLoggedIn = (event: Event) => {
      console.log('🎧 Evento userLoggedIn capturado en LoginComponent');
      console.log('🎧 Event detail:', (event as CustomEvent).detail);
      setTimeout(() => {
        this.handlePostLoginRedirect();
      }, 300);
    };
    
    window.addEventListener('userLoggedIn', handleUserLoggedIn);
    console.log('👂 Listener de userLoggedIn configurado en LoginComponent');
  }

  private handlePostLoginRedirect() {
    console.log('🎯 handlePostLoginRedirect ejecutado');
    const token = this.authService.getToken();
    
    if (!token) {
      console.log('⚠️ No hay token, esperando...');
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
      
      console.log('🎯 Rol detectado desde evento:', normalizedRole);
      
      if (normalizedRole === 'admin') {
        // Para admins, siempre a /admin, ignorando returnUrl
        console.log('🎯 Redirigiendo admin a /admin desde evento (ignorando returnUrl)');
        sessionStorage.removeItem('returnUrl'); // Limpiar returnUrl
        this.router.navigateByUrl('/admin');
      } else {
        // Para clientes, siempre a /perfil, ignorando returnUrl
        console.log('🎯 Redirigiendo cliente a /perfil desde evento (ignorando returnUrl)');
        sessionStorage.removeItem('returnUrl'); // Limpiar returnUrl
        this.router.navigateByUrl('/perfil').then(success => {
          if (!success) {
            console.log('🎯 Fallback: usando window.location.href');
            window.location.href = '/perfil';
          }
        });
      }
    } catch (error) {
      console.error('❌ Error al procesar redirección desde evento:', error);
      // Redirigir a perfil por defecto (asumiendo cliente)
      sessionStorage.removeItem('returnUrl'); // Limpiar returnUrl
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

    // Obtener el returnUrl de los query params o sessionStorage
    const returnUrl = this.route.snapshot.queryParams['returnUrl'] || sessionStorage.getItem('returnUrl');

    console.log('🔄 Iniciando proceso de login...');
    console.log('📧 Email:', this.loginEmail);
    console.log('🔑 Password:', this.loginPassword ? '***' : 'vacío');
    
    this.authService.login(this.loginEmail, this.loginPassword, this.rememberMe).subscribe({
      next: (response) => {
        console.log('📥 ===== CALLBACK NEXT() EJECUTADO EN LOGINCOMPONENT =====');
        console.log('📥 Respuesta del login:', response);
        this.isLoading = false;
        
        console.log('✅ Login exitoso, iniciando redirección...');
        
        // Función para realizar la redirección
        const performRedirect = () => {
          console.log('🚀 Ejecutando performRedirect...');
          // Obtener el rol directamente del token decodificado para mayor confiabilidad
          const token = this.authService.getToken();
          console.log('🔑 Token obtenido en performRedirect:', token ? 'Sí' : 'No');
          console.log('🔑 Token desde localStorage:', localStorage.getItem('authToken') ? 'Sí' : 'No');
          console.log('🔑 Token desde sessionStorage:', sessionStorage.getItem('authToken') ? 'Sí' : 'No');
          
          if (token) {
            try {
              const base64Url = token.split('.')[1];
              const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
              const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
              }).join(''));
              const payload = JSON.parse(jsonPayload);
              
              console.log('📋 Payload completo:', payload);
              
              const userRole = payload?.role || payload?.userRole || payload?.rol || payload?.type || 'client';
              const normalizedRole = userRole ? userRole.toString().toLowerCase().trim() : 'client';
              
              console.log('🔍 Rol obtenido del token después del login:', normalizedRole);
              
              // Limpiar el returnUrl de sessionStorage
              // Para admins, siempre redirigir a /admin, ignorando returnUrl
              // Para clientes, siempre redirigir a /perfil, ignorando returnUrl
              if (normalizedRole === 'admin') {
                // Para admins, SIEMPRE redirigir a /admin, ignorando returnUrl
                console.log('✅ Usuario es ADMIN - Redirigiendo a /admin (ignorando returnUrl)');
                sessionStorage.removeItem('returnUrl'); // Limpiar returnUrl
                this.router.navigateByUrl('/admin').then(success => {
                  console.log('✅ Navegación a /admin:', success ? 'exitosa' : 'fallida');
                  if (!success) {
                    console.error('❌ Error al navegar a /admin, usando location.href como fallback');
                    window.location.href = '/admin';
                  }
                }).catch(err => {
                  console.error('❌ Excepción al navegar a /admin:', err);
                  console.log('🔄 Usando location.href como fallback');
                  window.location.href = '/admin';
                });
              } else {
                // Para clientes, SIEMPRE redirigir a /perfil, ignorando returnUrl
                console.log('✅ Usuario es CLIENTE - Redirigiendo a /perfil (ignorando returnUrl)');
                sessionStorage.removeItem('returnUrl'); // Limpiar returnUrl
                console.log('🔑 Token disponible antes de navegar:', this.authService.getToken() ? 'Sí' : 'No');
                console.log('🔒 Usuario autenticado antes de navegar:', this.authService.isAuthenticated());
                
                // Forzar navegación con location.href como fallback
                this.router.navigateByUrl('/perfil').then(success => {
                  console.log('✅ Navegación a /perfil:', success ? 'exitosa' : 'fallida');
                  if (!success) {
                    console.error('❌ Error al navegar a /perfil, usando location.href como fallback');
                    window.location.href = '/perfil';
                  }
                }).catch(err => {
                  console.error('❌ Excepción al navegar a /perfil:', err);
                  console.log('🔄 Usando location.href como fallback');
                  window.location.href = '/perfil';
                });
              }
            } catch (error) {
              console.error('❌ Error al decodificar token para obtener rol:', error);
              // Fallback: usar el método del servicio
              const userInfo = this.authService.getUserInfo();
              console.log('📋 UserInfo obtenido del servicio:', userInfo);
              const userRole = userInfo?.role || this.authService.getRole();
              const normalizedRole = userRole ? userRole.toString().toLowerCase().trim() : 'client';
              
              console.log('🔍 Rol obtenido del servicio:', normalizedRole);
              
              if (normalizedRole === 'admin') {
                // Para admins, siempre a /admin
                console.log('✅ Redirigiendo admin a /admin (fallback)');
                sessionStorage.removeItem('returnUrl'); // Limpiar returnUrl
                this.router.navigateByUrl('/admin');
              } else {
                // Para clientes, siempre a /perfil
                console.log('✅ Redirigiendo cliente a /perfil (fallback)');
                sessionStorage.removeItem('returnUrl'); // Limpiar returnUrl
                this.router.navigateByUrl('/perfil');
              }
            }
          } else {
            console.error('❌ No se encontró token después del login');
            // Redirigir a perfil por defecto si no hay token (asumiendo que es cliente)
            console.log('✅ Redirigiendo a /perfil (sin token - asumiendo cliente)');
            sessionStorage.removeItem('returnUrl'); // Limpiar returnUrl
            this.router.navigateByUrl('/perfil');
          }
        };
        
        // Redirigir inmediatamente - el token ya está guardado en el AuthService
        // Usar setTimeout para asegurar que Angular haya procesado el cambio
        setTimeout(() => {
          console.log('⏰ Timeout ejecutado, llamando performRedirect...');
          performRedirect();
        }, 300);
      },
      error: (error) => {
        console.error('❌ Error en el subscribe del login:', error);
        this.isLoading = false;
        this.loginError = error.message || 'Error al iniciar sesión. Verifica tus credenciales.';
      },
      complete: () => {
        console.log('✅ Observable de login completado');
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
