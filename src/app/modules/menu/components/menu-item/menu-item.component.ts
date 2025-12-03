import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserService } from '../../../../core/services/user.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Observable, Subject } from 'rxjs';
import { takeUntil, switchMap, map } from 'rxjs/operators';
import { Meta, Title } from '@angular/platform-browser';

@Component({
  selector: 'app-menu-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './menu-item.component.html',
  styleUrl: './menu-item.component.css'
})
export class MenuItemComponent implements OnInit, OnChanges, OnDestroy {
  @Input() name: string = '';
  @Input() description: string = '';
  @Input() price: number = 0;
  @Input() imageUrl: string | undefined = '';
  @Input() available: boolean = true;
  @Input() dishId: number | string = 0;
  @Input() stockStatus?: 'available' | 'low_stock' | 'out_of_stock';
  @Output() favoriteClick = new EventEmitter<{ dishId: number | string; action: 'add' | 'remove' | 'login' }>();

  isFavorite$: Observable<boolean> = new Observable();
  isLoggedIn: boolean = false;
  private destroy$ = new Subject<void>();

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private router: Router,
    private title: Title,
    private meta: Meta
  ) {
    this.title.setTitle('Menú - PRESTEZA');
    this.meta.updateTag({ name: 'description', content: 'Explora el menú de PRESTEZA y elige entre opciones para tu pedido.' });
  }

  ngOnInit() {
    this.checkLoginStatus();
    this.updateFavoriteStatus();
    
    window.addEventListener('userLoggedIn', () => {
      this.checkLoginStatus();
      this.updateFavoriteStatus();
    });
    
    window.addEventListener('favoritesChanged', () => {
      this.updateFavoriteStatus();
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnChanges() {
    this.checkLoginStatus();
    this.updateFavoriteStatus();
  }

  private updateFavoriteStatus() {
    if (this.dishId && this.isLoggedIn) {
      this.isFavorite$ = this.userService.isFavorite(this.dishId);
    } else {
      this.isFavorite$ = new Observable(observer => {
        observer.next(false);
        observer.complete();
      });
    }
  }

  checkLoginStatus() {
    this.isLoggedIn = this.authService.isAuthenticated();
  }

  onFavoriteClick(event: Event) {
    event.stopPropagation();
    event.preventDefault();
    
    console.log('onFavoriteClick llamado para dishId:', this.dishId);
    
    this.checkLoginStatus();
    if (!this.isLoggedIn) {
      console.log('Usuario no autenticado, redirigiendo a login');
      this.router.navigate(['/login']);
      this.favoriteClick.emit({
        dishId: this.dishId,
        action: 'login'
      });
      return;
    }
    
    if (!this.dishId || this.dishId === 0) {
      console.warn('No se puede agregar a favoritos: dishId no está definido o es 0');
      return;
    }

    console.log('Iniciando toggle de favorito para dishId:', this.dishId);

    this.userService.isFavorite(this.dishId).pipe(
      takeUntil(this.destroy$),
      switchMap((wasFavorite: boolean) => {
        console.log(`Estado actual del favorito para ${this.dishId}:`, wasFavorite);
        return this.userService.toggleFavorite(this.dishId).pipe(
          map(() => wasFavorite)
        );
      })
    ).subscribe({
      next: (wasFavorite: boolean) => {
        console.log(`✅ Favorito ${wasFavorite ? 'eliminado' : 'agregado'} correctamente`);
        this.updateFavoriteStatus();
                this.favoriteClick.emit({
          dishId: this.dishId,
          action: wasFavorite ? 'remove' : 'add'
        });
      },
      error: (error) => {
        console.error('❌ Error al alternar favorito:', error);
        console.error('Detalles del error:', {
          message: error?.message,
          status: error?.status,
          error: error?.error,
          url: error?.url
        });
        this.updateFavoriteStatus();
      }
    });
  }
}
