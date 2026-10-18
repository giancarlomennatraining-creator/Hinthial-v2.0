import sharp from "sharp";

/** PDF a pagina singola con una riga di testo per voce (Helvetica, A4): il testo si legge davvero, come in un PDF vero. */
export function buildPdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/[\()]/g, "\$&").replace(/[^\x20-\x7e]/g, (c) => ({ à: "a", è: "e", é: "e", ì: "i", ò: "o", ù: "u", "€": "EUR", "’": "'", "–": "-" })[c] ?? "?");
  const stream = lines.map((l, i) => `BT /F1 ${i === 0 ? 16 : 11} Tf 60 ${770 - i * 18} Td (${esc(l)}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) pdf += `${String(o).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** La "prima pagina" di un documento come miniatura: intestazione colorata, titolo e le prime righe. */
export async function pageThumbnail(lines: string[], accent: string): Promise<Buffer> {
  const [title, ...rest] = lines;
  const body = rest
    .slice(0, 14)
    .map((l, i) => `<text x="44" y="${150 + i * 26}" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#3a4350">${xml(l.slice(0, 52))}</text>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#ffffff"/>
    <rect width="600" height="84" fill="${accent}"/><text x="44" y="54" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="bold" fill="#ffffff">${xml((title ?? "").slice(0, 34))}</text>${body}
    <rect x="44" y="700" width="200" height="2" fill="#c9d2dc"/><rect x="44" y="722" width="120" height="2" fill="#dfe5eb"/></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 72 }).toBuffer();
}

/** Una "foto" riconoscibile ma finta: sfumatura, qualche forma e una didascalia. Per immagini e scansioni. */
export async function pictureJpeg(caption: string, hue: [string, string], width = 1200, height = 800): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hue[0]}"/><stop offset="1" stop-color="${hue[1]}"/></linearGradient></defs>
    <rect width="${width}" height="${height}" fill="url(#g)"/>
    <circle cx="${width * 0.72}" cy="${height * 0.3}" r="${height * 0.14}" fill="#ffffff" opacity="0.35"/>
    <rect x="${width * 0.1}" y="${height * 0.55}" width="${width * 0.8}" height="${height * 0.3}" rx="24" fill="#ffffff" opacity="0.22"/>
    <text x="${width * 0.1}" y="${height * 0.9}" font-family="Arial, Helvetica, sans-serif" font-size="${height * 0.06}" fill="#ffffff">${xml(caption)}</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 78 }).toBuffer();
}

/** Un breve messaggio audio finto: due note con dissolvenza, WAV a 16 bit, 8 kHz. Si riproduce davvero. */
export function toneWav(seconds: number, notes: number[] = [440, 523]): Buffer {
  const rate = 8000;
  const samples = Math.floor(seconds * rate);
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    const t = i / rate;
    const note = notes[Math.min(notes.length - 1, Math.floor((i / samples) * notes.length))];
    const fade = Math.min(1, t * 8, (seconds - t) * 8);
    data.writeInt16LE(Math.round(Math.sin(2 * Math.PI * note * t) * 9000 * Math.max(0, fade)), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}
