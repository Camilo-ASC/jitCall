import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { JitsiCallPage } from './jitsi-call.page';

const routes: Routes = [
  {
    path: '',
    component: JitsiCallPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class JitsiCallPageRoutingModule {}
