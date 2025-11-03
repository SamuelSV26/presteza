import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../../core/services/user.service';
import { Observable } from 'rxjs';

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
  @Input() dishId: number = 0;
  @Output() favoriteClick = new EventEmitter<{ dishId: number; action: 'add' | 'remove' | 'login' }>();
  
  isFavorite$: Observable<boolean> = new Observable();
  isLoggedIn: boolean = false;

  constructor(private userService: UserService) {}

  ngOnInit() {
    this.checkLoginStatus();
    if (this.dishId && this.isLoggedIn) {
      this.isFavorite$ = this.userService.isFavorite(this.dishId);
    } else {
      // Inicializar con observable que siempre retorna false
      this.isFavorite$ = new Observable(observer => {
        observer.next(false);
        observer.complete();
      });
    }

    // Escuchar cuando el usuario inicie sesión
    window.addEventListener('userLoggedIn', () => {
      this.checkLoginStatus();
      if (this.dishId && this.isLoggedIn) {
        this.isFavorite$ = this.userService.isFavorite(this.dishId);
      }
    });
  }

  ngOnChanges() {
    // Revisar estado de login cuando cambie el dishId
    this.checkLoginStatus();
    if (this.dishId && this.isLoggedIn) {
      this.isFavorite$ = this.userService.isFavorite(this.dishId);
    }
  }

  checkLoginStatus() {
    this.isLoggedIn = localStorage.getItem('userName') !== null;
  }

  onFavoriteClick(event: Event) {
    event.stopPropagation();
    
    if (!this.isLoggedIn) {
      // Emitir evento para mostrar modal de login
      this.favoriteClick.emit({ dishId: this.dishId, action: 'login' });
      return;
    }

    // Toggle favorite
    this.userService.toggleFavorite(this.dishId);
    this.isFavorite$ = this.userService.isFavorite(this.dishId);
    
    // Emitir evento para notificar al componente padre
    this.userService.isFavorite(this.dishId).subscribe(isFav => {
      this.favoriteClick.emit({ 
        dishId: this.dishId, 
        action: isFav ? 'add' : 'remove' 
      });
    });
  }
}
