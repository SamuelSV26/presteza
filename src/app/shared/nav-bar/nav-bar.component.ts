import { Component, HostListener, ElementRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CartComponent } from './cart/cart.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, CartComponent],
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

  @Input() name: string = '';
  @Input() description: string = '';
  @Input() price: number = 0;
  @Input() imageUrl: string | undefined = '';
  @Input() available: boolean = true;
}

