"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, ImageOff } from "lucide-react";
import { isDisplayableImage, isRemoteRef } from "@/lib/media";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  photos,
  sku,
  index,
  open,
  onOpenChange,
  onIndexChange,
}: {
  photos: string[];
  sku: string;
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIndexChange: (index: number) => void;
}) {
  const current = photos[index] ?? photos[0];
  const many = photos.length > 1;

  function go(delta: number) {
    if (!many || photos.length === 0) return;
    const next = (index + delta + photos.length) % photos.length;
    onIndexChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            go(-1);
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            go(1);
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Просмотр фото</DialogTitle>
          <DialogDescription>
            {sku}
            {many ? ` · ${index + 1} из ${photos.length}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[min(22rem,50vh)] items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element -- supplier CDNs and /api/media are arbitrary hosts
            <img
              src={current}
              alt={sku}
              className="max-h-[min(22rem,50vh)] w-full object-contain"
              referrerPolicy="no-referrer"
            />
          ) : null}
        </div>
        {many ? (
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => go(-1)}>
              <ChevronLeft />
              Назад
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => go(1)}>
              Далее
              <ChevronRight />
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
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
  const box =
    size === "sm"
      ? "size-14"
      : size === "lg"
        ? "h-40 w-full max-w-xs"
        : "size-24";
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const currentIndex = photos.length === 0 ? 0 : Math.min(index, photos.length - 1);

  return (
    <div className="grid gap-2">
      {photos.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {photos.map((src, photoIndex) => (
            <button
              key={src}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setIndex(photoIndex);
                setOpen(true);
              }}
              className={cn(
                "block cursor-pointer overflow-hidden rounded-lg border bg-muted/40 hover:opacity-90",
                box,
              )}
              aria-label={`Просмотр фото ${sku}`}
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
            >
              <ExternalLink className="size-3 shrink-0" />
              {size === "sm" ? "на сайте" : href.replace(/^https?:\/\//, "")}
            </a>
          ))}
        </div>
      ) : photos.length === 0 && size !== "sm" ? (
        <p className="text-[11px] text-muted-foreground">Ссылок на фото в прайсе нет</p>
      ) : null}
      {photos.length > 0 ? (
        <PhotoViewer
          photos={photos}
          sku={sku}
          index={currentIndex}
          open={open}
          onOpenChange={setOpen}
          onIndexChange={setIndex}
        />
      ) : null}
    </div>
  );
}
