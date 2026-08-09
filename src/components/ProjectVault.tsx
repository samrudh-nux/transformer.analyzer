import React, { useState, useEffect, useRef } from 'react';
import {
  FolderPlus,
  Folder,
  Plus,
  Search,
  FileCode,
  HardDrive,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  ExternalLink,
  Code2,
  Save,
  Tag,
  Upload,
  ChevronRight,
  FolderGit2,
  FileText,
  Eye,
  X,
  Play,
  Check,
  Sparkles,
  Database,
  CloudCheck,
  RefreshCw,
  Download,
  FileDown
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { ProjectFolder, ProjectItem, ProjectAttachment, FolderType, AttachmentType, UserProfile } from '../types';
import { User, Camera } from 'lucide-react';
// @ts-ignore - JS file import
import { supabase } from '../supabaseClient';

interface ProjectVaultProps {
  onLoadCodeToReviewer: (code: string) => void;
  userProfile?: UserProfile | null;
  onOpenProfileModal?: () => void;
}

const INITIAL_FOLDERS: ProjectFolder[] = [
  {
    id: 'f-1',
    name: 'SO(3) & Kinematics Transforms',
    folderType: 'code',
    color: 'bg-indigo-500',
    description: 'Core rigid body rotation matrices, Lie algebra, and quaternion conversions.',
    createdAt: '2026-08-01',
  },
  {
    id: 'f-2',
    name: 'Robot CAD & URDF Specs',
    folderType: 'docs',
    color: 'bg-amber-500',
    description: 'Kinematic trees, joint limits, and 3D visual mesh models.',
    createdAt: '2026-08-03',
  },
  {
    id: 'f-3',
    name: 'Google Drive & Spec Assets',
    folderType: 'drive',
    color: 'bg-emerald-500',
    description: 'External Drive documents, calibration sheets, and sensor design specs.',
    createdAt: '2026-08-05',
  },
];

const INITIAL_PROJECTS: ProjectItem[] = [
  {
    id: 'p-1',
    folderId: 'f-1',
    title: 'Camera Extrinsics & World Frame Alignment',
    language: 'python',
    description: 'Transform camera coordinates into world frame using SO(3) rotation matrices and OpenCV pinhole model.',
    code: `import numpy as np

def transform_cam_to_world(p_cam, R_world_cam, t_world_cam):
    """
    Transforms point from camera frame 'C' to world frame 'W'.
    p_cam: 3x1 vector in camera frame C
    R_world_cam: Rotation matrix R_W_C mapping C -> W
    t_world_cam: Translation vector t_W_C
    """
    R_world_cam = np.asarray(R_world_cam)
    p_cam = np.asarray(p_cam)
    t_world_cam = np.asarray(t_world_cam)
    
    # Correct SE(3) transform: p_W = R_W_C * p_C + t_W_C
    p_world = np.dot(R_world_cam, p_cam) + t_world_cam
    return p_world

# Example usage
R_W_C = np.eye(3)
t_W_C = [0.5, 0.2, 1.2]
p_C = [0.1, 0.0, 2.5]
print("World coords:", transform_cam_to_world(p_C, R_W_C, t_W_C))`,
    tags: ['SO(3)', 'OpenCV', 'Extrinsics', 'Robotics'],
    attachments: [
      {
        id: 'att-1',
        name: 'Camera_Extrinsics_Design_Spec.pdf',
        type: 'drive',
        url: 'https://drive.google.com/file/d/1a2b3c4d5e6f7g8h9i/view',
        driveId: '1a2b3c4d5e6f7g8h9i',
        mimeType: 'application/pdf',
        size: '1.4 MB',
        uploadedAt: '2026-08-06',
      },
      {
        id: 'att-2',
        name: 'stereo_rig_calibration.png',
        type: 'image',
        dataUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80',
        size: '420 KB',
        uploadedAt: '2026-08-07',
      },
    ],
    createdAt: '2026-08-05',
    updatedAt: '2026-08-08',
  },
  {
    id: 'p-2',
    folderId: 'f-2',
    title: '7-DOF Manipulator Forward Kinematics',
    language: 'cpp',
    description: 'Eigen-based forward kinematics parser with DH parameter table and singularity protection.',
    code: `#include <iostream>
#include <Eigen/Dense>

using namespace Eigen;

Matrix4d get_dh_transform(double a, double alpha, double d, double theta) {
    Matrix4d T;
    T << cos(theta), -sin(theta)*cos(alpha),  sin(theta)*sin(alpha), a*cos(theta),
         sin(theta),  cos(theta)*cos(alpha), -cos(theta)*sin(alpha), a*sin(theta),
         0,           sin(alpha),             cos(alpha),            d,
         0,           0,                      0,                     1;
    return T;
}

int main() {
    Matrix4d T_0_7 = Matrix4d::Identity();
    // Chain multiplication across 7 links
    std::cout << "End-effector T_0_7:\\n" << T_0_7 << std::endl;
    return 0;
}`,
    tags: ['C++', 'Eigen', 'URDF', 'Forward Kinematics'],
    attachments: [
      {
        id: 'att-3',
        name: 'Robot_Arm_Kinematic_Tree.gdoc',
        type: 'drive',
        url: 'https://docs.google.com/document/d/1X9Y8Z7W6V5U4T3S2R1/edit',
        driveId: '1X9Y8Z7W6V5U4T3S2R1',
        mimeType: 'application/vnd.google-apps.document',
        size: 'Google Doc',
        uploadedAt: '2026-08-06',
      },
    ],
    createdAt: '2026-08-06',
    updatedAt: '2026-08-08',
  },
];

export const ProjectVault: React.FC<ProjectVaultProps> = ({
  onLoadCodeToReviewer,
  userProfile,
  onOpenProfileModal,
}) => {
  // Load state from localStorage or initial defaults
  const [folders, setFolders] = useState<ProjectFolder[]>(() => {
    const saved = localStorage.getItem('vault_folders');
    return saved ? JSON.parse(saved) : INITIAL_FOLDERS;
  });

  const [projects, setProjects] = useState<ProjectItem[]>(() => {
    const saved = localStorage.getItem('vault_projects');
    return saved ? JSON.parse(saved) : INITIAL_PROJECTS;
  });

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    INITIAL_PROJECTS[0]?.id || null
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSupabaseSynced, setIsSupabaseSynced] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);

  // Modals state
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderType, setNewFolderType] = useState<FolderType>('code');
  const [newFolderColor, setNewFolderColor] = useState('bg-blue-500');

  const [isNewDriveAttachmentOpen, setIsNewDriveAttachmentOpen] = useState(false);
  const [driveName, setDriveName] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const [isSavingSupabase, setIsSavingSupabase] = useState<boolean>(false);
  const [supabaseSaveNotice, setSupabaseSaveNotice] = useState<string | null>(null);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState<boolean>(false);

  // Explicit Save to Supabase function
  const handleExplicitSaveToSupabase = async () => {
    if (!activeProject) return;
    setIsSavingSupabase(true);
    setSupabaseSaveNotice(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      if (!userData?.user) {
        setSupabaseSaveNotice('User not authenticated with Supabase. Please sign up or log in first.');
        setIsSavingSupabase(false);
        return;
      }

      // Upsert current folder if needed
      const currentFolder = folders.find((f) => f.id === activeProject.folderId);
      if (currentFolder) {
        await supabase.from('folders').upsert({
          id: currentFolder.id,
          user_id: userData.user.id,
          name: currentFolder.name,
          folder_type: currentFolder.folderType,
          color: currentFolder.color,
          description: currentFolder.description || '',
        });
      }

      // Upsert current project into Supabase table 'projects'
      const { error: upsertError } = await supabase.from('projects').upsert({
        id: activeProject.id,
        user_id: userData.user.id,
        folder_id: activeProject.folderId,
        title: activeProject.title,
        language: activeProject.language,
        description: activeProject.description,
        code: activeProject.code,
        tags: activeProject.tags,
        attachments: activeProject.attachments,
        updated_at: new Date().toISOString(),
      });

      if (upsertError) {
        setSupabaseSaveNotice(`Supabase Save Failed: ${upsertError.message}`);
      } else {
        setIsSupabaseSynced(true);
        setSupabaseSaveNotice(`✓ Successfully saved "${activeProject.title}" to Supabase table 'projects'!`);
      }
    } catch (err: any) {
      setSupabaseSaveNotice(`Save Error: ${err?.message || 'Check database table setup'}`);
    } finally {
      setIsSavingSupabase(false);
      setTimeout(() => {
        setSupabaseSaveNotice(null);
      }, 6000);
    }
  };

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

  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);

  // Generate and export printable PDF document
  const handleExportPDF = async () => {
    if (!activeProject) return;
    setIsExportingPDF(true);

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
      };

      // Header Banner Box
      doc.setFillColor(24, 24, 27); // Dark zinc-900
      doc.rect(margin, y, contentWidth, 24, 'F');

      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      const titleText = activeProject.title || 'Untitled Project';
      doc.text(titleText, margin + 5, y + 10);

      // Metadata subtitle
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(161, 161, 170);
      const folderName = folders.find((f) => f.id === activeProject.folderId)?.name || 'General Vault';
      const metaStr = `Folder: ${folderName}   |   Language: ${(activeProject.language || 'code').toUpperCase()}   |   Exported: ${new Date().toLocaleDateString()}`;
      doc.text(metaStr, margin + 5, y + 18);

      y += 30;

      // Description
      if (activeProject.description) {
        checkPageBreak(18);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(24, 24, 27);
        doc.text('PROJECT DESCRIPTION', margin, y);
        y += 5.5;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        const splitDesc = doc.splitTextToSize(activeProject.description, contentWidth);
        doc.text(splitDesc, margin, y);
        y += splitDesc.length * 4.5 + 6;
      }

      // Code Snippet
      if (activeProject.code) {
        checkPageBreak(25);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(24, 24, 27);
        doc.text(`SOURCE CODE (${(activeProject.language || 'CODE').toUpperCase()})`, margin, y);
        y += 5.5;

        const codeLines = activeProject.code.split('\n');
        const lineHeight = 4.2;

        // Code Header Banner
        doc.setFillColor(39, 39, 42);
        doc.rect(margin, y, contentWidth, 6.5, 'F');
        doc.setFont('courier', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(228, 228, 231);
        doc.text(`// ${activeProject.title} (${codeLines.length} lines)`, margin + 4, y + 4.5);
        y += 6.5;

        doc.setFont('courier', 'normal');
        doc.setFontSize(7.5);

        for (let i = 0; i < codeLines.length; i++) {
          checkPageBreak(lineHeight + 1.5);

          if (i % 2 === 0) {
            doc.setFillColor(248, 250, 252);
            doc.rect(margin, y, contentWidth, lineHeight + 0.3, 'F');
          }

          // Line numbers
          doc.setTextColor(148, 163, 184);
          doc.text(String(i + 1).padStart(3, ' '), margin + 2, y + 3.2);

          // Code text
          doc.setTextColor(15, 23, 42);
          const rawLine = codeLines[i].replace(/\t/g, '  ');
          const truncatedLine = rawLine.length > 95 ? rawLine.substring(0, 95) + '...' : rawLine;
          doc.text(truncatedLine, margin + 11, y + 3.2);

          y += lineHeight;
        }

        y += 8;
      }

      // Attachments & Google Drive Assets
      if (activeProject.attachments && activeProject.attachments.length > 0) {
        checkPageBreak(20);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(24, 24, 27);
        doc.text(`ATTACHED FILES & STORED ASSETS (${activeProject.attachments.length})`, margin, y);
        y += 6;

        for (const att of activeProject.attachments) {
          const isImg =
            att.type === 'image' ||
            att.mimeType?.startsWith('image/') ||
            /\.(png|jpe?g|webp|gif|svg)$/i.test(att.name);

          const imgUrl = att.dataUrl || att.url;
          const imgInfo = isImg && imgUrl ? await getImageDataUrl(imgUrl) : null;

          const cardHeight = att.storagePath || att.url ? 17 : 13;
          checkPageBreak(cardHeight + 4);

          // Card Background & Border
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(margin, y, contentWidth, cardHeight, 1.5, 1.5, 'FD');

          // Title & Badge
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(15, 23, 42);
          doc.text(`• ${att.name}`, margin + 3.5, y + 4.8);

          // Source Tag
          const badgeText = att.storagePath
            ? '[SUPABASE STORAGE]'
            : att.type === 'drive'
            ? '[GOOGLE DRIVE]'
            : '[FILE ATTACHMENT]';
          doc.setFont('courier', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(att.storagePath ? 16 : 79, att.storagePath ? 185 : 70, att.storagePath ? 129 : 229);
          doc.text(badgeText, pageWidth - margin - 3.5, y + 4.8, { align: 'right' });

          // Specs
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          const fileInfo = `Type: ${(att.mimeType || att.type).toUpperCase()}   |   Size: ${att.size || 'N/A'}   |   Uploaded: ${att.uploadedAt}`;
          doc.text(fileInfo, margin + 3.5, y + 9.5);

          // Storage location or URL link
          if (att.storagePath) {
            doc.setFont('courier', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(71, 85, 105);
            doc.text(`Storage Path: app-files/${att.storagePath}`, margin + 3.5, y + 14);
          } else if (att.url) {
            doc.setFont('courier', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(71, 85, 105);
            const truncUrl = att.url.length > 80 ? att.url.substring(0, 80) + '...' : att.url;
            doc.text(`URL: ${truncUrl}`, margin + 3.5, y + 14);
          }

          y += cardHeight + 3;

          // Render Real Image Preview if available
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
            doc.roundedRect(margin + 3, y, displayW + 4, displayH + 4, 1, 1, 'FD');

            try {
              doc.addImage(imgInfo.dataUrl, imgInfo.format, margin + 5, y + 2, displayW, displayH);
              y += displayH + 8;
            } catch (err) {
              console.warn('Failed to embed image in PDF:', err);
            }
          }
        }
      }

      // Footer
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Page ${i} of ${totalPages}  •  Project Vault Export  •  Supabase Storage`,
          margin,
          pageHeight - 7
        );
      }

      const safeTitle = activeProject.title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Project';
      doc.save(`${safeTitle}_Document.pdf`);
      setSupabaseSaveNotice(`✓ Downloaded printable PDF for "${activeProject.title}"!`);
    } catch (pdfErr: any) {
      console.error('PDF Generation Error:', pdfErr);
      setSupabaseSaveNotice(`PDF Export Error: ${pdfErr?.message || 'Could not build PDF'}`);
    } finally {
      setIsExportingPDF(false);
      setTimeout(() => {
        setSupabaseSaveNotice(null);
      }, 5000);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem('vault_folders', JSON.stringify(folders));
  }, [folders]);

  useEffect(() => {
    localStorage.setItem('vault_projects', JSON.stringify(projects));
  }, [projects]);

  // Supabase Data Sync on Mount
  useEffect(() => {
    async function loadSupabaseData() {
      try {
        setSyncing(true);
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) {
          setIsSupabaseSynced(false);
          setSyncing(false);
          return;
        }

        // Fetch Folders from Supabase
        const { data: dbFolders, error: folderErr } = await supabase
          .from('folders')
          .select('*')
          .order('created_at', { ascending: true });

        // Fetch Projects from Supabase
        const { data: dbProjects, error: projErr } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false });

        if (!folderErr && dbFolders && dbFolders.length > 0) {
          const mappedFolders: ProjectFolder[] = dbFolders.map((f: any) => ({
            id: f.id,
            name: f.name,
            folderType: f.folder_type || f.folderType || 'code',
            color: f.color || 'bg-indigo-500',
            description: f.description || '',
            createdAt: f.created_at ? f.created_at.split('T')[0] : '',
          }));
          setFolders(mappedFolders);
        }

        if (!projErr && dbProjects && dbProjects.length > 0) {
          const mappedProjects: ProjectItem[] = await Promise.all(
            dbProjects.map(async (p: any) => {
              const rawAttachments: ProjectAttachment[] = p.attachments || [];
              const updatedAttachments = await Promise.all(
                rawAttachments.map(async (att) => {
                  if (att.storagePath) {
                    try {
                      const { data: signedData } = await supabase.storage
                        .from('app-files')
                        .createSignedUrl(att.storagePath, 60 * 60 * 24 * 7);
                      if (signedData?.signedUrl) {
                        return {
                          ...att,
                          url: signedData.signedUrl,
                          dataUrl: att.type === 'image' ? signedData.signedUrl : (att.dataUrl || signedData.signedUrl),
                        };
                      }
                    } catch (err) {
                      console.warn('Could not generate signed URL for storage path:', att.storagePath, err);
                    }
                  }
                  return att;
                })
              );

              return {
                id: p.id,
                folderId: p.folder_id || p.folderId,
                title: p.title,
                language: p.language || 'python',
                description: p.description || '',
                code: p.code || '',
                tags: p.tags || [],
                attachments: updatedAttachments,
                createdAt: p.created_at ? p.created_at.split('T')[0] : '',
                updatedAt: p.updated_at ? p.updated_at.split('T')[0] : '',
              };
            })
          );
          setProjects(mappedProjects);
          if (mappedProjects[0]?.id) {
            setSelectedProjectId(mappedProjects[0].id);
          }
        }

        if (!folderErr && !projErr) {
          setIsSupabaseSynced(true);
        }
      } catch (err) {
        console.warn('Supabase offline or tables not yet created. Using local storage.', err);
      } finally {
        setSyncing(false);
      }
    }

    loadSupabaseData();
  }, []);

  const activeProject = projects.find((p) => p.id === selectedProjectId) || null;

  // Filter projects by selected folder and search query
  const filteredProjects = projects.filter((p) => {
    const matchesFolder = selectedFolderId ? p.folderId === selectedFolderId : true;
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFolder && matchesSearch;
  });

  // Create folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const newFolder: ProjectFolder = {
      id: `f-${Date.now()}`,
      name: newFolderName.trim(),
      folderType: newFolderType,
      color: newFolderColor,
      createdAt: new Date().toISOString().split('T')[0],
    };

    setFolders([...folders, newFolder]);
    setSelectedFolderId(newFolder.id);
    setNewFolderName('');
    setIsNewFolderOpen(false);

    // Save to Supabase
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        await supabase.from('folders').insert({
          id: newFolder.id,
          user_id: userData.user.id,
          name: newFolder.name,
          folder_type: newFolder.folderType,
          color: newFolder.color,
          description: '',
        });
      }
    } catch (err) {
      console.warn('Could not sync new folder to Supabase:', err);
    }
  };

  // Create new project item
  const handleCreateProject = async () => {
    const targetFolderId = selectedFolderId || folders[0]?.id || 'f-1';
    const newProj: ProjectItem = {
      id: `p-${Date.now()}`,
      folderId: targetFolderId,
      title: 'New Transform Script',
      language: 'python',
      description: 'Add a description for this rigid-body coordinate transform code snippet...',
      code: `# Python Transformation Module\nimport numpy as np\n\ndef rigid_body_transform(point, R, t):\n    return np.dot(R, point) + t\n`,
      tags: ['Custom', 'SO(3)'],
      attachments: [],
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    setProjects([newProj, ...projects]);
    setSelectedProjectId(newProj.id);

    // Save to Supabase
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        await supabase.from('projects').insert({
          id: newProj.id,
          user_id: userData.user.id,
          folder_id: newProj.folderId,
          title: newProj.title,
          language: newProj.language,
          description: newProj.description,
          code: newProj.code,
          tags: newProj.tags,
          attachments: newProj.attachments,
        });
      }
    } catch (err) {
      console.warn('Could not sync new project to Supabase:', err);
    }
  };

  // Update current project code/details
  const handleUpdateProject = async (field: keyof ProjectItem, value: any) => {
    if (!selectedProjectId) return;

    const updatedProjects = projects.map((p) =>
      p.id === selectedProjectId
        ? {
            ...p,
            [field]: value,
            updatedAt: new Date().toISOString().split('T')[0],
          }
        : p
    );

    setProjects(updatedProjects);

    // Sync update to Supabase
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        const dbFieldMap: Record<string, string> = {
          folderId: 'folder_id',
          title: 'title',
          language: 'language',
          description: 'description',
          code: 'code',
          tags: 'tags',
          attachments: 'attachments',
        };

        const colName = dbFieldMap[field] || field;
        await supabase
          .from('projects')
          .update({
            [colName]: value,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedProjectId);
      }
    } catch (err) {
      console.warn('Could not sync project update to Supabase:', err);
    }
  };

  // Delete project (including any files stored in Supabase Storage app-files bucket)
  const handleDeleteProject = async (id: string) => {
    const projToDelete = projects.find((p) => p.id === id);
    setProjects(projects.filter((p) => p.id !== id));
    if (selectedProjectId === id) {
      setSelectedProjectId(null);
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        // Clean up files in Supabase Storage bucket 'app-files'
        if (projToDelete?.attachments && projToDelete.attachments.length > 0) {
          const storagePaths = projToDelete.attachments
            .map((a) => a.storagePath)
            .filter(Boolean) as string[];
          if (storagePaths.length > 0) {
            await supabase.storage.from('app-files').remove(storagePaths);
          }
        }

        await supabase.from('projects').delete().eq('id', id);
      }
    } catch (err) {
      console.warn('Could not delete project from Supabase:', err);
    }
  };

  // Attach Google Drive file
  const handleAddDriveAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !driveName.trim()) return;

    const newAtt: ProjectAttachment = {
      id: `att-${Date.now()}`,
      name: driveName.trim(),
      type: 'drive',
      url: driveUrl.trim() || 'https://drive.google.com',
      uploadedAt: new Date().toISOString().split('T')[0],
      size: 'Google Drive',
    };

    const targetProject = projects.find((p) => p.id === selectedProjectId);
    const updatedAttachments = [...(targetProject?.attachments || []), newAtt];

    setProjects(
      projects.map((p) =>
        p.id === selectedProjectId
          ? { ...p, attachments: updatedAttachments }
          : p
      )
    );

    setDriveName('');
    setDriveUrl('');
    setIsNewDriveAttachmentOpen(false);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        await supabase
          .from('projects')
          .update({ attachments: updatedAttachments })
          .eq('id', selectedProjectId);
      }
    } catch (err) {
      console.warn('Could not sync drive attachment to Supabase:', err);
    }
  };

  // Upload local file attachment to Supabase Storage bucket 'app-files'
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length || !selectedProjectId) return;

    const file = files[0];
    const isImage = file.type.startsWith('image/');

    try {
      const { data: userData } = await supabase.auth.getUser();
      let storagePath: string | undefined = undefined;
      let signedUrl: string | undefined = undefined;

      if (userData?.user) {
        const userId = userData.user.id;
        const cleanName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const fileId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        // Clean folder structure starting with user ID: ${auth.uid()}/attachments/${selectedProjectId}/${fileId}_${cleanName}
        storagePath = `${userId}/attachments/${selectedProjectId}/${fileId}_${cleanName}`;

        // Upload file to private bucket 'app-files'
        const { error: uploadErr } = await supabase.storage
          .from('app-files')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: true,
            contentType: file.type || undefined,
          });

        if (uploadErr) {
          console.warn('Supabase Storage upload warning:', uploadErr.message);
        } else {
          // Generate signed URL (since bucket 'app-files' is private)
          const { data: signedData, error: signedErr } = await supabase.storage
            .from('app-files')
            .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days

          if (!signedErr && signedData?.signedUrl) {
            signedUrl = signedData.signedUrl;
          }
        }
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        const localDataUrl = event.target?.result as string;

        const newAtt: ProjectAttachment = {
          id: `att-${Date.now()}`,
          name: file.name,
          type: isImage ? 'image' : 'file',
          mimeType: file.type,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          uploadedAt: new Date().toISOString().split('T')[0],
          storagePath: storagePath,
          url: signedUrl || localDataUrl,
          dataUrl: signedUrl || localDataUrl,
        };

        const targetProject = projects.find((p) => p.id === selectedProjectId);
        const updatedAttachments = [...(targetProject?.attachments || []), newAtt];

        setProjects(
          projects.map((p) =>
            p.id === selectedProjectId
              ? { ...p, attachments: updatedAttachments }
              : p
          )
        );

        if (userData?.user) {
          await supabase
            .from('projects')
            .update({ attachments: updatedAttachments })
            .eq('id', selectedProjectId);
        }
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error('File upload error:', err);
    } finally {
      e.target.value = '';
    }
  };

  // Delete attachment (removes file from Supabase Storage 'app-files' and updates database row)
  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!selectedProjectId) return;
    const targetProject = projects.find((p) => p.id === selectedProjectId);
    const attToDelete = targetProject?.attachments.find((a) => a.id === attachmentId);
    const updatedAttachments = (targetProject?.attachments || []).filter(
      (a) => a.id !== attachmentId
    );

    setProjects(
      projects.map((p) =>
        p.id === selectedProjectId
          ? {
              ...p,
              attachments: updatedAttachments,
            }
          : p
      )
    );

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        // Delete file from Supabase Storage if storagePath exists
        if (attToDelete?.storagePath) {
          const { error: removeErr } = await supabase.storage
            .from('app-files')
            .remove([attToDelete.storagePath]);
          if (removeErr) {
            console.warn('Could not remove file from Supabase Storage:', removeErr);
          }
        }

        await supabase
          .from('projects')
          .update({ attachments: updatedAttachments })
          .eq('id', selectedProjectId);
      }
    } catch (err) {
      console.warn('Could not delete attachment from Supabase:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header Banner */}
      <div className="mb-6 bg-gradient-to-r from-zinc-900 via-indigo-950 to-zinc-900 text-white rounded-2xl p-6 shadow-md border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-indigo-400 mb-1">
            <FolderGit2 className="w-5 h-5" />
            <span className="text-xs font-mono font-semibold uppercase tracking-wider">
              Project Vault & Document Attachments
            </span>
            {isSupabaseSynced ? (
              <span className="ml-2 inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono">
                <Database className="w-3 h-3 text-emerald-400" />
                <span>Supabase Live Sync</span>
              </span>
            ) : syncing ? (
              <span className="ml-2 inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-mono">
                <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                <span>Connecting Supabase...</span>
              </span>
            ) : (
              <span className="ml-2 inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px] font-mono">
                <Database className="w-3 h-3 text-zinc-400" />
                <span>Local & Storage</span>
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold font-sans tracking-tight">
            Projects, Codes & Google Drive Assets
          </h2>
          <p className="text-xs text-zinc-300 mt-1 max-w-2xl font-sans">
            Organize code snippets, category folders, mathematical specs, and attach Google Drive documents or calibration images directly to your transformation workspace.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => setIsSupabaseModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 text-xs font-mono font-semibold rounded-md border border-emerald-800/80 transition-all shadow-2xs active:scale-[0.98]"
            title="Inspect Supabase database tables and view SQL schema"
          >
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>DB Inspector</span>
          </button>
          <button
            onClick={() => setIsNewFolderOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono font-semibold rounded-md border border-zinc-700 transition-all shadow-2xs active:scale-[0.98]"
          >
            <FolderPlus className="w-3.5 h-3.5 text-indigo-400" />
            <span>New Folder</span>
          </button>
          <button
            onClick={handleCreateProject}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-semibold rounded-md shadow-2xs transition-all active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Engineer Profile Card in Vault */}
      {userProfile && (
        <div className="mb-6 bg-white rounded-xl p-4 border border-zinc-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="relative shrink-0">
              <img
                src={userProfile.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'}
                alt="Profile Avatar"
                className="w-12 h-12 rounded-xl object-cover ring-2 ring-indigo-500/20 shadow-xs"
              />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white" />
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-zinc-900 font-sans">
                  {userProfile.fullName || 'Robotics Engineer'}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-semibold">
                  {userProfile.role || 'Robotics & SLAM Engineer'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 font-sans mt-0.5">
                <span>{userProfile.organization || 'Autonomous Systems Lab'}</span>
                <span>•</span>
                <span className="font-mono text-zinc-600">{userProfile.primaryConvention || 'Hamilton Quaternion'}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenProfileModal}
            className="shrink-0 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold rounded-lg border border-zinc-300/70 transition-all flex items-center space-x-1.5 active:scale-95"
          >
            <Camera className="w-3.5 h-3.5 text-indigo-600" />
            <span>Edit Profile & Photo</span>
          </button>
        </div>
      )}

      {/* Supabase Save Notification Banner */}
      {supabaseSaveNotice && (
        <div className={`mb-6 p-3 rounded-xl border flex items-center justify-between font-mono text-xs shadow-2xs animate-fade-in ${
          supabaseSaveNotice.includes('Failed') || supabaseSaveNotice.includes('Error')
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          <div className="flex items-center space-x-2">
            <Database className={`w-4 h-4 shrink-0 ${
              supabaseSaveNotice.includes('Failed') || supabaseSaveNotice.includes('Error')
                ? 'text-rose-600'
                : 'text-emerald-600'
            }`} />
            <span className="font-medium">{supabaseSaveNotice}</span>
          </div>
          <button
            onClick={() => setSupabaseSaveNotice(null)}
            className="text-zinc-400 hover:text-zinc-600 text-xs font-sans px-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Sidebar Folders (3 cols) | Projects List (4 cols) | Active Project & Attachments (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Folders & Categories (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-100">
              <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider font-mono flex items-center space-x-1.5">
                <Folder className="w-4 h-4 text-indigo-600" />
                <span>Folders & Types</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                {folders.length} categories
              </span>
            </div>

            <div className="space-y-1">
              {/* All Projects button */}
              <button
                onClick={() => setSelectedFolderId(null)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${
                  selectedFolderId === null
                    ? 'bg-zinc-900 text-white font-semibold shadow-2xs'
                    : 'text-zinc-700 hover:bg-zinc-100'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <FolderGit2 className="w-4 h-4 text-indigo-400" />
                  <span>All Projects & Snippets</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-700/50 text-zinc-300 font-mono">
                  {projects.length}
                </span>
              </button>

              {/* Folders List */}
              {folders.map((folder) => {
                const count = projects.filter((p) => p.folderId === folder.id).length;
                const isSelected = selectedFolderId === folder.id;

                return (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-indigo-50 border border-indigo-200 text-indigo-950 font-semibold shadow-2xs'
                        : 'text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${folder.color}`} />
                      <span className="truncate">{folder.name}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      {folder.folderType === 'drive' && (
                        <HardDrive className="w-3 h-3 text-emerald-600" />
                      )}
                      {folder.folderType === 'code' && (
                        <FileCode className="w-3 h-3 text-indigo-600" />
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-mono">
                        {count}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Middle Column: Projects List & Filter (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-2xs flex flex-col min-h-[500px]">
            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects, tags, codes..."
                className="w-full pl-9 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-sans text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all"
              />
            </div>

            {/* List Header */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-100 text-xs text-zinc-500 font-mono">
              <span>{filteredProjects.length} Items Found</span>
              <span>Updated</span>
            </div>

            {/* Items */}
            <div className="space-y-2 flex-1 overflow-y-auto max-h-[520px] pr-1">
              {filteredProjects.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 text-xs font-mono">
                  No projects found in this view.
                </div>
              ) : (
                filteredProjects.map((project) => {
                  const isSelected = selectedProjectId === project.id;
                  const folder = folders.find((f) => f.id === project.folderId);

                  // Calculate truncated preview lines for read-only view
                  const codeLines = project.code ? project.code.split('\n') : [];
                  const maxPreviewLines = 6;
                  const isTruncated = codeLines.length > maxPreviewLines;
                  const truncatedCode = codeLines.slice(0, maxPreviewLines).join('\n');

                  return (
                    <div
                      key={project.id}
                      onClick={() => setSelectedProjectId(project.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-300/50 shadow-2xs'
                          : 'bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-xs font-bold text-zinc-900 font-sans line-clamp-1">
                          {project.title}
                        </h4>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 shrink-0 uppercase">
                          {project.language}
                        </span>
                      </div>

                      <p className="text-[11px] text-zinc-500 font-sans line-clamp-2 mb-2 leading-relaxed">
                        {project.description}
                      </p>

                      {/* Read-Only Code Preview Pane (shows when item is selected) */}
                      {isSelected && (
                        <div className="my-2.5 p-2.5 bg-zinc-900 rounded-lg border border-zinc-800 shadow-inner font-mono text-[11px]">
                          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-zinc-800 text-[10px]">
                            <span className="flex items-center space-x-1.5 text-indigo-400 font-semibold">
                              <Eye className="w-3 h-3" />
                              <span>Read-Only Preview</span>
                            </span>
                            <span className="text-zinc-400 font-mono">
                              {codeLines.length} lines {isTruncated ? '(truncated)' : ''}
                            </span>
                          </div>

                          <pre className="text-zinc-300 overflow-x-auto whitespace-pre leading-relaxed select-text font-mono text-[11px]">
                            {truncatedCode}
                          </pre>

                          {isTruncated && (
                            <div className="mt-2 pt-1.5 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400 font-sans">
                              <span className="text-indigo-300 font-mono">
                                ... +{codeLines.length - maxPreviewLines} more lines
                              </span>
                              <span className="text-zinc-500">Edit full script in workspace →</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                        <div className="flex items-center space-x-1">
                          <span className={`w-2 h-2 rounded-full ${folder?.color || 'bg-zinc-400'}`} />
                          <span className="truncate max-w-[100px]">{folder?.name || 'General'}</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          {project.attachments.length > 0 && (
                            <span className="flex items-center space-x-1 text-indigo-600 font-semibold">
                              <Paperclip className="w-3 h-3" />
                              <span>{project.attachments.length}</span>
                            </span>
                          )}
                          <span>{project.updatedAt}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Active Project Details & Attachments (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {activeProject ? (
            <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-2xs space-y-5">
              {/* Top Controls */}
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono text-zinc-400">Project Workspace</span>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-300" />
                  <span className="text-xs font-bold text-zinc-800 font-mono uppercase">
                    {activeProject.language}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleExportPDF}
                    disabled={isExportingPDF}
                    className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-mono font-semibold rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-2xs transition-all active:scale-[0.98]"
                    title="Export printable PDF report with code, notes and attached files"
                  >
                    {isExportingPDF ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <FileDown className="w-3.5 h-3.5 text-white" />
                    )}
                    <span>Export PDF Report</span>
                  </button>

                  <button
                    onClick={handleExplicitSaveToSupabase}
                    disabled={isSavingSupabase}
                    className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-mono font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-2xs transition-all active:scale-[0.98]"
                    title="Explicitly save code, metadata, and attachments to Supabase table 'projects'"
                  >
                    {isSavingSupabase ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <Database className="w-3.5 h-3.5 text-white" />
                    )}
                    <span>Save to Vault</span>
                  </button>

                  <button
                    onClick={() => onLoadCodeToReviewer(activeProject.code)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-mono font-semibold rounded-md bg-zinc-900 hover:bg-zinc-800 text-white shadow-2xs transition-all active:scale-[0.98]"
                    title="Load code directly into Code Reviewer workspace"
                  >
                    <Play className="w-3.5 h-3.5 text-white fill-current" />
                    <span>Run in Reviewer</span>
                  </button>

                  <button
                    onClick={() => handleDeleteProject(activeProject.id)}
                    className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                    title="Delete project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Title & Description Form */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 uppercase font-mono mb-1">
                    Project Title
                  </label>
                  <input
                    type="text"
                    value={activeProject.title}
                    onChange={(e) => handleUpdateProject('title', e.target.value)}
                    className="w-full text-sm font-bold text-zinc-900 border-b border-zinc-200 pb-1 focus:outline-none focus:border-indigo-600 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 uppercase font-mono mb-1">
                    Description & Notes
                  </label>
                  <textarea
                    rows={2}
                    value={activeProject.description}
                    onChange={(e) => handleUpdateProject('description', e.target.value)}
                    className="w-full text-xs text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-sans"
                  />
                </div>
              </div>

              {/* Code Snippet Box */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-zinc-600 uppercase font-mono flex items-center space-x-1.5">
                    <Code2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Code Snippet</span>
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleExplicitSaveToSupabase}
                      disabled={isSavingSupabase}
                      className="text-[11px] font-mono font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-0.5 rounded border border-emerald-200 transition-all flex items-center space-x-1"
                    >
                      {isSavingSupabase ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Check className="w-3 h-3 text-emerald-600" />
                      )}
                      <span>Save Code to Supabase</span>
                    </button>
                  </div>
                </div>
                <textarea
                  rows={8}
                  value={activeProject.code}
                  onChange={(e) => handleUpdateProject('code', e.target.value)}
                  className="w-full p-3 font-mono text-xs bg-zinc-900 text-zinc-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                />
              </div>

              {/* Attachments Section (Google Drive, Images, Files) */}
              <div className="border-t border-zinc-200 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider font-mono flex items-center space-x-1.5">
                    <Paperclip className="w-4 h-4 text-indigo-600" />
                    <span>Attachments & Drive Links ({activeProject.attachments.length})</span>
                  </span>

                  <div className="flex items-center space-x-2">
                    {/* Add Google Drive button */}
                    <button
                      onClick={() => setIsNewDriveAttachmentOpen(true)}
                      className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1"
                    >
                      <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Drive Link</span>
                    </button>

                    {/* Upload File / Image button */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border border-zinc-200 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1"
                    >
                      <Upload className="w-3.5 h-3.5 text-zinc-600" />
                      <span>Attach File</span>
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Attachments List & Image Gallery */}
                <div className="space-y-3">
                  {/* Small Image Gallery for saved image attachments */}
                  {activeProject.attachments.some((a) => a.type === 'image') && (
                    <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono text-zinc-300">
                        <span className="flex items-center space-x-1.5 font-bold text-indigo-400">
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>Image Gallery (Supabase Bucket 'app-files')</span>
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          Signed URL Secured
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
                        {activeProject.attachments
                          .filter((a) => a.type === 'image')
                          .map((imgAtt) => {
                            const imgSrc = imgAtt.url || imgAtt.dataUrl;
                            return (
                              <div
                                key={imgAtt.id}
                                onClick={() => imgSrc && setPreviewImageUrl(imgSrc)}
                                className="group relative aspect-4/3 rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800 hover:border-indigo-500/80 cursor-pointer transition-all shadow-2xs"
                              >
                                {imgSrc ? (
                                  <img
                                    src={imgSrc}
                                    alt={imgAtt.name}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                    <ImageIcon className="w-6 h-6" />
                                  </div>
                                )}
                                
                                {/* Gradient Hover Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between">
                                  <div className="flex justify-end">
                                    <span className="p-1 bg-black/60 rounded text-zinc-200">
                                      <Eye className="w-3 h-3" />
                                    </span>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-medium text-white truncate leading-tight">
                                      {imgAtt.name}
                                    </p>
                                    <span className="text-[9px] text-zinc-400 font-mono">
                                      {imgAtt.size || 'Image'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {activeProject.attachments.length === 0 ? (
                    <div className="p-4 border border-dashed border-zinc-200 rounded-xl text-center text-xs text-zinc-400 font-mono">
                      No Google Drive links or image attachments added yet.
                    </div>
                  ) : (
                    activeProject.attachments.map((att) => {
                      const displayImgSrc = att.url || att.dataUrl;
                      return (
                        <div
                          key={att.id}
                          className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 flex items-center justify-between text-xs font-sans group hover:bg-white hover:border-zinc-300 transition-all"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            {att.type === 'drive' && (
                              <div className="w-7 h-7 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                <HardDrive className="w-4 h-4" />
                              </div>
                            )}
                            {att.type === 'image' && (
                              <div className="w-7 h-7 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 overflow-hidden">
                                {displayImgSrc ? (
                                  <img
                                    src={displayImgSrc}
                                    alt={att.name}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <ImageIcon className="w-4 h-4" />
                                )}
                              </div>
                            )}
                            {att.type === 'file' && (
                              <div className="w-7 h-7 rounded bg-zinc-200 text-zinc-700 flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4" />
                              </div>
                            )}

                            <div className="min-w-0">
                              <p className="font-semibold text-zinc-800 truncate">{att.name}</p>
                              <span className="text-[10px] font-mono text-zinc-400">
                                {att.size} • {att.uploadedAt}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            {att.type === 'image' && displayImgSrc && (
                              <button
                                onClick={() => setPreviewImageUrl(displayImgSrc)}
                                className="p-1 text-zinc-400 hover:text-indigo-600 rounded transition-colors"
                                title="Preview Image"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {att.url && (
                              <a
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-zinc-400 hover:text-emerald-600 rounded transition-colors"
                                title="Open Attachment / Link"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}

                            <button
                              onClick={() => handleDeleteAttachment(att.id)}
                              className="p-1 text-zinc-400 hover:text-rose-600 rounded transition-colors"
                              title="Remove attachment"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center text-zinc-400 font-mono text-xs">
              Select or create a project to manage code and attachments.
            </div>
          )}
        </div>
      </div>

      {/* New Folder Modal */}
      {isNewFolderOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-bold text-zinc-900 font-sans">
                Create Folder Category
              </h3>
              <button
                onClick={() => setIsNewFolderOpen(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Folder Name
                </label>
                <input
                  type="text"
                  required
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. Robot Extrinsics Calibration"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Folder Type
                </label>
                <select
                  value={newFolderType}
                  onChange={(e) => setNewFolderType(e.target.value as FolderType)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="code">Code Snippets & Algorithms</option>
                  <option value="drive">Google Drive Docs & Sheets</option>
                  <option value="media">Image Diagrams & CAD Screenshots</option>
                  <option value="docs">Specification Documents</option>
                  <option value="general">General Project Folder</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Color Tag
                </label>
                <div className="flex items-center space-x-2">
                  {['bg-blue-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-purple-500'].map(
                    (color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewFolderColor(color)}
                        className={`w-6 h-6 rounded-full ${color} ring-2 transition-all ${
                          newFolderColor === color ? 'ring-zinc-900 scale-110' : 'ring-transparent'
                        }`}
                      />
                    )
                  )}
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsNewFolderOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attach Google Drive Modal */}
      {isNewDriveAttachmentOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-zinc-900 font-sans">
                  Attach Google Drive File
                </h3>
              </div>
              <button
                onClick={() => setIsNewDriveAttachmentOpen(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDriveAttachment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Document / Sheet Title
                </label>
                <input
                  type="text"
                  required
                  value={driveName}
                  onChange={(e) => setDriveName(e.target.value)}
                  placeholder="e.g. Kinematics Calibration Sheet"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Google Drive URL
                </label>
                <input
                  type="url"
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  placeholder="https://docs.google.com/document/d/..."
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsNewDriveAttachmentOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs"
                >
                  Add Drive Attachment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImageUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-3xl w-full max-h-[85vh] bg-zinc-900 rounded-2xl p-2 overflow-hidden flex flex-col items-center">
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute top-4 right-4 p-2 bg-zinc-800 text-white rounded-full hover:bg-zinc-700 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImageUrl}
              alt="Attachment Preview"
              className="max-h-[75vh] w-auto object-contain rounded-xl"
            />
          </div>
        </div>
      )}

      {/* Supabase Database Inspector Modal */}
      {isSupabaseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 text-zinc-100 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-zinc-800 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <Database className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-sans">
                    Supabase Database Tables & Live Sync
                  </h3>
                  <p className="text-xs text-zinc-400 font-mono">
                    Verify database connection, active tables & SQL migration script
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSupabaseModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sync Summary Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                <span className="text-zinc-500 text-[10px] uppercase">Table 'projects'</span>
                <div className="text-lg font-bold text-emerald-400 mt-1">
                  {projects.length} Rows Ready
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  Stores code, titles, tags & drive attachments
                </div>
              </div>

              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                <span className="text-zinc-500 text-[10px] uppercase">Table 'folders'</span>
                <div className="text-lg font-bold text-indigo-400 mt-1">
                  {folders.length} Folders
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  Stores categories, colors & folder types
                </div>
              </div>
            </div>

            {/* SQL Table Schema Instructions */}
            <div className="p-4 bg-zinc-950/80 rounded-xl border border-zinc-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400 font-mono uppercase flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Single Migration SQL Code (`supabase_schema.sql`)</span>
                </span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                  Ready to Run in Supabase SQL Editor
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed font-sans">
                Make sure you've executed the SQL script in your Supabase dashboard's SQL Editor to enable Row Level Security (RLS) policies and automatic `auth.uid()` filtering.
              </p>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between border-t border-zinc-800 pt-4 text-xs">
              <button
                onClick={handleExplicitSaveToSupabase}
                disabled={isSavingSupabase}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all flex items-center space-x-2"
              >
                {isSavingSupabase ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Force Save All to Supabase Now</span>
              </button>

              <button
                onClick={() => setIsSupabaseModalOpen(false)}
                className="px-4 py-2 text-zinc-400 hover:text-white font-medium"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
