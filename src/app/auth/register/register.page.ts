import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from 'src/app/services/auth.service';
import { UserService } from 'src/app/services/user.service';
import { PushNotifications } from '@capacitor/push-notifications';
import { ToastController } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  standalone: false
})
export class RegisterPage {
  registerForm: FormGroup;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private userService: UserService,
    private toastController: ToastController,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      name: ['', Validators.required],
      lastname: ['', Validators.required],
      phone: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  goToLogin() {
  this.router.navigate(['/auth/login']);
  }

  async register() {
    if (this.registerForm.invalid) return;

    this.loading = true;

    const { name, lastname, phone, email, password } = this.registerForm.value;

    try {
      // Crear usuario en Firebase Auth
      const userCredential = await this.authService.register(
        { name: name, lastname: lastname, phone: phone, email },
        password
      );
      const uid = userCredential.user.uid;

      // Solicitar permisos y obtener token FCM
      const permission = await PushNotifications.requestPermissions();
      let fcmToken = '';

      if (permission.receive === 'granted') {
        await PushNotifications.register();

        const tokenPromise = new Promise<string>((resolve, reject) => {
          PushNotifications.addListener('registration', (token) => {
            resolve(token.value);
          });

          PushNotifications.addListener('registrationError', (err) => {
            reject(err);
          });
        });

        fcmToken = await tokenPromise;
      }

      // Guardar usuario en Firestore
      await this.userService.createUser(uid, {
        nombre: name,
        apellido: lastname,
        telefono: phone,
        email,
        token: fcmToken
      });

      this.showToast('Usuario registrado con éxito');
    } catch (err) {
      console.error(err);
      this.showToast('Error al registrar usuario');
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
