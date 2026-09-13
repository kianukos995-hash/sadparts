"use client";

import { useState } from "react";
import { brandLogoUrl, resolveBrand, type BrandProfile } from "@/lib/brands";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function BrandMark({
  brand,
  size = "sm",
  onOpen,
}: {
  brand: string;
  size?: "sm" | "md";
  onOpen?: (profile: BrandProfile) => void;
}) {
  const profile = resolveBrand(brand);
  const logo = brandLogoUrl(profile);
  const [failed, setFailed] = useState(false);
  const box = size === "md" ? "size-10 text-xs" : "size-7 text-[10px]";
  return (
    <button
      type="button"
      title={`${profile.name}: ${profile.country}`}
      onClick={(event) => {
        event.stopPropagation();
        onOpen?.(profile);
      }}
      className="inline-flex max-w-full items-center gap-1.5 rounded-md text-left hover:bg-muted/60"
    >
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-md font-bold text-white",
          box,
        )}
        style={{ background: profile.color }}
      >
        {logo && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element -- brand favicons are arbitrary hosts
          <img
            src={logo}
            alt=""
            className="size-full object-contain bg-white p-0.5"
            onError={() => setFailed(true)}
          />
        ) : (
          profile.initials
        )}
      </span>
      <span className="truncate text-sm font-medium">{brand}</span>
    </button>
  );
}

export function BrandDialog({
  brand,
  onOpenChange,
}: {
  brand: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const profile = brand ? resolveBrand(brand) : null;
  return (
    <Dialog open={Boolean(brand)} onOpenChange={onOpenChange}>
      <DialogContent>
        {profile ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BrandMark brand={profile.name} size="md" />
              </DialogTitle>
              <DialogDescription>
                {profile.country} · на рынке с {profile.founded}
              </DialogDescription>
            </DialogHeader>
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Страна</dt>
                <dd>{profile.country}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Как давно на рынке</dt>
                <dd>{profile.founded}</dd>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{profile.about}</p>
            </dl>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
