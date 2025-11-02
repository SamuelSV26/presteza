import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FooterComponent } from './footer/footer.component';
import { NavbarComponent } from './nav-bar/nav-bar.component';

@NgModule({
  exports: [FooterComponent, NavbarComponent],
  imports: [CommonModule, NavbarComponent, FooterComponent]
})
export class SharedModule {}
