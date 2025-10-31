import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-feature-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './feature-card.component.html',
  styleUrl: './feature-card.component.css'
})
export class FeatureCardComponent {
  @Input() imageUrl: string = '';
  @Input() imageAlt: string = '';
  @Input() title: string = '';
  @Input() description: string = '';
}
