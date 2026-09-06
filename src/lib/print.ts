/**
 * Stampa solo l'elemento marcato con la classe "print-only" già
 * presente nel DOM (v. globals.css per la regola @media print che la
 * isola) --- pensato per un unico elemento marcato alla volta, come il
 * kit di recovery in SetupMasterKeyForm. La classe sul <body> si
 * rimuove da sola dopo la stampa ("afterprint", affidabile su tutti i
 * browser principali sia dopo la stampa vera sia dopo l'annullamento
 * della finestra di dialogo).
 */
export function printOnlyMarkedContent(): void {
  function cleanup() {
    document.body.classList.remove("printing-only-marked");
    window.removeEventListener("afterprint", cleanup);
  }
  window.addEventListener("afterprint", cleanup);
  document.body.classList.add("printing-only-marked");
  window.print();
}
