import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from 'src/app/services/auth.service';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  standalone: false
})
export class LoginPage {
  loginForm: FormGroup;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastController: ToastController
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  goToRegister() {
  this.router.navigate(['/auth/register']).then(success => {
    if (!success) {
      console.error('Error al navegar a /auth/register');
    }
  });
}

  async login() {
    if (this.loginForm.invalid) return;

    this.loading = true;
    const { email, password } = this.loginForm.value;

    try {
      await this.authService.login(email, password);
      this.showToast('Inicio de sesión exitoso');
      this.router.navigate(['/home']);
    } catch (err) {
      console.error(err);
      this.showToast('Error al iniciar sesión');
    } finally {
      this.loading = false;
    }
  }

  async showToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
    });
    toast.present();
  }
}
