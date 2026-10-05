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
| `logo-lockup.svg` | Logo + nome combinati in un'unica immagine (usata nelle schermate di login/registrazione) | SVG |
| `favicon.png` | Icona per la scheda del browser | PNG, 512x512px (Next.js genera le altre dimensioni) |

SVG è preferibile perché resta nitido a ogni dimensione (sidebar,
header, favicon); se hai solo PNG/JPG va bene comunque, basta usare lo
stesso nome file con l'estensione corretta e dirmelo.

## Come vengono usati

Una volta aggiunti i file, aggiorno io i punti dell'interfaccia che
oggi mostrano "HINTHIAL" come testo semplice (sidebar dell'app, header
delle pagine di login/registrazione, landing page, favicon del
browser) per usare questi asset al loro posto.

## `hinthia/` --- il set ridotto dell'avatar dell'assistente

`hinthia-avatar.svg` (l'avatar di HINTHIA, fornito dal proprietario) è
un guscio SVG attorno a un PNG da 1312x1199: **1,3 MB**, troppi per
mostrarlo a 30px accanto a una risposta in chat. La cartella `hinthia/`
contiene copie ridotte, ricavate **solo** per ridimensionamento
meccanico dall'originale --- nessun ridisegno, nessuna modifica al
soggetto; l'originale resta qui intatto ed è la fonte da cui
rigenerarle.

Come sono state ricavate: estratto il PNG incorporato, tolti i bordi
trasparenti (a 32-64px una cornice vuota si mangia il soggetto),
portato su tela quadrata trasparente --- così l'immagine entra in un
riquadro quadrato o tondo senza deformarsi e senza che un ritaglio
circolare tagli i germogli, che sono metà del personaggio --- e
ridotto alle misure sotto. Sfondo trasparente a ogni misura, PNG e
WebP.

| File | Per cosa |
|---|---|
| `hinthia-32.*` | solo dove lo spazio è davvero minimo: a questa misura la faccia non si legge più |
| `hinthia-64.*` | misura minima consigliata per l'avatar accanto a un messaggio in chat (30px a schermo, densità 2x) |
| `hinthia-128.*` | intestazione di sezione, stato "sta pensando" |
| `hinthia-256.*` | presentazione grande (es. chat vuota: "Ciao, sono Hinthia") |
| `hinthia-512.*` | la stessa, su schermi ad alta densità |

Nota: l'SVG originale porta con sé i metadati C2PA (content
credentials) dell'immagine; le copie ridotte, essendo PNG/WebP
rigenerati, non li conservano.
