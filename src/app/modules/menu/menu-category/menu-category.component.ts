import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MenuService, MenuItem, MenuCategory } from '../../../core/services/menu.service';
import { ProductCustomizationModalComponent } from '../../../components/organisms/product-customization-modal/product-customization-modal.component';
import { MenuItemComponent } from '../../../components/molecules/menu-item/menu-item.component';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-menu-category',
  standalone: true,
  imports: [CommonModule, MenuItemComponent, ProductCustomizationModalComponent],
  templateUrl: './menu-category.component.html',
  styleUrl: './menu-category.component.css'
})
export class MenuCategoryComponent implements OnInit {
  category$!: Observable<MenuCategory | undefined>;
  items$!: Observable<MenuItem[]>;
  selectedProduct: MenuItem | null = null;
  showCustomizationModal = false;

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

  openCustomizationModal(product: MenuItem): void {
    this.selectedProduct = product;
    this.showCustomizationModal = true;
  }

  closeCustomizationModal(): void {
    this.showCustomizationModal = false;
    this.selectedProduct = null;
  }

  onProductAdded(): void {
    this.closeCustomizationModal();
  }
}
