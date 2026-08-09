import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Camera,
  Upload,
  User,
  Briefcase,
  Building,
  FileText,
  Rotate3d,
  Check,
  Save,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Image as ImageIcon,
  Link as LinkIcon,
  Video,
  VideoOff,
  AlertCircle
} from 'lucide-react';
import { UserProfile } from '../types';
// @ts-ignore - JS file import
import { supabase } from '../supabaseClient';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: UserProfile;
  userEmail: string;
  userId?: string;
  onSaveProfile: (profile: UserProfile) => void;
}

const DEFAULT_AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=256&q=80',
];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  userEmail,
  userId,
  onSaveProfile,
}) => {
  const [fullName, setFullName] = useState(currentProfile.fullName || '');
  const [role, setRole] = useState(currentProfile.role || 'Robotics & SLAM Engineer');
  const [organization, setOrganization] = useState(currentProfile.organization || 'Autonomous Systems Lab');
  const [bio, setBio] = useState(
    currentProfile.bio || 'Working on SO(3)/SE(3) rigid-body state estimation, LiDAR-Inertial odometry, and kinematics.'
  );
  const [primaryConvention, setPrimaryConvention] = useState(
    currentProfile.primaryConvention || 'Hamilton Quaternion (w, x, y, z)'
  );
  const [avatarUrl, setAvatarUrl] = useState(currentProfile.avatarUrl || '');

  const [activePicTab, setActivePicTab] = useState<'camera' | 'upload' | 'url'>('camera');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    fullName?: string;
    role?: string;
    organization?: string;
    form?: string;
  }>({});

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync state when currentProfile changes
  useEffect(() => {
    if (isOpen) {
      setFullName(currentProfile.fullName || userEmail.split('@')[0] || 'Robotics Engineer');
      setRole(currentProfile.role || 'Robotics & SLAM Engineer');
      setOrganization(currentProfile.organization || 'Autonomous Systems Lab');
      setBio(
        currentProfile.bio ||
          'Working on SO(3)/SE(3) rigid-body state estimation, LiDAR-Inertial odometry, and kinematics.'
      );
      setPrimaryConvention(currentProfile.primaryConvention || 'Hamilton Quaternion (w, x, y, z)');
      setAvatarUrl(currentProfile.avatarUrl || '');
      setCapturedPreview(null);
      setSaveSuccess(false);
      setValidationErrors({});
    }
  }, [isOpen, currentProfile, userEmail]);

  // Clean up camera on unmount or modal close
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
  }, [isOpen]);

  // Ensure stream is connected to video element whenever camera becomes active or video mounts
  useEffect(() => {
    if (isCameraActive && videoRef.current && mediaStreamRef.current) {
      const video = videoRef.current;
      if (video.srcObject !== mediaStreamRef.current) {
        video.srcObject = mediaStreamRef.current;
      }
      video.play().catch((err) => {
        console.warn('Video play error on mount:', err);
      });
    }
  }, [isCameraActive]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (mediaStreamRef.current) {
        stopCamera();
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 640 },
          facingMode: 'user',
        },
        audio: false,
      });
      mediaStreamRef.current = stream;
      setIsCameraActive(true);

      // Connect stream if video element is already available in DOM
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Video element play error:', playErr);
        }
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError(
        err?.message || 'Could not access webcam. Please check browser permissions or generate a digital snapshot.'
      );
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) {
      setCameraError('Camera stream element is not ready. Please try again.');
      return;
    }
    try {
      const video = videoRef.current;

      // Ensure video track is actually delivering frames
      const vw = video.videoWidth || 0;
      const vh = video.videoHeight || 0;

      if (vw === 0 || vh === 0) {
        setCameraError('Waiting for live video feed to stabilize. Please try capturing again in a second.');
        return;
      }

      const canvas = document.createElement('canvas');
      const size = Math.min(vw, vh);
      canvas.width = 400;
      canvas.height = 400;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Center crop image to 1:1 square
        const sx = (vw - size) / 2;
        const sy = (vh - size) / 2;

        // Mirror snapshot to match CSS mirrored live feed
        ctx.translate(400, 0);
        ctx.scale(-1, 1);

        ctx.drawImage(video, sx, sy, size, size, 0, 0, 400, 400);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        if (dataUrl && dataUrl.length > 200) {
          setCapturedPreview(dataUrl);
          setAvatarUrl(dataUrl);
          setCameraError(null);
          stopCamera();
        } else {
          setCameraError('Captured image was blank. Please ensure camera permission is enabled.');
        }
      }
    } catch (e: any) {
      console.error('Capture error:', e);
      setCameraError(`Snapshot error: ${e?.message || 'Failed to capture frame'}`);
    }
  };

  const generateCanvasAvatar = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, 400, 400);
        grad.addColorStop(0, '#4f46e5');
        grad.addColorStop(0.5, '#2563eb');
        grad.addColorStop(1, '#0284c7');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 400, 400);

        // Tech grid lines overlay
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i <= 400; i += 40) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, 400);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, i);
          ctx.lineTo(400, i);
          ctx.stroke();
        }

        // Circular badge ring
        ctx.beginPath();
        ctx.arc(200, 200, 120, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Monogram
        const letter = (fullName || userEmail || 'E').charAt(0).toUpperCase();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 150px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(letter, 200, 200);

        const dataUrl = canvas.toDataURL('image/png');
        setCapturedPreview(dataUrl);
        setAvatarUrl(dataUrl);
        setCameraError(null);
        stopCamera();
      }
    } catch (err: any) {
      console.error('Canvas avatar error:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          setAvatarUrl(dataUrl);
          setCapturedPreview(dataUrl);
        }
      };
      reader.readAsDataURL(file);

      // Optionally upload to Supabase Storage
      if (userId) {
        const fileExt = file.name.split('.').pop() || 'png';
        const filePath = `avatars/${userId}_${Date.now()}.${fileExt}`;
        const { error: uploadErr } = await supabase.storage.from('app-files').upload(filePath, file, {
          upsert: true,
        });
        if (!uploadErr) {
          const { data: publicUrlData } = supabase.storage.from('app-files').getPublicUrl(filePath);
          if (publicUrlData?.publicUrl) {
            setAvatarUrl(publicUrlData.publicUrl);
          }
        }
      }
    } catch (err) {
      console.warn('File read error:', err);
    }
  };

  const handleApplyUrl = () => {
    if (imageUrlInput.trim()) {
      setAvatarUrl(imageUrlInput.trim());
      setCapturedPreview(imageUrlInput.trim());
      setImageUrlInput('');
    }
  };

  const uploadAvatarIfNeeded = async (url: string, uid: string): Promise<string> => {
    if (!url || !url.startsWith('data:image/')) return url;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const mime = blob.type || 'image/jpeg';
      const ext = mime.split('/')[1] || 'jpeg';
      const filePath = `avatars/${uid || 'user'}_${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('app-files')
        .upload(filePath, blob, {
          contentType: mime,
          upsert: true,
        });

      if (!uploadErr) {
        const { data: publicUrlData } = supabase.storage
          .from('app-files')
          .getPublicUrl(filePath);
        if (publicUrlData?.publicUrl) {
          return publicUrlData.publicUrl;
        }
      }
    } catch (err) {
      console.warn('Avatar storage upload notice:', err);
    }
    return url;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);

    // Validate required fields
    const errors: { fullName?: string; role?: string; organization?: string; form?: string } = {};
    if (!fullName.trim()) {
      errors.fullName = 'Full Name is required.';
    }
    if (!role.trim()) {
      errors.role = 'Role / Designation is required.';
    }
    if (!organization.trim()) {
      errors.organization = 'Organization / Lab is required.';
    }

    if (Object.keys(errors).length > 0) {
      errors.form = 'Please complete all required fields before saving.';
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    setIsSaving(true);

    let finalAvatarUrl = avatarUrl || DEFAULT_AVATAR_PRESETS[0];
    if (finalAvatarUrl.startsWith('data:image/') && userId) {
      finalAvatarUrl = await uploadAvatarIfNeeded(finalAvatarUrl, userId);
    }

    const updatedProfile: UserProfile = {
      id: userId,
      email: userEmail,
      fullName: fullName.trim() || userEmail.split('@')[0],
      role: role.trim() || 'Robotics Engineer',
      organization: organization.trim() || 'Autonomous Systems Lab',
      bio: bio.trim(),
      avatarUrl: finalAvatarUrl,
      primaryConvention,
      updatedAt: new Date().toISOString(),
    };

    try {
      // 1. Update Supabase Auth user metadata
      await supabase.auth.updateUser({
        data: {
          full_name: updatedProfile.fullName,
          role: updatedProfile.role,
          organization: updatedProfile.organization,
          bio: updatedProfile.bio,
          avatar_url: updatedProfile.avatarUrl,
          primary_convention: updatedProfile.primaryConvention,
        },
      });

      // 2. Upsert into Supabase 'user_profiles' table if it exists
      try {
        await supabase.from('user_profiles').upsert(
          {
            id: userId,
            email: userEmail,
            full_name: updatedProfile.fullName,
            role: updatedProfile.role,
            organization: updatedProfile.organization,
            bio: updatedProfile.bio,
            avatar_url: updatedProfile.avatarUrl,
            primary_convention: updatedProfile.primaryConvention,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      } catch (dbErr) {
        console.warn('user_profiles table note:', dbErr);
      }

      // 3. Save to LocalStorage for instant offline synchronization
      if (userId) {
        localStorage.setItem(`user_profile_${userId}`, JSON.stringify(updatedProfile));
      }
      localStorage.setItem('user_profile_latest', JSON.stringify(updatedProfile));

      // 4. Notify parent
      onSaveProfile(updatedProfile);
      setSaveSuccess(true);

      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Save profile error:', err);
    } finally {
      setIsSaving(false);
      stopCamera();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col transition-all">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 tracking-tight font-sans">
                Engineer Profile & Identity
              </h2>
              <p className="text-xs text-zinc-500 font-mono">{userEmail}</p>
            </div>
          </div>

          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <form onSubmit={handleSave} className="p-6 space-y-6">
          {/* Avatar & Photo Section */}
          <div className="bg-zinc-50/80 rounded-xl p-5 border border-zinc-200/80 space-y-4">
            <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-5">
              {/* Profile Avatar Preview Ring */}
              <div className="relative group shrink-0">
                <div className="w-24 h-24 rounded-2xl overflow-hidden ring-4 ring-white shadow-md bg-zinc-900 flex items-center justify-center text-white relative">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-zinc-400 space-y-1">
                      <User className="w-8 h-8" />
                      <span className="text-[10px] font-mono">NO PHOTO</span>
                    </div>
                  )}
                </div>

                <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white shadow-xs">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </span>
              </div>

              {/* Photo Options Controls */}
              <div className="flex-1 space-y-2.5 w-full">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-800 font-sans flex items-center space-x-1.5">
                    <Camera className="w-4 h-4 text-indigo-600" />
                    <span>Profile Photo & Face Snapshot</span>
                  </span>

                  <span className="text-[11px] font-mono text-zinc-400">
                    Saved to Supabase Storage
                  </span>
                </div>

                {/* Sub-tabs for Photo Source */}
                <div className="flex items-center space-x-1 bg-zinc-200/60 p-1 rounded-lg text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => {
                      setActivePicTab('camera');
                      if (!isCameraActive && !capturedPreview) startCamera();
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-md transition-all flex items-center justify-center space-x-1.5 ${
                      activePicTab === 'camera'
                        ? 'bg-white text-zinc-900 font-semibold shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Webcam</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setActivePicTab('upload');
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-md transition-all flex items-center justify-center space-x-1.5 ${
                      activePicTab === 'upload'
                        ? 'bg-white text-zinc-900 font-semibold shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Upload File</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setActivePicTab('url');
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-md transition-all flex items-center justify-center space-x-1.5 ${
                      activePicTab === 'url'
                        ? 'bg-white text-zinc-900 font-semibold shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    <LinkIcon className="w-3.5 h-3.5 text-indigo-600" />
                    <span>URL / Presets</span>
                  </button>
                </div>

                {/* Camera View Area */}
                {activePicTab === 'camera' && (
                  <div className="space-y-3 pt-1">
                    {isCameraActive ? (
                      <div className="relative rounded-xl overflow-hidden bg-zinc-950 aspect-square max-w-[240px] mx-auto border border-zinc-800 shadow-md">
                        <video
                          ref={(el) => {
                            videoRef.current = el;
                            if (el && mediaStreamRef.current && el.srcObject !== mediaStreamRef.current) {
                              el.srcObject = mediaStreamRef.current;
                              el.play().catch((err) => console.warn('Video element play error:', err));
                            }
                          }}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover scale-x-[-1]"
                        />
                        <div className="absolute inset-0 border-2 border-indigo-400/40 rounded-xl pointer-events-none flex items-center justify-center">
                          <div className="w-32 h-32 border border-white/50 rounded-full border-dashed" />
                        </div>
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-zinc-900/80 backdrop-blur-xs text-[10px] font-mono text-emerald-400 flex items-center space-x-1.5 border border-zinc-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>LIVE CAMERA</span>
                        </div>
                        <div className="absolute bottom-2 left-2 right-2 flex justify-center">
                          <button
                            type="button"
                            onClick={capturePhoto}
                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-semibold text-xs rounded-lg shadow-lg flex items-center space-x-1.5 transition-transform active:scale-95"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Capture Snapshot</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={startCamera}
                          className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-mono font-medium rounded-lg flex items-center space-x-1.5 transition-all active:scale-95 shadow-xs"
                        >
                          <Video className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Start Live Camera</span>
                        </button>

                        <button
                          type="button"
                          onClick={generateCanvasAvatar}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-mono font-medium rounded-lg border border-indigo-200/80 flex items-center space-x-1.5 transition-all active:scale-95"
                          title="Generate a custom tech avatar snapshot instantly using canvas"
                        >
                          <User className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Generate Digital Badge Photo</span>
                        </button>
                      </div>
                    )}

                    {cameraError && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-sans flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{cameraError}</p>
                          <p className="text-[11px] text-rose-600 mt-0.5">
                            You can also use "Generate Digital Badge Photo" above or "Upload File".
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Upload File Area */}
                {activePicTab === 'upload' && (
                  <div className="space-y-2 pt-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-3 px-4 border-2 border-dashed border-zinc-300 hover:border-indigo-500 rounded-xl bg-white text-zinc-600 hover:text-indigo-600 text-xs font-mono font-medium flex items-center justify-center space-x-2 transition-colors"
                    >
                      <Upload className="w-4 h-4 text-indigo-500" />
                      <span>Choose Image from Device / Drive</span>
                    </button>
                  </div>
                )}

                {/* URL or Presets Area */}
                {activePicTab === 'url' && (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center space-x-2">
                      <input
                        type="url"
                        value={imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                        placeholder="https://example.com/my-photo.jpg"
                        className="flex-1 px-3 py-1.5 text-xs font-mono bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={handleApplyUrl}
                        className="px-3 py-1.5 bg-zinc-900 text-white text-xs font-mono font-medium rounded-lg hover:bg-zinc-800"
                      >
                        Apply
                      </button>
                    </div>

                    <div>
                      <span className="text-[11px] text-zinc-500 font-mono block mb-1.5">
                        Or pick a default avatar preset:
                      </span>
                      <div className="flex items-center space-x-2">
                        {DEFAULT_AVATAR_PRESETS.map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setAvatarUrl(preset);
                              setCapturedPreview(preset);
                            }}
                            className={`w-9 h-9 rounded-full overflow-hidden ring-2 transition-all ${
                              avatarUrl === preset
                                ? 'ring-indigo-600 ring-offset-2 scale-105'
                                : 'ring-transparent hover:ring-zinc-300'
                            }`}
                          >
                            <img src={preset} alt="preset" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Basic Details Form Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1 font-sans flex items-center space-x-1">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <span>Full Name <span className="text-rose-500">*</span></span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (validationErrors.fullName) {
                    setValidationErrors((prev) => ({ ...prev, fullName: undefined, form: undefined }));
                  }
                }}
                placeholder="Dr. Elena Rostova"
                className={`w-full px-3 py-2 text-xs font-sans bg-zinc-50 border ${
                  validationErrors.fullName ? 'border-rose-500 ring-1 ring-rose-500/50 bg-rose-50/20' : 'border-zinc-200 focus:ring-indigo-600'
                } rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:bg-white transition-all`}
              />
              {validationErrors.fullName && (
                <p className="text-[11px] text-rose-600 font-sans mt-1 flex items-center space-x-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{validationErrors.fullName}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1 font-sans flex items-center space-x-1">
                <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                <span>Role / Designation <span className="text-rose-500">*</span></span>
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  if (validationErrors.role) {
                    setValidationErrors((prev) => ({ ...prev, role: undefined, form: undefined }));
                  }
                }}
                placeholder="Senior Robotics & SLAM Specialist"
                className={`w-full px-3 py-2 text-xs font-sans bg-zinc-50 border ${
                  validationErrors.role ? 'border-rose-500 ring-1 ring-rose-500/50 bg-rose-50/20' : 'border-zinc-200 focus:ring-indigo-600'
                } rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:bg-white transition-all`}
              />
              {validationErrors.role && (
                <p className="text-[11px] text-rose-600 font-sans mt-1 flex items-center space-x-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{validationErrors.role}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1 font-sans flex items-center space-x-1">
                <Building className="w-3.5 h-3.5 text-indigo-600" />
                <span>Organization / Lab <span className="text-rose-500">*</span></span>
              </label>
              <input
                type="text"
                value={organization}
                onChange={(e) => {
                  setOrganization(e.target.value);
                  if (validationErrors.organization) {
                    setValidationErrors((prev) => ({ ...prev, organization: undefined, form: undefined }));
                  }
                }}
                placeholder="Boston Dynamics / MIT CSAIL"
                className={`w-full px-3 py-2 text-xs font-sans bg-zinc-50 border ${
                  validationErrors.organization ? 'border-rose-500 ring-1 ring-rose-500/50 bg-rose-50/20' : 'border-zinc-200 focus:ring-indigo-600'
                } rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:bg-white transition-all`}
              />
              {validationErrors.organization && (
                <p className="text-[11px] text-rose-600 font-sans mt-1 flex items-center space-x-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{validationErrors.organization}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1 font-sans flex items-center space-x-1">
                <Rotate3d className="w-3.5 h-3.5 text-indigo-600" />
                <span>Primary Convention</span>
              </label>
              <select
                value={primaryConvention}
                onChange={(e) => setPrimaryConvention(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all"
              >
                <option value="Hamilton Quaternion (w, x, y, z)">Hamilton Quaternion (w, x, y, z)</option>
                <option value="JPL Quaternion (x, y, z, w)">JPL Quaternion (x, y, z, w)</option>
                <option value="Euler ZYX (Yaw-Pitch-Roll)">Euler ZYX (Yaw-Pitch-Roll)</option>
                <option value="SO(3) Rotation Matrix 3x3">SO(3) Rotation Matrix 3x3</option>
                <option value="SE(3) Transformation 4x4">SE(3) Transformation 4x4</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1 font-sans flex items-center space-x-1">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>Bio & Research Focus</span>
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Short description of coordinate frame conventions used in your codebase..."
              className="w-full px-3 py-2 text-xs font-sans bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all resize-none"
            />
          </div>

          {/* Validation Alert Banner */}
          {validationErrors.form && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-sans flex items-center space-x-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationErrors.form}</span>
            </div>
          )}

          {/* Success Banner */}
          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-sans flex items-center space-x-2 animate-fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Profile updated successfully and synced across Supabase!</span>
            </div>
          )}

          {/* Modal Footer Controls */}
          <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              <span>Persists across all project sessions</span>
            </span>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-sm transition-all flex items-center space-x-1.5 active:scale-95"
              >
                {isSaving ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Profile</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
