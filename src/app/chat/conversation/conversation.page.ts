import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectorRef, QueryList, ViewChildren, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController, IonContent, Platform, AlertController } from '@ionic/angular';
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

// Capacitor Plugins
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { VoiceRecorder, RecordingData, GenericResponse } from 'capacitor-voice-recorder';
import { Geolocation, Position } from '@capacitor/geolocation';

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
  type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'location';
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
  isPlayingAudio?: boolean;
  audioDuration?: number; 
  currentTime?: number; 
  durationFormatted?: string;
  currentTimeFormatted?: string;
}

@Component({
  selector: 'app-conversation',
  templateUrl: './conversation.page.html',
  styleUrls: ['./conversation.page.scss'],
  standalone: false
})
export class ConversationPage implements OnInit, OnDestroy {
  @ViewChild(IonContent) chatContent!: IonContent;
  @ViewChildren('audioPlayer') audioPlayers!: QueryList<ElementRef<HTMLAudioElement>>;

  chatId: string | null = null;
  messages: ChatMessage[] = [];
  newMessageText: string = '';
  
  isLoadingMessages = true;
  currentUserId: string | null = null;
  otherUserId: string | null = null;
  otherUserName: string | null = 'Chat';

  isRecording = false;
  private canRecordAudio = false;

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
    private platform: Platform,
    private alertController: AlertController,
    private cdr: ChangeDetectorRef
  ) {
    this.app = initializeApp(environment.firebaseConfig);
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app);
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
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
      if (this.platform.is('capacitor')) {
        this.checkAudioPermission(); 
      }
    } else {
      this.showToast('Error: No se pudo cargar la conversación.');
      this.router.navigate(['/chat/list']);
    }
  }
  
  async checkAudioPermission() {
    try {
      const permStatus = await VoiceRecorder.requestAudioRecordingPermission();
      this.canRecordAudio = permStatus.value;
      if (!permStatus.value) {
        console.warn('Permiso para grabar audio denegado inicialmente.');
      }
    } catch (e) {
      console.error("Error solicitando permiso de audio:", e);
      this.canRecordAudio = false;
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
          this.contactForCall = { uid: this.otherUserId, name: this.otherUserName };
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
          id: doc.id, senderId: data.senderId, receiverId: data.receiverId,
          text: data.text, type: data.type, fileUrl: data.fileUrl,
          fileName: data.fileName, location: data.location, timestamp: messageTimestampDate,
          isPlayingAudio: false, 
          audioDuration: 0,      
          currentTime: 0,        
          durationFormatted: '0:00', 
          currentTimeFormatted: '0:00' 
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
      senderId: this.currentUserId, receiverId: this.otherUserId,
      text: this.newMessageText.trim(), type: 'text' as const,
      timestamp: serverTimestamp()
    };
    try {
      const messagesRef = collection(this.db, `chats/${this.chatId}/messages`);
      await addDoc(messagesRef, messageData);
      const chatDocRef = doc(this.db, 'chats', this.chatId);
      await updateDoc(chatDocRef, {
        lastMessageText: messageData.text, lastMessageTimestamp: serverTimestamp(),
        lastMessageSenderId: this.currentUserId, updatedAt: serverTimestamp(),
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
      this.showToast('Datos de contacto incompletos para llamar.'); return;
    }
    const contactUserDocRef = doc(this.db, 'users', this.contactForCall.uid);
    try {
      const contactUserSnap = await getDoc(contactUserDocRef);
      const contactData = contactUserSnap.data() as User | undefined; 
      if (!contactUserSnap.exists() || !contactData?.token) {
        this.showToast(`${this.otherUserName} no puede recibir llamadas (sin token).`); return;
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
      if (!currentUser) { this.showToast('Error de autenticación.'); return; }
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
        error: (err) => { console.error("Error API llamada:", err); this.showToast('No se pudo iniciar la llamada.'); }
      });
    } catch (error) {
      console.error("Error preparando llamada:", error);
      this.showToast('Error al preparar la llamada.');
    }
  }

  async selectAndSendImage() {
    if (!this.chatId || !this.currentUserId || !this.otherUserId) {
      this.showToast('Error: Información de chat no disponible.'); return;
    }
    try {
      if (this.platform.is('capacitor')) {
        const permissions = await Camera.checkPermissions();
        if (permissions.camera === 'denied' || permissions.photos === 'denied') {
          const requestedPermissions = await Camera.requestPermissions();
          if (requestedPermissions.camera === 'denied' || requestedPermissions.photos === 'denied') {
            this.showToast('Permiso de cámara/galería denegado.'); return;
          }
        }
      }
      const image = await Camera.getPhoto({
        quality: 90, allowEditing: false, resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt 
      });
      if (image.dataUrl) {
        this.showToast('Subiendo imagen...', 4000);
        const blob = await this.dataUrlToBlob(image.dataUrl);
        const fileName = `chat_media/${this.chatId}/${new Date().getTime()}.${image.format}`;
        const { data: uploadData, error: uploadError } = await this.supabase.storage
          .from(this.bucketName).upload(fileName, blob, { 
            contentType: image.format === 'jpg' ? 'image/jpeg' : `image/${image.format}`, upsert: false 
          });
        if (uploadError) { console.error('Error Supabase img:', uploadError); throw uploadError; }
        if (uploadData && uploadData.path) {
          const { data: urlData } = this.supabase.storage.from(this.bucketName).getPublicUrl(uploadData.path);
          if (urlData && urlData.publicUrl) {
            await this.sendMediaMessage(urlData.publicUrl, 'image', `imagen.${image.format}`);
          } else { throw new Error('No se pudo obtener URL pública de imagen.'); }
        } else { throw new Error('No se recibió info de subida de Supabase para imagen.'); }
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

  async sendMediaMessage(
    fileUrlOrLocation: string | { latitude: number, longitude: number }, 
    type: 'image' | 'audio' | 'video' | 'file' | 'location', 
    originalFileName?: string
  ) {
    if (!this.chatId || !this.currentUserId || !this.otherUserId) {
      this.showToast('Error al enviar: datos de chat incompletos.'); return;
    }
    const messageData: any = { 
      senderId: this.currentUserId, receiverId: this.otherUserId,
      type: type, timestamp: serverTimestamp(),
    };
    let lastMessageTextPreview = '';
    if (type === 'location' && typeof fileUrlOrLocation !== 'string') {
      messageData.location = fileUrlOrLocation; 
      lastMessageTextPreview = '📍 Ubicación Compartida';
    } else if (typeof fileUrlOrLocation === 'string') {
      messageData.fileUrl = fileUrlOrLocation;
      messageData.fileName = originalFileName || `${type}_${new Date().getTime()}`;
      if (type === 'image') lastMessageTextPreview = '📷 Imagen';
      if (type === 'audio') lastMessageTextPreview = '🎤 Mensaje de voz';
      if (type === 'video') lastMessageTextPreview = '📹 Video';
      if (type === 'file' && originalFileName) lastMessageTextPreview = `📄 ${originalFileName}`;
      else if (type === 'file') lastMessageTextPreview = '📄 Archivo adjunto';
    } else {
      this.showToast('Error interno al preparar mensaje.'); return;
    }
    try {
      const messagesRef = collection(this.db, `chats/${this.chatId}/messages`);
      await addDoc(messagesRef, messageData);
      const chatDocRef = doc(this.db, 'chats', this.chatId);
      await updateDoc(chatDocRef, {
        lastMessageText: lastMessageTextPreview, lastMessageTimestamp: serverTimestamp(),
        lastMessageSenderId: this.currentUserId, updatedAt: serverTimestamp(),
      });
      this.scrollToBottom();
      if (type === 'location') {
        this.showToast('Ubicación enviada.');
      } else {
        this.showToast(type === 'image' ? 'Imagen enviada.' : `${type.charAt(0).toUpperCase() + type.slice(1)} enviado.`);
      }
    } catch (error) {
      console.error(`Error al enviar mensaje de ${type}:`, error);
      this.showToast(`No se pudo enviar el/la ${type}.`);
    }
  }

  openImage(imageUrl?: string) {
    if (imageUrl) {
      console.log('Abriendo imagen (simulado):', imageUrl);
      this.showToast('Visualizador de imagen no implementado.');
    }
  }
  
  async toggleRecording() {
    if (!this.platform.is('capacitor')) {
      this.showToast('Grabación de audio solo en app móvil.'); return;
    }
    if (!this.canRecordAudio) {
      const permResult = await VoiceRecorder.requestAudioRecordingPermission();
      if (!permResult.value) {
        const alert = await this.alertController.create({
          header: 'Permiso Requerido',
          message: 'Necesitamos permiso del micrófono. Habilítalo en los ajustes.',
          buttons: ['OK']
        });
        await alert.present(); return;
      }
      this.canRecordAudio = true;
    }
    if (this.isRecording) {
      this.showToast('Procesando audio...', 1500);
      try {
        const result: RecordingData = await VoiceRecorder.stopRecording();
        this.isRecording = false; this.cdr.detectChanges();
        if (result && result.value && result.value.recordDataBase64) {
          this.showToast('Grabación finalizada. Subiendo...', 4000);
          const base64Sound = result.value.recordDataBase64;
          const mimeType = result.value.mimeType || 'audio/aac';
          const fileExtension = mimeType.split('/').pop() || 'aac';
          const audioBlob = await this.base64ToBlob(`data:${mimeType};base64,${base64Sound}`, mimeType);
          const fileName = `chat_media/${this.chatId}/audio_${new Date().getTime()}.${fileExtension}`;
          const { data: uploadData, error: uploadError } = await this.supabase.storage
            .from(this.bucketName).upload(fileName, audioBlob, { contentType: mimeType, upsert: false });
          if (uploadError) { console.error("Error Supabase audio:", uploadError); throw uploadError; }
          if (uploadData && uploadData.path) {
            const { data: urlData } = this.supabase.storage.from(this.bucketName).getPublicUrl(uploadData.path);
            if (urlData && urlData.publicUrl) {
              await this.sendMediaMessage(urlData.publicUrl, 'audio', `mensaje_voz.${fileExtension}`);
            } else { throw new Error('No se pudo obtener URL pública del audio.'); }
          } else { throw new Error('No se recibió info de subida de Supabase para el audio.');}
        } else { this.showToast('No se pudo obtener la grabación.'); }
      } catch (error) { 
        console.error('Error deteniendo/procesando grabación:', error);
        this.showToast('Error al procesar el audio.');
        this.isRecording = false; this.cdr.detectChanges();
      }
    } else {
      try {
        await VoiceRecorder.startRecording();
        this.isRecording = true; this.cdr.detectChanges();
        this.showToast('Grabando...'); 
      } catch (error) { 
        console.error('Error iniciando grabación:', error);
        const permStatus = await VoiceRecorder.hasAudioRecordingPermission(); 
        if(!permStatus.value) {
            this.showToast('Permiso de micrófono no concedido.');
            this.canRecordAudio = false; 
        } else {
            this.showToast('No se pudo iniciar la grabación.');
        }
      }
    }
  }
  
  private async base64ToBlob(dataURI: string, contentType: string = ''): Promise<Blob> {
    const base64WithoutPrefix = dataURI.startsWith('data:') ? dataURI.split(',')[1] : dataURI;
    const byteString = atob(base64WithoutPrefix);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: contentType });
  }

  // --- === FUNCIONES PARA CONTROL DE AUDIO PERSONALIZADO (REPRODUCCIÓN) === ---
  getAudioElement(msgId?: string): HTMLAudioElement | undefined {
    if (!msgId) return undefined;
    const audioRef = this.audioPlayers.find(ref => ref.nativeElement.id === `audioPlayer_${msgId}`);
    return audioRef?.nativeElement;
  }

  toggleAudioPlayback(msg: ChatMessage) {
    const audioElement = this.getAudioElement(msg.id);
    if (!audioElement) {
      console.error('Elemento de audio no encontrado para el mensaje:', msg.id);
      return;
    }

    if (audioElement.paused || audioElement.ended) {
      this.audioPlayers.forEach(ref => {
        const otherAudio = ref.nativeElement;
        if (otherAudio !== audioElement && !otherAudio.paused) {
          otherAudio.pause();
          const otherMsgId = otherAudio.id.replace('audioPlayer_', '');
          const otherMsg = this.messages.find(m => m.id === otherMsgId);
          if (otherMsg) {
            otherMsg.isPlayingAudio = false;
          }
        }
      });
      audioElement.play().catch(e => console.error("Error al reproducir audio:", e));
      msg.isPlayingAudio = true;
    } else {
      audioElement.pause();
      msg.isPlayingAudio = false;
    }
    this.cdr.detectChanges(); 
  }

  setAudioDuration(msg: ChatMessage, duration: number) {
    if (msg && !isNaN(duration) && duration !== Infinity) {
      msg.audioDuration = duration;
      msg.durationFormatted = this.formatDuration(duration);
      if (!msg.currentTimeFormatted || msg.currentTime === 0) {
        msg.currentTimeFormatted = this.formatDuration(0);
      }
      this.cdr.detectChanges();
    }
  }

  updateAudioProgress(msg: ChatMessage, currentTime: number, duration: number) {
    if (msg && !isNaN(currentTime) && !isNaN(duration) && duration > 0) {
      msg.currentTime = currentTime;
      msg.currentTimeFormatted = this.formatDuration(currentTime);
      this.cdr.detectChanges();
    }
  }
  
  onAudioPlaybackEnd(msg: ChatMessage) {
    if (msg) {
      msg.isPlayingAudio = false;
      msg.currentTime = 0; 
      msg.currentTimeFormatted = this.formatDuration(0);
      this.cdr.detectChanges();
    }
    const audioElement = this.getAudioElement(msg.id);
    if (audioElement) {
      audioElement.currentTime = 0; 
    }
  }

  formatDuration(seconds: number): string {
    if (isNaN(seconds) || seconds === Infinity || seconds < 0) {
      return '0:00';
    }
    const minutes: number = Math.floor(seconds / 60);
    const remainingSeconds: number = Math.floor(seconds % 60);
    const formattedSeconds: string = remainingSeconds < 10 ? `0${remainingSeconds}` : `${remainingSeconds}`;
    return `${minutes}:${formattedSeconds}`;
  }
  // --- === FIN DE FUNCIONES PARA CONTROL DE AUDIO (REPRODUCCIÓN) === ---

  // --- === FUNCIONES PARA COMPARTIR UBICACIÓN === ---
  async shareCurrentLocation() {
    if (!this.platform.is('capacitor')) {
      this.showToast('Compartir ubicación solo disponible en la app móvil.');
      return;
    }

    try {
      let permissions = await Geolocation.checkPermissions();
      if (permissions.location !== 'granted' && permissions.coarseLocation !== 'granted') {
        permissions = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
      }

      if (permissions.location === 'granted' || permissions.coarseLocation === 'granted') {
        this.showToast('Obteniendo ubicación...');
        const position: Position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true, 
          timeout: 15000 
        });
        
        const locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        await this.sendMediaMessage(locationData, 'location');
      } else {
        this.showToast('Permiso de ubicación denegado.');
      }
    } catch (error: any) {
      console.error('Error al obtener o compartir ubicación:', error);
      if (error && error.message) {
          if (error.message.toLowerCase().includes('location services are not enabled')) {
            this.showToast('Servicios de ubicación desactivados. Por favor, actívalos.');
          } else if (error.message.toLowerCase().includes('permission was denied')){
            this.showToast('Permiso de ubicación denegado.');
          } else {
            this.showToast('No se pudo obtener la ubicación.');
          }
      } else {
        this.showToast('No se pudo obtener la ubicación (error desconocido).');
      }
    }
  }

  public getMapLink(latitude?: number, longitude?: number): string { 
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      return `https://maps.google.com/?q=${latitude},${longitude}&ll=${latitude},${longitude}&z=17`;
    }
    return '#'; 
  }
  // --- === FIN DE FUNCIONES PARA UBICACIÓN === ---

  scrollToBottom(duration: number = 300) {
    setTimeout(() => {
      if (this.chatContent) {
        this.chatContent.scrollToBottom(duration);
      }
    }, 100);
  }

  async showToast(message: string, duration: number = 3000) {
    const toast = await this.toastController.create({
      message, duration: duration, position: 'bottom'
    });
    toast.present();
  }

  ngOnDestroy() {
    if (this.messagesUnsubscribe) this.messagesUnsubscribe();
    if (this.chatDocUnsubscribe) this.chatDocUnsubscribe();
  }
}