import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './registro.component.html',
  styleUrls: ['./registro.component.css']
})
export class RegistroComponent {
  registroForm: FormGroup;
  submitted = false;
  formSuccess = false;

  constructor(private fb: FormBuilder, private router: Router) {
    this.registroForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      acceptTerms: [false, [Validators.requiredTrue]]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  onSubmit() {
    this.submitted = true;
    
    if (this.registroForm.valid) {
      console.log('Registro:', this.registroForm.value);
      
      // Simular registro exitoso
      this.formSuccess = true;
      localStorage.setItem('userName', this.registroForm.value.name);
      
      // Redirigir después de 2 segundos
      setTimeout(() => {
        this.router.navigate(['/']);
      }, 2000);
    }
  }

  get f() {
    return this.registroForm.controls;
  }

  navigateToLogin() {
    // Cerrar el modal de registro y mostrar el modal de login desde el navbar
    // Por ahora redirigimos al home y el usuario puede hacer clic en el icono de usuario
    this.router.navigate(['/']);
  }
}

