import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LinkComponent } from '../../atoms/link/link.component';

@Component({
  selector: 'app-nav-logo',
  standalone: true,
  imports: [CommonModule, LinkComponent],
  templateUrl: './nav-logo.component.html',
  styleUrl: './nav-logo.component.css'
})
export class NavLogoComponent {
  @Input() text: string = 'PRESTEZA';
  @Input() routerLink: string = '/';
}
