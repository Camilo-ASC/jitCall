import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'jitsi-call/:meetingId', // Cuando la URL sea /call/jitsi-call/UN_ID_DE_REUNION
    // Carga el módulo de la página JitsiCall
    loadChildren: () => import('./jitsi-call/jitsi-call.module').then( m => m.JitsiCallPageModule)
  },
  {
    path: 'incoming-call',    // Cuando la URL sea /call/incoming-call
    // Carga el módulo de la página IncomingCall
    loadChildren: () => import('./incoming-call/incoming-call.module').then( m => m.IncomingCallPageModule)
  }
  
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CallRoutingModule { }