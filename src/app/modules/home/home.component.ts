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
  loading = true;
  error: string | null = null;
  
  valores = [
    { 
      icon: 'bi-award-fill', 
      title: '100% Calidad', 
      text: 'Escogimos la mejor carne para nuestros productos, haciéndolos únicos, jugosos y exquisitos al paladar.' 
    },
    { 
      icon: 'bi-stars', 
      title: 'Ingredientes Premium', 
      text: 'Cada ingrediente es cuidadosamente seleccionado por un personal altamente capacitado para garantizar la mejor calidad.' 
    },
    { 
      icon: 'bi-trophy-fill', 
      title: 'Reconocimiento Local', 
      text: 'En poco tiempo logramos posicionar nuestra marca y obtener reconocimientos locales por nuestra excelencia y dedicación.' 
    }
  ];

  stats = [
    {
      icon: 'bi-people-fill',
      value: 5000,
      display: '0',
      suffix: '+',
      label: 'Clientes Satisfechos',
      percentage: 100
    },
    {
      icon: 'bi-cup-hot-fill',
      value: 100,
      display: '0',
      suffix: '+',
      label: 'Platos Únicos',
      percentage: 85
    },
    {
      icon: 'bi-star-fill',
      value: 4.9,
      display: '0',
      suffix: '',
      label: 'Calificación Promedio',
      percentage: 98
    },
    {
      icon: 'bi-clock-history',
      value: 5,
      display: '0',
      suffix: '',
      label: 'Años de Experiencia',
      percentage: 100
    }
  ];

  constructor(
    private menuService: MenuService,
    private router: Router,
    private route: ActivatedRoute,
    private loadingService: LoadingService,
    private errorHandler: ErrorHandlerService
  ) {}

  ngOnInit() {
    window.addEventListener('productsUpdated', () => {
      this.loadData();
    });
    window.addEventListener('categoriesUpdated', () => {
      this.loadData();
    });
    setTimeout(() => {
      this.animateStats();
    }, 1000);
    const resolvedData = this.route.snapshot.data['homeData'] as HomeData;
    if (resolvedData) {
      if (resolvedData.error) {
        this.error = resolvedData.error;
      } else {
        this.featuredCategories = resolvedData.categories || [];
        if (this.featuredCategories.length === 0) {
          this.loadData();
        }
        this.featuredProducts = resolvedData.featuredProducts.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          imageUrl: item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80',
          badge: this.getBadgeForProduct(item.id)
        }));
        this.loading = false;
      }
    } else {
      this.loadData();
    }
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
        const categoriesWithIcon = categories.filter(cat => cat.icon && cat.icon.trim() !== '');
        const allCategories = categoriesWithIcon.length > 0 ? categoriesWithIcon : categories;
        this.featuredCategories = allCategories.slice(0, 5);
        this.loading = false;
        this.loadingService.stopLoading();
      },
      error: (error) => {
        this.error = 'Error al cargar las categorías';
        this.loading = false;
        this.loadingService.stopLoading();
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

  private getBadgeForProduct(id: number | string): string {
    if (typeof id === 'string' && id.length === 24) {
      return 'Destacado';
    }
    const badges: { [key: number]: string } = {
      1: 'Más Popular',
      6: 'Especial',
      30: 'Recomendado'
    };
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    return badges[numericId] || 'Destacado';
  }

  navigateToMenu() {
    this.router.navigate(['/menu']);
  }

  navigateToProductDetail(productId: number | string): void {
    this.router.navigate(['/menu/producto', productId]);
  }

  navigateToCategory(categoryId: string) {
    this.router.navigate(['/menu', categoryId]);
  }

  scrollProducts(direction: 'left' | 'right') {
    const container = document.querySelector('.products-scroll-content');
    if (container) {
      const scrollAmount = 400;
      const currentScroll = container.scrollLeft;
      const targetScroll = direction === 'left' 
        ? currentScroll - scrollAmount 
        : currentScroll + scrollAmount;
      
      container.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    }
  }

  private animateStats() {
    this.stats.forEach((stat, index) => {
      setTimeout(() => {
        const target = stat.value;
        const duration = 2000;
        const steps = 60;
        const increment = target / steps;
        let current = 0;
        const timer = setInterval(() => {
          current += increment;
          if (current >= target) {
            stat.display = target.toString();
            clearInterval(timer);
          } else {
            if (target % 1 === 0) {
              stat.display = Math.floor(current).toString();
            } else {
              stat.display = current.toFixed(1);
            }
          }
        }, duration / steps);
      }, index * 200);
    });
  }
}
