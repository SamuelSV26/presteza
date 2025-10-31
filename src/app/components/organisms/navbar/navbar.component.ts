import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CartComponent } from '../cart/cart.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, CartComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  constructor(private router: Router) {}

  @HostListener('window:scroll', [])
  onWindowScroll() {
    const navbar = document.querySelector('.glass-navbar');
    if (window.scrollY > 50) {
      navbar?.classList.add('scrolled');
    } else {
      navbar?.classList.remove('scrolled');
    }
  }

  navigateTo(path: string) {
    console.log('Navigating to:', path);
    this.router.navigate([path]).then((success) => {
      console.log('Navigation success:', success);
      // Cerrar el menú móvil si está abierto
      const navbarNav = document.getElementById('navbarNav');
      if (navbarNav && navbarNav.classList.contains('show')) {
        const bsCollapse = (window as any).bootstrap?.Collapse?.getInstance(navbarNav);
        if (bsCollapse) {
          bsCollapse.hide();
        } else {
          // Fallback: cerrar manualmente
          navbarNav.classList.remove('show');
        }
      }
    }).catch((error) => {
      console.error('Navigation error:', error);
    });
  }
}
