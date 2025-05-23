import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  constructor(private firestore: AngularFirestore) {}

  async createUser(uid: string, userData: {
    nombre: string;
    apellido: string;
    telefono: string;
    email: string;
    token?: string;
  }): Promise<void> {
    return this.firestore.collection('users').doc(uid).set({
      uid,
      ...userData
    });
  }
}
