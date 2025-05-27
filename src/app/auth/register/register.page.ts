import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, updateDoc } from "firebase/firestore";
import { environment } from 'src/environments/environment';

import { User } from 'src/app/core/models/user.model'; 

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrl: './register.page.scss',
  standalone: false
})
export class RegisterPage {
  registerForm: FormGroup;
  loading = false;

  private app = initializeApp(environment.firebaseConfig);
  private auth = getAuth(this.app);
  private db = getFirestore(this.app);

  constructor(
    private fb: FormBuilder,
    private toastController: ToastController,
    private router: Router
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
    let uid = '';

    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      uid = userCredential.user.uid;
      console.log('Usuario creado en Auth con UID:', uid);

      const userDocRef = doc(this.db, `users/${uid}`);
      await setDoc(userDocRef, {
        uid, name, lastname, phone, email,
        token: '' 
      });
      console.log('Datos iniciales del usuario guardados en Firestore.');

      if (Capacitor.isNativePlatform()) {
        console.log('Plataforma nativa detectada, intentando obtener y guardar token FCM...');
        const fcmToken = await this.getFcmToken();
        
        if (fcmToken) {
          await updateDoc(userDocRef, { token: fcmToken });
          console.log('Token FCM actualizado en Firestore.');
        } else {
          console.warn('No se obtuvo token FCM (permiso denegado, error o timeout).');
        }
      } else {
        console.log('Ejecutando en el navegador, se omite la obtención de token FCM.');
      }

      this.showToast('¡Usuario registrado con éxito!');
      this.router.navigate(['/home']);

    } catch (err: any) {
      console.error('Error en el proceso de registro principal:', err);
      let message = 'Ocurrió un error al registrar el usuario.';
      if (err.code === 'auth/email-already-in-use') {
        message = 'El correo electrónico ya está en uso.';
      } else if (err.code) {
        message = `Error (${err.code}): ${err.message}`;
      } else if (err.message) {
        message = err.message;
      }
      this.showToast(message);
    } finally {
      this.loading = false;
    }
  }

  private async getFcmToken(): Promise<string | null> {
    console.log('getFcmToken: Solicitando permisos de notificación...');
    
    try {
      const permissionResult = await PushNotifications.requestPermissions();
      if (permissionResult.receive !== 'granted') {
        console.warn('getFcmToken: Permiso para notificaciones fue denegado por el usuario.');
        this.showToast('Permiso de notificaciones denegado.');
        return null;
      }

      console.log('getFcmToken: Permiso concedido. Preparando para registrar...');
      
      return await new Promise<string | null>(async (resolve, reject) => {
        let registrationListenerHandle: PluginListenerHandle | null = null;
        let errorListenerHandle: PluginListenerHandle | null = null;
        let timeoutId: any = null;

        const cleanupListeners = async () => {
          if (registrationListenerHandle) {
            try { await registrationListenerHandle.remove(); } catch(e) { console.warn("Warn: Error menor removiendo listener de registro", e); }
            registrationListenerHandle = null; 
            console.log('getFcmToken: Listener de "registration" eliminado.');
          }
          if (errorListenerHandle) {
            try { await errorListenerHandle.remove(); } catch(e) { console.warn("Warn: Error menor removiendo listener de error", e); }
            errorListenerHandle = null;
            console.log('getFcmToken: Listener de "registrationError" eliminado.');
          }
          if (timeoutId) {
            clearTimeout(timeoutId);
            console.log('getFcmToken: Timeout limpiado.');
          }
        };

        try {
          registrationListenerHandle = await PushNotifications.addListener('registration', (token) => {
            console.log('getFcmToken: Evento "registration" recibido. Token:', token.value);
            cleanupListeners().then(() => resolve(token.value));
          });

          errorListenerHandle = await PushNotifications.addListener('registrationError', (error: any) => {
            console.error('getFcmToken: Evento "registrationError" recibido:', error);
            cleanupListeners().then(() => reject(error));
          });
          
          console.log('getFcmToken: Listeners añadidos. Llamando a PushNotifications.register().');
          await PushNotifications.register(); 

          timeoutId = setTimeout(() => {
            console.warn('getFcmToken: Timeout (15s) esperando el token FCM o error.');
            cleanupListeners().then(() => reject(new Error('Timeout: No se recibió token/error en 15s.')));
          }, 15000);

        } catch (listenerSetupError) { 
            console.error('getFcmToken: Error al configurar los listeners o al registrar:', listenerSetupError);
            await cleanupListeners(); 
            reject(listenerSetupError);
        }
      }).catch(tokenPromiseError => {
        console.error('getFcmToken: Error capturado por .catch() de la promesa del token:', tokenPromiseError);
        // No mostramos toast aquí, ya que el catch más externo podría hacerlo o la función register lo maneja
        return null;
      });

    } catch (permissionOrGeneralError) { 
      console.error('getFcmToken: Error general (permisos o similar):', permissionOrGeneralError);
      this.showToast('Error al configurar notificaciones.');
      // --- CAMBIO AQUÍ: Eliminamos la limpieza de listeners desde este catch externo ---
      // Porque si llegamos aquí por un error en requestPermissions, los handles serían null.
      // La promesa interna y su try/catch/finally se encargarán de sus propios listeners.
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