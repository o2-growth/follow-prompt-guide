/**
 * Embeds O2 Inc. brand fonts into a jsPDF doc instance.
 * Anton (display, fallback for Tusker), Montserrat (body), JetBrains Mono (eyebrows).
 *
 * TTFs live in src/assets/fonts/pdf/. Vite's ?url import gives us a hashed URL,
 * we fetch + cache as base64 once per session.
 */
import type jsPDF from "jspdf";

import AntonRegular from "@/assets/fonts/pdf/Anton-Regular.ttf?url";
import MontserratRegular from "@/assets/fonts/pdf/Montserrat-Regular.ttf?url";
import MontserratBold from "@/assets/fonts/pdf/Montserrat-Bold.ttf?url";
import MontserratItalic from "@/assets/fonts/pdf/Montserrat-Italic.ttf?url";
import JetBrainsRegular from "@/assets/fonts/pdf/JetBrainsMono-Regular.ttf?url";
import JetBrainsBold from "@/assets/fonts/pdf/JetBrainsMono-Bold.ttf?url";

export const FONT = {
  display: "Anton", // headlines uppercase (Tusker fallback)
  body: "Montserrat",
  mono: "JetBrainsMono",
} as const;

const SPECS: Array<{ url: string; vfs: string; family: string; style: "normal" | "bold" | "italic" }> = [
  // Anton has only one weight; alias it as both normal and bold so existing setFont(FONT.display, "bold") works.
  { url: AntonRegular, vfs: "Anton-Regular.ttf", family: FONT.display, style: "normal" },
  { url: AntonRegular, vfs: "Anton-Regular.ttf", family: FONT.display, style: "bold" },
  { url: MontserratRegular, vfs: "Montserrat-Regular.ttf", family: FONT.body, style: "normal" },
  { url: MontserratBold, vfs: "Montserrat-Bold.ttf", family: FONT.body, style: "bold" },
  { url: MontserratItalic, vfs: "Montserrat-Italic.ttf", family: FONT.body, style: "italic" },
  { url: JetBrainsRegular, vfs: "JetBrainsMono-Regular.ttf", family: FONT.mono, style: "normal" },
  { url: JetBrainsBold, vfs: "JetBrainsMono-Bold.ttf", family: FONT.mono, style: "bold" },
];

let cache: Array<{ vfs: string; family: string; style: "normal" | "bold" | "italic"; b64: string }> | null = null;

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

export async function ensureFontsLoaded(): Promise<void> {
  if (cache) return;
  cache = await Promise.all(
    SPECS.map(async (s) => ({ ...s, b64: await fetchAsBase64(s.url) }))
  );
}

export function registerFonts(doc: jsPDF): void {
  if (!cache) throw new Error("Call ensureFontsLoaded() before registerFonts(doc)");
  for (const f of cache) {
    doc.addFileToVFS(f.vfs, f.b64);
    doc.addFont(f.vfs, f.family, f.style);
  }
}
