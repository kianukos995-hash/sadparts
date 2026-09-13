import { normalizeSku } from "@/lib/format";

export type PairSide = "L" | "R";

const LEFT =
  /(^|[^A-ZА-ЯЁ])(LH|LEFT|ЛЕВАЯ|ЛЕВЫЙ|ЛЕВОЕ|ЛЕВЫЕ|ЛЕВ\.?|ЛЮВАЯ)(?=[^A-ZА-ЯЁ]|$)/i;
const RIGHT =
  /(^|[^A-ZА-ЯЁ])(RH|RIGHT|ПРАВАЯ|ПРАВЫЙ|ПРАВОЕ|ПРАВЫЕ|ПРАВ\.?)(?=[^A-ZА-ЯЁ]|$)/i;

const CONSUMABLE =
  /прокладк|кольц|сальник|уплотн|gasket|seal|o-?ring|кольцо|манжет/i;

export function detectPairSide(text: string): PairSide | "" {
  const value = text.trim();
  if (!value) return "";
  const hasL = LEFT.test(value);
  const hasR = RIGHT.test(value);
  if (hasL && !hasR) return "L";
  if (hasR && !hasL) return "R";
  return "";
}

export function flipSideText(text: string) {
  const side = detectPairSide(text);
  if (!side) return text;
  let next = text;
  if (side === "L") {
    next = next.replace(/ЛЕВАЯ/gi, "ПРАВАЯ");
    next = next.replace(/ЛЕВЫЙ/gi, "ПРАВЫЙ");
    next = next.replace(/ЛЕВОЕ/gi, "ПРАВОЕ");
    next = next.replace(/ЛЕВЫЕ/gi, "ПРАВЫЕ");
    next = next.replace(/LEFT/gi, "RIGHT");
    next = next.replace(/\bLH\b/gi, "RH");
    next = next.replace(/([/-_])L(\b|$)/gi, "$1R$2");
  } else {
    next = next.replace(/ПРАВАЯ/gi, "ЛЕВАЯ");
    next = next.replace(/ПРАВЫЙ/gi, "ЛЕВЫЙ");
    next = next.replace(/ПРАВОЕ/gi, "ЛЕВОЕ");
    next = next.replace(/ПРАВЫЕ/gi, "ЛЕВЫЕ");
    next = next.replace(/RIGHT/gi, "LEFT");
    next = next.replace(/\bRH\b/gi, "LH");
    next = next.replace(/([/-_])R(\b|$)/gi, "$1L$2");
  }
  return next;
}

export function pairQuery(sku: string, name: string) {
  const blob = `${sku} ${name}`;
  const side = detectPairSide(blob);
  if (!side) return { side: "" as const, sku: "", name: "" };
  return {
    side,
    sku: normalizeSku(flipSideText(sku)),
    name: flipSideText(name),
  };
}

export function isRelatedConsumable(name: string) {
  return CONSUMABLE.test(name);
}

export function pairLabel(side: PairSide | "" | undefined) {
  if (side === "L") return "левая";
  if (side === "R") return "правая";
  return "";
}
