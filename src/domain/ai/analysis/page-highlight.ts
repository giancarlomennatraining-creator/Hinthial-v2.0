/**
 * Dove sta, su una pagina di PDF disegnata, la frase che prova un dato. Funzioni pure sugli elementi di testo che
 * pdf.js restituisce per la pagina: niente pdf.js, niente DOM, così si provano senza disegnare nulla.
 */

/** Gli elementi di testo di pdf.js che servono qui (`TextItem`: stringa, matrice di trasformazione, ingombro in unità pagina). */
export interface PageTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

/** Un rettangolo in percentuale della pagina disegnata: resta giusto a qualunque larghezza si mostri l'immagine. */
export interface HighlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface CompactChar {
  char: string;
  item: number;
  offset: number;
}

const foldChar = (char: string) => {
  const lower = char.toLowerCase();
  return lower.length === char.length ? lower : char;
};

/** Il testo della pagina senza spazi, con per ogni carattere l'elemento da cui viene: la citazione si cerca così, tollerante ad a capo e spaziature. */
function compactPage(items: PageTextItem[]): CompactChar[] {
  const chars: CompactChar[] = [];
  items.forEach((item, itemIndex) => {
    [...item.str].forEach((char, offset) => {
      if (!/\s/.test(char)) chars.push({ char: foldChar(char), item: itemIndex, offset });
    });
  });
  return chars;
}

export interface QuoteSpan {
  item: number;
  /** Primo carattere dell'elemento compreso nella frase. */
  start: number;
  /** Primo carattere dell'elemento dopo la frase. */
  end: number;
}

/** Le parti degli elementi di testo che compongono la citazione, o null se non c'è (pagina scansionata, testo cambiato). */
export function locateQuote(items: PageTextItem[], quote: string): QuoteSpan[] | null {
  const needle = [...quote].filter((char) => !/\s/.test(char)).map(foldChar);
  if (needle.length === 0) return null;
  const page = compactPage(items);

  for (let from = 0; from + needle.length <= page.length; from++) {
    if (!needle.every((char, i) => page[from + i].char === char)) continue;
    const spans: QuoteSpan[] = [];
    for (let i = from; i < from + needle.length; i++) {
      const { item, offset } = page[i];
      const last = spans[spans.length - 1];
      if (last && last.item === item) last.end = offset + 1;
      else spans.push({ item, start: offset, end: offset + 1 });
    }
    return spans;
  }
  return null;
}

/** Prodotto di due matrici affini nel formato di pdf.js (a, b, c, d, e, f). */
function multiply(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

/**
 * I rettangoli da evidenziare. `viewportTransform` è la matrice del viewport con cui la pagina è stata disegnata;
 * `canvasWidth`/`canvasHeight` le dimensioni dell'immagine. Dentro un elemento la frase è posizionata in proporzione
 * ai caratteri: basta per un'evidenziazione, non pretende di conoscere la larghezza di ogni lettera.
 * Una pagina ruotata non è gestita: i rettangoli sarebbero fuori posto, quindi non se ne restituisce nessuno.
 */
export function highlightRects(
  items: PageTextItem[],
  spans: QuoteSpan[],
  viewportTransform: number[],
  canvasWidth: number,
  canvasHeight: number,
): HighlightRect[] {
  if (canvasWidth <= 0 || canvasHeight <= 0) return [];
  const rects: HighlightRect[] = [];

  for (const span of spans) {
    const item = items[span.item];
    const length = [...item.str].length;
    if (length === 0) continue;
    const tx = multiply(viewportTransform, item.transform);
    // Con testo ruotato (b o c non nulli) un rettangolo allineato agli assi non descrive più il testo.
    if (Math.abs(tx[1]) > 1e-3 || Math.abs(tx[2]) > 1e-3) continue;

    const scale = Math.hypot(viewportTransform[0], viewportTransform[1]);
    const fontHeight = Math.abs(tx[3]);
    const itemWidth = item.width * scale;
    const left = tx[4] + (itemWidth * span.start) / length;
    const width = (itemWidth * (span.end - span.start)) / length;
    // Il punto di base della riga è tx[5]: l'ingombro sale da lì (le y del viewport crescono verso il basso).
    const top = tx[5] - fontHeight;

    rects.push({
      left: (left / canvasWidth) * 100,
      top: (top / canvasHeight) * 100,
      width: (width / canvasWidth) * 100,
      height: ((fontHeight * 1.2) / canvasHeight) * 100,
    });
  }
  return rects;
}
