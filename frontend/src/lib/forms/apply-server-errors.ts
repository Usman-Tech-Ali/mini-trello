import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { ApiError } from '@/lib/api/api-error';

/**
 * Shows an API error on the form: field-level details go under their fields, anything else
 * becomes a form-level message (`errors.root.server`).
 */
export function applyServerErrors<T extends FieldValues>(
  error: Error,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): void {
  if (error instanceof ApiError && error.details) {
    let applied = false;
    for (const field of fields) {
      const message = error.details[field]?.[0];
      if (message) {
        setError(field, { type: 'server', message }, { shouldFocus: !applied });
        applied = true;
      }
    }
    if (applied) return;
  }
  setError('root.server', { type: 'server', message: error.message });
}
