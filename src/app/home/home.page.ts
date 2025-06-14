import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { v4 as uuidv4 } from 'uuid';

// --- IMPORTACIONES DIRECTAS DE FIREBASE ---
import { initializeApp } from 'firebase/app';
import { getAuth, User as FirebaseUser } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  collection, 
  getDocs, 
  deleteDoc,
  setDoc,             // Asegúrate de que setDoc esté aquí
  serverTimestamp     // Asegúrate de que serverTimestamp esté aquí
} from 'firebase/firestore';
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
  currentSearchTerm: string = '';

  // --- INICIALIZACIÓN DE FIREBASE ---
  private app = initializeApp(environment.firebaseConfig);
  private auth = getAuth(this.app);
  private db = getFirestore(this.app);

  // --- CONSTRUCTOR ---
  constructor(
    private router: Router,
    private toastController: ToastController,
    private http: HttpClient
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
      this.handleSearch({ target: { value: this.currentSearchTerm } }); 
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
      this.handleSearch({ target: { value: this.currentSearchTerm } }); 
      this.showToast('Contacto eliminado con éxito.');
    } catch (error) {
      console.error("Error al eliminar contacto:", error);
      this.showToast('Error al eliminar el contacto.');
    }
  }

  makeCall(contact: User) {
    if (!this.auth.currentUser || !this.userName) {
      this.showToast('Error de autenticación. Por favor, reinicia la app.');
      return;
    }
    if (!contact.token) {
      this.showToast(`${contact.name} no puede recibir llamadas (no tiene token FCM).`);
      return;
    }
    const meetingId = uuidv4();
    const currentUser = this.auth.currentUser;
    const notificationPayload = {
      token: contact.token,
      notification: {
        title: "Llamada entrante",
        body: `${this.userName} te está llamando`
      },
      android: {
        priority: "high",
        data: {
          userId: contact.uid, 
          meetingId: meetingId,
          type: "incoming_call",
          name: this.userName,
          userFrom: currentUser.uid
        }
      }
    };
    const apiUrl = 'https://ravishing-courtesy-production.up.railway.app/notifications';
    this.showToast(`Llamando a ${contact.name}...`);
    this.http.post(apiUrl, notificationPayload).subscribe({
      next: () => {
        console.log('Notificación de llamada enviada con éxito a la API.');
        this.router.navigate(['/call/jitsi-call', meetingId]);
      },
      error: (err) => {
        console.error('Error al enviar notificación de llamada a la API:', err);
        this.showToast('No se pudo iniciar la llamada (error de API).');
      }
    });
  }

  // --- === NUEVA FUNCIÓN PARA INICIAR O ABRIR UN CHAT === ---
  async startOrOpenChat(contactToChatWith: User) {
    if (!this.auth.currentUser || !this.userName) {
      this.showToast('Debes iniciar sesión para chatear.');
      return;
    }
    if (!contactToChatWith || !contactToChatWith.uid) {
      this.showToast('No se pudo identificar al contacto.');
      return;
    }

    const currentUserUid = this.auth.currentUser.uid;
    const contactUid = contactToChatWith.uid;

    const ids = [currentUserUid, contactUid].sort();
    const chatId = ids.join('_');

    const chatDocRef = doc(this.db, 'chats', chatId);
    this.isLoading = true; 
    try {
      const chatDocSnap = await getDoc(chatDocRef);

      if (!chatDocSnap.exists()) {
        console.log(`Creando nuevo chat con ID: ${chatId}`);
        const currentUserDisplayName = this.userName; // Ya tenemos el nombre completo
        const contactDisplayName = `${contactToChatWith.name} ${contactToChatWith.lastname}`;

        await setDoc(chatDocRef, {
          participants: ids,
          participantInfo: {
            [currentUserUid]: { name: currentUserDisplayName },
            [contactUid]: { name: contactDisplayName }
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessageText: '',
          lastMessageTimestamp: serverTimestamp(),
          lastMessageSenderId: '',
          unreadCount: {
            [currentUserUid]: 0,
            [contactUid]: 0
          }
        });
        this.showToast(`Chat iniciado con ${contactDisplayName}`);
      } else {
        console.log(`Abriendo chat existente con ID: ${chatId}`);
      }
      this.router.navigate(['/chat/conversation', chatId]);
    } catch (error) {
      console.error("Error al iniciar o abrir el chat:", error);
      this.showToast('No se pudo iniciar la conversación.');
    } finally {
      this.isLoading = false;
    }
  }
  // --- === FIN DE LA NUEVA FUNCIÓN === ---

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