import { z } from 'zod';

import { emailSchema } from './common';

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name must be at most 80 characters'),
  email: emailSchema,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128, 'Password is too long'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export interface UserDto {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  user: UserDto;
}
