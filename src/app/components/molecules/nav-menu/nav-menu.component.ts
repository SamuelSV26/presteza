import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavItemComponent } from '../nav-item/nav-item.component';

@Component({
  selector: 'app-nav-menu',
  standalone: true,
  imports: [CommonModule, NavItemComponent],
  templateUrl: './nav-menu.component.html',
  styleUrl: './nav-menu.component.css'
})
export class NavMenuComponent {
  @Input() menuItems: { label: string; routerLink: string; href?: string }[] = [];
  @Output() navigate = new EventEmitter<string>();

  onNavigate(path: string) {
    this.navigate.emit(path);
  }
}
