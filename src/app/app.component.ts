import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../share/navbar/navbar.component';
import { HomeComponent } from '../home/home.component';
import { FooterComponent } from '../share/footer/footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, HomeComponent,FooterComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  title = 'project';

}
