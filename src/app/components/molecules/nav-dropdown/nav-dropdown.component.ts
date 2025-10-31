import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-nav-dropdown',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './nav-dropdown.component.html',
  styleUrl: './nav-dropdown.component.css'
})
export class NavDropdownComponent {
  @Input() label: string = '';
  @Input() items: { label: string; routerLink: string; href?: string }[] = [];
  @Output() navigate = new EventEmitter<string>();

  onNavigate(path: string) {
    this.navigate.emit(path);
  }
}
