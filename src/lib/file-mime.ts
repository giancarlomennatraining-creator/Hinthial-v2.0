const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Il tipo MIME di un file scelto dall'utente. Il browser lo ricava dal sistema operativo: dove Word non è installato un
 * .docx arriva spesso senza tipo, e senza non verrebbe letto. Per il resto vale ciò che dichiara il browser.
 */
export function mimeTypeOfFile(file: { name: string; type: string }): string {
  if (file.type) return file.type;
  if (file.name.toLowerCase().endsWith(".docx")) return DOCX_MIME_TYPE;
  return "application/octet-stream";
}
