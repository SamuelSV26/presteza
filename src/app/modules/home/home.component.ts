import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MenuService } from '../../core/services/menu.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  featuredProducts: any[] = [];
  featuredCategories: any[] = [];

  constructor(
    private menuService: MenuService,
    private router: Router
  ) {}

  ngOnInit() {
    this.menuService.getCategories().subscribe(categories => {
      this.featuredCategories = categories.slice(0, 6);
    });

    // Productos destacados
    this.featuredProducts = [
      {
        id: 1,
        name: 'Bandeja Paisa Presteza',
        description: 'Carne asada, chicharrón, frijoles, arroz, aguacate, huevo, plátano y arepa',
        price: 25000,
        imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80',
        badge: 'Más Popular'
      },
      {
        id: 6,
        name: 'Hamburguesa Presteza',
        description: 'Doble carne, queso cheddar, tocino, huevo y salsa BBQ',
        price: 22000,
        imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80',
        badge: 'Especial'
      },
      {
        id: 30,
        name: 'Cazuela de Mariscos',
        description: 'Mezcla de mariscos en salsa cremosa con arroz y patacones',
        price: 28000,
        imageUrl: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=600&q=80',
        badge: 'Recomendado'
      }
    ];
  }

  navigateToMenu() {
    this.router.navigate(['/menu']);
  }

  navigateToCategory(categoryId: string) {
    this.router.navigate(['/menu', categoryId]);
  }
}
