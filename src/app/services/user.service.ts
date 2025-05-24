import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { User } from '../core/models/user.model';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  constructor(private firestore: AngularFirestore) {} // Inyectamos el servicio de compatibilidad

  createUser(uid: string, userData: any): Promise<void> {
    return this.firestore.collection('users').doc(uid).set({
      uid,
      ...userData
    });
  }

  getUserById(uid: string): Observable<User | undefined> {
    return this.firestore.collection<User>('users').doc(uid).valueChanges();
  }
}