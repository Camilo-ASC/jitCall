import { Component, OnInit } from '@angular/core';

// --- IMPORTACIONES DIRECTAS DE FIREBASE ---
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { environment } from 'src/environments/environment';
import { User } from 'src/app/core/models/user.model'; // Mantenemos tu modelo de datos

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  standalone: false
})
export class HomePage implements OnInit {
  userName: string | null = null;
  isLoading = true; // Añadimos un estado de carga para una mejor experiencia

  // --- INICIALIZACIÓN DIRECTA DE FIREBASE ---
  private app = initializeApp(environment.firebaseConfig);
  private auth = getAuth(this.app);
  private db = getFirestore(this.app);

  // El constructor ahora está limpio de los servicios de Firebase
  constructor() {}

  ngOnInit() {
    // onAuthStateChanged es la forma directa de saber quién está logueado.
    // Se dispara cada vez que el estado de autenticación cambia.
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        // Si hay un usuario, buscamos su perfil en Firestore
        console.log('Usuario logueado detectado, UID:', user.uid);
        this.fetchUserProfile(user.uid);
      } else {
        // Si no hay usuario (ej: después de un logout)
        console.log('No hay usuario logueado.');
        this.userName = null;
        this.isLoading = false;
        // Aquí podrías redirigir a la página de login si quisieras
      }
    });
  }

  async fetchUserProfile(uid: string) {
    this.isLoading = true;
    try {
      // Creamos la referencia al documento del usuario
      const userDocRef = doc(this.db, 'users', uid);
      // Obtenemos el documento con getDoc
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data() as User; // Usamos tu interfaz User
        this.userName = `${userData.name} ${userData.lastname}`;
        console.log('Perfil de usuario cargado:', this.userName);
      } else {
        console.error('¡Error! No se encontró el documento del usuario en Firestore.');
        this.userName = 'Usuario no encontrado';
      }
    } catch (error) {
      console.error('Error al traer el perfil del usuario:', error);
      this.userName = 'Error al cargar perfil';
    } finally {
      this.isLoading = false;
    }
  }
}