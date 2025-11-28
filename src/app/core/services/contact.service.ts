import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { 
  CreateContactMessageDto, 
  ContactMessageFromBackend, 
  ContactMessage,
  CreateCommentDto,
  CommentFromBackend
} from '../models/ContactMessage';
import { environment } from '../../../environments/environment';
import { ErrorHandlerService } from './error-handler.service';

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  private apiUrl = `${environment.apiUrl}/comments`;

  constructor(
    private http: HttpClient,
    private errorHandler: ErrorHandlerService
  ) {}

  // Mapear DTO del frontend al formato del backend
  private mapToBackendDto(dto: CreateContactMessageDto): CreateCommentDto {
    return {
      user_name: dto.name,
      user_email: dto.email,
      user_phone: dto.phone,
      user_title: dto.subject,
      user_comment: dto.message
    };
  }

  // Mapear respuesta del backend al formato del frontend
  private mapCommentToContactMessage(comment: CommentFromBackend): ContactMessageFromBackend {
    // Validar que el comentario tenga los campos necesarios
    if (!comment) {
      console.error('Comentario nulo o indefinido recibido del backend');
      throw new Error('Comentario inválido recibido del backend');
    }

    return {
      _id: comment._id,
      id: comment._id || comment.id || '',
      name: comment.user_name || '',
      email: comment.user_email || '',
      phone: comment.user_phone || '',
      subject: comment.user_title || '',
      message: comment.user_comment || '',
      read: false, // El backend no tiene este campo, se maneja en el frontend si es necesario
      createdAt: comment.createdAt || new Date().toISOString(),
      updatedAt: comment.updatedAt || comment.createdAt || new Date().toISOString()
    };
  }

  create(createContactMessageDto: CreateContactMessageDto): Observable<ContactMessageFromBackend> {
    const commentDto = this.mapToBackendDto(createContactMessageDto);
    
    return this.http.post<CommentFromBackend>(this.apiUrl, commentDto).pipe(
      map(comment => this.mapCommentToContactMessage(comment)),
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  findAll(): Observable<ContactMessageFromBackend[]> {
    return this.http.get<any>(this.apiUrl).pipe(
      map(response => {
        // Manejar diferentes formatos de respuesta del backend
        let comments: CommentFromBackend[] = [];
        
        if (Array.isArray(response)) {
          // Si la respuesta es directamente un array
          comments = response;
        } else if (response.comments && Array.isArray(response.comments)) {
          // Si la respuesta está dentro de un objeto con propiedad 'comments'
          comments = response.comments;
        } else if (response.data && Array.isArray(response.data)) {
          // Si la respuesta está dentro de un objeto con propiedad 'data'
          comments = response.data;
        } else {
          console.warn('Formato de respuesta inesperado del backend:', response);
          comments = [];
        }
        
        // Mapear comentarios con manejo de errores individual
        const mappedMessages: ContactMessageFromBackend[] = [];
        comments.forEach((comment, index) => {
          try {
            const mapped = this.mapCommentToContactMessage(comment);
            mappedMessages.push(mapped);
          } catch (error) {
            console.error(`Error al mapear comentario en índice ${index}:`, error, comment);
            // Continuar con los demás comentarios aunque uno falle
          }
        });
        
        return mappedMessages;
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Error al obtener comentarios del backend:', error);
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  findOne(id: string): Observable<ContactMessageFromBackend> {
    return this.http.get<CommentFromBackend>(`${this.apiUrl}/${id}`).pipe(
      map(comment => this.mapCommentToContactMessage(comment)),
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  markAsRead(id: string): Observable<ContactMessageFromBackend> {
    // El backend no tiene un campo "read", pero podemos mantener esta funcionalidad
    // en el frontend si es necesario. Por ahora, solo retornamos el mensaje.
    return this.findOne(id);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleHttpError(error);
        return throwError(() => appError);
      })
    );
  }

  mapBackendMessageToFrontend(backendMessage: ContactMessageFromBackend): ContactMessage {
    const messageId = backendMessage._id || backendMessage.id || '';
    
    // Función helper para convertir fechas de forma segura
    const parseDate = (dateValue: string | Date | undefined): Date | undefined => {
      if (!dateValue) return undefined;
      if (dateValue instanceof Date) return dateValue;
      const parsed = new Date(dateValue);
      return isNaN(parsed.getTime()) ? undefined : parsed;
    };
    
    return {
      id: messageId,
      name: backendMessage.name || '',
      email: backendMessage.email || '',
      phone: backendMessage.phone || '',
      subject: backendMessage.subject || '',
      message: backendMessage.message || '',
      read: backendMessage.read || false,
      createdAt: parseDate(backendMessage.createdAt),
      updatedAt: parseDate(backendMessage.updatedAt),
    };
  }
}
