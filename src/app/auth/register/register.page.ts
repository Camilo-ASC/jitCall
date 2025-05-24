import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

// --- IMPORTACIONES DIRECTAS DE FIREBASE JS SDK ---
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  standalone: false
})
export class RegisterPage {
  registerForm: FormGroup;
  loading = false;

  // --- INICIALIZACIÓN DIRECTA DE FIREBASE ---
  // Creamos la conexión directamente aquí, evitando problemas de inyección
  private app = initializeApp(environment.firebaseConfig);
  private auth = getAuth(this.app);
  private db = getFirestore(this.app);

  constructor(
    private fb: FormBuilder,
    private toastController: ToastController,
    private router: Router
    // Ya no inyectamos AuthService ni UserService
  ) {
    this.registerForm = this.fb.group({
      name: ['', Validators.required],
      lastname: ['', Validators.required],
      phone: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  goToLogin() {
    this.router.navigate(['/auth/login']);
  }

  async register() {
    if (this.registerForm.invalid) {
      this.showToast('Por favor, completa todos los campos correctamente.');
      return;
    }

    this.loading = true;
    const { name, lastname, phone, email, password } = this.registerForm.value;

    try {
      // 1. Crear usuario en Firebase Auth directamente
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      const uid = userCredential.user.uid;
      console.log('Usuario creado en Auth con UID:', uid);

      // 2. Guardar datos del usuario en Firestore directamente
      const userDocRef = doc(this.db, `users/${uid}`);
      await setDoc(userDocRef, {
        uid,
        name,
        lastname,
        phone,
        email,
        token: '' // Inicializamos el token vacío
      });
      console.log('Datos del usuario guardados en Firestore.');

      // 3. Intentar obtener y actualizar el token FCM (si está en un dispositivo)
      if (Capacitor.isNativePlatform()) {
        const fcmToken = await this.getFcmToken();
        if (fcmToken) {
          // Usamos 'merge: true' para añadir/actualizar solo el campo del token
          await setDoc(userDocRef, { token: fcmToken }, { merge: true });
          console.log('Token FCM actualizado en Firestore.');
        }
      }

      this.showToast('¡Usuario registrado con éxito!');
      this.router.navigate(['/home']); // O redirige a login

    } catch (err: any) {
      console.error('Error en el proceso de registro:', err);
      const message = err.code === 'auth/email-already-in-use' 
        ? 'El correo electrónico ya está en uso.' 
        : 'Ocurrió un error al registrar el usuario.';
      this.showToast(message);
    } finally {
      this.loading = false;
    }
  }

  // Función auxiliar para el token, para mantener el código más limpio
  private async getFcmToken(): Promise<string | null> {
    try {
      const permission = await PushNotifications.requestPermissions();
      if (permission.receive !== 'granted') {
        console.warn('Permiso para notificaciones fue denegado.');
        return null;
      }
      
      await PushNotifications.register();
      const token = await new Promise<string>((resolve, reject) => {
        PushNotifications.addListener('registration', (token) => resolve(token.value));
        PushNotifications.addListener('registrationError', (err) => reject(err));
      });
      
      return token;
    } catch (error) {
      console.error('Error al obtener token FCM:', error);
      return null;
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