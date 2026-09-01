export interface AssetListItem {
  id: string;
  /** Decrypted client-side for display. */
  name: string;
  categoryId: string | null;
  createdAt: string;
}

export interface AssetInput {
  name: string;
  categoryId: string | null;
}
