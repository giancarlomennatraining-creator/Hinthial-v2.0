"use client";

import { CollectionsView } from "@/components/documents/archive/CollectionsView";
import { GalleryView } from "@/components/documents/archive/GalleryView";
import { ShelfView } from "@/components/documents/archive/ShelfView";
import { TimelineView } from "@/components/documents/archive/TimelineView";
import type { ArchiveData } from "@/components/documents/archive/useArchiveData";
import type { ArchiveViewMode } from "@/lib/list-view";

/** Le quattro viste alternative dell'Archivio: stessi documenti, un altro modo di trovarli. */
export function AlternativeArchiveView({ view, data }: { view: ArchiveViewMode; data: ArchiveData }) {
  switch (view) {
    case "gallery":
      return <GalleryView data={data} />;
    case "timeline":
      return <TimelineView data={data} />;
    case "collections":
      return <CollectionsView data={data} />;
    case "shelf":
      return <ShelfView data={data} />;
    default:
      return null;
  }
}
