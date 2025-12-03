import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { MenuService } from '../../core/services/menu.service';
import { LoadingService } from '../../core/services/loading.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { HomeData } from '../../core/resolvers/home.resolver';
import { MenuCategory } from '../../core/models/MenuCategory';
import { Meta, Title } from '@angular/platform-browser';

const DEFAULT_CATEGORY_IMAGE = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80';
const GRADIENT_OVERLAY = 'linear-gradient(135deg, rgba(107, 29, 61, 0.7) 0%, rgba(139, 45, 79, 0.6) 50%, rgba(0, 0, 0, 0.5) 100%)';

const CATEGORY_IMAGES: Record<string, string> = {
  'bebidas': 'https://images.unsplash.com/photo-1546171753-97d7676e4602?w=800&q=80',
  'desayunos': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80',
  'comida rapida': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80',
  'ensaladas': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
  'postres': 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80',
  'almuerzos': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
  'hamburguesas': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80',
  'entradas': 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&q=80',
  'acompanamientos': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800&q=80',
  'sopas': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80',
  'pescados': 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80',
  'carnes': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80',
  'comida vegetariana': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80',
  'comida internacional': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80',
  'comida tipica': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80'
};

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
    private errorHandler: ErrorHandlerService,
    private title: Title,
    private meta: Meta
  ) {
    this.title.setTitle('Home - PRESTEZA');
    this.meta.updateTag({ name: 'description', content: 'Bienvenido a PRESTEZA, tu lugar para disfrutar de la mejor comida.' });
  }

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
    const badges: Record<number, string> = {
      1: 'Más Popular',
      6: 'Especial',
      30: 'Recomendado'
    };
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    return badges[numericId] || 'Destacado';
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }

  navigateToProductDetail(productId: number | string): void {
    this.router.navigate(['/menu/producto', productId]);
  }

  navigateToCategory(categoryId: string) {
    this.router.navigate(['/menu', categoryId]);
  }

  getCategoryBackgroundImage(category: MenuCategory | any): string {
    if (category.imageUrl) {
      return `${GRADIENT_OVERLAY}, url("${category.imageUrl}")`;
    }

    const normalizedName = this.normalizeCategoryName(category.name);
    const imageUrl = CATEGORY_IMAGES[normalizedName] || DEFAULT_CATEGORY_IMAGE;

    return `${GRADIENT_OVERLAY}, url("${imageUrl}")`;
  }

  private normalizeCategoryName(name: string): string {
    if (!name) return '';
    return name
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, ' ');
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
