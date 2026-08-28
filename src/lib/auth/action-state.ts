/**
 * Shared shape for the login/register form action state.
 *
 * Kept out of actions.ts on purpose: a "use server" module may only
 * export async functions, and login/register pages need to import this
 * plain constant/type as the initial useActionState value.
 */
export interface AuthActionState {
  error: string | null;
}

export const initialAuthActionState: AuthActionState = { error: null };
