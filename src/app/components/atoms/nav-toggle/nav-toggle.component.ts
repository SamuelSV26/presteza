import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-nav-toggle',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './nav-toggle.component.html',
  styleUrl: './nav-toggle.component.css'
})
export class NavToggleComponent {
  toggleId = 'navbarNav';
}
