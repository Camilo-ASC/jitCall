import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';

// --- IMPORTACIONES DIRECTAS DE FIREBASE ---
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, doc, setDoc, limit } from 'firebase/firestore';
import { environment } from 'src/environments/environment';
import { User } from 'src/app/core/models/user.model';

@Component({
  selector: 'app-add-contact',
  templateUrl: './add-contact.page.html',
  standalone: false
})
export class AddContactPage {
  contactForm: FormGroup;
  loading = false;
  currentUser: FirebaseUser | null = null;

  // --- INICIALIZACIÓN DIRECTA DE FIREBASE ---
  private app = initializeApp(environment.firebaseConfig);
  private auth = getAuth(this.app);
  private db = getFirestore(this.app);

  constructor(
    private fb: FormBuilder,
    private toastController: ToastController,
    private router: Router
  ) {
    this.contactForm = this.fb.group({
      phone: ['', [Validators.required, Validators.pattern('^[0-9]+$')]]
    });

    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.currentUser = user;
      } else {
        // Si por alguna razón el usuario pierde la sesión, lo mandamos al login
        this.router.navigate(['/auth/login']);
      }
    });
  }

  async searchAndAddContact() {
    if (this.contactForm.invalid || !this.currentUser) return;

    this.loading = true;
    const phoneToSearch = this.contactForm.value.phone;

    try {
      const usersRef = collection(this.db, 'users');
      const q = query(usersRef, where("phone", "==", phoneToSearch), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        this.showToast('No se encontró ningún usuario con ese número de teléfono.');
        return;
      }

      const foundUserDoc = querySnapshot.docs[0];
      const foundUserData = foundUserDoc.data() as User;
      const foundUserUid = foundUserDoc.id;

      if (foundUserUid === this.currentUser.uid) {
        this.showToast('No puedes agregarte a ti mismo como contacto.');
        return;
      }

      const newContactDocRef = doc(this.db, `users/${this.currentUser.uid}/contacts/${foundUserUid}`);
      await setDoc(newContactDocRef, {
        uid: foundUserUid,
        name: foundUserData.name,
        lastname: foundUserData.lastname,
        phone: foundUserData.phone,
        email: foundUserData.email
      });
      
      this.showToast('¡Contacto agregado con éxito!');
      this.router.navigate(['/home']);

    } catch (error) {
      console.error("Error al agregar contacto:", error);
      this.showToast('Ocurrió un error inesperado.');
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