import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import { User } from '../core/models/user.model';
import { from, Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private router: Router
  ) {}

  // Registro de usuario
  register(userData: User, password: string): Promise<any> {
    return this.afAuth.createUserWithEmailAndPassword(userData.email, password)
      .then((cred) => {
        const uid = cred.user?.uid;
        return this.firestore.collection('users').doc(uid).set({
          uid,
          nombre: userData.nombre,
          apellido: userData.apellido,
          telefono: userData.telefono,
          email: userData.email,
        });
      });
  }

  // Inicio de sesión
  login(email: string, password: string): Promise<any> {
    return this.afAuth.signInWithEmailAndPassword(email, password);
  }

  // Cierre de sesión
  logout(): Promise<void> {
    return this.afAuth.signOut().then(() => {
      this.router.navigate(['/login']);
    });
  }

  // Obtener el usuario actual
  getCurrentUser(): Observable<any> {
    return this.afAuth.authState;
  }

  // Obtener token actual de autenticación
  getIdToken(): Observable<string | null> {
    return this.afAuth.idToken;
  }
}
