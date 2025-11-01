import { Component, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './nav-bar.component.html',
  styleUrls: ['./nav-bar.component.css']
})
export class NavbarComponent {
  sedesOpen = false;
  selectedSede = '';

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
    // cierra el dropdown si se hace click fuera del componente
    const target = event.target as Node;
    if (!this.el.nativeElement.contains(target)) {
      this.sedesOpen = false;
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
}
