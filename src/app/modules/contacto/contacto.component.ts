import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ContactService } from '../../core/services/contact.service';
import { NotificationService } from '../../core/services/notification.service';
import { Meta, Title } from '@angular/platform-browser';

@Component({
  selector: 'app-contacto',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './contacto.component.html',
  styleUrls: ['./contacto.component.css']
})
export class ContactoComponent {
  contactForm: FormGroup;
  submitted = false;
  formSuccess = false;
  isLoading = false;

  contactInfo = {
    phone: '3104941839',
    email: 'contacto@presteza.com',
    address: 'Carrera 23 # 70B - 57, Milan, Manizales, Caldas',
    schedule: {
      weekdays: 'Lunes a Viernes: 11:00 AM - 10:00 PM',
      weekends: 'Sábados y Domingos: 12:00 PM - 11:00 PM'
    }
  };

  whatsappInfo = {
    name: 'WhatsApp',
    icon: 'bi-whatsapp',
    url: 'https://wa.me/573104941839',
    color: '#25D366',
    phone: '3104941839'
  };

  constructor(
    private fb: FormBuilder,
    private contactService: ContactService,
    private notificationService: NotificationService,
    private title: Title,
    private meta: Meta
  ) {
    this.title.setTitle('Contacto - PRESTEZA');
    this.meta.updateTag({ name: 'description', content: 'Contáctanos.' });
    this.contactForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      subject: ['', [Validators.required, Validators.minLength(5)]],
      message: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  onSubmit() {
    this.submitted = true;
    if (this.contactForm.valid) {
      this.isLoading = true;
      const formValue = this.contactForm.value;

      this.contactService.create(formValue).subscribe({
        next: () => {
          this.isLoading = false;
          this.formSuccess = true;
          this.contactForm.reset();
          this.submitted = false;
          this.notificationService.showSuccess('¡Mensaje enviado exitosamente! Nos pondremos en contacto contigo pronto.');
          setTimeout(() => {
            this.formSuccess = false;
          }, 5000);
        },
        error: (error) => {
          this.isLoading = false;
          const errorMessage = error?.message || error?.error?.message || 'Error al enviar el mensaje. Por favor intenta nuevamente.';
          this.notificationService.showError(errorMessage);
        }
      });
    }
  }

  get f() {
    return this.contactForm.controls;
  }
}
