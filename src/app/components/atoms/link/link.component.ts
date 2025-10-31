import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-link',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './link.component.html',
  styleUrl: './link.component.css'
})
export class LinkComponent {
  @Input() href: string = '';
  @Input() routerLink: string = '';
  @Input() class: string = '';
}
