import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // <-- Añadido por si se usa en las sub-páginas
import { IonicModule } from '@ionic/angular'; // <-- Añadido para componentes Ionic en sub-páginas

import { CallRoutingModule } from './call-routing.module';

@NgModule({
  declarations: [
    // Si tuvieras un CallPage que fuera el componente principal de este módulo, iría aquí.
    // Si no, está bien dejarlo vacío.
  ],
  imports: [
    CommonModule,
    FormsModule,     // <-- Añadido
    IonicModule,     // <-- Añadido
    CallRoutingModule
  ]
})
export class CallModule { }