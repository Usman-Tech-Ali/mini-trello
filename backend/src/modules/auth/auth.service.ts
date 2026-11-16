import type { LoginInput, RegisterInput, UserDto } from '@mini-trello/shared';
import argon2 from 'argon2';

import { AppError } from '../../lib/app-error';
import { isDuplicateKeyError } from '../../lib/mongo-errors';
import { toUserDto, UserModel } from '../users/user.model';

// Verifying against a dummy hash when the email doesn't exist keeps response times similar,
// so login timing doesn't reveal which emails are registered.
let dummyHash: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  dummyHash ??= argon2.hash('timing-equalizer-password');
  return dummyHash;
}

export async function registerUser(input: RegisterInput): Promise<UserDto> {
  const passwordHash = await argon2.hash(input.password);
  try {
    const user = await UserModel.create({ name: input.name, email: input.email, passwordHash });
    return toUserDto(user);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.', {
        email: ['An account with this email already exists.'],
      });
    }
    throw error;
  }
}

export async function authenticate(input: LoginInput): Promise<UserDto> {
  const user = await UserModel.findOne({ email: input.email }).select('+passwordHash');
  const passwordMatches = user
    ? await argon2.verify(user.passwordHash, input.password)
    : await argon2.verify(await getDummyHash(), input.password).then(() => false);

  if (!user || !passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
  return toUserDto(user);
}

export async function findUserById(userId: string): Promise<UserDto | null> {
  const user = await UserModel.findById(userId);
  return user ? toUserDto(user) : null;
}
