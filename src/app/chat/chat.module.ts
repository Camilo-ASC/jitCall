
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';    // <-- Añadido por buena práctica
import { IonicModule } from '@ionic/angular'; // <-- Añadido por buena práctica

import { ChatRoutingModule } from './chat-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,    // <-- Añadido
    IonicModule,    // <-- Añadido
    ChatRoutingModule
  ],
  declarations: [
    // Aquí no declaramos ChatListPage porque tiene su propio módulo
    // que es cargado perezosamente por ChatRoutingModule.
  ]
})
export class ChatModule { }