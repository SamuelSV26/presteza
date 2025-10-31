import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-nav-item',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './nav-item.component.html',
  styleUrl: './nav-item.component.css'
})
export class NavItemComponent {
  @Input() label: string = '';
  @Input() routerLink: string = '';
  @Input() href: string = '';
  @Output() navigate = new EventEmitter<string>();

  onClick() {
    if (this.routerLink) {
      this.navigate.emit(this.routerLink);
    } else if (this.href) {
      this.navigate.emit(this.href);
    }
  }
}
