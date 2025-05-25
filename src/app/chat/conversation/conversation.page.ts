import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core'; // Quité ElementRef por ahora
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController, IonContent } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { v4 as uuidv4 } from 'uuid';

// Firebase
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, User as FirebaseUser } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc,
  updateDoc,
  serverTimestamp,
  Timestamp, // Importante para el tipado
  Unsubscribe 
} from 'firebase/firestore';
import { environment } from 'src/environments/environment';

// Modelo User (asegúrate que la ruta sea correcta y que User tenga 'token?: string;')
import { User } from 'src/app/core/models/user.model'; 

// --- INTERFACES PARA EL CHAT ---

// Interfaz para el documento de chat como se guarda en Firestore (info general del chat)
interface ChatData {
  participants: string[];
  participantInfo: {
    [key: string]: { name: string; photoUrl?: string; };
  };
  // ... otros campos del documento de chat si los necesitas
}

// Interfaz para el documento de MENSAJE como se guarda en Firestore
interface MessageDocumentData {
  senderId: string;
  receiverId: string;
  text?: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'location';
  fileUrl?: string;
  fileName?: string;
  location?: { latitude: number; longitude: number };
  timestamp: Timestamp; // En Firestore, los timestamps son de tipo Timestamp
}

// Interfaz para los MENSAJES que usamos en la LÓGICA de la PÁGINA y en el TEMPLATE
export interface ChatMessage {
  id?: string;
  senderId: string;
  receiverId: string;
  text?: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'location';
  fileUrl?: string;
  fileName?: string;
  location?: { latitude: number; longitude: number };
  timestamp?: Date; // Para el template, es mejor usar el objeto Date de JavaScript
}


@Component({
  selector: 'app-conversation',
  templateUrl: './conversation.page.html',
  styleUrls: ['./conversation.page.scss'],
  standalone: false
})
export class ConversationPage implements OnInit, OnDestroy {
  @ViewChild(IonContent) chatContent!: IonContent;

  chatId: string | null = null;
  messages: ChatMessage[] = [];
  newMessageText: string = '';
  
  isLoadingMessages = true;
  currentUserId: string | null = null;
  otherUserId: string | null = null; // Corregido: string | null
  otherUserName: string | null = 'Chat';

  private app: FirebaseApp;
  private auth = getAuth(); 
  private db = getFirestore();

  private messagesUnsubscribe: Unsubscribe | null = null;
  private chatDocUnsubscribe: Unsubscribe | null = null;

  private contactForCall: Partial<User> | null = null; 

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private toastController: ToastController,
    private http: HttpClient
  ) {
    this.app = initializeApp(environment.firebaseConfig);
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app);
  }

  ngOnInit() {
    this.chatId = this.route.snapshot.paramMap.get('chatId');
    const user = this.auth.currentUser;

    if (user) {
      this.currentUserId = user.uid;
    } else {
      this.router.navigate(['/auth/login']);
      return;
    }

    if (this.chatId) {
      this.loadChatInfo();
      this.loadMessages();
    } else {
      this.showToast('Error: No se pudo cargar la conversación.');
      this.router.navigate(['/chat/list']);
    }
  }

  async loadChatInfo() {
    if (!this.chatId || !this.currentUserId) return;

    const chatDocRef = doc(this.db, 'chats', this.chatId);
    this.chatDocUnsubscribe = onSnapshot(chatDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const chatData = docSnap.data() as ChatData; // Le decimos a TS la forma de chatData
        // Corregimos la asignación de otherUserId
        this.otherUserId = chatData.participants.find(uid => uid !== this.currentUserId) || null; 
        
        if (this.otherUserId && chatData.participantInfo && chatData.participantInfo[this.otherUserId]) {
          this.otherUserName = chatData.participantInfo[this.otherUserId].name;
          this.contactForCall = { 
            uid: this.otherUserId, 
            name: this.otherUserName,
          };
        } else {
          this.otherUserName = 'Desconocido';
        }
      } else {
        this.router.navigate(['/chat/list']);
      }
    });
  }

  loadMessages() {
    if (!this.chatId) return;
    this.isLoadingMessages = true;

    const messagesRef = collection(this.db, `chats/${this.chatId}/messages`);
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    this.messagesUnsubscribe = onSnapshot(q, (querySnapshot) => {
      this.messages = querySnapshot.docs.map(doc => {
        const data = doc.data() as MessageDocumentData; // Le decimos a TS la forma de data
        
        let messageTimestampDate: Date | undefined = undefined;
        // Aseguramos que data.timestamp exista y sea un objeto Timestamp de Firebase
        if (data.timestamp && typeof data.timestamp.toDate === 'function') {
            messageTimestampDate = data.timestamp.toDate();
        }

        return {
          id: doc.id,
          senderId: data.senderId,
          receiverId: data.receiverId,
          text: data.text,
          type: data.type,
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          location: data.location,
          timestamp: messageTimestampDate // Usamos la fecha convertida
        } as ChatMessage; // Aseguramos que el objeto devuelto cumpla con ChatMessage
      });
      this.isLoadingMessages = false;
      this.scrollToBottom();
    });
  }

  async sendMessage() {
    if (!this.newMessageText || this.newMessageText.trim() === '' || !this.chatId || !this.currentUserId || !this.otherUserId) {
      return;
    }

    const messageData = { // No necesita Omit si los campos coinciden o son opcionales
      senderId: this.currentUserId,
      receiverId: this.otherUserId,
      text: this.newMessageText.trim(),
      type: 'text' as const, // Aseguramos el tipo literal
      timestamp: serverTimestamp()
    };

    try {
      const messagesRef = collection(this.db, `chats/${this.chatId}/messages`);
      await addDoc(messagesRef, messageData);

      const chatDocRef = doc(this.db, 'chats', this.chatId);
      await updateDoc(chatDocRef, {
        lastMessageText: messageData.text,
        lastMessageTimestamp: serverTimestamp(), // Usamos serverTimestamp para consistencia
        lastMessageSenderId: this.currentUserId,
        updatedAt: serverTimestamp(),
      });

      this.newMessageText = '';
      this.scrollToBottom();
    } catch (error) {
      this.showToast('No se pudo enviar el mensaje.');
    }
  }

  // Corregimos el tipo del evento
  sendMessageOnEnter(event: Event) {
    const keyboardEvent = event as KeyboardEvent; // Hacemos un type assertion
    if (keyboardEvent.key === 'Enter' && !keyboardEvent.shiftKey) {
      event.preventDefault(); 
      this.sendMessage();
    }
  }

  async triggerCall() {
    if (!this.contactForCall || !this.contactForCall.uid || !this.otherUserName) {
      this.showToast('Datos de contacto incompletos para llamar.');
      return;
    }
    
    const contactUserDocRef = doc(this.db, 'users', this.contactForCall.uid);
    try {
      const contactUserSnap = await getDoc(contactUserDocRef);
      // Usamos 'as User' para decirle a TS la forma de los datos del usuario
      const contactData = contactUserSnap.data() as User | undefined; 

      if (!contactUserSnap.exists() || !contactData?.token) { // Verificamos contactData.token
        this.showToast(`${this.otherUserName} no puede recibir llamadas (sin token).`);
        return;
      }
      const contactTokenFCM = contactData.token;

      const currentUser = this.auth.currentUser;
      const currentUserNameForCall = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Alguien';

      if (!currentUser) {
        this.showToast('Error de autenticación.');
        return;
      }

      const meetingId = uuidv4();
      const notificationPayload = {
        token: contactTokenFCM,
        notification: { title: "Llamada entrante", body: `${currentUserNameForCall} te está llamando` },
        android: {
          priority: "high",
          data: {
            userId: this.contactForCall.uid, meetingId, type: "incoming_call",
            name: currentUserNameForCall, userFrom: currentUser.uid
          }
        }
      };
      const apiUrl = 'https://ravishing-courtesy-production.up.railway.app/notifications';
      
      this.showToast(`Llamando a ${this.otherUserName}...`);
      this.http.post(apiUrl, notificationPayload).subscribe({
        next: () => this.router.navigate(['/call/jitsi-call', meetingId]),
        error: (err) => this.showToast('No se pudo iniciar la llamada.')
      });

    } catch (error) {
      this.showToast('Error al preparar la llamada.');
    }
  }

  scrollToBottom(duration: number = 300) {
    setTimeout(() => {
      if (this.chatContent) {
        this.chatContent.scrollToBottom(duration);
      }
    }, 100);
  }

  async showToast(message: string) {
    const toast = await this.toastController.create({
      message, duration: 3000, position: 'bottom'
    });
    toast.present();
  }

  ngOnDestroy() {
    if (this.messagesUnsubscribe) this.messagesUnsubscribe();
    if (this.chatDocUnsubscribe) this.chatDocUnsubscribe();
  }
}