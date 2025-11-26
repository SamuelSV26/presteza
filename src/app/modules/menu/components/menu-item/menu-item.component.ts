import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserService } from '../../../../core/services/user.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Observable } from 'rxjs';
import { Meta, Title } from '@angular/platform-browser';

@Component({
  selector: 'app-menu-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './menu-item.component.html',
  styleUrl: './menu-item.component.css'
})
export class MenuItemComponent implements OnInit, OnChanges {
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
    if (this.dishId && this.isLoggedIn) {
      this.isFavorite$ = this.userService.isFavorite(this.dishId);
    } else {
      this.isFavorite$ = new Observable(observer => {
        observer.next(false);
        observer.complete();
      });
    }
    window.addEventListener('userLoggedIn', () => {
      this.checkLoginStatus();
      if (this.dishId && this.isLoggedIn) {
        this.isFavorite$ = this.userService.isFavorite(this.dishId);
      }
    });
  }

  ngOnChanges() {
    this.checkLoginStatus();
    if (this.dishId && this.isLoggedIn) {
      this.isFavorite$ = this.userService.isFavorite(this.dishId);
    }
  }

  checkLoginStatus() {
    this.isLoggedIn = this.authService.isAuthenticated();
  }

  onFavoriteClick(event: Event) {
    event.stopPropagation();
    this.checkLoginStatus();
    if (!this.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }
    this.userService.toggleFavorite(this.dishId);
    this.isFavorite$ = this.userService.isFavorite(this.dishId);
    this.userService.isFavorite(this.dishId).subscribe(isFav => {
      this.favoriteClick.emit({
        dishId: this.dishId,
        action: isFav ? 'add' : 'remove'
      });
    });
  }
}
