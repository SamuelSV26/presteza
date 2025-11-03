# Middleware para la Página de Inicio

Este middleware completo proporciona una arquitectura robusta para manejar la página de inicio con guards, resolvers, interceptors y servicios de gestión de estado.

## 📁 Estructura

```
src/app/core/
├── guards/
│   └── home.guard.ts          # Guard para validar acceso a la página
├── resolvers/
│   └── home.resolver.ts       # Resolver para precargar datos
├── interceptors/
│   ├── http.interceptor.ts    # Interceptor principal HTTP
│   └── logging.interceptor.ts # Interceptor para logging (desarrollo)
└── services/
    ├── loading.service.ts     # Servicio de estado de carga
    └── error-handler.service.ts # Servicio de manejo de errores
```

## 🔐 Guard (`home.guard.ts`)

**Función**: Valida que el usuario pueda acceder a la página de inicio.

**Características**:
- Verifica precondiciones antes de cargar la página
- Registra acceso a la página (para analytics)
- Retorna `true` si se puede acceder, `false` en caso contrario

**Uso**: Configurado automáticamente en el routing.

## 📊 Resolver (`home.resolver.ts`)

**Función**: Precarga datos antes de mostrar el componente.

**Características**:
- Carga categorías y productos destacados en paralelo
- Maneja errores de manera elegante
- Retorna datos estructurados con estado de carga y errores

**Interfaz**:
```typescript
interface HomeData {
  categories: MenuCategory[];
  featuredProducts: MenuItem[];
  loading: boolean;
  error: string | null;
}
```

## 🔄 Interceptors

### HTTP Interceptor (`http.interceptor.ts`)

**Funcionalidades**:
- ✅ Manejo automático de estados de carga
- ✅ Manejo centralizado de errores HTTP
- ✅ Agregar headers comunes a todas las peticiones
- ✅ Redirección automática en caso de 401 (no autorizado)
- ✅ Logging de errores

**Códigos de error manejados**:
- `0`: Error de conexión
- `400`: Solicitud incorrecta
- `401`: No autorizado
- `403`: Acceso denegado
- `404`: Recurso no encontrado
- `500`: Error interno del servidor
- `503`: Servicio no disponible

### Logging Interceptor (`logging.interceptor.ts`)

**Funcionalidades**:
- 📝 Logging detallado de peticiones HTTP (solo en desarrollo)
- ⏱️ Medición de tiempo de respuesta
- 🐛 Útil para debugging

## 🎯 Servicios

### Loading Service (`loading.service.ts`)

**Funcionalidades**:
- Gestiona el estado de carga globalmente
- Soporta múltiples peticiones simultáneas
- Observable para suscribirse al estado
- Mensajes personalizados de carga

**Métodos principales**:
```typescript
startLoading(message?: string): void
stopLoading(): void
forceStopLoading(): void
executeWithLoading<T>(fn: () => Promise<T>, message?: string): Promise<T>
```

### Error Handler Service (`error-handler.service.ts`)

**Funcionalidades**:
- Manejo centralizado de errores
- Mensajes de error amigables
- Observable para suscribirse a errores
- Diferentes tipos de errores (HTTP, genéricos)

**Métodos principales**:
```typescript
handleHttpError(error: HttpErrorResponse): AppError
handleError(error: any): AppError
clearError(): void
getLastError(): AppError | null
```

## 🚀 Uso en Componentes

### Ejemplo en HomeComponent

```typescript
export class HomeComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private loadingService: LoadingService,
    private errorHandler: ErrorHandlerService
  ) {}

  ngOnInit() {
    // Obtener datos del resolver
    const resolvedData = this.route.snapshot.data['homeData'] as HomeData;
    
    // Suscribirse a errores globales
    this.errorHandler.error$.subscribe(error => {
      if (error) {
        console.error('Error:', error.message);
      }
    });
  }
}
```

## ⚙️ Configuración

### `app.config.ts`

```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([
        httpInterceptor,
        loggingInterceptor
      ])
    )
  ]
};
```

### `app.routing.module.ts`

```typescript
{
  path: '',
  component: HomeComponent,
  canActivate: [homeGuard],
  resolve: { homeData: homeResolver }
}
```

## 📝 Notas

- Los interceptors se ejecutan en orden: primero `httpInterceptor`, luego `loggingInterceptor`
- El guard se ejecuta antes del resolver
- El resolver se ejecuta antes de que el componente se inicialice
- Los servicios están disponibles globalmente (`providedIn: 'root'`)

## 🔧 Personalización

### Agregar más validaciones al Guard

```typescript
const checkPreconditions = (): boolean => {
  // Tu lógica aquí
  const isAuthenticated = localStorage.getItem('token') !== null;
  return isAuthenticated;
};
```

### Agregar más headers al Interceptor

```typescript
const clonedRequest = req.clone({
  setHeaders: {
    'Authorization': `Bearer ${token}`,
    'X-Custom-Header': 'value'
  }
});
```

## 📈 Beneficios

1. **Carga optimizada**: Los datos se precargan antes de mostrar la página
2. **Manejo de errores robusto**: Errores manejados centralmente con mensajes claros
3. **Estados de carga**: Loading automático para todas las peticiones HTTP
4. **Logging**: Debugging facilitado en desarrollo
5. **Escalabilidad**: Fácil de extender y mantener
6. **Type-safe**: TypeScript en todo el código

