import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { MenuComponent } from './pages/menu/menu.component';
import { MenuCategoryComponent } from './pages/menu-category/menu-category.component';
import { SedeComponent } from './pages/sede/sede.component';

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
