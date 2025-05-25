// src/app/chat/chat-routing.module.ts
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

// No necesitamos un componente 'ChatPage' aquí si este módulo solo es para enrutar
// a las sub-páginas como chat-list y conversation.

const routes: Routes = [
  {
    path: '', // Cuando la URL es solo /chat (porque app-routing ya nos trajo aquí)
    redirectTo: 'list', // Redirige automáticamente a /chat/list
    pathMatch: 'full'   // Importante para que la redirección funcione bien
  },
  {
    path: 'list', // Cuando la URL sea /chat/list
    // Carga perezosamente el módulo de tu página ChatListPage
    loadChildren: () => import('./chat-list/chat-list.module').then( m => m.ChatListPageModule)
  }
  // Más adelante aquí añadiremos la ruta para la conversación individual, ej:
  // {
  //   path: 'conversation/:chatId',
  //   loadChildren: () => import('./conversation/conversation.module').then( m => m.ConversationPageModule)
  // }
];

@NgModule({
  imports: [RouterModule.forChild(routes)], // Usamos forChild porque este es un módulo "hijo"
  exports: [RouterModule],
})
export class ChatRoutingModule { }