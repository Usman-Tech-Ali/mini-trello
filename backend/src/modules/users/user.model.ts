import type { UserDto } from '@mini-trello/shared';
import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    // Never returned by default; must be requested explicitly with .select('+passwordHash').
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
);

// Unique email lookups for login/registration and member invites.
userSchema.index({ email: 1 }, { unique: true });

export type User = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<User>;

export const UserModel = model('User', userSchema);

export function toUserDto(user: Pick<UserDocument, '_id' | 'name' | 'email'>): UserDto {
  return { id: user._id.toString(), name: user.name, email: user.email };
}
