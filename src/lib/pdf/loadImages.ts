/**
 * Pre-loads brand logos as data URLs for embedding in jsPDF via doc.addImage().
 */
import o2White from "@/assets/branding/o2-logo-white.png";
import g4White from "@/assets/branding/g4-logo-white.png";

export interface PdfBrandImages {
  o2White: string; // data URL
  g4White: string;
  o2Width: number;
  o2Height: number;
  g4Width: number;
  g4Height: number;
}

let cache: PdfBrandImages | null = null;

function loadAsDataURL(url: string): Promise<{ dataUrl: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      resolve({ dataUrl: canvas.toDataURL("image/png"), w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = reject;
    img.src = url;
  });
}

export async function loadBrandImages(): Promise<PdfBrandImages> {
  if (cache) return cache;
  const [o2, g4] = await Promise.all([loadAsDataURL(o2White), loadAsDataURL(g4White)]);
  cache = {
    o2White: o2.dataUrl,
    o2Width: o2.w,
    o2Height: o2.h,
    g4White: g4.dataUrl,
    g4Width: g4.w,
    g4Height: g4.h,
  };
  return cache;
}
