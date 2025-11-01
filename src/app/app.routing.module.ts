import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './modules/home/home.component'; // ajusta la ruta si tu carpeta es distinta
import { MenuComponent } from './modules/menu/menu.component';
import { MenuCategoryComponent } from './modules/menu/menu-category/menu-category.component';
import { SedeComponent } from './modules/sede/sede.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent
  },
  {
    path: 'home',
    redirectTo: '',
    pathMatch: 'full'
  },
  {
    path: 'menu',
    component: MenuComponent
  },
  {
    path: 'menu/:id',
    component: MenuCategoryComponent
  },
  {
    path: 'sede',
    component: SedeComponent
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
