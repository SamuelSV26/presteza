import { Routes } from '@angular/router';
import { HomeComponent } from './modules/home/home.component';
import { MenuComponent } from './modules/menu/menu.component';
import { MenuCategoryComponent } from './modules/menu/components/menu-category/menu-category.component';
import { ProductDetailComponent } from './modules/menu/components/product-detail/product-detail.component';
import { SedeComponent } from './modules/sede/sede.component';
import { NosotrosComponent } from './modules/nosotros/nosotros.component';
import { ContactoComponent } from './modules/contacto/contacto.component';
import { RegistroComponent } from './modules/registro/registro.component';
import { LoginComponent } from './modules/login/login.component';
import { PerfilComponent } from './modules/perfil/perfil.component';
import { AdminDashboardComponent } from './modules/admin/admin-dashboard.component';
import { homeGuard } from './core/guards/home.guard';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { homeResolver } from './core/resolvers/home.resolver';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    canActivate: [homeGuard],
    resolve: { homeData: homeResolver }
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
    path: 'menu/producto/:id',
    component: ProductDetailComponent
  },
  {
    path: 'sede',
    component: SedeComponent
  },
  {
    path: 'nosotros',
    component: NosotrosComponent
  },
  {
    path: 'contacto',
    component: ContactoComponent
  },
  {
    path: 'registro',
    component: RegistroComponent
  },
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'perfil',
    component: PerfilComponent,
    canActivate: [authGuard]
  },
  {
    path: 'admin',
    component: AdminDashboardComponent,
    canActivate: [adminGuard]
  }
];

