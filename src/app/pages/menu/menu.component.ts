import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MenuService, MenuCategory } from '../../services/menu.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css'
})
export class MenuComponent implements OnInit {
  categories$!: Observable<MenuCategory[]>;

  constructor(
    private menuService: MenuService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.categories$ = this.menuService.getCategories();
  }

  navigateToCategory(categoryId: string): void {
    this.router.navigate(['/menu', categoryId]);
  }
}