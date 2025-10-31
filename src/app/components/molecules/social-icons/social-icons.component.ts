import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LinkComponent } from '../../atoms/link/link.component';
import { IconComponent } from '../../atoms/icon/icon.component';

@Component({
  selector: 'app-social-icons',
  standalone: true,
  imports: [CommonModule, LinkComponent, IconComponent],
  templateUrl: './social-icons.component.html',
  styleUrl: './social-icons.component.css'
})
export class SocialIconsComponent {
  @Input() socialLinks: { name: string; url: string; icon: string }[] = [
    { name: 'Facebook', url: '#', icon: 'facebook' },
    { name: 'Instagram', url: '#', icon: 'instagram' }
  ];
}
