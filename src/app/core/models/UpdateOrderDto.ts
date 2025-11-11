import { CreateOrderDto } from './CreateOrderDto';

/**
 * DTO para actualizar una orden - todos los campos son opcionales
 */
export type UpdateOrderDto = Partial<CreateOrderDto>;

