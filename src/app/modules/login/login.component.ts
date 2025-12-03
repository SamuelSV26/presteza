import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { filter, take } from 'rxjs/operators';
import { timeout } from 'rxjs';
import { TokenService } from '../../core/services/token.service';
import { Meta, Title } from '@angular/platform-browser';

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

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private tokenService: TokenService,
    private title: Title,
    private meta: Meta
  ) {
    this.title.setTitle('Login - PRESTEZA');
    this.meta.updateTag({ name: 'description', content: 'Inicia sesión en PRESTEZA para acceder a tu cuenta y realizar pedidos.' });
  }

  ngOnInit() {
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
      }
    });
  }

  navigateToRegistro() {
    this.router.navigate(['/registro']);
  }

  onForgotPassword(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.router.navigateByUrl('/forgot-password');
  }
}
