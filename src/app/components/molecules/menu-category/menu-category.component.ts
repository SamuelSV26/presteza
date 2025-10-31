import { Component, Input } from '@angular/core';
import { CommonModule, NgStyle } from '@angular/common';
import { MenuItemComponent } from '../menu-item/menu-item.component';

export interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  available: boolean;
}

@Component({
  selector: 'app-menu-category',
  standalone: true,
  imports: [CommonModule, NgStyle, MenuItemComponent],
  templateUrl: './menu-category.component.html',
  styleUrl: './menu-category.component.css'
})
export class MenuCategoryComponent {
  @Input() categoryName: string = '';
  @Input() items: MenuItem[] = [];
  @Input() style: any = {};
}
