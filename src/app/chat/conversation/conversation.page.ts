import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController, IonContent, Platform } from '@ionic/angular'; // Platform AÑADIDO
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
  Timestamp,
  Unsubscribe 
} from 'firebase/firestore';
import { environment } from 'src/environments/environment';

// Supabase
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Capacitor Camera
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera'; // <-- IMPORTACIÓN PARA CAMERA

// Modelo User
import { User } from 'src/app/core/models/user.model'; 

// --- INTERFACES PARA EL CHAT ---
interface ChatData {
  participants: string[];
  participantInfo: {
    [key: string]: { name: string; photoUrl?: string; };
  };
}

interface MessageDocumentData {
  senderId: string;
  receiverId: string;
  text?: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'location'; // Tipos de mensaje
  fileUrl?: string;
  fileName?: string;
  location?: { latitude: number; longitude: number };
  timestamp: Timestamp;
}

export interface ChatMessage {
  id?: string;
  senderId: string;
  receiverId: string;
  text?: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'location';
  fileUrl?: string;
  fileName?: string;
  location?: { latitude: number; longitude: number };
  timestamp?: Date;
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
  otherUserId: string | null = null;
  otherUserName: string | null = 'Chat';

  private app: FirebaseApp;
  private auth = getAuth(); 
  private db = getFirestore();

  public supabase: SupabaseClient;
  public bucketName = 'gallerycloud1';

  private messagesUnsubscribe: Unsubscribe | null = null;
  private chatDocUnsubscribe: Unsubscribe | null = null;
  private contactForCall: Partial<User> | null = null; 

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private toastController: ToastController,
    private http: HttpClient,
    private platform: Platform // Inyectamos Platform
  ) {
    this.app = initializeApp(environment.firebaseConfig);
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app);
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
    console.log('Supabase client initialized using environment variables');
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
        const chatData = docSnap.data() as ChatData;
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
        this.showToast('Conversación no encontrada.');
        this.router.navigate(['/chat/list']);
      }
    }, error => {
      console.error("Error cargando info del chat:", error);
      this.showToast('Error al cargar datos de la conversación.');
    });
  }

  loadMessages() {
    if (!this.chatId) return;
    this.isLoadingMessages = true;

    const messagesRef = collection(this.db, `chats/${this.chatId}/messages`);
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    this.messagesUnsubscribe = onSnapshot(q, (querySnapshot) => {
      this.messages = querySnapshot.docs.map(doc => {
        const data = doc.data() as MessageDocumentData;
        let messageTimestampDate: Date | undefined = undefined;
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
          timestamp: messageTimestampDate
        } as ChatMessage;
      });
      this.isLoadingMessages = false;
      this.scrollToBottom();
    }, error => {
      console.error("Error cargando mensajes:", error);
      this.isLoadingMessages = false;
      this.showToast("Error al cargar los mensajes.");
    });
  }

  async sendMessage() {
    if (!this.newMessageText || this.newMessageText.trim() === '' || !this.chatId || !this.currentUserId || !this.otherUserId) {
      return;
    }
    const messageData = {
      senderId: this.currentUserId,
      receiverId: this.otherUserId,
      text: this.newMessageText.trim(),
      type: 'text' as const,
      timestamp: serverTimestamp()
    };
    try {
      const messagesRef = collection(this.db, `chats/${this.chatId}/messages`);
      await addDoc(messagesRef, messageData);

      const chatDocRef = doc(this.db, 'chats', this.chatId);
      await updateDoc(chatDocRef, {
        lastMessageText: messageData.text,
        lastMessageTimestamp: serverTimestamp(),
        lastMessageSenderId: this.currentUserId,
        updatedAt: serverTimestamp(),
      });
      this.newMessageText = '';
      this.scrollToBottom();
    } catch (error) {
      console.error("Error al enviar mensaje:", error);
      this.showToast('No se pudo enviar el mensaje.');
    }
  }

  sendMessageOnEnter(event: Event) {
    const keyboardEvent = event as KeyboardEvent;
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
      const contactData = contactUserSnap.data() as User | undefined; 
      if (!contactUserSnap.exists() || !contactData?.token) {
        this.showToast(`${this.otherUserName} no puede recibir llamadas (sin token).`);
        return;
      }
      const contactTokenFCM = contactData.token;
      const currentUser = this.auth.currentUser;
      let currentUserNameForCall = 'Alguien';
      if (currentUser) {
        const currentUserProfileSnap = await getDoc(doc(this.db, 'users', currentUser.uid));
        if (currentUserProfileSnap.exists()) {
            const currentUserData = currentUserProfileSnap.data() as User;
            currentUserNameForCall = `${currentUserData.name} ${currentUserData.lastname}`;
        } else {
            currentUserNameForCall = currentUser.email?.split('@')[0] || 'Alguien';
        }
      }
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
        error: (err) => {
          console.error("Error API llamada:", err);
          this.showToast('No se pudo iniciar la llamada.');
        }
      });
    } catch (error) {
      console.error("Error preparando llamada:", error);
      this.showToast('Error al preparar la llamada.');
    }
  }

  // --- === NUEVAS FUNCIONES PARA ENVIAR IMÁGENES === ---
  async selectAndSendImage() {
    if (!this.chatId || !this.currentUserId || !this.otherUserId) {
      this.showToast('Error: Información de chat no disponible.');
      return;
    }

    try {
      if (this.platform.is('capacitor')) {
        const permissions = await Camera.checkPermissions();
        if (permissions.camera === 'denied' || permissions.photos === 'denied') {
          const requestedPermissions = await Camera.requestPermissions();
          if (requestedPermissions.camera === 'denied' || requestedPermissions.photos === 'denied') {
            this.showToast('Permiso de cámara/galería denegado.');
            return;
          }
        }
      }

      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt 
      });

      if (image.dataUrl) {
        this.showToast('Subiendo imagen...');

        const blob = await this.dataUrlToBlob(image.dataUrl);
        const fileName = `chat_media/${this.chatId}/${new Date().getTime()}.${image.format}`;
        
        const { data: uploadData, error: uploadError } = await this.supabase.storage
          .from(this.bucketName)
          .upload(fileName, blob, {
            contentType: image.format === 'jpg' ? 'image/jpeg' : `image/${image.format}`,
            upsert: false 
          });

        if (uploadError) {
          console.error('Error al subir a Supabase:', uploadError);
          throw uploadError;
        }

        if (uploadData && uploadData.path) {
          const { data: urlData } = this.supabase.storage
            .from(this.bucketName)
            .getPublicUrl(uploadData.path);

          if (urlData && urlData.publicUrl) {
            await this.sendMediaMessage(urlData.publicUrl, 'image', `imagen.${image.format}`);
          } else {
            throw new Error('No se pudo obtener la URL pública de la imagen.');
          }
        } else {
          throw new Error('No se recibió info de subida de Supabase.');
        }
      }
    } catch (error: any) {
      console.error('Error en selectAndSendImage:', error);
      if (error && error.message) {
        if (error.message.toLowerCase().includes('user cancelled') || error.message.toLowerCase().includes('canceled')) {
          console.log('Selección de imagen cancelada.');
        } else if (error.message.toLowerCase().includes('permission')) {
          this.showToast('Permiso de cámara/galería fue denegado.');
        } else {
          this.showToast('Error al procesar la imagen.');
        }
      } else {
        this.showToast('Error desconocido al procesar la imagen.');
      }
    }
  }

  private async dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return blob;
  }

  async sendMediaMessage(fileUrl: string, type: 'image' | 'audio' | 'video' | 'file', originalFileName?: string) {
    if (!this.chatId || !this.currentUserId || !this.otherUserId) {
      this.showToast('Error al enviar: datos de chat incompletos.');
      return;
    }
    const messageData = {
      senderId: this.currentUserId,
      receiverId: this.otherUserId,
      type: type,
      fileUrl: fileUrl,
      fileName: originalFileName || `${type}_${new Date().getTime()}`,
      timestamp: serverTimestamp(),
    };
    try {
      const messagesRef = collection(this.db, `chats/${this.chatId}/messages`);
      await addDoc(messagesRef, messageData);
      const chatDocRef = doc(this.db, 'chats', this.chatId);
      let lastMessageTextPreview = '📷 Imagen';
      if (type === 'audio') lastMessageTextPreview = '🎤 Mensaje de voz';
      if (type === 'video') lastMessageTextPreview = '📹 Video';
      if (type === 'file' && originalFileName) lastMessageTextPreview = `📄 ${originalFileName}`;
      else if (type === 'file') lastMessageTextPreview = '📄 Archivo adjunto';

      await updateDoc(chatDocRef, {
        lastMessageText: lastMessageTextPreview,
        lastMessageTimestamp: serverTimestamp(),
        lastMessageSenderId: this.currentUserId,
        updatedAt: serverTimestamp(),
      });
      this.scrollToBottom();
      this.showToast(type === 'image' ? 'Imagen enviada.' : `${type.charAt(0).toUpperCase() + type.slice(1)} enviado.`);
    } catch (error) {
      console.error(`Error al enviar mensaje de ${type}:`, error);
      this.showToast(`No se pudo enviar el/la ${type}.`);
    }
  }

  openImage(imageUrl?: string) {
    if (imageUrl) {
      console.log('Abriendo imagen (simulado):', imageUrl);
      this.showToast('Visualizador de imagen no implementado.');
      // Considerar usar un Modal de Ionic para mostrar la imagen aquí
    }
  }
  // --- === FIN DE NUEVAS FUNCIONES PARA IMÁGENES === ---

  scrollToBottom(duration: number = 300) { /* ... (sin cambios) ... */ }
  async showToast(message: string) { /* ... (sin cambios) ... */ }
  ngOnDestroy() { /* ... (sin cambios) ... */ }
}