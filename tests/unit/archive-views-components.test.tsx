import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CollectionsView } from "@/components/documents/archive/CollectionsView";
import { GalleryView } from "@/components/documents/archive/GalleryView";
import { ShelfView } from "@/components/documents/archive/ShelfView";
import { TimelineView } from "@/components/documents/archive/TimelineView";
import type { ArchiveData } from "@/components/documents/archive/useArchiveData";
import type { Category } from "@/domain/categories/types";
import type { DocumentSummary } from "@/domain/documents/types";

// Il menu "Vista" ha le sue prove (e2e): qui si guardano le viste.
vi.mock("@/components/documents/archive/ArchiveViewSwitcher", () => ({ ArchiveViewSwitcher: () => null }));

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();
const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10);

const CATEGORIES: Category[] = [
  { id: "c-ass", name: "Assicurazioni", icon: "🛡️", aiExtractionEnabled: false, aiExtractionEnabledUntil: null },
  { id: "c-casa", name: "Casa", icon: "🏠", aiExtractionEnabled: false, aiExtractionEnabledUntil: null },
];

function doc(over: Partial<DocumentSummary> & { id: string }): DocumentSummary {
  return {
    filename: `${over.id}.pdf`,
    mimeType: "application/pdf",
    size: 200_000,
    categoryId: null,
    relatedAssetId: null,
    createdAt: daysAgo(2),
    storagePath: `p/${over.id}`,
    wrappedDocumentKey: "k",
    expiresAt: null,
    notes: "",
    tags: [],
    extractedAt: null,
    hasThumbnail: false,
    dossierIds: [],
    deletedAt: null,
    purgeAt: null,
    issuer: "",
    aiExtractionExcluded: false,
    structuredFields: {},
    analysisStatus: null,
    analysisUpdatedAt: null,
    ...over,
  } as DocumentSummary;
}

const DOCS = [
  doc({ id: "polizza", filename: "Polizza RCA.pdf", categoryId: "c-ass", expiresAt: inDays(9), analysisStatus: "completed", issuer: "Alfa" }),
  doc({ id: "bolletta", filename: "Bolletta luce.pdf", categoryId: "c-casa", createdAt: daysAgo(40), expiresAt: inDays(400) }),
  doc({ id: "appunti", filename: "Appunti.txt", mimeType: "text/plain", createdAt: daysAgo(80) }),
  doc({ id: "foto", filename: "Foto.jpg", mimeType: "image/jpeg", createdAt: daysAgo(80), categoryId: "c-casa" }),
];

function makeData(docs = DOCS, over: Partial<ArchiveData> = {}): ArchiveData {
  let selected = new Set<string>();
  const data = {
    supabase: {} as never,
    masterKey: {} as CryptoKey,
    categories: CATEGORIES,
    assets: [],
    dossiers: [],
    documents: docs,
    setDocuments: () => {},
    loading: false,
    error: null,
    setError: () => {},
    refresh: async () => {},
    busyDocId: null,
    setBusyDocId: () => {},
    trashRetentionDays: 15,
    get selectedIds() {
      return selected;
    },
    setSelectedIds: (next: Set<string>) => {
      selected = next;
    },
    selectedDocuments: [],
    toggleSelected: () => {},
    toggleSelectAll: () => {},
    clearSelection: () => {},
    bulkBusy: false,
    bulkPopover: null,
    setBulkPopover: () => {},
    bulkTagInput: "",
    setBulkTagInput: () => {},
    handleOpen: async () => {},
    handleDelete: async () => {},
    handleBulkDelete: async () => {},
    handleBulkCategory: async () => {},
    handleBulkTag: async () => {},
    handleBulkDossier: async () => {},
    categoryFor: (d: DocumentSummary) => CATEGORIES.find((c) => c.id === d.categoryId),
    assetFor: () => undefined,
    ...over,
  };
  return data as unknown as ArchiveData;
}

describe("Cassettiera", () => {
  it("mostra una scheda per documento, le viste con i conteggi e le faccette", () => {
    render(<GalleryView data={makeData()} />);
    expect(screen.getByRole("link", { name: "Apri Polizza RCA.pdf" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /^Apri / })).toHaveLength(4);
    expect(screen.getByRole("button", { name: /^Tutti\s*4$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^In scadenza\s*1$/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Senza categoria\s*1$/ })).toHaveLength(2); // la vista in alto e la faccetta a sinistra
    const rail = screen.getByRole("complementary", { name: "Filtri" });
    expect(within(rail).getByRole("button", { name: /Assicurazioni/ })).toBeInTheDocument();
  });

  it("le viste e le faccette restringono le schede, e si combinano", () => {
    render(<GalleryView data={makeData()} />);
    fireEvent.click(screen.getByRole("button", { name: /^In scadenza/ }));
    expect(screen.getAllByRole("link", { name: /^Apri / }).map((a) => a.getAttribute("aria-label"))).toEqual(["Apri Polizza RCA.pdf"]);

    fireEvent.click(screen.getByRole("button", { name: /^Tutti/ }));
    const rail = screen.getByRole("complementary", { name: "Filtri" });
    fireEvent.click(within(rail).getByRole("button", { name: /Casa/ }));
    expect(screen.getAllByRole("link", { name: /^Apri / })).toHaveLength(2);
    fireEvent.click(within(rail).getByRole("button", { name: /Immagine/ }));
    expect(screen.getAllByRole("link", { name: /^Apri / })).toHaveLength(1);
    expect(screen.getByText("Mostro 1 di 1 · Casa")).toBeInTheDocument();
  });

  it("la ricerca cerca anche nell'emittente, e senza risultati lo dice", () => {
    render(<GalleryView data={makeData()} />);
    fireEvent.change(screen.getByLabelText("Cerca nell'archivio"), { target: { value: "alfa" } });
    expect(screen.getAllByRole("link", { name: /^Apri / })).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Cerca nell'archivio"), { target: { value: "zzz" } });
    expect(screen.getByText("Nessun contenuto corrisponde ai filtri.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Togli i filtri" }));
    expect(screen.getAllByRole("link", { name: /^Apri / })).toHaveLength(4);
  });

  it("selezionare una scheda chiama la selezione, e con dei selezionati compare la barra delle azioni", () => {
    const toggleSelected = vi.fn();
    render(<GalleryView data={makeData(DOCS, { toggleSelected })} />);
    fireEvent.click(screen.getByRole("button", { name: "Seleziona Polizza RCA.pdf" }));
    expect(toggleSelected).toHaveBeenCalledWith("polizza");
    expect(screen.queryByRole("toolbar")).toBeNull();

    render(<GalleryView data={makeData(DOCS, { selectedIds: new Set(["polizza", "foto"]) })} />);
    const bar = screen.getByRole("toolbar", { name: "Azioni sui documenti selezionati" });
    expect(bar).toHaveTextContent("2 selezionati");
    expect(within(bar).getByRole("button", { name: "Cestino" })).toBeInTheDocument();
  });

  it("con molti documenti ne mostra sessanta e propone gli altri", () => {
    const many = Array.from({ length: 75 }, (_, i) => doc({ id: `d${i}`, createdAt: daysAgo(i + 1) }));
    render(<GalleryView data={makeData(many)} />);
    expect(screen.getAllByRole("link", { name: /^Apri / })).toHaveLength(60);
    fireEvent.click(screen.getByRole("button", { name: "Mostra altri 15" }));
    expect(screen.getAllByRole("link", { name: /^Apri / })).toHaveLength(75);
  });
});

describe("Linea del tempo", () => {
  it("raggruppa per mese, mostra le scadenze in arrivo e la mappa dei mesi", () => {
    render(<TimelineView data={makeData()} />);
    expect(screen.getByRole("region", { name: "In arrivo" })).toHaveTextContent("Polizza RCA.pdf");
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings.length).toBeGreaterThanOrEqual(2);
    const map = screen.getByRole("complementary", { name: "Mappa del tempo" });
    expect(within(map).getAllByRole("button", { name: /documenti$/ }).length).toBeGreaterThanOrEqual(2);
  });

  it("scegliere un mese sulla mappa mostra solo quello, e 'Tutti i mesi' lo toglie", () => {
    render(<TimelineView data={makeData()} />);
    const map = screen.getByRole("complementary", { name: "Mappa del tempo" });
    const months = within(map).getAllByRole("button", { name: /documenti$/ });
    const before = screen.getAllByRole("heading", { level: 3 }).length;
    fireEvent.click(months[months.length - 1]);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
    fireEvent.click(within(map).getByRole("button", { name: "Tutti i mesi" }));
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(before);
  });

  it("i filtri restringono i documenti", () => {
    render(<TimelineView data={makeData()} />);
    fireEvent.click(screen.getByRole("button", { name: /^Da leggere con Hinthia$/ }));
    expect(screen.queryByRole("link", { name: /^Apri Polizza RCA/ })).toBeNull(); // già letto
    fireEvent.change(screen.getByLabelText("Cerca nell'archivio"), { target: { value: "bolletta" } });
    expect(screen.getAllByRole("link", { name: "Apri Bolletta luce.pdf" }).length).toBeGreaterThan(0);
  });
});

describe("Collezioni", () => {
  it("la home dice cosa chiede attenzione e mostra una collezione per categoria", () => {
    render(<CollectionsView data={makeData()} />);
    expect(screen.getByRole("region", { name: "Richiedono attenzione" })).toHaveTextContent("In scadenza");
    expect(screen.getByRole("button", { name: /Apri Assicurazioni, 1 documenti/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Apri Casa, 2 documenti/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Apri Senza categoria, 1 documenti/ })).toBeInTheDocument();
  });

  it("aprire una collezione mostra la tabella, e si torna indietro", () => {
    render(<CollectionsView data={makeData()} />);
    fireEvent.click(screen.getByRole("button", { name: /Apri Casa, 2 documenti/ }));
    expect(screen.getByRole("heading", { level: 1, name: "Casa" })).toBeInTheDocument();
    expect(screen.getByText("2 documenti · ordinati per data di aggiunta")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bolletta luce.pdf" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Polizza RCA.pdf" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Archivio/ }));
    expect(screen.getByRole("heading", { level: 1, name: "Archivio" })).toBeInTheDocument();
  });

  it("le colonne si ordinano e il verso si inverte al secondo clic", () => {
    render(<CollectionsView data={makeData()} />);
    fireEvent.click(screen.getByRole("button", { name: /Apri Casa, 2 documenti/ }));
    const names = () => screen.getAllByRole("link", { name: /^(?!Apri).*\.(pdf|jpg)$/ }).map((a) => a.textContent);
    fireEvent.click(screen.getByRole("button", { name: /^NOME/ }));
    expect(names()).toEqual(["Bolletta luce.pdf", "Foto.jpg"]);
    fireEvent.click(screen.getByRole("button", { name: /^NOME/ }));
    expect(names()).toEqual(["Foto.jpg", "Bolletta luce.pdf"]);
  });

  it("una card di attenzione apre l'elenco di quei documenti", () => {
    render(<CollectionsView data={makeData()} />);
    fireEvent.click(screen.getByRole("button", { name: /Da leggere con Hinthia/ }));
    expect(screen.getByRole("heading", { level: 1, name: "Da leggere con Hinthia" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Polizza RCA.pdf" })).toBeNull();
    expect(screen.getByRole("link", { name: "Foto.jpg" })).toBeInTheDocument();
  });

  it("la ricerca in alto trova nei documenti di tutta la collezione", () => {
    render(<CollectionsView data={makeData()} />);
    fireEvent.change(screen.getByLabelText("Cerca nell'archivio"), { target: { value: "bolletta" } });
    expect(screen.getByRole("heading", { level: 1, name: "Risultati" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bolletta luce.pdf" })).toBeInTheDocument();
  });
});

describe("Scaffale", () => {
  it("un dorso per documento, e cliccarlo ne apre la scheda a destra", () => {
    render(<ShelfView data={makeData()} />);
    expect(screen.getByRole("button", { name: "Polizza RCA.pdf" })).toBeInTheDocument();
    expect(screen.getByText("Sfoglia lo scaffale")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Polizza RCA.pdf" }));
    const panel = screen.getByRole("complementary", { name: "Dettaglio del volume" });
    expect(within(panel).getByText("Polizza RCA.pdf")).toBeInTheDocument();
    expect(within(panel).getByText("Letto da Hinthia")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Apri" })).toHaveAttribute("href", expect.stringMatching(/\/archive\/polizza$/));
    fireEvent.click(within(panel).getByRole("button", { name: "Rimetti a posto" }));
    expect(screen.getByText("Sfoglia lo scaffale")).toBeInTheDocument();
  });

  it("i filtri illuminano senza nascondere: gli altri dorsi si abbassano di opacità", () => {
    render(<ShelfView data={makeData()} />);
    fireEvent.click(screen.getByRole("button", { name: "In scadenza" }));
    expect(screen.getByRole("button", { name: "Polizza RCA.pdf" })).toHaveStyle({ opacity: "1" });
    expect(screen.getByRole("button", { name: "Bolletta luce.pdf" })).toHaveStyle({ opacity: "0.2" });
    expect(screen.getByText("1 documento illuminato su 4")).toBeInTheDocument();
  });

  it("la ricerca illumina i dorsi che corrispondono", () => {
    render(<ShelfView data={makeData()} />);
    fireEvent.change(screen.getByLabelText("Cerca nell'archivio"), { target: { value: "foto" } });
    expect(screen.getByRole("button", { name: "Foto.jpg" })).toHaveStyle({ opacity: "1" });
    expect(screen.getByRole("button", { name: "Polizza RCA.pdf" })).toHaveStyle({ opacity: "0.2" });
  });
});
