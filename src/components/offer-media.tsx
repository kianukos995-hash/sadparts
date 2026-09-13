"use client";

import { useState } from "react";
import { ExternalLink, ImageOff } from "lucide-react";
import { isDisplayableImage, isRemoteRef } from "@/lib/media";
import { cn } from "@/lib/utils";

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

  return (
    <div className="grid gap-2">
      {photos.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {photos.map((src) => (
            <a
              key={src}
              href={src}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "block overflow-hidden rounded-lg border bg-muted/40",
                box,
              )}
            >
              <Thumb src={src} alt={sku} className="size-full object-contain" />
            </a>
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
    </div>
  );
}
