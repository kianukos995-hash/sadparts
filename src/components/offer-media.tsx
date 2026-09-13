"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ExternalLink, ImageOff, X } from "lucide-react";
import { isDisplayableImage, isRemoteRef } from "@/lib/media";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function Thumb({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- supplier CDNs and /api/media are arbitrary hosts
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function PhotoViewer({
  sku,
  photos,
  index,
  onIndex,
  onClose,
}: {
  sku: string;
  photos: string[];
  index: number;
  onIndex: (value: number) => void;
  onClose: () => void;
}) {
  const current = photos[index] ?? photos[0];

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") {
        onIndex((index - 1 + photos.length) % photos.length);
      }
      if (event.key === "ArrowRight") {
        onIndex((index + 1) % photos.length);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, onClose, onIndex, photos.length]);

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border bg-background p-3 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Фото {sku}</p>
            <p className="text-xs text-muted-foreground">
              {photos.length > 1 ? `${index + 1} из ${photos.length}` : "Просмотр в программе"}
            </p>
          </div>
          <Button type="button" size="icon-sm" variant="ghost" onClick={onClose}>
            <X />
          </Button>
        </div>
        <div className="relative flex min-h-48 items-center justify-center rounded-lg bg-muted/40 p-2">
          {current ? (
            <Thumb src={current} alt={sku} className="max-h-[55vh] w-full object-contain" />
          ) : null}
          {photos.length > 1 ? (
            <>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                className="absolute left-2 top-1/2 -translate-y-1/2"
                onClick={() => onIndex((index - 1 + photos.length) % photos.length)}
              >
                <ChevronLeft />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => onIndex((index + 1) % photos.length)}
              >
                <ChevronRight />
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function OfferMedia({
  images,
  sku,
  size = "md",
}: {
  images?: string[];
  sku: string;
  size?: "sm" | "md" | "lg";
}) {
  const list = images?.filter(Boolean) ?? [];
  const photos = list.filter((item) => isDisplayableImage(item));
  const links = list.filter((item) => isRemoteRef(item) && !isDisplayableImage(item));
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const box =
    size === "sm"
      ? "size-14"
      : size === "lg"
        ? "h-40 w-full max-w-xs"
        : "size-24";

  return (
    <div className="grid gap-2">
      {photos.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {photos.map((src, photoIndex) => (
            <button
              key={src}
              type="button"
              title="Открыть фото"
              className={cn(
                "block cursor-zoom-in overflow-hidden rounded-lg border bg-muted/40",
                box,
              )}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIndex(photoIndex);
                setOpen(true);
              }}
            >
              <Thumb src={src} alt={sku} className="size-full object-contain" />
            </button>
          ))}
        </div>
      ) : (
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-muted/30 text-muted-foreground",
            box,
          )}
          title="Нет фото"
        >
          <ImageOff className="size-4" />
          {size !== "sm" ? (
            <span className="px-1 text-center text-[10px] leading-tight">Нет фото</span>
          ) : null}
        </div>
      )}
      {links.length > 0 ? (
        <div className="flex flex-col gap-1">
          {links.map((href) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-full items-center gap-1 truncate text-xs text-amber-800 hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              <ExternalLink className="size-3 shrink-0" />
              {size === "sm" ? "на сайте" : href.replace(/^https?:\/\//, "")}
            </a>
          ))}
        </div>
      ) : photos.length === 0 && size !== "sm" ? (
        <p className="text-[11px] text-muted-foreground">Ссылок на фото в прайсе нет</p>
      ) : null}
      {open && photos.length > 0 ? (
        <PhotoViewer
          sku={sku}
          photos={photos}
          index={index}
          onIndex={setIndex}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
