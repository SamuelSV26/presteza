import { Component } from '@angular/core';
import { SocialIconsComponent } from '../../molecules/social-icons/social-icons.component';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [SocialIconsComponent],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css'
})
export class FooterComponent {
  socialLinks = [
    { name: 'Facebook', url: '#', icon: 'facebook' },
    { name: 'Instagram', url: '#', icon: 'instagram' }
  ];
}
