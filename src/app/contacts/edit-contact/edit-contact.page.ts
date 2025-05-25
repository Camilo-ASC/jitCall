import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';

// Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { environment } from 'src/environments/environment';
import { User } from 'src/app/core/models/user.model';

@Component({
  selector: 'app-edit-contact',
  templateUrl: './edit-contact.page.html',
  standalone: false
})
export class EditContactPage implements OnInit {
  editContactForm: FormGroup;
  contactId: string | null = null;
  currentUserUid: string | null = null;
  isLoading = true;
  isSaving = false;
  initialContactData: Partial<User> = {}; // Para mostrar datos no editables

  private app = initializeApp(environment.firebaseConfig);
  private auth = getAuth(this.app);
  private db = getFirestore(this.app);

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute, // Para leer el ID de la URL
    private router: Router,
    private toastController: ToastController
  ) {
    this.editContactForm = this.fb.group({
      name: ['', Validators.required],
      lastname: ['', Validators.required]
    });
  }

  ngOnInit() {
    // 1. Obtenemos el ID del contacto desde los parámetros de la ruta
    this.contactId = this.route.snapshot.paramMap.get('id');
    
    // 2. Verificamos el usuario actual
    const user = this.auth.currentUser;
    if (user) {
      this.currentUserUid = user.uid;
      if (this.contactId) {
        this.loadContactData();
      } else {
        this.showToast('Error: No se especificó un contacto para editar.');
        this.isLoading = false;
        this.router.navigate(['/home']);
      }
    } else {
      this.showToast('Error: Sesión no válida.');
      this.isLoading = false;
      this.router.navigate(['/auth/login']);
    }
  }

  async loadContactData() {
    if (!this.currentUserUid || !this.contactId) return;
    this.isLoading = true;
    
    const contactDocRef = doc(this.db, `users/${this.currentUserUid}/contacts/${this.contactId}`);
    try {
      const docSnap = await getDoc(contactDocRef);
      if (docSnap.exists()) {
        const contactData = docSnap.data() as User;
        this.initialContactData = contactData; // Guardamos datos originales
        this.editContactForm.patchValue({
          name: contactData.name,
          lastname: contactData.lastname
        });
      } else {
        this.showToast('Error: Contacto no encontrado.');
        this.router.navigate(['/home']);
      }
    } catch (error) {
      console.error("Error cargando datos del contacto:", error);
      this.showToast('Error al cargar el contacto.');
    } finally {
      this.isLoading = false;
    }
  }

  async saveChanges() {
    if (this.editContactForm.invalid || !this.currentUserUid || !this.contactId) {
      return;
    }
    this.isSaving = true;

    const updatedData = {
      name: this.editContactForm.value.name,
      lastname: this.editContactForm.value.lastname
    };

    const contactDocRef = doc(this.db, `users/${this.currentUserUid}/contacts/${this.contactId}`);
    try {
      await updateDoc(contactDocRef, updatedData);
      this.showToast('Contacto actualizado con éxito.');
      this.router.navigate(['/home']);
    } catch (error) {
      console.error("Error actualizando contacto:", error);
      this.showToast('Error al guardar los cambios.');
    } finally {
      this.isSaving = false;
    }
  }

  async showToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom'
    });
    toast.present();
  }
}