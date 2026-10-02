/**
 * Shared shape for the login/register form action state.
 *
 * Kept out of actions.ts on purpose: a "use server" module may only
 * export async functions, and login/register pages need to import this
 * plain constant/type as the initial useActionState value.
 */
export interface AuthActionState {
  error: string | null;
  /** L'email appena inviata, restituita su un errore: React svuota i campi dopo ogni invio, e chi sbaglia la password non deve riscrivere anche l'email. */
  email?: string;
}

export const initialAuthActionState: AuthActionState = { error: null };
