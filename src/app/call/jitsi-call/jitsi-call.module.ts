import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { JitsiCallPageRoutingModule } from './jitsi-call-routing.module';

import { JitsiCallPage } from './jitsi-call.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    JitsiCallPageRoutingModule
  ],
  declarations: [JitsiCallPage]
})
export class JitsiCallPageModule {}
