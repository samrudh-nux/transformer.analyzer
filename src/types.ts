export type RepresentationType =
  | 'rotation_matrix'
  | 'quaternion'
  | 'euler'
  | 'axis_angle'
  | 'exponential_map'
  | 'se3_pose';

export type IssueCategory =
  | 'composition_order'
  | 'frame_mismatch'
  | 'normalization'
  | 'convention_ambiguity'
  | 'orthonormality_drift'
  | 'active_passive_confusion'
  | 'needs_domain_verification'
  | 'other';

export type IssueSeverity = 'high' | 'medium' | 'low';

export type DiffClassification = 'fixes_issue' | 'introduces_issue' | 'neutral' | 'unclear';

export interface DiffIssueItem extends IssueDetected {
  status?: 'fixed' | 'introduced' | 'unchanged' | 'partially_fixed';
}

export interface DiffAnalysis {
  classification: DiffClassification;
  one_line_verdict: string;
  issues_fixed: DiffIssueItem[];
  issues_introduced: DiffIssueItem[];
  issues_unchanged: DiffIssueItem[];
  no_semantic_impact_changes: string[];
}

export interface InferredFrame {
  from: string | null;
  to: string | null;
  inferred: boolean;
}

export interface TransformDetected {
  variable_name: string;
  line_ref: number;
  representation: RepresentationType;
  inferred_frame: InferredFrame;
  inferred_convention: string | null;
}

export interface CompositionStep {
  step: number;
  line_ref: number;
  operation: string;
  resulting_frame: {
    from: string | null;
    to: string | null;
  };
  frame_chain_consistent: boolean;
}

export interface IssueDetected {
  severity: IssueSeverity;
  confidence: number;
  line_ref: number;
  category: IssueCategory;
  description: string;
  suggested_fix: string;
}

export interface AnalysisResult {
  summary: string;
  transforms_detected: TransformDetected[];
  composition_steps: CompositionStep[];
  issues: IssueDetected[];
  clean: boolean;
  diff_analysis?: DiffAnalysis;
  before_analysis?: AnalysisResult;
  after_analysis?: AnalysisResult;
}

export interface PresetExample {
  id: string;
  title: string;
  language: 'python' | 'cpp';
  category: string;
  description: string;
  code: string;
}

export type FolderType = 'code' | 'drive' | 'media' | 'docs' | 'general';

export interface ProjectFolder {
  id: string;
  name: string;
  folderType: FolderType;
  color: string;
  description?: string;
  createdAt: string;
}

export type AttachmentType = 'image' | 'drive' | 'file' | 'code' | 'link';

export interface ProjectAttachment {
  id: string;
  name: string;
  type: AttachmentType;
  url?: string;
  driveId?: string;
  mimeType?: string;
  size?: string;
  uploadedAt: string;
  dataUrl?: string; // for images / local file previews
  storagePath?: string; // path in Supabase Storage app-files bucket
}

export interface ProjectItem {
  id: string;
  folderId: string;
  title: string;
  language: string;
  description: string;
  code: string;
  tags: string[];
  attachments: ProjectAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id?: string;
  email?: string;
  fullName: string;
  role: string;
  organization: string;
  bio: string;
  avatarUrl: string;
  primaryConvention?: string;
  updatedAt?: string;
}

