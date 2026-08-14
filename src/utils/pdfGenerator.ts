import { jsPDF } from 'jspdf';
import {
  AnalysisResult,
  IssueDetected,
  CompositionStep,
  TransformDetected,
  ProjectAttachment,
  ProjectItem,
  ProjectFolder,
  UserProfile,
} from '../types';
// @ts-ignore - JS file import
import { supabase } from '../supabaseClient';
import { extractGoogleDriveId, ResolvedImage } from './fileResolver';

export interface PDFExportOptions {
  analysisResult: AnalysisResult;
  analyzerMode: 'single' | 'diff';
  code: string;
  beforeCode: string;
  afterCode: string;
  analysisId?: string;
  projectId?: string;
  attachments?: ProjectAttachment[];
  secondaryData?: Record<string, any>;
  projectTitle?: string;
  projectDescription?: string;
  tags?: string[];
  notes?: string;
  userProfile?: UserProfile | null;
}

export interface PreparedPDFAttachment {
  att: ProjectAttachment;
  isCodeAtt: boolean;
  isImage: boolean;
  resolvedImg: ResolvedImage | null;
  resolvedText: string | null;
  base64DataUrl?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// BASE64 & ASYNC ATTACHMENT PRE-CONVERSION PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts any Blob or File object into a standard Base64 Data URL.
 */
export function blobToBase64DataUrl(blob: Blob | File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read blob as Base64 Data URL.'));
      }
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(blob);
  });
}

/**
 * Asynchronously loads an HTMLImageElement with crossOrigin set to Anonymous.
 */
function loadImageElementAsync(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Renders an Image element onto an offscreen canvas and exports a pristine,
 * untainted Base64 JPEG or PNG Data URL with measured dimensions.
 */
function canvasToBase64Image(
  img: HTMLImageElement,
  preferredFormat: 'JPEG' | 'PNG' = 'JPEG'
): ResolvedImage | null {
  try {
    const canvas = document.createElement('canvas');
    const width = img.naturalWidth || img.width || 400;
    const height = img.naturalHeight || img.height || 300;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (preferredFormat === 'JPEG') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(img, 0, 0, width, height);
    const mime = preferredFormat === 'PNG' ? 'image/png' : 'image/jpeg';
    const dataUrl = canvas.toDataURL(mime, 0.95);

    return {
      dataUrl,
      format: preferredFormat,
      width,
      height,
    };
  } catch (err) {
    console.warn('Canvas Base64 serialization error:', err);
    return null;
  }
}

/**
 * Reliably fetches and converts an external or stored asset into a Base64 image
 * formatted for jsPDF `doc.addImage()`. Handles Supabase Storage, Google Drive,
 * Blob URLs, raw File/Blob instances, and external URLs with proxy fallbacks.
 */
export async function convertAttachmentToBase64Image(
  att: ProjectAttachment
): Promise<ResolvedImage | null> {
  const isImg =
    att.type === 'image' ||
    att.mimeType?.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|svg|bmp|ico|tif|tiff)$/i.test(att.name);

  // 1. Check for raw Blob / File object attached directly to the object
  const rawBlob = (att as any).file || (att as any).blob;
  if (rawBlob instanceof Blob) {
    try {
      const rawDataUrl = await blobToBase64DataUrl(rawBlob);
      if (rawDataUrl && rawDataUrl.startsWith('data:image')) {
        const isPng = rawBlob.type === 'image/png' || rawDataUrl.startsWith('data:image/png');
        try {
          const img = await loadImageElementAsync(rawDataUrl);
          const converted = canvasToBase64Image(img, isPng ? 'PNG' : 'JPEG');
          if (converted) return converted;
          return {
            dataUrl: rawDataUrl,
            format: isPng ? 'PNG' : 'JPEG',
            width: img.naturalWidth || 400,
            height: img.naturalHeight || 300,
          };
        } catch {
          return {
            dataUrl: rawDataUrl,
            format: isPng ? 'PNG' : 'JPEG',
            width: 400,
            height: 300,
          };
        }
      }
    } catch (blobErr) {
      console.warn('Raw Blob conversion error in PDF generator:', blobErr);
    }
  }

  // 2. Check if a Base64 dataUrl is already cached on the attachment
  const existingDataUrl = att.dataUrl || (att.url?.startsWith('data:image') ? att.url : null);
  if (existingDataUrl) {
    try {
      const isPng = existingDataUrl.startsWith('data:image/png');
      const isJpeg =
        existingDataUrl.startsWith('data:image/jpeg') || existingDataUrl.startsWith('data:image/jpg');

      if (isPng || isJpeg) {
        try {
          const img = await loadImageElementAsync(existingDataUrl);
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
        // SVG, WebP, GIF -> Render through canvas to generate reliable PNG Base64
        const img = await loadImageElementAsync(existingDataUrl);
        const converted = canvasToBase64Image(img, 'PNG');
        if (converted) return converted;
      }
    } catch (e) {
      console.warn('Cached Base64 Data URL processing error:', e);
    }
  }

  // 3. If URL is a blob: URL (e.g. created via URL.createObjectURL)
  if (att.url && att.url.startsWith('blob:')) {
    try {
      const blobRes = await fetch(att.url);
      if (blobRes.ok) {
        const fetchedBlob = await blobRes.blob();
        const dataUrl = await blobToBase64DataUrl(fetchedBlob);
        if (dataUrl && dataUrl.startsWith('data:image')) {
          const isPng = fetchedBlob.type === 'image/png';
          try {
            const img = await loadImageElementAsync(dataUrl);
            const converted = canvasToBase64Image(img, isPng ? 'PNG' : 'JPEG');
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
      console.warn('Failed to convert blob: URL to Base64:', blobUrlErr);
    }
  }

  // 4. If stored in Supabase Storage bucket 'app-files'
  if (att.storagePath) {
    try {
      const { data: storageBlob, error: downloadErr } = await supabase.storage
        .from('app-files')
        .download(att.storagePath);

      if (!downloadErr && storageBlob) {
        const base64Data = await blobToBase64DataUrl(storageBlob);
        if (base64Data && base64Data.startsWith('data:image')) {
          const isPng = storageBlob.type === 'image/png' || base64Data.startsWith('data:image/png');
          try {
            const img = await loadImageElementAsync(base64Data);
            const converted = canvasToBase64Image(img, isPng ? 'PNG' : 'JPEG');
            if (converted) return converted;
            return {
              dataUrl: base64Data,
              format: isPng ? 'PNG' : 'JPEG',
              width: img.naturalWidth || 400,
              height: img.naturalHeight || 300,
            };
          } catch {
            return {
              dataUrl: base64Data,
              format: isPng ? 'PNG' : 'JPEG',
              width: 400,
              height: 300,
            };
          }
        }
      }
    } catch (storageErr) {
      console.warn('Supabase storage download and Base64 conversion warning:', storageErr);
    }
  }

  // 5. Google Drive or External HTTP URL
  const driveId = extractGoogleDriveId(att.url || att.driveId);
  let targetUrl = att.url;
  if (!targetUrl && driveId) {
    targetUrl = `https://lh3.googleusercontent.com/d/${driveId}=w1600`;
  } else if (driveId && targetUrl && targetUrl.includes('drive.google.com')) {
    targetUrl = `https://lh3.googleusercontent.com/d/${driveId}=w1600`;
  }

  if (targetUrl) {
    // Attempt client-side direct fetch
    try {
      const res = await fetch(targetUrl, { mode: 'cors' });
      if (res.ok) {
        const fetchedBlob = await res.blob();
        if (fetchedBlob.type.startsWith('image/') || isImg) {
          const dataUrl = await blobToBase64DataUrl(fetchedBlob);
          if (dataUrl && dataUrl.startsWith('data:image')) {
            const img = await loadImageElementAsync(dataUrl);
            const isPng = fetchedBlob.type === 'image/png';
            const converted = canvasToBase64Image(img, isPng ? 'PNG' : 'JPEG');
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
    } catch {
      // Direct CORS fetch failed; proceed to server proxy
    }

    // Server Proxy Fallback to bypass CORS restrictions
    try {
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(targetUrl)}`;
      const proxyRes = await fetch(proxyUrl);
      if (proxyRes.ok) {
        const json = await proxyRes.json();
        if (json.dataUrl && json.dataUrl.startsWith('data:image')) {
          const isPng = json.mimeType?.includes('png') || json.dataUrl.startsWith('data:image/png');
          try {
            const img = await loadImageElementAsync(json.dataUrl);
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
      console.warn('Server proxy Base64 fetch error:', proxyErr);
    }
  }

  return null;
}

/**
 * Resolves attachment text content from Supabase Storage, Blob objects,
 * blob: URLs, or external resources into decoded UTF-8 text strings.
 */
export async function convertAttachmentToDecodedText(
  att: ProjectAttachment
): Promise<string | null> {
  // If text content is already in memory
  if ((att as any).content && typeof (att as any).content === 'string') {
    return (att as any).content;
  }

  // 1. Raw Blob or File instance
  const rawBlob = (att as any).file || (att as any).blob;
  if (rawBlob instanceof Blob) {
    try {
      const text = await rawBlob.text();
      if (text) return text;
    } catch (e) {
      console.warn('Failed to read raw blob text:', e);
    }
  }

  // 2. Blob URL
  if (att.url && att.url.startsWith('blob:')) {
    try {
      const blobRes = await fetch(att.url);
      if (blobRes.ok) {
        const text = await blobRes.text();
        if (text) return text;
      }
    } catch (blobUrlErr) {
      console.warn('Failed to fetch blob: URL text:', blobUrlErr);
    }
  }

  // 3. Supabase Storage bucket 'app-files'
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

  // 4. Data URL containing Base64 text
  if (att.dataUrl && att.dataUrl.startsWith('data:')) {
    try {
      const commaIdx = att.dataUrl.indexOf(',');
      if (commaIdx !== -1) {
        const header = att.dataUrl.substring(0, commaIdx);
        const data = att.dataUrl.substring(commaIdx + 1);
        if (header.includes(';base64')) {
          const raw = atob(data);
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

  // 5. External HTTP URL
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
      try {
        const proxyRes = await fetch(`/api/proxy-file?url=${encodeURIComponent(att.url)}`);
        if (proxyRes.ok) {
          const proxyJson = await proxyRes.json();
          if (proxyJson.content) return proxyJson.content;
        }
      } catch (err) {
        console.warn('Server proxy text fetch error:', err);
      }
    }
  }

  return null;
}

/**
 * Pre-processes all attachments in parallel into Base64 images and decoded text
 * before PDF document serialization commences.
 */
export async function prepareAllAttachmentsForPDF(
  attachments: ProjectAttachment[]
): Promise<PreparedPDFAttachment[]> {
  if (!attachments || attachments.length === 0) return [];

  const promises = attachments.map(async (att) => {
    const isCodeAtt =
      att.type === 'code' ||
      /\.(py|cpp|h|hpp|c|ts|js|json|yaml|yml|urdf|xml|txt|md|sh|csv|log)$/i.test(att.name);

    const isImage =
      att.type === 'image' ||
      att.mimeType?.startsWith('image/') ||
      /\.(png|jpe?g|webp|gif|svg|bmp|ico|tif|tiff)$/i.test(att.name);

    let resolvedImg: ResolvedImage | null = null;
    let resolvedText: string | null = null;

    try {
      // 1. Resolve Base64 image if it is an image type
      if (isImage || att.url?.startsWith('data:image') || att.dataUrl) {
        resolvedImg = await convertAttachmentToBase64Image(att);
      }

      // 2. Resolve text / code if it is a code/text type and not an image
      if (isCodeAtt && !resolvedImg) {
        resolvedText = await convertAttachmentToDecodedText(att);
      }
    } catch (prepErr) {
      console.warn(`Error preparing attachment ${att.name} for PDF:`, prepErr);
    }

    return {
      att,
      isCodeAtt,
      isImage,
      resolvedImg,
      resolvedText,
      base64DataUrl: resolvedImg?.dataUrl || null,
    };
  });

  return Promise.all(promises);
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT VAULT PDF EXPORTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exports a publication-grade PDF report for any project in the Vault,
 * pre-converting all attachments to Base64 format before PDF serialization.
 */
export async function exportProjectVaultPDF(
  project: ProjectItem,
  folders: ProjectFolder[],
  userProfile?: UserProfile | null
): Promise<void> {
  // Pre-resolve and convert all attachments to Base64 prior to PDF layout rendering
  const preparedAttachments = await prepareAllAttachmentsForPDF(project.attachments || []);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const bottomMargin = 16;

  let yPos = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (yPos + neededHeight > pageHeight - bottomMargin) {
      doc.addPage();
      yPos = margin + 6;
    }
  };

  const folderName = folders.find((f) => f.id === project.folderId)?.name || 'General Workspace';
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // 1. Header Banner
  doc.setFillColor(15, 23, 42); // Dark slate-900
  doc.rect(margin, yPos, contentWidth, 26, 'F');

  // Decorative Indigo Accent Bar
  doc.setFillColor(99, 102, 241); // Indigo-500
  doc.rect(margin, yPos, 3, 26, 'F');

  // Title & Subtitle
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  const safeTitle = project.title || 'Untitled Transform Script';
  doc.text(safeTitle.substring(0, 52), margin + 7, yPos + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  const authorTag = userProfile?.fullName ? `Engineer: ${userProfile.fullName}` : 'TRANS-A.AI Robotics Engineering';
  doc.text(`${authorTag}   •   Folder: ${folderName}`, margin + 7, yPos + 16);

  // Right-aligned status pill
  doc.setFillColor(30, 41, 59); // slate-800
  doc.roundedRect(pageWidth - margin - 48, yPos + 5, 42, 6.5, 1, 1, 'F');
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(129, 140, 248); // indigo-300
  doc.text(`[${(project.language || 'python').toUpperCase()}] VAULT SPEC`, pageWidth - margin - 27, yPos + 9.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Exported: ${dateStr} ${timeStr}`, pageWidth - margin - 6, yPos + 18, { align: 'right' });

  yPos += 30;

  // 2. Project Metadata & Tags Bar
  if (project.tags && project.tags.length > 0) {
    checkPageBreak(12);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, yPos, contentWidth, 8.5, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('TAGS & RIGID-BODY CONVENTIONS:', margin + 4, yPos + 5.5);

    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(79, 70, 229);
    const tagsStr = project.tags.map((t) => `#${t}`).join('   ');
    doc.text(tagsStr.substring(0, 75), margin + 64, yPos + 5.5);

    yPos += 12;
  }

  // 3. Project Description
  if (project.description) {
    checkPageBreak(22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('PROJECT OVERVIEW & SPECIFICATION', margin, yPos);
    yPos += 5.5;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    const splitDesc = doc.splitTextToSize(project.description, contentWidth - 8);
    const descHeight = Math.max(splitDesc.length * 4.5 + 8, 14);

    doc.roundedRect(margin, yPos, contentWidth, descHeight, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(splitDesc, margin + 4, yPos + 6);

    yPos += descHeight + 6;
  }

  // 4. Primary Source Code Block
  if (project.code) {
    checkPageBreak(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`PRIMARY SOURCE CODE — ${(project.language || 'PYTHON').toUpperCase()}`, margin, yPos);
    yPos += 5.5;

    const codeLines = project.code.split('\n');
    const lineHeight = 4.0;

    // Code Header Banner
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(margin, yPos, contentWidth, 6.5, 'F');
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(228, 228, 231);
    doc.text(`// ${project.title} (${codeLines.length} lines)`, margin + 4, yPos + 4.5);
    yPos += 6.5;

    doc.setFont('courier', 'normal');
    doc.setFontSize(7.2);

    for (let i = 0; i < codeLines.length; i++) {
      checkPageBreak(lineHeight + 1);

      if (i % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, yPos, contentWidth, lineHeight + 0.2, 'F');
      }

      // Line numbers
      doc.setTextColor(148, 163, 184);
      doc.text(String(i + 1).padStart(3, ' '), margin + 2, yPos + 3.0);

      // Code text
      doc.setTextColor(15, 23, 42);
      const rawLine = codeLines[i].replace(/\t/g, '  ');
      const truncatedLine = rawLine.length > 96 ? rawLine.substring(0, 96) + '...' : rawLine;
      doc.text(truncatedLine, margin + 11, yPos + 3.0);

      yPos += lineHeight;
    }

    yPos += 8;
  }

  // 5. Attached Files, Images & Google Drive Specs (Rendered from pre-converted Base64)
  if (preparedAttachments.length > 0) {
    checkPageBreak(22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`ATTACHED ASSETS, IMAGES & EXTERNAL SPECS (${preparedAttachments.length})`, margin, yPos);
    yPos += 6;

    for (const prep of preparedAttachments) {
      const { att, isCodeAtt, resolvedImg, resolvedText } = prep;
      const cardHeight = att.storagePath || att.url ? 18 : 13;
      checkPageBreak(cardHeight + 4);

      // Card Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, yPos, contentWidth, cardHeight, 1.5, 1.5, 'FD');

      // Title & Dot
      doc.setFillColor(99, 102, 241);
      doc.circle(margin + 4, yPos + 5.2, 1.2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(att.name, margin + 7.5, yPos + 6);

      // Source Tag Badge
      const badgeText = att.storagePath
        ? '[SUPABASE STORAGE]'
        : att.type === 'drive'
        ? '[GOOGLE DRIVE]'
        : isCodeAtt
        ? '[SOURCE CODE]'
        : '[FILE ATTACHMENT]';

      doc.setFont('courier', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(att.storagePath ? 16 : 79, att.storagePath ? 185 : 70, att.storagePath ? 129 : 229);
      doc.text(badgeText, pageWidth - margin - 4, yPos + 6, { align: 'right' });

      // Specs subtitle
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const fileInfo = `Type: ${(att.mimeType || att.type).toUpperCase()}   |   Size: ${att.size || 'Attached'}   |   Date: ${att.uploadedAt}`;
      doc.text(fileInfo, margin + 7.5, yPos + 10.5);

      // File path or Active Link
      if (att.storagePath) {
        doc.setFont('courier', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text(`Bucket Path: app-files/${att.storagePath}`, margin + 7.5, yPos + 15);
      } else if (att.url) {
        doc.setFont('courier', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(59, 130, 246);
        const truncUrl = att.url.length > 78 ? att.url.substring(0, 78) + '...' : att.url;
        doc.text(`URL: ${truncUrl}`, margin + 7.5, yPos + 15);
      }

      yPos += cardHeight + 4;

      // Render Source Code / Text preview if text attachment
      if (isCodeAtt && resolvedText && !resolvedImg) {
        const lines = resolvedText.split('\n');
        const maxLines = Math.min(lines.length, 35);
        const blockHeight = maxLines * 3.8 + 8;

        checkPageBreak(blockHeight + 10);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(`FILE CONTENT PREVIEW: ${att.name}`, margin + 2, yPos);
        yPos += 4;

        doc.setFillColor(15, 23, 42); // slate-900
        doc.roundedRect(margin, yPos, contentWidth, blockHeight, 1.5, 1.5, 'F');

        doc.setFont('courier', 'normal');
        doc.setFontSize(7.0);

        let codeY = yPos + 5;
        for (let l = 0; l < maxLines; l++) {
          doc.setTextColor(100, 116, 139);
          doc.text(String(l + 1).padStart(3, ' '), margin + 3, codeY);

          doc.setTextColor(226, 232, 240);
          const lineStr = lines[l].replace(/\t/g, '  ').substring(0, 92);
          doc.text(lineStr, margin + 12, codeY);
          codeY += 3.8;
        }

        if (lines.length > maxLines) {
          doc.setTextColor(148, 163, 184);
          doc.text(`... (${lines.length - maxLines} more lines omitted for document preview)`, margin + 12, codeY);
        }

        yPos += blockHeight + 6;
      }

      // Render Embedded High-Res Image Preview via pre-converted Base64
      if (resolvedImg && resolvedImg.dataUrl) {
        let displayW = 95;
        let displayH = (resolvedImg.height / resolvedImg.width) * displayW;
        if (displayH > 65) {
          displayH = 65;
          displayW = (resolvedImg.width / resolvedImg.height) * displayH;
        }
        if (isNaN(displayH) || displayH <= 0) {
          displayW = 75;
          displayH = 50;
        }

        checkPageBreak(displayH + 12);

        // Frame wrapper
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(margin + 2, yPos, displayW + 4, displayH + 4, 1.2, 1.2, 'FD');

        try {
          doc.addImage(
            resolvedImg.dataUrl,
            resolvedImg.format,
            margin + 4,
            yPos + 2,
            displayW,
            displayH
          );

          yPos += displayH + 8;
        } catch (err) {
          console.warn('Failed to embed Base64 image in Vault PDF:', err);
        }
      }
    }
  }

  // 6. Running Headers & Footers on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    if (i > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`TRANS-A.AI Vault Document  •  ${project.title}`, margin, 9);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, 11, pageWidth - margin, 11);
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('TRANS-A.AI Rigid-Body Transformation Vault', margin, pageHeight - 6);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  }

  const cleanFileTitle = (project.title || 'Project').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${cleanFileTitle}_Spec_Report.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// REVIEWER ANALYSIS REPORT PDF EXPORTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exports a publication-grade PDF analysis report, pre-converting all associated
 * attachments, 3D canvas traces, and images into Base64 format before PDF serialization.
 */
export async function exportAnalysisReportPDF(options: PDFExportOptions): Promise<void> {
  const {
    analysisResult,
    analyzerMode,
    code,
    beforeCode,
    afterCode,
    analysisId,
    projectId,
    userProfile,
  } = options;

  let attachments: ProjectAttachment[] = options.attachments || [];
  let secondaryData: Record<string, any> = options.secondaryData || {};
  let projectTitle = options.projectTitle || '';
  let projectDescription = options.projectDescription || '';
  let projectTags = options.tags || [];

  // Fetch associated attachments and secondary data stored in Supabase
  if (projectId || analysisId) {
    try {
      const targetId = projectId || analysisId;

      const { data: projData } = await supabase
        .from('projects')
        .select('*')
        .or(`id.eq.${targetId},title.ilike.%${targetId}%`)
        .limit(1);

      if (projData && projData.length > 0) {
        const proj = projData[0];
        if (!projectTitle) projectTitle = proj.title;
        if (!projectDescription) projectDescription = proj.description || '';
        if (!projectTags.length && proj.tags) projectTags = proj.tags;

        if (proj.attachments && Array.isArray(proj.attachments)) {
          attachments = [...attachments, ...proj.attachments];
        }

        if (proj.meta_json || proj.secondary_data) {
          secondaryData = {
            ...secondaryData,
            ...(proj.meta_json || proj.secondary_data || {}),
          };
        }
      }
    } catch (err) {
      console.warn('Supabase attachment fetch note:', err);
    }
  }

  // Deduplicate attachments
  const uniqueAttachmentsMap = new Map<string, ProjectAttachment>();
  attachments.forEach((att) => {
    const key = att.id || att.name || att.storagePath || att.url;
    if (key && !uniqueAttachmentsMap.has(key)) {
      uniqueAttachmentsMap.set(key, att);
    }
  });
  const uniqueAttachments = Array.from(uniqueAttachmentsMap.values());

  // Asynchronously pre-convert all external file and blob attachments into Base64 format
  const preparedAttachments = await prepareAllAttachmentsForPDF(uniqueAttachments);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const bottomMargin = 16;

  let yPos = margin;

  const shortId = analysisId
    ? analysisId.slice(0, 5)
    : Math.random().toString(36).substring(2, 7);
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fileName = `frame-analysis-${shortId}-${dateStr}.pdf`;

  const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const analysisUrl = analysisId ? `${appOrigin}/a/${analysisId}` : `${appOrigin}`;

  const checkPageBreak = (neededHeight: number) => {
    if (yPos + neededHeight > pageHeight - bottomMargin) {
      doc.addPage();
      yPos = margin + 6;
    }
  };

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, yPos, contentWidth, 26, 'F');

  doc.setFillColor(99, 102, 241);
  doc.rect(margin, yPos, 3, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('TRANS-A.AI', margin + 7, yPos + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text('SO(3) / SE(3) Rigid-Body Coordinate Frame Reviewer', margin + 7, yPos + 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(129, 140, 248);
  doc.text('ANALYSIS & AUDIT REPORT', pageWidth - margin - 6, yPos + 9, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Generated: ${dateStr} ${timeStr}`, pageWidth - margin - 6, yPos + 16, { align: 'right' });

  yPos += 29;

  // Advisory Strip
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, yPos, contentWidth, 9, 1, 1, 'FD');

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Deterministic AI & Static Semantic Frame Review. Validated against Lie algebra, Euler & quaternion conventions.',
    margin + 4,
    yPos + 5.5
  );

  yPos += 13;

  // Project Context Card
  if (projectTitle || projectDescription) {
    checkPageBreak(18);
    doc.setFillColor(238, 242, 255);
    doc.setDrawColor(199, 210, 254);
    doc.roundedRect(margin, yPos, contentWidth, projectDescription ? 15 : 10, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(67, 56, 202);
    doc.text(`PROJECT: ${projectTitle || 'Vault Project'}`, margin + 4, yPos + 5);

    if (projectDescription) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      const descLines = doc.splitTextToSize(projectDescription, contentWidth - 8);
      doc.text(descLines, margin + 4, yPos + 9.5);
    }

    yPos += (projectDescription ? 15 : 10) + 5;
  }

  // Verdict Summary
  if (analyzerMode === 'diff' && analysisResult.diff_analysis) {
    const diff = analysisResult.diff_analysis;
    const classification = diff.classification || 'neutral';

    let badgeBg = [100, 116, 139];
    let badgeText = 'NEUTRAL';
    if (classification === 'fixes_issue') {
      badgeBg = [16, 185, 129];
      badgeText = 'FIXES ISSUE';
    } else if (classification === 'introduces_issue') {
      badgeBg = [225, 29, 72];
      badgeText = 'INTRODUCES ISSUE';
    } else if (classification === 'unclear') {
      badgeBg = [217, 119, 6];
      badgeText = 'NEEDS VERIFICATION';
    }

    checkPageBreak(20);

    doc.setFillColor(badgeBg[0], badgeBg[1], badgeBg[2]);
    doc.roundedRect(margin, yPos, 42, 6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(badgeText, margin + 21, yPos + 4.2, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('PR Diff Verdict:', margin + 46, yPos + 4.5);

    yPos += 9;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    const verdictLines = doc.splitTextToSize(diff.one_line_verdict, contentWidth);
    doc.text(verdictLines, margin, yPos);
    yPos += verdictLines.length * 5 + 6;
  } else {
    checkPageBreak(16);
    const isClean = analysisResult.clean;

    doc.setFillColor(isClean ? 16 : 225, isClean ? 185 : 29, isClean ? 129 : 72);
    doc.roundedRect(margin, yPos, 32, 6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(isClean ? 'SO(3) CLEAN' : 'BUGS DETECTED', margin + 16, yPos + 4.2, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('Analysis Summary:', margin + 36, yPos + 4.5);

    yPos += 9;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    const summaryLines = doc.splitTextToSize(analysisResult.summary, contentWidth);
    doc.text(summaryLines, margin, yPos);
    yPos += summaryLines.length * 4.5 + 6;
  }

  // Code Block Renderer Helper
  const renderCodeBlock = (title: string, codeText: string, accentColor: [number, number, number]) => {
    const lines = codeText.split('\n');
    const lineCount = lines.length;
    const blockHeight = Math.min(lineCount * 3.8 + 10, 80);

    checkPageBreak(blockHeight + 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin, yPos);
    yPos += 5;

    doc.setFillColor(15, 23, 42);
    doc.roundedRect(margin, yPos, contentWidth, blockHeight, 1.5, 1.5, 'F');

    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.rect(margin, yPos, 2, blockHeight, 'F');

    doc.setFont('courier', 'normal');
    doc.setFontSize(7.2);

    let codeY = yPos + 4.5;
    const maxVisibleLines = Math.floor((blockHeight - 6) / 3.8);

    for (let i = 0; i < Math.min(lines.length, maxVisibleLines); i++) {
      const lineNum = (i + 1).toString().padStart(3, ' ');
      doc.setTextColor(100, 116, 139);
      doc.text(lineNum, margin + 4, codeY);

      doc.setTextColor(226, 232, 240);
      const lineStr = lines[i].substring(0, 88);
      doc.text(lineStr, margin + 14, codeY);

      codeY += 3.8;
    }

    if (lines.length > maxVisibleLines) {
      doc.setTextColor(148, 163, 184);
      doc.text(`... (${lines.length - maxVisibleLines} lines truncated for report preview)`, margin + 14, codeY);
    }

    yPos += blockHeight + 8;
  };

  if (analyzerMode === 'diff') {
    renderCodeBlock('BEFORE CODE (Original)', beforeCode, [225, 29, 72]);
    renderCodeBlock('AFTER CODE (Modified)', afterCode, [16, 185, 129]);
  } else {
    renderCodeBlock('ANALYZED CODE SNIPPET', code, [99, 102, 241]);
  }

  // Transforms Detected Table
  const transforms: TransformDetected[] = analysisResult.transforms_detected || [];
  if (transforms.length > 0) {
    checkPageBreak(25 + transforms.length * 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('TRANSFORMS DETECTED', margin, yPos);
    yPos += 5.5;

    const colWidths = [42, 36, 60, 44];
    const headers = ['Variable', 'Representation', 'Inferred Frame (From -> To)', 'Convention'];

    doc.setFillColor(30, 41, 59);
    doc.rect(margin, yPos, contentWidth, 6.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    let colX = margin + 3;
    headers.forEach((h, idx) => {
      doc.text(h, colX, yPos + 4.5);
      colX += colWidths[idx];
    });

    yPos += 6.5;

    transforms.forEach((tr, rowIdx) => {
      checkPageBreak(8);

      const isEven = rowIdx % 2 === 0;
      doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, yPos, contentWidth, 6.5, 'FD');

      doc.setFont('courier', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(15, 23, 42);

      const frameText = `${tr.inferred_frame?.from || '?'} -> ${tr.inferred_frame?.to || '?'}`;

      let rColX = margin + 3;
      doc.text(tr.variable_name.substring(0, 20), rColX, yPos + 4.5);
      rColX += colWidths[0];

      doc.setFont('helvetica', 'normal');
      doc.text(tr.representation.substring(0, 18), rColX, yPos + 4.5);
      rColX += colWidths[1];

      doc.setFont('courier', 'bold');
      doc.setTextColor(79, 70, 229);
      doc.text(frameText.substring(0, 30), rColX, yPos + 4.5);
      rColX += colWidths[2];

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const conventionText = tr.inferred_convention || 'N/A';
      doc.text(conventionText.substring(0, 22), rColX, yPos + 4.5);

      yPos += 6.5;
    });

    yPos += 7;
  }

  // Issues List
  const renderIssueItem = (issue: IssueDetected, statusTag?: string) => {
    checkPageBreak(28);

    const isHigh = issue.severity === 'high';
    const isMedium = issue.severity === 'medium';

    let cardBg: [number, number, number] = [248, 250, 252];
    let borderColor: [number, number, number] = [226, 232, 240];
    let badgeBg: [number, number, number] = [71, 85, 105];

    if (isHigh || statusTag === 'introduced') {
      cardBg = [254, 242, 242];
      borderColor = [254, 202, 202];
      badgeBg = [225, 29, 72];
    } else if (isMedium) {
      cardBg = [255, 251, 235];
      borderColor = [253, 230, 138];
      badgeBg = [217, 119, 6];
    } else if (statusTag === 'fixed') {
      cardBg = [236, 253, 245];
      borderColor = [167, 243, 208];
      badgeBg = [16, 185, 129];
    }

    doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);

    const descLines = doc.splitTextToSize(issue.description, contentWidth - 10);
    const issueHeight = Math.max(18 + descLines.length * 4.2 + (issue.suggested_fix ? 12 : 0), 22);

    doc.roundedRect(margin, yPos, contentWidth, issueHeight, 1.5, 1.5, 'FD');

    doc.setFillColor(badgeBg[0], badgeBg[1], badgeBg[2]);
    doc.roundedRect(margin + 4, yPos + 3.5, 26, 4.5, 0.8, 0.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    const tagText = statusTag ? statusTag.toUpperCase() : `${issue.severity.toUpperCase()}`;
    doc.text(tagText, margin + 17, yPos + 6.8, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(`Line #${issue.line_ref} • ${issue.category}`, margin + 33, yPos + 6.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Confidence: ${(issue.confidence * 100).toFixed(0)}%`, pageWidth - margin - 5, yPos + 6.8, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(30, 41, 59);
    let descY = yPos + 12;
    doc.text(descLines, margin + 4, descY);
    descY += descLines.length * 4.2;

    if (issue.suggested_fix) {
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(margin + 4, descY + 1, contentWidth - 8, 8.5, 1, 1, 'F');

      doc.setFont('courier', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(52, 211, 153);
      const fixText = `Fix: ${issue.suggested_fix.substring(0, 75)}`;
      doc.text(fixText, margin + 7, descY + 6.5);
    }

    yPos += issueHeight + 4;
  };

  const issues = analysisResult.issues || [];
  if (issues.length > 0) {
    checkPageBreak(18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`DETAILED FINDINGS & FRAME BUGS (${issues.length})`, margin, yPos);
    yPos += 6;
    issues.forEach((iss) => renderIssueItem(iss));
    yPos += 4;
  }

  // PR Diff Detailed Issue Sections (Fixed, Introduced, Unchanged)
  if (analyzerMode === 'diff' && analysisResult.diff_analysis) {
    const diff = analysisResult.diff_analysis;

    // Fixed Issues
    if (diff.issues_fixed && diff.issues_fixed.length > 0) {
      checkPageBreak(18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(16, 185, 129); // emerald-600
      doc.text(`✓ ISSUES RESOLVED IN THIS PR (${diff.issues_fixed.length})`, margin, yPos);
      yPos += 5.5;
      diff.issues_fixed.forEach((iss) => renderIssueItem(iss, 'fixed'));
      yPos += 3;
    }

    // Introduced Issues
    if (diff.issues_introduced && diff.issues_introduced.length > 0) {
      checkPageBreak(18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(225, 29, 72); // rose-600
      doc.text(`⚠ ISSUES INTRODUCED BY THIS PR (${diff.issues_introduced.length})`, margin, yPos);
      yPos += 5.5;
      diff.issues_introduced.forEach((iss) => renderIssueItem(iss, 'introduced'));
      yPos += 3;
    }

    // Unchanged Issues
    if (diff.issues_unchanged && diff.issues_unchanged.length > 0) {
      checkPageBreak(18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`UNCHANGED ISSUES PERSISTING (${diff.issues_unchanged.length})`, margin, yPos);
      yPos += 5.5;
      diff.issues_unchanged.forEach((iss) => renderIssueItem(iss, 'unchanged'));
      yPos += 3;
    }

    // Non-semantic impact changes
    if (diff.no_semantic_impact_changes && diff.no_semantic_impact_changes.length > 0) {
      checkPageBreak(16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text('NON-SEMANTIC / SYNTACTIC CHANGES:', margin, yPos);
      yPos += 5;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      const nsCount = diff.no_semantic_impact_changes.length;
      const boxH = Math.max(nsCount * 4.2 + 6, 10);
      doc.roundedRect(margin, yPos, contentWidth, boxH, 1, 1, 'FD');

      doc.setFont('courier', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(100, 116, 139);

      let nsY = yPos + 4.5;
      diff.no_semantic_impact_changes.forEach((change) => {
        doc.text(`• ${change.substring(0, 90)}`, margin + 4, nsY);
        nsY += 4.2;
      });

      yPos += boxH + 6;
    }
  }

  // Frame Composition Steps Table
  const compSteps: CompositionStep[] = analysisResult.composition_steps || [];
  if (compSteps.length > 0) {
    checkPageBreak(25 + compSteps.length * 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('FRAME COMPOSITION PIPELINE & CONSISTENCY STEPS', margin, yPos);
    yPos += 5.5;

    const compColWidths = [18, 22, 62, 45, 35];
    const compHeaders = ['Step', 'Line #', 'Operation / Expression', 'Result Frame (From -> To)', 'Consistency'];

    doc.setFillColor(30, 41, 59);
    doc.rect(margin, yPos, contentWidth, 6.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    let cColX = margin + 3;
    compHeaders.forEach((h, idx) => {
      doc.text(h, cColX, yPos + 4.5);
      cColX += compColWidths[idx];
    });

    yPos += 6.5;

    compSteps.forEach((st, rIdx) => {
      checkPageBreak(8);

      const isEven = rIdx % 2 === 0;
      doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, yPos, contentWidth, 6.5, 'FD');

      doc.setFont('courier', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(15, 23, 42);

      let stepX = margin + 3;
      doc.text(`[#${st.step}]`, stepX, yPos + 4.5);
      stepX += compColWidths[0];

      doc.text(`L${st.line_ref}`, stepX, yPos + 4.5);
      stepX += compColWidths[1];

      doc.text((st.operation || '').substring(0, 32), stepX, yPos + 4.5);
      stepX += compColWidths[2];

      const fromTo = `${st.resulting_frame?.from || '?'} -> ${st.resulting_frame?.to || '?'}`;
      doc.setFont('courier', 'bold');
      doc.setTextColor(79, 70, 229);
      doc.text(fromTo.substring(0, 24), stepX, yPos + 4.5);
      stepX += compColWidths[3];

      const isConsistent = st.frame_chain_consistent;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.0);
      doc.setTextColor(isConsistent ? 16 : 225, isConsistent ? 185 : 29, isConsistent ? 129 : 72);
      doc.text(isConsistent ? 'CONSISTENT' : 'CHAIN WARNING', stepX, yPos + 4.5);

      yPos += 6.5;
    });

    yPos += 7;
  }

  // Associated Attachments & Stored Assets (Pre-converted to Base64)
  if (preparedAttachments.length > 0) {
    checkPageBreak(22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`ASSOCIATED ASSETS, IMAGES & EXTERNAL SPECS (${preparedAttachments.length})`, margin, yPos);
    yPos += 6;

    for (const prep of preparedAttachments) {
      const { att, isCodeAtt, resolvedImg, resolvedText } = prep;

      const cardHeight = att.storagePath || att.url ? 17 : 13;
      checkPageBreak(cardHeight + 4);

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, yPos, contentWidth, cardHeight, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`• ${att.name}`, margin + 3.5, yPos + 4.8);

      const badgeText = att.storagePath
        ? '[SUPABASE STORAGE]'
        : att.type === 'drive'
        ? '[GOOGLE DRIVE]'
        : isCodeAtt
        ? '[SOURCE CODE]'
        : '[FILE ATTACHMENT]';

      doc.setFont('courier', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(att.storagePath ? 16 : 79, att.storagePath ? 185 : 70, att.storagePath ? 129 : 229);
      doc.text(badgeText, pageWidth - margin - 3.5, yPos + 4.8, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const fileInfo = `Type: ${(att.mimeType || att.type).toUpperCase()}   |   Size: ${att.size || 'Attached'}   |   Date: ${att.uploadedAt}`;
      doc.text(fileInfo, margin + 3.5, yPos + 9.5);

      if (att.storagePath) {
        doc.setFont('courier', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text(`Storage Path: app-files/${att.storagePath}`, margin + 3.5, yPos + 14);
      } else if (att.url) {
        doc.setFont('courier', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(59, 130, 246);
        const truncUrl = att.url.length > 80 ? att.url.substring(0, 80) + '...' : att.url;
        doc.text(`URL: ${truncUrl}`, margin + 3.5, yPos + 14);
      }

      yPos += cardHeight + 3;

      // Render Attached Code Content if text file
      if (isCodeAtt && resolvedText && !resolvedImg) {
        renderCodeBlock(`ATTACHED FILE CONTENT: ${att.name}`, resolvedText, [16, 185, 129]);
      }

      // Render Embedded High-Res Image Preview via pre-converted Base64
      if (resolvedImg && resolvedImg.dataUrl) {
        let displayW = 90;
        let displayH = (resolvedImg.height / resolvedImg.width) * displayW;
        if (displayH > 60) {
          displayH = 60;
          displayW = (resolvedImg.width / resolvedImg.height) * displayH;
        }
        if (isNaN(displayH) || displayH <= 0) {
          displayW = 60;
          displayH = 45;
        }

        checkPageBreak(displayH + 8);

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(margin + 3, yPos, displayW + 4, displayH + 4, 1, 1, 'FD');

        try {
          doc.addImage(resolvedImg.dataUrl, resolvedImg.format, margin + 5, yPos + 2, displayW, displayH);
          yPos += displayH + 8;
        } catch (err) {
          console.warn('Failed to embed attachment Base64 image in PDF:', err);
        }
      }
    }

    yPos += 4;
  }

  // 3D Frame Chain Trace Snapshot Image
  let snapshotDataUrl: string | null = null;
  if (typeof window !== 'undefined') {
    if (typeof (window as any).__getGizmo3DSnapshot === 'function') {
      try {
        snapshotDataUrl = (window as any).__getGizmo3DSnapshot();
      } catch (snapErr) {
        console.warn('Gizmo snapshot hook error:', snapErr);
      }
    }

    // Fallback: search for active WebGL / 3D canvas in DOM if snapshot is null
    if (!snapshotDataUrl) {
      try {
        const canvases = Array.from(document.querySelectorAll('canvas'));
        for (const c of canvases) {
          if (c.width > 80 && c.height > 80) {
            const data = c.toDataURL('image/png');
            if (data && data.startsWith('data:image/png') && data.length > 500) {
              snapshotDataUrl = data;
              break;
            }
          }
        }
      } catch (domErr) {
        console.warn('Canvas DOM snapshot fallback error:', domErr);
      }
    }
  }

  if (snapshotDataUrl) {
    checkPageBreak(65);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('3D FRAME CHAIN TRACE SNAPSHOT', margin, yPos);
    yPos += 6;

    try {
      const imgWidth = contentWidth;
      const imgHeight = 50;

      doc.setFillColor(15, 23, 42);
      doc.roundedRect(margin, yPos, imgWidth, imgHeight, 2, 2, 'F');

      doc.addImage(snapshotDataUrl, 'PNG', margin + 2, yPos + 2, imgWidth - 4, imgHeight - 4);
      yPos += imgHeight + 4;

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Interactive 3D pose snapshot from TRANS-A.AI workspace (${analysisUrl})`, margin, yPos);
      yPos += 10;
    } catch (err) {
      console.warn('PDF 3D Image Add Error:', err);
    }
  }

  // Final Pass: Add Page Numbers & Footers
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);

    doc.text(`Audit URL: ${analysisUrl}`, margin, pageHeight - 7);
    doc.text(`Page ${i} of ${totalPages}  •  TRANS-A.AI Robotics Audit`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  doc.save(fileName);
}
