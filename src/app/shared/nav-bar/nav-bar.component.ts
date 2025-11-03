import { Component, HostListener, ElementRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartComponent } from './cart/cart.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, CartComponent, FormsModule],
  templateUrl: './nav-bar.component.html',
  styleUrls: ['./nav-bar.component.css'],
})
export class NavbarComponent {
  sedesOpen = false;
  selectedSede = '';
  userName: string | null = null;
  showLoginModal = false;
  loginEmail = '';
  loginPassword = '';
  rememberMe = false;

  ngOnInit() {
    const storedUser = localStorage.getItem('userName');
    this.userName = storedUser ? storedUser : null;
    
    // Escuchar evento para mostrar modal de login desde otros componentes
    window.addEventListener('showLoginModal', () => {
      this.showLoginModal = true;
    });
  }
  constructor(private router: Router, private el: ElementRef) {}

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

  navigateTo(path: string) {
    this.router.navigate([path]);
  }

  onAccountClick(event: Event) {
    event.stopPropagation();
    if (this.userName) {
      this.router.navigate(['/perfil']);
    } else {
      this.showLoginModal = !this.showLoginModal;
    }
  }

  closeLoginModal() {
    this.showLoginModal = false;
  }

  navigateToRegistro() {
    this.closeLoginModal();
    this.router.navigate(['/registro']);
  }

  onLoginSubmit() {
    // Aquí puedes agregar la lógica de autenticación
    console.log('Login:', { email: this.loginEmail, password: this.loginPassword, rememberMe: this.rememberMe });
    
    // Simulación de login exitoso
    if (this.loginEmail && this.loginPassword) {
      localStorage.setItem('userName', this.loginEmail.split('@')[0]);
      this.userName = this.loginEmail.split('@')[0];
      this.closeLoginModal();
      
      // Disparar evento para que los componentes actualicen su estado
      window.dispatchEvent(new CustomEvent('userLoggedIn'));
    }
  }

  @Input() name: string = '';
  @Input() description: string = '';
  @Input() price: number = 0;
  @Input() imageUrl: string | undefined = '';
  @Input() available: boolean = true;
}
