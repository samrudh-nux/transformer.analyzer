// @ts-ignore - JS file import
import { supabase } from '../supabaseClient';
import { ProjectAttachment } from '../types';

export interface ResolvedImage {
  dataUrl: string;
  format: 'JPEG' | 'PNG';
  width: number;
  height: number;
}

/**
 * Extract Google Drive file ID from various URL patterns
 */
export function extractGoogleDriveId(url?: string): string | null {
  if (!url) return null;
  const fileMatch = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  const docMatch = url.match(/docs\.google\.com\/(?:document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
  if (docMatch) return docMatch[1];
  return null;
}

/**
 * Convert any HTML Image / Canvas to a reliable JPEG or PNG Base64 Data URL
 */
function canvasToDataUrl(
  img: HTMLImageElement,
  preferredFormat: 'JPEG' | 'PNG' = 'JPEG'
): { dataUrl: string; format: 'JPEG' | 'PNG'; width: number; height: number } | null {
  try {
    const canvas = document.createElement('canvas');
    const width = img.naturalWidth || img.width || 400;
    const height = img.naturalHeight || img.height || 300;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Fill white background for JPEGs or transparent images
    if (preferredFormat === 'JPEG') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(img, 0, 0, width, height);
    const mime = preferredFormat === 'PNG' ? 'image/png' : 'image/jpeg';
    const dataUrl = canvas.toDataURL(mime, 0.92);
    return {
      dataUrl,
      format: preferredFormat,
      width,
      height,
    };
  } catch (err) {
    console.warn('Canvas conversion error (possibly tainted):', err);
    return null;
  }
}

/**
 * Load image from Data URL or Blob URL and measure dimensions
 */
function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Helper to convert a Blob or File to a Base64 Data URL
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read blob as data URL.'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Resolves an attachment image into an embedding-ready Base64 Data URL for jsPDF
 * Handles:
 * - Raw Blob or File object instances
 * - blob: URLs (e.g. created via URL.createObjectURL)
 * - Direct base64 Data URLs (PNG, JPEG, WebP, SVG, GIF)
 * - Supabase Storage files (via authenticated SDK download)
 * - Google Drive shared images & docs (via thumbnail API)
 * - External image URLs (via direct fetch or server proxy for Vercel/production CORS)
 */
export async function resolveAttachmentImage(att: ProjectAttachment): Promise<ResolvedImage | null> {
  const isImage =
    att.type === 'image' ||
    att.mimeType?.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|svg|bmp|ico|tif|tiff)$/i.test(att.name);

  // 0. If att contains a raw Blob or File instance
  const rawBlob = (att as any).file || (att as any).blob;
  if (rawBlob instanceof Blob) {
    try {
      const dataUrl = await blobToDataUrl(rawBlob);
      if (dataUrl && dataUrl.startsWith('data:image')) {
        const isPng = rawBlob.type === 'image/png' || dataUrl.startsWith('data:image/png');
        try {
          const img = await loadImageElement(dataUrl);
          const converted = canvasToDataUrl(img, isPng ? 'PNG' : 'JPEG');
          if (converted) return converted;
          return {
            dataUrl,
            format: isPng ? 'PNG' : 'JPEG',
            width: img.naturalWidth || 400,
            height: img.naturalHeight || 300,
          };
        } catch {
          return {
            dataUrl,
            format: isPng ? 'PNG' : 'JPEG',
            width: 400,
            height: 300,
          };
        }
      }
    } catch (blobErr) {
      console.warn('Raw Blob conversion error:', blobErr);
    }
  }

  // Check if it's a Google Drive link that could be an image or document preview
  const driveId = extractGoogleDriveId(att.url || att.driveId);

  // 1. If it's already a Data URL
  const existingDataUrl = att.dataUrl || (att.url?.startsWith('data:image') ? att.url : null);
  if (existingDataUrl) {
    try {
      const isPng = existingDataUrl.startsWith('data:image/png');
      const isJpeg = existingDataUrl.startsWith('data:image/jpeg') || existingDataUrl.startsWith('data:image/jpg');

      if (isPng || isJpeg) {
        try {
          const img = await loadImageElement(existingDataUrl);
          return {
            dataUrl: existingDataUrl,
            format: isPng ? 'PNG' : 'JPEG',
            width: img.naturalWidth || 400,
            height: img.naturalHeight || 300,
          };
        } catch {
          return {
            dataUrl: existingDataUrl,
            format: isPng ? 'PNG' : 'JPEG',
            width: 400,
            height: 300,
          };
        }
      } else {
        // SVG / WebP / GIF / etc. -> convert to PNG/JPEG via Canvas
        const img = await loadImageElement(existingDataUrl);
        const converted = canvasToDataUrl(img, 'PNG');
        if (converted) return converted;
      }
    } catch (e) {
      console.warn('Existing dataUrl processing error:', e);
    }
  }

  // 2. If it's a blob: URL (e.g. blob:http://localhost:3000/...)
  if (att.url && att.url.startsWith('blob:')) {
    try {
      const blobRes = await fetch(att.url);
      if (blobRes.ok) {
        const fetchedBlob = await blobRes.blob();
        const dataUrl = await blobToDataUrl(fetchedBlob);
        if (dataUrl && dataUrl.startsWith('data:image')) {
          const isPng = fetchedBlob.type === 'image/png';
          try {
            const img = await loadImageElement(dataUrl);
            const converted = canvasToDataUrl(img, isPng ? 'PNG' : 'JPEG');
            if (converted) return converted;
            return {
              dataUrl,
              format: isPng ? 'PNG' : 'JPEG',
              width: img.naturalWidth || 400,
              height: img.naturalHeight || 300,
            };
          } catch {
            return {
              dataUrl,
              format: isPng ? 'PNG' : 'JPEG',
              width: 400,
              height: 300,
            };
          }
        }
      }
    } catch (blobUrlErr) {
      console.warn('Failed to read blob URL into base64:', blobUrlErr);
    }
  }

  // 2. If stored in Supabase Storage bucket 'app-files', download directly via Supabase SDK (No CORS issues!)
  if (att.storagePath) {
    try {
      const { data: blobData, error: downloadErr } = await supabase.storage
        .from('app-files')
        .download(att.storagePath);

      if (!downloadErr && blobData) {
        const blobDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blobData);
        });

        if (blobDataUrl && blobDataUrl.startsWith('data:image')) {
          try {
            const img = await loadImageElement(blobDataUrl);
            const isPng = blobData.type === 'image/png';
            const converted = canvasToDataUrl(img, isPng ? 'PNG' : 'JPEG');
            if (converted) return converted;
            return {
              dataUrl: blobDataUrl,
              format: isPng ? 'PNG' : 'JPEG',
              width: img.naturalWidth || 400,
              height: img.naturalHeight || 300,
            };
          } catch {
            return {
              dataUrl: blobDataUrl,
              format: 'JPEG',
              width: 400,
              height: 300,
            };
          }
        }
      }
    } catch (err) {
      console.warn('Supabase storage direct download error:', err);
    }
  }

  // 3. Resolve target URL for external images or Google Drive
  let targetUrl = att.url || att.dataUrl;
  if (!targetUrl && driveId) {
    targetUrl = `https://lh3.googleusercontent.com/d/${driveId}=w1600`;
  } else if (driveId && targetUrl && targetUrl.includes('drive.google.com')) {
    targetUrl = `https://lh3.googleusercontent.com/d/${driveId}=w1600`;
  }

  if (!targetUrl) return null;

  // 4. Try client-side fetch (works for same-origin or CORS-enabled CDNs)
  try {
    const res = await fetch(targetUrl, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.type.startsWith('image/') || isImage) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        if (dataUrl && dataUrl.startsWith('data:image')) {
          const img = await loadImageElement(dataUrl);
          const isPng = blob.type === 'image/png';
          const converted = canvasToDataUrl(img, isPng ? 'PNG' : 'JPEG');
          if (converted) return converted;
          return {
            dataUrl,
            format: isPng ? 'PNG' : 'JPEG',
            width: img.naturalWidth || 400,
            height: img.naturalHeight || 300,
          };
        }
      }
    }
  } catch (clientFetchErr) {
    // Client-side fetch failed (e.g. blocked by CORS when deployed on Vercel)
    console.warn('Client-side fetch blocked by CORS, trying server proxy fallback...');
  }

  // 5. Server Proxy Fallback (Bypasses Vercel/browser CORS restrictions)
  try {
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(targetUrl)}`;
    const proxyRes = await fetch(proxyUrl);
    if (proxyRes.ok) {
      const json = await proxyRes.json();
      if (json.dataUrl && json.dataUrl.startsWith('data:image')) {
        const isPng = json.mimeType?.includes('png') || json.dataUrl.startsWith('data:image/png');
        try {
          const img = await loadImageElement(json.dataUrl);
          return {
            dataUrl: json.dataUrl,
            format: isPng ? 'PNG' : 'JPEG',
            width: img.naturalWidth || 400,
            height: img.naturalHeight || 300,
          };
        } catch {
          return {
            dataUrl: json.dataUrl,
            format: isPng ? 'PNG' : 'JPEG',
            width: 400,
            height: 300,
          };
        }
      }
    }
  } catch (proxyErr) {
    console.warn('Server proxy fetch error:', proxyErr);
  }

  // 6. Direct Image loading with off-screen canvas fallback
  try {
    const img = await loadImageElement(targetUrl);
    const converted = canvasToDataUrl(img, 'JPEG');
    if (converted) return converted;
  } catch (imgLoadErr) {
    console.warn('Final direct image load failed for PDF:', targetUrl, imgLoadErr);
  }

  return null;
}

/**
 * Resolves attachment text/code content (for Python, C++, JSON, URDF, CSV, text, configs)
 */
export async function resolveAttachmentText(att: ProjectAttachment): Promise<string | null> {
  // If content is already in memory
  if ((att as any).content && typeof (att as any).content === 'string') {
    return (att as any).content;
  }

  // 0. If att contains a raw Blob or File instance
  const rawBlob = (att as any).file || (att as any).blob;
  if (rawBlob instanceof Blob) {
    try {
      const text = await rawBlob.text();
      if (text) return text;
    } catch (e) {
      console.warn('Failed to read raw blob as text:', e);
    }
  }

  // 1. If it is a blob: URL (e.g. created via URL.createObjectURL)
  if (att.url && att.url.startsWith('blob:')) {
    try {
      const blobRes = await fetch(att.url);
      if (blobRes.ok) {
        const text = await blobRes.text();
        if (text) return text;
      }
    } catch (blobUrlErr) {
      console.warn('Failed to fetch blob: URL for text:', blobUrlErr);
    }
  }

  // 2. If stored in Supabase Storage 'app-files'
  if (att.storagePath) {
    try {
      const { data: blobData, error } = await supabase.storage
        .from('app-files')
        .download(att.storagePath);
      if (!error && blobData) {
        const text = await blobData.text();
        if (text && !text.includes('<!DOCTYPE html>')) {
          return text;
        }
      }
    } catch (e) {
      console.warn('Supabase storage text download error:', e);
    }
  }

  // 2. If dataUrl contains base64 encoded text
  if (att.dataUrl && att.dataUrl.startsWith('data:')) {
    try {
      const commaIdx = att.dataUrl.indexOf(',');
      if (commaIdx !== -1) {
        const header = att.dataUrl.substring(0, commaIdx);
        const data = att.dataUrl.substring(commaIdx + 1);
        if (header.includes(';base64')) {
          const raw = atob(data);
          // UTF-8 decoding
          const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
          const decoded = new TextDecoder('utf-8').decode(bytes);
          if (decoded && !decoded.includes('\0')) {
            return decoded;
          }
        } else {
          return decodeURIComponent(data);
        }
      }
    } catch (decodeErr) {
      console.warn('DataURL text decode error:', decodeErr);
    }
  }

  // 3. If external URL
  if (att.url && !att.url.startsWith('data:image')) {
    try {
      const res = await fetch(att.url);
      if (res.ok) {
        const text = await res.text();
        if (text && !text.includes('<!DOCTYPE html>')) {
          return text;
        }
      }
    } catch {
      // Try server proxy
      try {
        const proxyRes = await fetch(`/api/proxy-file?url=${encodeURIComponent(att.url)}`);
        if (proxyRes.ok) {
          const proxyJson = await proxyRes.json();
          if (proxyJson.content) return proxyJson.content;
        }
      } catch (err) {
        console.warn('Server proxy file text error:', err);
      }
    }
  }

  return null;
}
