import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-social-icons',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './social-icons.component.html',
  styleUrl: './social-icons.component.css',
  encapsulation: ViewEncapsulation.None
})
export class SocialIconsComponent {
  @Input() socialLinks: { name: string; url: string; icon: string }[] = [
    { name: 'Facebook', url: '#', icon: 'facebook' },
    { name: 'Instagram', url: '#', icon: 'instagram' }
  ];
}
