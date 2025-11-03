import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { MenuService } from '../../core/services/menu.service';
import { LoadingService } from '../../core/services/loading.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { HomeData } from '../../core/resolvers/home.resolver';

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
  loading = false;
  error: string | null = null;

  constructor(
    private menuService: MenuService,
    private router: Router,
    private route: ActivatedRoute,
    private loadingService: LoadingService,
    private errorHandler: ErrorHandlerService
  ) {}

  ngOnInit() {
    // Obtener datos del resolver
    const resolvedData = this.route.snapshot.data['homeData'] as HomeData;
    
    if (resolvedData) {
      if (resolvedData.error) {
        this.error = resolvedData.error;
      } else {
        this.featuredCategories = resolvedData.categories;
        this.featuredProducts = resolvedData.featuredProducts.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          imageUrl: item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80',
          badge: this.getBadgeForProduct(item.id)
        }));
      }
    } else {
      // Fallback: cargar datos manualmente si el resolver no está disponible
      this.loadData();
    }

    // Suscribirse a errores globales
    this.errorHandler.error$.subscribe(error => {
      if (error) {
        this.error = error.message;
      }
    });
  }

  private loadData() {
    this.loading = true;
    this.loadingService.startLoading('Cargando datos...');

    this.menuService.getCategories().subscribe({
      next: (categories) => {
        this.featuredCategories = categories.slice(0, 6);
      },
      error: (error) => {
        this.error = 'Error al cargar las categorías';
        this.errorHandler.handleError(error);
      }
    });

    this.menuService.getFeaturedItems().subscribe({
      next: (items) => {
        this.featuredProducts = items.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          imageUrl: item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80',
          badge: this.getBadgeForProduct(item.id)
        }));
        this.loading = false;
        this.loadingService.stopLoading();
      },
      error: (error) => {
        this.error = 'Error al cargar los productos destacados';
        this.errorHandler.handleError(error);
        this.loading = false;
        this.loadingService.stopLoading();
      }
    });
  }

  private getBadgeForProduct(id: number): string {
    const badges: { [key: number]: string } = {
      1: 'Más Popular',
      6: 'Especial',
      30: 'Recomendado'
    };
    return badges[id] || 'Destacado';
  }

  navigateToMenu() {
    this.router.navigate(['/menu']);
  }

  navigateToCategory(categoryId: string) {
    this.router.navigate(['/menu', categoryId]);
  }
}
