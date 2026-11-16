import { useMutation, useQueryClient } from '@tanstack/react-query';

import { login, logout, register } from '../api/auth.api';
import { setSession } from './use-session';

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      setSession(queryClient, user);
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: register,
    onSuccess: (user) => {
      setSession(queryClient, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    // Clear local state even if the request fails: the user asked to leave.
    onSettled: () => {
      setSession(queryClient, null);
    },
  });
}
