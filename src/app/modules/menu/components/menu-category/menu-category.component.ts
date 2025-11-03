import { MenuItemComponent } from '../menu-item/menu-item.component';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MenuService, MenuItem, MenuCategory } from '../../../../core/services/menu.service';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-menu-category',
  standalone: true,
  imports: [CommonModule, MenuItemComponent],
  templateUrl: './menu-category.component.html',
  styleUrl: './menu-category.component.css'
})
export class MenuCategoryComponent implements OnInit {
  category$!: Observable<MenuCategory | undefined>;
  items$!: Observable<MenuItem[]>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private menuService: MenuService
  ) {}

  ngOnInit(): void {
    this.category$ = this.route.paramMap.pipe(
      map(params => params.get('id')),
      switchMap(id => this.menuService.getCategoryById(id))
    );

    this.items$ = this.route.paramMap.pipe(
      map(params => params.get('id')),
      switchMap(id => this.menuService.getItemsByCategory(id))
    );
  }

  goBack(): void {
    this.router.navigate(['/menu']);
  }

  openProductDetail(product: MenuItem): void {
    this.router.navigate(['/menu/producto', product.id]);
  }

  onFavoriteClick(event: { dishId: number; action: 'add' | 'remove' | 'login' }): void {
    if (event.action === 'login') {
      // Disparar evento global para mostrar el modal de login en el navbar
      window.dispatchEvent(new CustomEvent('showLoginModal'));
    }
  }
}
