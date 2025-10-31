import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-menu-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './menu-item.component.html',
  styleUrl: './menu-item.component.css'
})
export class MenuItemComponent {
  @Input() name: string = '';
  @Input() description: string = '';
  @Input() price: number = 0;
  @Input() imageUrl: string | undefined = '';
  @Input() available: boolean = true;
}
