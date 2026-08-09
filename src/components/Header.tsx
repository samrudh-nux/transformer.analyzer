import React from 'react';
import { Rotate3d, Code2, Layout, FileJson, FolderGit2, CheckCircle2, Lock, LogOut, UserCheck, FileDown, User, Camera, BookOpen } from 'lucide-react';
import { UserProfile } from '../types';

export type AppMode = 'reviewer' | 'project_vault' | 'design_spec';

interface HeaderProps {
  activeMode: AppMode;
  setActiveMode: (mode: AppMode) => void;
  showRawJson: boolean;
  setShowRawJson: (show: boolean) => void;
  isClean: boolean | null;
  issueCount: number;
  isAnalyzing: boolean;
  userEmail?: string | null;
  isAuthenticated: boolean;
  onSignOut: () => void;
  onExportPDF?: () => void;
  userProfile?: UserProfile | null;
  onOpenProfileModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeMode,
  setActiveMode,
  showRawJson,
  setShowRawJson,
  isClean,
  issueCount,
  isAnalyzing,
  userEmail,
  isAuthenticated,
  onSignOut,
  onExportPDF,
  userProfile,
  onOpenProfileModal,
}) => {

  const handleTabClick = (mode: AppMode) => {
    if (!isAuthenticated && mode !== 'design_spec') {
      setActiveMode('design_spec');
      return;
    }
    if (isAuthenticated && mode === 'design_spec') {
      setActiveMode('reviewer');
      return;
    }
    setActiveMode(mode);
  };

  return (
    <header className="border-b border-zinc-200 bg-zinc-50/90 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Title & Icon */}
        <div 
          onClick={() => setActiveMode(isAuthenticated ? 'reviewer' : 'design_spec')}
          className="flex items-center space-x-2.5 cursor-pointer select-none group"
        >
          <Rotate3d className="w-7 h-7 text-indigo-600 group-hover:text-indigo-500 group-hover:rotate-12 group-hover:scale-110 transition-all duration-300 drop-shadow-xs" />
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-zinc-900 tracking-tight font-sans group-hover:text-indigo-600 transition-colors">
                TRANS-A.AI
              </h1>
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-zinc-200/80 text-zinc-700 border border-zinc-300/50">
                SO(3) / SE(3)
              </span>
            </div>
            <p className="text-xs text-zinc-500 font-sans">
              Rigid-body rotation & coordinate frame reviewer
            </p>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center bg-zinc-200/70 p-1 rounded-lg border border-zinc-300/60 text-xs font-medium">
          {!isAuthenticated && (
            <button
              onClick={() => handleTabClick('design_spec')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all ${
                activeMode === 'design_spec'
                  ? 'bg-white text-zinc-900 shadow-sm font-semibold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Layout className="w-3.5 h-3.5 text-indigo-600" />
              <span>Landing & Auth</span>
            </button>
          )}

          <button
            onClick={() => handleTabClick('reviewer')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all relative ${
              activeMode === 'reviewer'
                ? 'bg-white text-zinc-900 shadow-sm font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            } ${!isAuthenticated ? 'opacity-70' : ''}`}
            title={!isAuthenticated ? 'Sign in required to access Code Reviewer' : ''}
          >
            <Code2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>Code Reviewer</span>
            {!isAuthenticated && (
              <Lock className="w-3 h-3 text-amber-600 ml-0.5" />
            )}
            {isAuthenticated && isClean === false && issueCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                {issueCount}
              </span>
            )}
            {isAuthenticated && isClean === true && (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 ml-1" />
            )}
          </button>

          <button
            onClick={() => handleTabClick('project_vault')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all relative ${
              activeMode === 'project_vault'
                ? 'bg-white text-zinc-900 shadow-sm font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            } ${!isAuthenticated ? 'opacity-70' : ''}`}
            title={!isAuthenticated ? 'Sign in required to access Projects & Drive Vault' : ''}
          >
            <FolderGit2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>Projects & Drive Vault</span>
            {!isAuthenticated && (
              <Lock className="w-3 h-3 text-amber-600 ml-0.5" />
            )}
          </button>
        </div>

        {/* Right Tools & User Authentication Controls */}
        <div className="flex items-center space-x-2.5">
          {isAuthenticated && activeMode === 'reviewer' && onExportPDF && (
            <button
              onClick={onExportPDF}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-mono font-semibold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-all active:scale-[0.98]"
              title="Export complete analysis report as PDF"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Export PDF Report</span>
            </button>
          )}

          {isAuthenticated && activeMode === 'reviewer' && (
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md border transition-all ${
                showRawJson
                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                  : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100'
              }`}
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>{showRawJson ? 'Hide JSON' : 'Raw JSON'}</span>
            </button>
          )}

          {isAuthenticated ? (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onOpenProfileModal}
                className="flex items-center space-x-2 px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-200 shadow-2xs transition-all text-left active:scale-[0.98] group"
                title="Click to view and edit Engineer Profile & Photo"
              >
                <div className="relative shrink-0">
                  {userProfile?.avatarUrl ? (
                    <img
                      src={userProfile.avatarUrl}
                      alt="Profile Avatar"
                      className="w-7 h-7 rounded-full object-cover ring-2 ring-indigo-500/30"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-mono text-xs font-bold flex items-center justify-center">
                      {(userProfile?.fullName || userEmail || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-zinc-900 border border-white text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Camera className="w-2 h-2" />
                  </span>
                </div>

                <div className="hidden sm:flex flex-col text-left pr-1">
                  <span className="text-xs font-semibold text-zinc-900 max-w-[130px] truncate leading-none">
                    {userProfile?.fullName || userEmail?.split('@')[0] || 'User'}
                  </span>
                  <span className="text-[10px] font-mono text-indigo-600 max-w-[130px] truncate leading-tight mt-0.5">
                    {userProfile?.role || 'Robotics Engineer'}
                  </span>
                </div>
              </button>

              <button
                onClick={onSignOut}
                className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-all active:scale-[0.98]"
                title="Sign out of account"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden md:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setActiveMode('design_spec')}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-2xs transition-all"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Sign In / Sign Up</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};


