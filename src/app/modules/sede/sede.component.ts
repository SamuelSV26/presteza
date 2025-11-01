import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-sede',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sede.component.html',
  styleUrl: './sede.component.css'
})
export class SedeComponent {
  sede = {
    name: 'Presteza - Sede Principal',
    address: 'Carrera 23 # 70B - 57',
    fullAddress: 'Carrera 23#70B-57 Av. Santander, Torre Plaza 70 Piso 2 Local 8, Milan, Manizales, Caldas',
    city: 'Manizales, Caldas',
    phone: '3104941839',
    email: 'contacto@presteza.com',
    schedule: {
      weekdays: 'Lunes a Viernes: 11:00 AM - 10:00 PM',
      weekends: 'Sábados y Domingos: 12:00 PM - 11:00 PM'
    },
    mapUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3976.9739!2d-75.5131!3d5.0699!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e475b1b1b1b1b1b%3A0x8e475b1b1b1b1b1b!2sCarrera%2023%2370B-57%2C%20Manizales%2C%20Caldas!5e0!3m2!1ses!2sco!4v1234567890',
    imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80'
  };

  safeMapUrl: SafeResourceUrl;

  constructor(private sanitizer: DomSanitizer) {
    this.safeMapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.sede.mapUrl);
  }
}