import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth/login', // O 'home' si prefieres que intente ir a home y el guard lo redirija
    pathMatch: 'full'
  },
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadChildren: () => import('./auth/login/login.module').then(m => m.LoginPageModule)
      },
      {
        path: 'register',
        loadChildren: () => import('./auth/register/register.module').then(m => m.RegisterPageModule)
      }
    ]
  },
  {
    path: 'home',
    loadChildren: () => import('./home/home.module').then(m => m.HomePageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'contacts',
    loadChildren: () => import('./contacts/contacts.module').then(m => m.ContactsModule), // Asumiendo que se llama ContactsModule
    canActivate: [AuthGuard]
  },
  {
    path: 'call',
    loadChildren: () => import('./call/call.module').then(m => m.CallModule), // Asumiendo que se llama CallModule
    canActivate: [AuthGuard]
  },
  // --- RUTA CORREGIDA Y ÚNICA PARA EL CHAT ---
  {
    path: 'chat', // Cuando la URL sea /chat o /chat/...
    loadChildren: () => import('./chat/chat.module').then( m => m.ChatModule), // Carga el módulo principal del chat
    canActivate: [AuthGuard] // Protegemos toda la sección de chat
  }
  // Ya NO necesitamos una ruta separada para 'chat-list' aquí,
  // eso se manejará dentro de 'chat-routing.module.ts'.
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule]
})
export class AppRoutingModule {}