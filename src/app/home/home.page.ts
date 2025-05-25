import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';

// --- IMPORTACIONES DIRECTAS DE FIREBASE ---
import { initializeApp } from 'firebase/app';
import { getAuth, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { environment } from 'src/environments/environment';
import { User } from 'src/app/core/models/user.model';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  standalone: false
})
export class HomePage {
  // --- PROPIEDADES DE LA CLASE ---
  userName: string | null = null;
  contacts: User[] = [];
  filteredContacts: User[] = [];
  isLoading = true;
  currentSearchTerm: string = ''; // <-- 1. AÑADIDA ESTA NUEVA PROPIEDAD

  // --- INICIALIZACIÓN DE FIREBASE ---
  private app = initializeApp(environment.firebaseConfig);
  private auth = getAuth(this.app);
  private db = getFirestore(this.app);

  // --- CONSTRUCTOR ---
  constructor(
    private router: Router,
    private toastController: ToastController
  ) {}

  // --- CICLO DE VIDA DE IONIC PARA AUTO-REFRESCO ---
  ionViewWillEnter() {
    console.log('HomePage se está mostrando. Refrescando datos...');
    this.isLoading = true; 
    const user = this.auth.currentUser;
    if (user) {
      this.fetchUserProfile(user.uid);
      this.fetchContacts(user.uid);
    } else {
      console.log('No hay usuario, redirigiendo a login.');
      this.isLoading = false;
      this.router.navigate(['/auth/login']);
    }
  }

  // --- MÉTODOS PARA OBTENER DATOS ---
  async fetchUserProfile(uid: string) {
    const userDocRef = doc(this.db, 'users', uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data() as User;
      this.userName = `${userData.name} ${userData.lastname}`;
    } else {
      this.userName = 'Usuario no encontrado';
    }
  }

  async fetchContacts(uid: string) {
    this.isLoading = true;
    try {
      const contactsColRef = collection(this.db, `users/${uid}/contacts`);
      const contactsSnapshot = await getDocs(contactsColRef);
      this.contacts = contactsSnapshot.docs.map(doc => doc.data() as User);
      this.handleSearch({ target: { value: this.currentSearchTerm } }); // Usamos el término actual o vacío
    } catch (error) {
      console.error("Error al traer los contactos:", error);
      this.contacts = [];
      this.handleSearch({ target: { value: '' } }); 
    } finally {
      this.isLoading = false;
    }
  }

  // --- FUNCIÓN PARA MANEJAR LA BÚSQUEDA ---
  handleSearch(event: any) {
    // <-- 2. ACTUALIZAMOS currentSearchTerm AQUÍ
    this.currentSearchTerm = event?.target?.value?.toLowerCase() || ''; 

    if (!this.currentSearchTerm) {
      this.filteredContacts = [...this.contacts];
      return;
    }
    this.filteredContacts = this.contacts.filter(contact => {
      const nameMatch = contact.name?.toLowerCase().includes(this.currentSearchTerm);
      const lastnameMatch = contact.lastname?.toLowerCase().includes(this.currentSearchTerm);
      return nameMatch || lastnameMatch;
    });
  }

  // --- MÉTODOS PARA ACCIONES (Llamados desde el HTML) ---
  goToAddContact() {
    this.router.navigate(['/contacts/add-contact']);
  }

  goToEditContact(contactId: string) {
    this.router.navigate(['/contacts/edit-contact', contactId]);
  }

  async deleteContact(contactId: string) {
    if (!this.auth.currentUser) return;
    try {
      const contactDocRef = doc(this.db, `users/${this.auth.currentUser.uid}/contacts/${contactId}`);
      await deleteDoc(contactDocRef);
      this.contacts = this.contacts.filter(contact => contact.uid !== contactId);
      
      // <-- 3. LLAMAMOS A handleSearch PARA ACTUALIZAR LA VISTA
      this.handleSearch({ target: { value: this.currentSearchTerm } }); 
      
      this.showToast('Contacto eliminado con éxito.');
    } catch (error) {
      console.error("Error al eliminar contacto:", error);
      this.showToast('Error al eliminar el contacto.');
    }
  }

  makeCall(contact: User) {
    console.log(`Llamar a: ${contact.name} (ID: ${contact.uid})`);
    // La lógica de la llamada vendrá aquí en el siguiente paso.
  }

  // --- MÉTODO AUXILIAR PARA MOSTRAR MENSAJES ---
  async showToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
    });
    toast.present();
  }
}