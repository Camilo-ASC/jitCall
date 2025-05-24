import { Component } from '@angular/core';
import { AuthService } from './services/auth.service';
import { MenuController } from '@ionic/angular';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: false
})
export class AppComponent {
  constructor(private authService: AuthService,
    private menuCtrl: MenuController
  ) {}

  async logout() {
    await this.menuCtrl.close(); // cierra el menú antes
    await this.authService.logout(); // luego cierra sesión
  }
}