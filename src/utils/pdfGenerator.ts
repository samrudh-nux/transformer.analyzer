import { jsPDF } from 'jspdf';
import { AnalysisResult, IssueDetected, CompositionStep, TransformDetected, ProjectAttachment } from '../types';
// @ts-ignore - JS file import
import { supabase } from '../supabaseClient';

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
}

// Helper to convert any image URL (including Supabase signed URLs) to base64 Data URL for PDF embedding
async function getImageDataUrl(
  url?: string
): Promise<{ dataUrl: string; format: 'JPEG' | 'PNG'; width: number; height: number } | null> {
  if (!url) return null;

  if (url.startsWith('data:image')) {
    const isPng = url.startsWith('data:image/png');
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          dataUrl: url,
          format: isPng ? 'PNG' : 'JPEG',
          width: img.naturalWidth || 400,
          height: img.naturalHeight || 300,
        });
      };
      img.onerror = () => {
        resolve({
          dataUrl: url,
          format: isPng ? 'PNG' : 'JPEG',
          width: 400,
          height: 300,
        });
      };
      img.src = url;
    });
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const w = img.naturalWidth || 400;
        const h = img.naturalHeight || 300;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve({
            dataUrl,
            format: 'JPEG',
            width: w,
            height: h,
          });
          return;
        }
      } catch (e) {
        console.warn('Canvas conversion failed, trying fetch fallback:', e);
      }
      resolve(null);
    };

    img.onerror = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          const resUrl = reader.result as string;
          if (resUrl && resUrl.startsWith('data:image')) {
            const isPng = resUrl.includes('png');
            resolve({
              dataUrl: resUrl,
              format: isPng ? 'PNG' : 'JPEG',
              width: 400,
              height: 300,
            });
          } else {
            resolve(null);
          }
        };
        reader.readAsDataURL(blob);
      } catch (fetchErr) {
        console.warn('Could not fetch image URL for PDF export:', fetchErr);
        resolve(null);
      }
    };

    img.src = url;
  });
}

// Helper to fetch text content of source code attachments
async function fetchAttachmentTextContent(att: ProjectAttachment): Promise<string | null> {
  if ((att as any).content) {
    return (att as any).content;
  }
  let fetchUrl = att.dataUrl || att.url;
  if (!fetchUrl && att.storagePath) {
    try {
      const { data } = await supabase.storage.from('app-files').download(att.storagePath);
      if (data) {
        return await data.text();
      }
    } catch (e) {
      console.warn('Storage download text failed:', e);
    }
  }
  if (fetchUrl && !fetchUrl.startsWith('data:image')) {
    try {
      const res = await fetch(fetchUrl);
      if (res.ok) {
        const text = await res.text();
        if (text && !text.includes('<!DOCTYPE html>')) {
          return text;
        }
      }
    } catch (e) {
      console.warn('Fetch attachment text failed:', e);
    }
  }
  return null;
}

export async function exportAnalysisReportPDF(options: PDFExportOptions) {
  const {
    analysisResult,
    analyzerMode,
    code,
    beforeCode,
    afterCode,
    analysisId,
    projectId,
  } = options;

  let attachments: ProjectAttachment[] = options.attachments || [];
  let secondaryData: Record<string, any> = options.secondaryData || {};
  let projectTitle = options.projectTitle || '';
  let projectDescription = options.projectDescription || '';
  let projectTags = options.tags || [];

  // Attempt to fetch associated attachments and secondary data stored in Supabase
  if (projectId || analysisId) {
    try {
      const targetId = projectId || analysisId;

      // 1. Check Supabase 'projects' table
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
          const resolvedAtts = await Promise.all(
            proj.attachments.map(async (att: ProjectAttachment) => {
              if (att.storagePath && !att.url) {
                try {
                  const { data: signedData } = await supabase.storage
                    .from('app-files')
                    .createSignedUrl(att.storagePath, 60 * 60 * 24);
                  if (signedData?.signedUrl) {
                    return {
                      ...att,
                      url: signedData.signedUrl,
                      dataUrl: att.type === 'image' ? signedData.signedUrl : att.dataUrl,
                    };
                  }
                } catch (err) {
                  console.warn('Signed URL fetch error:', err);
                }
              }
              return att;
            })
          );
          attachments = [...attachments, ...resolvedAtts];
        }

        if (proj.meta_json || proj.secondary_data) {
          secondaryData = {
            ...secondaryData,
            ...(proj.meta_json || proj.secondary_data || {}),
          };
        }
      }

      // 2. Check Supabase 'analyses' table
      const { data: analysisData } = await supabase
        .from('analyses')
        .select('*')
        .eq('id', targetId)
        .limit(1);

      if (analysisData && analysisData.length > 0) {
        const anal = analysisData[0];
        if (anal.attachments && Array.isArray(anal.attachments)) {
          attachments = [...attachments, ...anal.attachments];
        }
        if (anal.secondary_data || anal.meta) {
          secondaryData = {
            ...secondaryData,
            ...(anal.secondary_data || anal.meta || {}),
          };
        }
      }
    } catch (err) {
      console.warn('Supabase attachment fetch note:', err);
    }
  }

  // Deduplicate attachments by ID or Name
  const uniqueAttachmentsMap = new Map<string, ProjectAttachment>();
  attachments.forEach((att) => {
    const key = att.id || att.name || att.storagePath || att.url;
    if (key && !uniqueAttachmentsMap.has(key)) {
      uniqueAttachmentsMap.set(key, att);
    }
  });
  const uniqueAttachments = Array.from(uniqueAttachmentsMap.values());

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm
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

  const drawHeader = () => {
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(margin, yPos, contentWidth, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('TRANS-A.AI', margin + 6, yPos + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('SO(3) / SE(3) Rigid-Body Coordinate Frame Reviewer', margin + 6, yPos + 14);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(129, 140, 248);
    doc.text('ANALYSIS REPORT', pageWidth - margin - 6, yPos + 8, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text(`Generated: ${dateStr} ${timeStr}`, pageWidth - margin - 6, yPos + 14, { align: 'right' });

    yPos += 27;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, yPos, contentWidth, 10, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Note: AI-assisted semantic static analysis. Results are probabilistic and should be verified against platform specs.',
      margin + 4,
      yPos + 6
    );

    yPos += 14;
  };

  drawHeader();

  // Render Project Context if available
  if (projectTitle || projectDescription) {
    checkPageBreak(18);
    doc.setFillColor(238, 242, 255);
    doc.setDrawColor(199, 210, 254);
    doc.roundedRect(margin, yPos, contentWidth, projectDescription ? 16 : 11, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(67, 56, 202);
    doc.text(`PROJECT CONTEXT: ${projectTitle || 'Vault Code Project'}`, margin + 4, yPos + 5);

    if (projectDescription) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      const descLines = doc.splitTextToSize(projectDescription, contentWidth - 8);
      doc.text(descLines, margin + 4, yPos + 10);
    }

    yPos += (projectDescription ? 16 : 11) + 5;
  }

  // Verdict & Summary
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
    doc.setFontSize(11);
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
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    const summaryLines = doc.splitTextToSize(analysisResult.summary, contentWidth);
    doc.text(summaryLines, margin, yPos);
    yPos += summaryLines.length * 4.5 + 6;
  }

  // Section 2: Code Snippet Block(s)
  const renderCodeBlock = (title: string, codeText: string, accentColor: [number, number, number]) => {
    const lines = codeText.split('\n');
    const lineCount = lines.length;
    const blockHeight = Math.min(lineCount * 3.8 + 10, 80);

    checkPageBreak(blockHeight + 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin, yPos);
    yPos += 5;

    doc.setFillColor(15, 23, 42); // slate-900
    doc.roundedRect(margin, yPos, contentWidth, blockHeight, 1.5, 1.5, 'F');

    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.rect(margin, yPos, 2, blockHeight, 'F');

    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);

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

  // Section 3: Transforms Detected Table
  const transforms: TransformDetected[] = analysisResult.transforms_detected || [];
  if (transforms.length > 0) {
    checkPageBreak(25 + transforms.length * 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('TRANSFORMS DETECTED', margin, yPos);
    yPos += 6;

    const colWidths = [42, 36, 60, 44];
    const headers = ['Variable', 'Representation', 'Inferred Frame (From -> To)', 'Convention'];

    doc.setFillColor(30, 41, 59);
    doc.rect(margin, yPos, contentWidth, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);

    let colX = margin + 3;
    headers.forEach((h, idx) => {
      doc.text(h, colX, yPos + 4.8);
      colX += colWidths[idx];
    });

    yPos += 7;

    transforms.forEach((tr, rowIdx) => {
      checkPageBreak(8);

      const isEven = rowIdx % 2 === 0;
      doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, yPos, contentWidth, 7, 'FD');

      doc.setFont('courier', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);

      const frameText = `${tr.inferred_frame?.from || '?'} -> ${tr.inferred_frame?.to || '?'}`;

      let rColX = margin + 3;
      doc.text(tr.variable_name.substring(0, 20), rColX, yPos + 4.8);
      rColX += colWidths[0];

      doc.setFont('helvetica', 'normal');
      doc.text(tr.representation.substring(0, 18), rColX, yPos + 4.8);
      rColX += colWidths[1];

      doc.setFont('courier', 'bold');
      doc.setTextColor(79, 70, 229);
      doc.text(frameText.substring(0, 30), rColX, yPos + 4.8);
      rColX += colWidths[2];

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const conventionText = tr.inferred_convention || 'N/A';
      doc.text(conventionText.substring(0, 22), rColX, yPos + 4.8);

      yPos += 7;
    });

    yPos += 8;
  }

  // Section 4: Composition Steps
  const steps: CompositionStep[] = analysisResult.composition_steps || [];
  if (steps.length > 0) {
    checkPageBreak(25);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('COMPOSITION STEPS & CHAIN TRACE', margin, yPos);
    yPos += 6;

    steps.forEach((st) => {
      checkPageBreak(12);

      const hasIssue = !st.frame_chain_consistent;
      doc.setFillColor(hasIssue ? 254 : 248, hasIssue ? 242 : 250, hasIssue ? 242 : 252);
      doc.setDrawColor(hasIssue ? 252 : 226, hasIssue ? 165 : 232, hasIssue ? 165 : 240);
      doc.roundedRect(margin, yPos, contentWidth, 9, 1, 1, 'FD');

      doc.setFillColor(hasIssue ? 225 : 99, hasIssue ? 29 : 102, hasIssue ? 72 : 241);
      doc.rect(margin, yPos, 2.5, 9, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(`Step #${st.step}: ${st.operation}`, margin + 5, yPos + 5.8);

      doc.setFont('courier', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      const stepStr = `${st.resulting_frame?.from || '?'} -> ${st.resulting_frame?.to || '?'}`;
      doc.text(`Result Frame: ${stepStr}`, pageWidth - margin - 5, yPos + 5.8, { align: 'right' });

      yPos += 11;
    });

    yPos += 4;
  }

  // Section 5: Issues List
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
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    let descY = yPos + 12;
    doc.text(descLines, margin + 4, descY);
    descY += descLines.length * 4.2;

    if (issue.suggested_fix) {
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(margin + 4, descY + 1, contentWidth - 8, 9, 1, 1, 'F');

      doc.setFont('courier', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(52, 211, 153);
      const fixText = `Fix: ${issue.suggested_fix.substring(0, 75)}`;
      doc.text(fixText, margin + 7, descY + 6.8);
    }

    yPos += issueHeight + 4;
  };

  if (analyzerMode === 'diff' && analysisResult.diff_analysis) {
    const diff = analysisResult.diff_analysis;

    if (diff.issues_introduced && diff.issues_introduced.length > 0) {
      checkPageBreak(18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(225, 29, 72);
      doc.text(`ISSUES INTRODUCED (${diff.issues_introduced.length})`, margin, yPos);
      yPos += 6;
      diff.issues_introduced.forEach((iss) => renderIssueItem(iss, 'introduced'));
      yPos += 4;
    }

    if (diff.issues_fixed && diff.issues_fixed.length > 0) {
      checkPageBreak(18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(16, 185, 129);
      doc.text(`ISSUES FIXED (${diff.issues_fixed.length})`, margin, yPos);
      yPos += 6;
      diff.issues_fixed.forEach((iss) => renderIssueItem(iss, 'fixed'));
      yPos += 4;
    }

    if (diff.issues_unchanged && diff.issues_unchanged.length > 0) {
      checkPageBreak(18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(100, 116, 139);
      doc.text(`ISSUES UNCHANGED (${diff.issues_unchanged.length})`, margin, yPos);
      yPos += 6;
      diff.issues_unchanged.forEach((iss) => renderIssueItem(iss, 'unchanged'));
      yPos += 4;
    }
  } else {
    const issues = analysisResult.issues || [];
    if (issues.length > 0) {
      checkPageBreak(18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`DETAILED FINDINGS & BUGS (${issues.length})`, margin, yPos);
      yPos += 6;
      issues.forEach((iss) => renderIssueItem(iss));
      yPos += 4;
    }
  }

  // Section 6: ASSOCIATED SOURCE CODE ATTACHMENTS & SUPABASE STORED ASSETS
  if (uniqueAttachments.length > 0) {
    checkPageBreak(22);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`ASSOCIATED ATTACHMENTS & SUPABASE STORED ASSETS (${uniqueAttachments.length})`, margin, yPos);
    yPos += 6;

    for (const att of uniqueAttachments) {
      const isCodeAtt =
        att.type === 'code' ||
        /\.(py|cpp|h|hpp|c|ts|js|json|yaml|yml|urdf|xml|txt|md|sh)$/i.test(att.name);

      const isImg =
        att.type === 'image' ||
        att.mimeType?.startsWith('image/') ||
        /\.(png|jpe?g|webp|gif|svg)$/i.test(att.name);

      const imgUrl = att.dataUrl || att.url;
      const imgInfo = isImg && imgUrl ? await getImageDataUrl(imgUrl) : null;

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
      const fileInfo = `Type: ${(att.mimeType || att.type).toUpperCase()}   |   Size: ${att.size || 'N/A'}   |   Uploaded: ${att.uploadedAt}`;
      doc.text(fileInfo, margin + 3.5, yPos + 9.5);

      if (att.storagePath) {
        doc.setFont('courier', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text(`Storage Path: app-files/${att.storagePath}`, margin + 3.5, yPos + 14);
      } else if (att.url) {
        doc.setFont('courier', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        const truncUrl = att.url.length > 80 ? att.url.substring(0, 80) + '...' : att.url;
        doc.text(`URL: ${truncUrl}`, margin + 3.5, yPos + 14);
      }

      yPos += cardHeight + 3;

      // If Source Code Attachment, render its code contents in a code block!
      if (isCodeAtt) {
        const textContent = await fetchAttachmentTextContent(att);
        if (textContent) {
          renderCodeBlock(`ATTACHED SOURCE CODE: ${att.name}`, textContent, [16, 185, 129]);
        }
      }

      // If Image Attachment, render Image Preview in PDF!
      if (imgInfo) {
        let displayW = 85;
        let displayH = (imgInfo.height / imgInfo.width) * displayW;
        if (displayH > 55) {
          displayH = 55;
          displayW = (imgInfo.width / imgInfo.height) * displayH;
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
          doc.addImage(imgInfo.dataUrl, imgInfo.format, margin + 5, yPos + 2, displayW, displayH);
          yPos += displayH + 8;
        } catch (err) {
          console.warn('Failed to embed attachment image in PDF:', err);
        }
      }
    }

    yPos += 4;
  }

  // Section 7: SECONDARY DATA & TELEMETRY
  if (Object.keys(secondaryData).length > 0) {
    checkPageBreak(25);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('SECONDARY ANALYSIS DATA & SUPABASE TELEMETRY', margin, yPos);
    yPos += 6;

    const secJsonStr = JSON.stringify(secondaryData, null, 2);
    renderCodeBlock('SUPABASE METADATA & TELEMETRY JSON', secJsonStr, [14, 165, 233]);
  }

  // Section 8: 3D Frame Chain Trace Snapshot Image
  const snapshotDataUrl = typeof window !== 'undefined' && (window as any).__getGizmo3DSnapshot
    ? (window as any).__getGizmo3DSnapshot()
    : null;

  if (snapshotDataUrl) {
    checkPageBreak(65);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
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
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Static snapshot — view interactively at ${analysisUrl}`, margin, yPos);
      yPos += 10;
    } catch (err) {
      console.warn('PDF Image Add Error:', err);
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

    doc.text(`Link: ${analysisUrl}`, margin, pageHeight - 7);

    doc.text(`Page ${i} of ${totalPages}  •  Supabase Vault Parity Report`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  doc.save(fileName);
}
