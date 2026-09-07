export interface ProfileInput {
  firstName: string;
  lastName: string;
  /** ISO (yyyy-mm-dd), o null per "non impostata" --- dato anagrafico facoltativo, in chiaro. */
  birthDate: string | null;
}
