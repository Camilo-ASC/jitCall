import { Component } from '@angular/core';
import { Router } from '@angular/router'; 
import { initializeApp } from 'firebase/app';
import { getAuth, User as FirebaseUser } from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    orderBy, 
    onSnapshot, 
    Timestamp,
    Unsubscribe 
} from 'firebase/firestore';
import { environment } from 'src/environments/environment';


import { User } from 'src/app/core/models/user.model';

// Interfaz para el documento de chat como se guarda en Firestore
interface ChatDocumentData {
  participants: string[];
  participantInfo: {
    [key: string]: { name: string; photoUrl?: string; };
  };
  lastMessageText?: string;
  lastMessageTimestamp?: Timestamp;
  unreadCount?: { [key: string]: number; };
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Interfaz para representar un chat en la lista
export interface ChatListItem {
  id: string;
  otherParticipantName: string;
  otherParticipantPhotoUrl?: string;
  lastMessageText?: string;
  lastMessageTimestamp?: Date;
  unreadCount?: number;
  participants: string[];
}

@Component({
  selector: 'app-chat-list',
  templateUrl: './chat-list.page.html',
  standalone: false
})
export class ChatListPage {
  activeChats: ChatListItem[] = [];
  isLoading = true;
  currentUser: FirebaseUser | null = null;

  private app = initializeApp(environment.firebaseConfig);
  private auth = getAuth(this.app);
  private db = getFirestore(this.app);

  private unsubscribeChats: Unsubscribe | null = null;

  constructor(
    public router: Router // <-- CAMBIO AQUÍ: de 'private' a 'public'
  ) {}

  ionViewWillEnter() {
    console.log('ChatListPage: ionViewWillEnter');
    this.currentUser = this.auth.currentUser;
    if (this.currentUser) {
      this.loadActiveChats(this.currentUser.uid);
    } else {
      console.warn('ChatListPage: Usuario no autenticado, redirigiendo a login.');
      this.isLoading = false;
      this.router.navigate(['/auth/login']);
    }
  }

  loadActiveChats(currentUserId: string) {
    this.isLoading = true;
    const chatsRef = collection(this.db, 'chats');
    const q = query(
      chatsRef,
      where('participants', 'array-contains', currentUserId),
      orderBy('lastMessageTimestamp', 'desc')
    );

    if (this.unsubscribeChats) {
      this.unsubscribeChats();
    }

    this.unsubscribeChats = onSnapshot(q, (querySnapshot) => {
      this.activeChats = querySnapshot.docs.map(doc => {
        const data = doc.data() as ChatDocumentData; 
        
        const otherParticipantUid = data.participants.find((uid: string) => uid !== currentUserId);
        const otherParticipantInfo = data.participantInfo && otherParticipantUid 
                                      ? data.participantInfo[otherParticipantUid] 
                                      : null;
        
        let lastMessageTimestampDate: Date | undefined = undefined;
        if (data.lastMessageTimestamp && typeof data.lastMessageTimestamp.toDate === 'function') {
            lastMessageTimestampDate = data.lastMessageTimestamp.toDate();
        }

        return {
          id: doc.id,
          otherParticipantName: otherParticipantInfo ? otherParticipantInfo.name : 'Desconocido',
          otherParticipantPhotoUrl: otherParticipantInfo ? otherParticipantInfo.photoUrl : undefined,
          lastMessageText: data.lastMessageText || '',
          lastMessageTimestamp: lastMessageTimestampDate,
          unreadCount: data.unreadCount && data.unreadCount[currentUserId] 
                        ? data.unreadCount[currentUserId] 
                        : 0,
          participants: data.participants 
        } as ChatListItem;
      });
      this.isLoading = false;
      console.log('ChatListPage: Chats activos cargados/actualizados:', this.activeChats);
    }, (error) => {
      console.error("ChatListPage: Error al cargar los chats activos:", error);
      this.isLoading = false;
    });
  }

  openChat(chatItem: ChatListItem) {
    if (!this.currentUser) return;
    const otherUserId = chatItem.participants.find(uid => uid !== this.currentUser!.uid);
    if (!otherUserId) {
      console.error("ChatListPage: No se pudo determinar el otro participante.");
      return;
    }
    this.router.navigate(['/chat/conversation', chatItem.id]);
    console.log('ChatListPage: Abriendo chat:', chatItem.id);
  }

  ionViewDidLeave() {
    if (this.unsubscribeChats) {
      this.unsubscribeChats();
      this.unsubscribeChats = null; 
      console.log('ChatListPage: Listener de chats detenido al salir de la vista.');
    }
  }
}