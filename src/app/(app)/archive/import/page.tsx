import { redirect } from "next/navigation";

/** L'importazione di più file è ora lo stesso percorso del caricamento di un file (v. CreateArchiveItemForm): i vecchi collegamenti portano lì. */
export default function BulkImportRedirectPage() {
  redirect("/archive/new?mode=upload");
}
