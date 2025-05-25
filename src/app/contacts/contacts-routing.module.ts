import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  // --- AÑADE ESTE BLOQUE ---
  {
    path: 'add-contact', // Cuando la URL sea /contacts/add-contact...
    // ...carga el módulo de la página para agregar contactos
    loadChildren: () => import('./add-contact/add-contact.module').then( m => m.AddContactPageModule)
  },
  // --- FIN DEL BLOQUE AÑADIDO ---

  
   {
     path: 'edit-contact/:id',
     loadChildren: () => import('./edit-contact/edit-contact.module').then( m => m.EditContactPageModule)
   }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ContactsRoutingModule { }