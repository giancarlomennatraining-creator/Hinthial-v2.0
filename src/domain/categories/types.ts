export interface Category {
  id: string;
  /** Plaintext (like the icon) --- a category name is a generic label, not sensitive content. */
  name: string;
  icon: string;
}

export interface CategoryInput {
  name: string;
  icon: string;
}
