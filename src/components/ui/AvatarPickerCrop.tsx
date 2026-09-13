"use client";

import { useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { clampOffset, computeCropRect, coverScale } from "@/lib/image-crop";

const CONTAINER_SIZE = 240;
const OUTPUT_SIZE = 256;
const MAX_ZOOM = 3;

/**
 * Il ritaglio a quadrato di una foto --- estratto da AvatarUploadForm
 * (Impostazioni > Informazioni utente) per essere riusato anche per la
 * foto di un amico (v. Create/EditFriendForm): stesso ritaglio via
 * `<canvas>` lato client, un solo file già pronto in uscita (mai un
 * zoom/posizione da riapplicare altrove). "Scatta foto"/"Carica foto"
 * riusano il trucco già validato in Archivio (v. CreateArchiveItemForm):
 * un solo `<input type="file">`, con `capture` impostato un istante
 * prima solo per il primo tasto.
 */
export function AvatarPickerCrop({
  currentAvatarUrl,
  fallbackFirstName,
  fallbackLastName,
  fallbackSeed,
  busy = false,
  onCropped,
  onRemove,
}: {
  currentAvatarUrl: string | null;
  fallbackFirstName: string;
  fallbackLastName: string;
  fallbackSeed: string;
  busy?: boolean;
  onCropped: (blob: Blob) => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragState = useRef<{
    startX: number;
    startY: number;
    startOffsetLeft: number;
    startOffsetTop: number;
  } | null>(null);

  const [pickedImageSrc, setPickedImageSrc] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ left: 0, top: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scale = naturalSize ? coverScale(naturalSize.width, naturalSize.height, CONTAINER_SIZE) * zoom : 1;
  const displayedWidth = naturalSize ? naturalSize.width * scale : 0;
  const displayedHeight = naturalSize ? naturalSize.height * scale : 0;

  function resetCropState() {
    if (pickedImageSrc) URL.revokeObjectURL(pickedImageSrc);
    setPickedImageSrc(null);
    setNaturalSize(null);
    setZoom(1);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setPickedImageSrc(URL.createObjectURL(file));
    setZoom(1);
  }

  // V. CreateArchiveItemForm per il ragionamento completo: `capture`
  // impostato un istante prima dell'apertura, tolto dopo, un solo input.
  function handleCameraClick() {
    const input = fileInputRef.current;
    if (!input) return;
    input.setAttribute("capture", "environment");
    input.click();
  }

  function handleFileInputBlur(event: React.FocusEvent<HTMLInputElement>) {
    event.target.removeAttribute("capture");
  }

  function handleImageLoad() {
    const img = imgRef.current;
    if (!img) return;
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    setNaturalSize({ width, height });

    const initialScale = coverScale(width, height, CONTAINER_SIZE);
    setOffset({
      left: (CONTAINER_SIZE - width * initialScale) / 2,
      top: (CONTAINER_SIZE - height * initialScale) / 2,
    });
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    dragState.current = {
      startX: event.clientX,
      startY: event.clientY,
      startOffsetLeft: offset.left,
      startOffsetTop: offset.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragState.current) return;
    const dx = event.clientX - dragState.current.startX;
    const dy = event.clientY - dragState.current.startY;
    setOffset({
      left: clampOffset(dragState.current.startOffsetLeft + dx, displayedWidth, CONTAINER_SIZE),
      top: clampOffset(dragState.current.startOffsetTop + dy, displayedHeight, CONTAINER_SIZE),
    });
  }

  function handlePointerUp() {
    dragState.current = null;
  }

  function handleZoomChange(nextZoom: number) {
    setZoom(nextZoom);
    if (!naturalSize) return;
    const nextScale = coverScale(naturalSize.width, naturalSize.height, CONTAINER_SIZE) * nextZoom;
    setOffset((prev) => ({
      left: clampOffset(prev.left, naturalSize.width * nextScale, CONTAINER_SIZE),
      top: clampOffset(prev.top, naturalSize.height * nextScale, CONTAINER_SIZE),
    }));
  }

  async function handleSave() {
    const img = imgRef.current;
    if (!img || !naturalSize) return;

    setSaving(true);
    setError(null);
    try {
      const { sx, sy, sSize } = computeCropRect({
        naturalWidth: naturalSize.width,
        containerSize: CONTAINER_SIZE,
        offsetLeft: offset.left,
        offsetTop: offset.top,
        displayedWidth,
      });

      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Impossibile preparare l'immagine.");
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error("Impossibile generare l'immagine."))),
          "image/jpeg",
          0.9,
        );
      });

      await onCropped(blob);
      resetCropState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile salvare la foto.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!onRemove) return;
    setSaving(true);
    setError(null);
    try {
      await onRemove();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile rimuovere la foto.");
    } finally {
      setSaving(false);
    }
  }

  const disabled = busy || saving;

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {pickedImageSrc ? (
        <div className="flex flex-col gap-3">
          <div
            className="relative touch-none select-none overflow-hidden rounded-full border border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900"
            style={{ width: CONTAINER_SIZE, height: CONTAINER_SIZE }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- immagine scelta in locale (object URL), in fase di ritaglio interattivo */}
            <img
              ref={imgRef}
              src={pickedImageSrc}
              alt=""
              onLoad={handleImageLoad}
              draggable={false}
              className="absolute cursor-move"
              style={{
                left: offset.left,
                top: offset.top,
                width: displayedWidth || undefined,
                height: displayedHeight || undefined,
                maxWidth: "none",
              }}
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            Zoom
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.05}
              value={zoom}
              onChange={(e) => handleZoomChange(Number(e.target.value))}
              className="flex-1"
            />
          </label>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={disabled || !naturalSize}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {saving ? "Salvataggio…" : "Salva foto"}
            </button>
            <button
              type="button"
              onClick={resetCropState}
              disabled={disabled}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Annulla
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <Avatar
            firstName={fallbackFirstName}
            lastName={fallbackLastName}
            avatarUrl={currentAvatarUrl}
            seed={fallbackSeed}
            size="lg"
          />
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <label className="w-fit cursor-pointer rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">
                {currentAvatarUrl ? "Cambia foto" : "Carica foto"}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  onBlur={handleFileInputBlur}
                />
              </label>
              {/* Solo su smartphone --- su desktop l'attributo capture viene
                  ignorato e si apre comunque la normale finestra di scelta
                  (v. CreateArchiveItemForm). */}
              <button
                type="button"
                onClick={handleCameraClick}
                className="w-fit rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                📷 Scatta foto
              </button>
            </div>
            {currentAvatarUrl && onRemove ? (
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled}
                className="w-fit text-sm font-medium text-red-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-red-400"
              >
                Rimuovi foto
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
