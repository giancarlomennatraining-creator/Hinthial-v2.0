# Brand assets

Questa cartella contiene gli asset di brand ufficiali di HINTHIAL
(logo, wordmark, eventuali varianti), forniti dal proprietario del
progetto --- **non generati né ridisegnati da Claude Code**.

## File attesi

Metti qui i tuoi file con questi nomi (così il codice può referenziarli
senza bisogno di ulteriori modifiche):

| File | Cosa | Formato consigliato |
|---|---|---|
| `logo.svg` | Logo/simbolo principale | SVG (vettoriale, si adatta a qualsiasi dimensione) |
| `logo-dark.svg` | Variante per sfondo scuro (opzionale, se diversa da `logo.svg`) | SVG |
| `wordmark.svg` | La scritta "HINTHIAL" nel lettering ufficiale, se separata dal simbolo | SVG |
| `favicon.png` | Icona per la scheda del browser | PNG, 512x512px (Next.js genera le altre dimensioni) |

SVG è preferibile perché resta nitido a ogni dimensione (sidebar,
header, favicon); se hai solo PNG/JPG va bene comunque, basta usare lo
stesso nome file con l'estensione corretta e dirmelo.

## Come vengono usati

Una volta aggiunti i file, aggiorno io i punti dell'interfaccia che
oggi mostrano "HINTHIAL" come testo semplice (sidebar dell'app, header
delle pagine di login/registrazione, landing page, favicon del
browser) per usare questi asset al loro posto.
