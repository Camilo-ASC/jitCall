import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';
import { User } from '../core/models/user.model';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(
    private afAuth: AngularFireAuth, // Inyectamos el servicio de compatibilidad
    private router: Router
  ) {}

  register(userData: User, password: string): Promise<any> {
    return this.afAuth.createUserWithEmailAndPassword(userData.email, password);
  }

  async login(email: string, password: string): Promise<any> {
    await this.afAuth.signInWithEmailAndPassword(email, password);
    return this.router.navigate(['/home']);
  }

  async logout(): Promise<void> {
    await this.afAuth.signOut();
    this.router.navigate(['/auth/login']);
  }

  getCurrentUser(): Observable<any> {
    return this.afAuth.authState;
  }

  getIdToken(): Observable<string | null> {
    return this.afAuth.idToken;
  }
}