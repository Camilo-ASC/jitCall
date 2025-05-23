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
    private afAuth: AngularFireAuth,
    private router: Router
  ) {}

  register(userData: User, password: string): Promise<any> {
    return this.afAuth.createUserWithEmailAndPassword(userData.email, password);
  }

  login(email: string, password: string): Promise<any> {
    return this.afAuth.signInWithEmailAndPassword(email, password);
  }

  logout(): Promise<void> {
    return this.afAuth.signOut().then(() => {
      this.router.navigate(['/auth/login']);
    });
  }

  getCurrentUser(): Observable<any> {
    return this.afAuth.authState;
  }

  getIdToken(): Observable<string | null> {
    return this.afAuth.idToken;
  }
}
