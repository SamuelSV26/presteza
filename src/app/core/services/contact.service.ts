import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { CreateContactMessageDto, ContactMessageFromBackend, ContactMessage } from '../models/ContactMessage';

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  private readonly STORAGE_KEY = 'presteza_contact_messages';

  constructor() {}

  /**
   * Obtiene todos los mensajes desde localStorage
   */
  private getMessagesFromStorage(): ContactMessageFromBackend[] {
    const messagesJson = localStorage.getItem(this.STORAGE_KEY);
    if (!messagesJson) {
      return [];
    }
    try {
      return JSON.parse(messagesJson);
    } catch (error) {
      console.error('Error parsing messages from localStorage:', error);
      return [];
    }
  }

  /**
   * Guarda los mensajes en localStorage
   */
  private saveMessagesToStorage(messages: ContactMessageFromBackend[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(messages));
    } catch (error) {
      console.error('Error saving messages to localStorage:', error);
    }
  }

  /**
   * Genera un ID único para el mensaje
   */
  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Envía un mensaje de contacto (guarda en localStorage)
   */
  create(createContactMessageDto: CreateContactMessageDto): Observable<ContactMessageFromBackend> {
    try {
      const messages = this.getMessagesFromStorage();
      const newMessage: ContactMessageFromBackend = {
        _id: this.generateId(),
        id: this.generateId(),
        name: createContactMessageDto.name,
        email: createContactMessageDto.email,
        phone: createContactMessageDto.phone,
        subject: createContactMessageDto.subject,
        message: createContactMessageDto.message,
        read: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      messages.push(newMessage);
      this.saveMessagesToStorage(messages);

      return of(newMessage);
    } catch (error) {
      return throwError(() => ({
        message: 'Error al guardar el mensaje',
        error
      }));
    }
  }

  /**
   * Obtiene todos los mensajes de contacto (solo admin)
   */
  findAll(): Observable<ContactMessageFromBackend[]> {
    try {
      const messages = this.getMessagesFromStorage();
      return of(messages);
    } catch (error) {
      return throwError(() => ({
        message: 'Error al cargar los mensajes',
        error
      }));
    }
  }

  /**
   * Obtiene un mensaje de contacto por ID
   */
  findOne(id: string): Observable<ContactMessageFromBackend> {
    try {
      const messages = this.getMessagesFromStorage();
      const message = messages.find(m => m._id === id || m.id === id);
      
      if (!message) {
        return throwError(() => ({
          message: 'Mensaje no encontrado',
          status: 404
        }));
      }

      return of(message);
    } catch (error) {
      return throwError(() => ({
        message: 'Error al obtener el mensaje',
        error
      }));
    }
  }

  /**
   * Marca un mensaje como leído
   */
  markAsRead(id: string): Observable<ContactMessageFromBackend> {
    try {
      const messages = this.getMessagesFromStorage();
      const messageIndex = messages.findIndex(m => m._id === id || m.id === id);

      if (messageIndex === -1) {
        return throwError(() => ({
          message: 'Mensaje no encontrado',
          status: 404
        }));
      }

      messages[messageIndex].read = true;
      messages[messageIndex].updatedAt = new Date().toISOString();
      this.saveMessagesToStorage(messages);

      return of(messages[messageIndex]);
    } catch (error) {
      return throwError(() => ({
        message: 'Error al marcar el mensaje como leído',
        error
      }));
    }
  }

  /**
   * Elimina un mensaje de contacto
   */
  remove(id: string): Observable<void> {
    try {
      const messages = this.getMessagesFromStorage();
      const filteredMessages = messages.filter(m => m._id !== id && m.id !== id);
      this.saveMessagesToStorage(filteredMessages);
      return of(undefined);
    } catch (error) {
      return throwError(() => ({
        message: 'Error al eliminar el mensaje',
        error
      }));
    }
  }

  /**
   * Convierte un mensaje del backend al formato del frontend
   */
  mapBackendMessageToFrontend(backendMessage: ContactMessageFromBackend): ContactMessage {
    const messageId = backendMessage._id || backendMessage.id || '';
    return {
      id: messageId,
      name: backendMessage.name,
      email: backendMessage.email,
      phone: backendMessage.phone,
      subject: backendMessage.subject,
      message: backendMessage.message,
      read: backendMessage.read || false,
      createdAt: backendMessage.createdAt ? new Date(backendMessage.createdAt) : undefined,
      updatedAt: backendMessage.updatedAt ? new Date(backendMessage.updatedAt) : undefined,
    };
  }
}
