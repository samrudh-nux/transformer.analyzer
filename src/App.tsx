import React, { useState, useEffect, useCallback } from 'react';
import { Header, AppMode } from './components/Header';
import { CodeEditor } from './components/CodeEditor';
import { DiffCodeEditor } from './components/DiffCodeEditor';
import { Gizmo3D } from './components/Gizmo3D';
import { FrameGraph } from './components/FrameGraph';
import { TransformsTable } from './components/TransformsTable';
import { IssuesList } from './components/IssuesList';
import { DiffResultsView } from './components/DiffResultsView';
import { JsonViewer } from './components/JsonViewer';
import { DesignSpecView } from './components/DesignSpecView';
import { ProjectVault } from './components/ProjectVault';
import { UserProfileModal } from './components/UserProfileModal';
import { BlogArticleModal } from './components/BlogArticleModal';
import { PRESET_EXAMPLES } from './data/presets';
import { DIFF_PRESET_PAIRS, DiffPresetPair } from './data/diffPresets';
import { AnalysisResult, PresetExample, UserProfile } from './types';
import { runLocalAnalysis } from './utils/localAnalyzer';
import { exportAnalysisReportPDF } from './utils/pdfGenerator';
import { Cpu, Code, GitCompare, FileDown } from 'lucide-react';
// @ts-ignore - JS file import
import { supabase } from './supabaseClient';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [activeMode, setActiveMode] = useState<AppMode>('reviewer');

  // User Profile state & modals
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isArticleModalOpen, setIsArticleModalOpen] = useState<boolean>(false);

  // Sync / fetch persistent User Profile from Supabase & localStorage
  const fetchAndSyncUserProfile = useCallback(async (currentUser: any) => {
    if (!currentUser) {
      setUserProfile(null);
      return;
    }

    const userId = currentUser.id;
    const email = currentUser.email || '';
    const meta = currentUser.user_metadata || {};

    // 1. Check local storage cache for instant sync
    let cached: UserProfile | null = null;
    try {
      const raw = localStorage.getItem(`user_profile_${userId}`) || localStorage.getItem('user_profile_latest');
      if (raw) cached = JSON.parse(raw);
    } catch (e) {
      // ignore JSON parse errors
    }

    let initialProfile: UserProfile = {
      id: userId,
      email: email,
      fullName: meta.full_name || cached?.fullName || email.split('@')[0] || 'Robotics Engineer',
      role: meta.role || cached?.role || 'Robotics & SLAM Engineer',
      organization: meta.organization || cached?.organization || 'Autonomous Systems Lab',
      bio: meta.bio || cached?.bio || 'Working on SO(3)/SE(3) rigid-body state estimation and robotics.',
      avatarUrl: meta.avatar_url || cached?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
      primaryConvention: meta.primary_convention || cached?.primaryConvention || 'Hamilton Quaternion (w, x, y, z)',
    };

    setUserProfile(initialProfile);

    // 2. Fetch from Supabase user_profiles table
    try {
      const { data: dbData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (dbData) {
        const syncedProfile: UserProfile = {
          id: userId,
          email: email,
          fullName: dbData.full_name || initialProfile.fullName,
          role: dbData.role || initialProfile.role,
          organization: dbData.organization || initialProfile.organization,
          bio: dbData.bio || initialProfile.bio,
          avatarUrl: dbData.avatar_url || initialProfile.avatarUrl,
          primaryConvention: dbData.primary_convention || initialProfile.primaryConvention,
        };
        setUserProfile(syncedProfile);
        localStorage.setItem(`user_profile_${userId}`, JSON.stringify(syncedProfile));
        localStorage.setItem('user_profile_latest', JSON.stringify(syncedProfile));
      }
    } catch (err) {
      console.warn('Supabase user_profiles lookup note:', err);
    }
  }, []);

  // Analyzer View Mode: Single Snippet vs Compare Before/After (Diff Mode)
  const [analyzerMode, setAnalyzerMode] = useState<'single' | 'diff'>('single');

  // Single mode state
  const [code, setCode] = useState<string>(PRESET_EXAMPLES[0].code);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESET_EXAMPLES[0].id);

  // Diff mode state
  const [beforeCode, setBeforeCode] = useState<string>(DIFF_PRESET_PAIRS[0].beforeCode);
  const [afterCode, setAfterCode] = useState<string>(DIFF_PRESET_PAIRS[0].afterCode);
  const [diffSelectedPresetId, setDiffSelectedPresetId] = useState<string>(DIFF_PRESET_PAIRS[0].id);
  const [diffActiveChainTab, setDiffActiveChainTab] = useState<'before' | 'after'>('after');

  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize and listen for Supabase authentication state & profile sync
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }: any) => {
        setSession(session);
        if (session?.user) {
          setActiveMode('reviewer');
          fetchAndSyncUserProfile(session.user);
        } else {
          setActiveMode('design_spec');
          setUserProfile(null);
        }
        setAuthLoading(false);
      })
      .catch(() => {
        setAuthLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, currentSession: any) => {
      setSession(currentSession);
      if (currentSession?.user) {
        setActiveMode('reviewer');
        fetchAndSyncUserProfile(currentSession.user);
      } else {
        setActiveMode('design_spec');
        setUserProfile(null);
      }
      setAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchAndSyncUserProfile]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setActiveMode('design_spec');
  };

  // Load code from Project Vault directly into Code Reviewer
  const handleLoadCodeToReviewer = (codeToLoad: string) => {
    setCode(codeToLoad);
    setSelectedPresetId('custom');
    setAnalyzerMode('single');
    setActiveMode('reviewer');
    handleAnalyze(codeToLoad, 'single');
  };

  // Trigger analysis call to backend /api/analyze
  const handleAnalyze = useCallback(
    async (codeToAnalyze?: string, modeOverride?: 'single' | 'diff') => {
      const mode = modeOverride || analyzerMode;
      let targetCode = '';

      if (mode === 'diff') {
        const b = codeToAnalyze !== undefined ? codeToAnalyze : beforeCode;
        targetCode = `BEFORE:\n${b}\n\nAFTER:\n${afterCode}`;
      } else {
        targetCode = codeToAnalyze !== undefined ? codeToAnalyze : code;
      }

      if (!targetCode.trim()) return;

      setIsAnalyzing(true);
      setErrorMessage(null);

      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code: targetCode }),
        });

        if (!response.ok) {
          throw new Error(`Server returned HTTP ${response.status}`);
        }

        const data: AnalysisResult = await response.json();
        setAnalysisResult(data);
      } catch (err: any) {
        console.warn('Analysis request endpoint fallback:', err);
        const fallbackResult = runLocalAnalysis(targetCode);
        setAnalysisResult({
          ...fallbackResult,
          source: 'local_analyzer',
          notice: 'Client-side static analysis active.',
        });
      } finally {
        setIsAnalyzing(false);
      }
    },
    [analyzerMode, beforeCode, afterCode, code]
  );

  // Run initial analysis on load
  useEffect(() => {
    handleAnalyze(code, 'single');
  }, []);

  // Keyboard shortcut Cmd+Enter / Ctrl+Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleAnalyze();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAnalyze]);

  // Export complete analysis report as PDF
  const handleExportPDF = async () => {
    if (!analysisResult) return;
    await exportAnalysisReportPDF({
      analysisResult,
      analyzerMode,
      code,
      beforeCode,
      afterCode,
      analysisId: (analysisResult as any).id || undefined,
    });
  };

  // Switch analyzer mode (Single vs Diff)
  const handleSwitchAnalyzerMode = (mode: 'single' | 'diff') => {
    if (mode === 'diff') {
      const targetCode = `BEFORE:\n${beforeCode}\n\nAFTER:\n${afterCode}`;
      handleAnalyze(targetCode, 'diff');
    } else {
      handleAnalyze(code, 'single');
    }
  };

  // Handle Preset Select (Single)
  const handleSelectPreset = (preset: PresetExample) => {
    setSelectedPresetId(preset.id);
    setCode(preset.code);
    handleAnalyze(preset.code, 'single');
  };

  // Handle Preset Select (Diff)
  const handleSelectDiffPreset = (preset: DiffPresetPair) => {
    setDiffSelectedPresetId(preset.id);
    setBeforeCode(preset.beforeCode);
    setAfterCode(preset.afterCode);
    const targetCode = `BEFORE:\n${preset.beforeCode}\n\nAFTER:\n${preset.afterCode}`;
    handleAnalyze(targetCode, 'diff');
  };

  // Handle Apply Fix
  const handleApplyFix = (suggestedFix: string, lineRef: number) => {
    const lines = code.split('\n');
    if (lineRef > 0 && lineRef <= lines.length) {
      lines[lineRef - 1] = suggestedFix;
      const newCode = lines.join('\n');
      setCode(newCode);
      handleAnalyze(newCode, 'single');
    }
  };

  // Compute active analysis for 3D Gizmo viewer
  const activeGizmoAnalysis =
    analyzerMode === 'diff'
      ? diffActiveChainTab === 'before'
        ? analysisResult?.before_analysis || analysisResult
        : analysisResult?.after_analysis || analysisResult
      : analysisResult;

  const activeGizmoCode =
    analyzerMode === 'diff'
      ? diffActiveChainTab === 'before'
        ? beforeCode
        : afterCode
      : code;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center font-mono text-xs">
        <div className="flex items-center space-x-3 bg-slate-800 px-6 py-4 rounded-xl border border-slate-700 shadow-2xl animate-fade-in">
          <Cpu className="w-5 h-5 text-indigo-400 animate-spin" />
          <span className="text-slate-200 font-semibold tracking-wide">Initializing Workspace Session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 font-sans flex flex-col selection:bg-indigo-600 selection:text-white">
      {/* Header */}
      <Header
        activeMode={activeMode}
        setActiveMode={setActiveMode}
        showRawJson={showRawJson}
        setShowRawJson={setShowRawJson}
        isClean={analysisResult?.clean ?? null}
        issueCount={analysisResult?.issues?.length || 0}
        isAnalyzing={isAnalyzing}
        userEmail={session?.user?.email || null}
        isAuthenticated={!!session}
        onSignOut={handleSignOut}
        onExportPDF={analysisResult ? handleExportPDF : undefined}
        userProfile={userProfile}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1">
        {!session ? (
          <DesignSpecView
            onEnterWorkspace={() => setActiveMode('reviewer')}
            userEmail={session?.user?.email || undefined}
            isAuthenticated={!!session}
            onSignOut={handleSignOut}
            onOpenArticleModal={() => setIsArticleModalOpen(true)}
          />
        ) : activeMode === 'project_vault' ? (
          <ProjectVault
            onLoadCodeToReviewer={handleLoadCodeToReviewer}
            userProfile={userProfile}
            onOpenProfileModal={() => setIsProfileModalOpen(true)}
          />
        ) : (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            {/* Analyzer Mode Selector Bar (Single Snippet vs Compare Before/After) */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-zinc-200 shadow-2xs">
              <div className="flex items-center space-x-1 bg-zinc-100 p-1 rounded-lg border border-zinc-200">
                <button
                  onClick={() => handleSwitchAnalyzerMode('single')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-medium font-mono transition-all flex items-center space-x-1.5 ${
                    analyzerMode === 'single'
                      ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <Code className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Single Snippet</span>
                </button>

                <button
                  onClick={() => handleSwitchAnalyzerMode('diff')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-medium font-mono transition-all flex items-center space-x-1.5 ${
                    analyzerMode === 'diff'
                      ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <GitCompare className="w-3.5 h-3.5 text-indigo-200" />
                  <span>Compare Before/After (Diff Mode)</span>
                </button>
              </div>

              <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline">
                {analyzerMode === 'single'
                  ? 'Analyzing single SO(3)/SE(3) code block'
                  : 'Comparing pull request / commit diff for introduced & fixed issues'}
              </span>
            </div>

            {/* Top Workspace Grid: Code Editor (Left) & 3D Gizmo / Status Summary (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Code Editor Panel (7 columns) */}
              <div className="lg:col-span-7 flex flex-col min-h-[420px]">
                {analyzerMode === 'single' ? (
                  <CodeEditor
                    code={code}
                    setCode={setCode}
                    onAnalyze={() => handleAnalyze(code, 'single')}
                    isAnalyzing={isAnalyzing}
                    selectedPresetId={selectedPresetId}
                    onSelectPreset={handleSelectPreset}
                  />
                ) : (
                  <DiffCodeEditor
                    beforeCode={beforeCode}
                    setBeforeCode={setBeforeCode}
                    afterCode={afterCode}
                    setAfterCode={setAfterCode}
                    onAnalyzeDiff={() => handleAnalyze(undefined, 'diff')}
                    isAnalyzing={isAnalyzing}
                    selectedPresetId={diffSelectedPresetId}
                    onSelectPresetPair={handleSelectDiffPreset}
                  />
                )}
              </div>

              {/* 3D Gizmo & Quick Summary Status Panel (5 columns) */}
              <div className="lg:col-span-5 flex flex-col space-y-4">
                {/* 3D Gizmo View */}
                <div className="flex flex-col overflow-hidden">
                  {/* Diff Mode 3D Chain Toggle */}
                  {analyzerMode === 'diff' && (
                    <div className="flex items-center justify-between bg-zinc-100 px-3 py-1.5 rounded-t-xl border border-zinc-200 text-xs font-mono border-b-0 shrink-0">
                      <span className="text-[10px] text-zinc-500 font-semibold uppercase">
                        3D Frame Chain Scene:
                      </span>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => setDiffActiveChainTab('before')}
                          className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all ${
                            diffActiveChainTab === 'before'
                              ? 'bg-rose-600 text-white shadow-2xs'
                              : 'bg-white text-zinc-700 hover:bg-zinc-200 border border-zinc-300'
                          }`}
                        >
                          Before Chain
                        </button>
                        <button
                          onClick={() => setDiffActiveChainTab('after')}
                          className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all ${
                            diffActiveChainTab === 'after'
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-white text-zinc-700 hover:bg-zinc-200 border border-zinc-300'
                          }`}
                        >
                          After Chain
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex-1">
                    <Gizmo3D
                      transforms={activeGizmoAnalysis?.transforms_detected || []}
                      compositionSteps={activeGizmoAnalysis?.composition_steps || []}
                      issues={activeGizmoAnalysis?.issues || []}
                      summary={activeGizmoAnalysis?.summary}
                      code={activeGizmoCode}
                    />
                  </div>
                </div>

                {/* Analysis Status Banner */}
                <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 font-semibold flex items-center space-x-1.5">
                      <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Semantic Pipeline Status</span>
                    </span>

                    {analysisResult && (
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono ${
                          analysisResult.diff_analysis
                            ? analysisResult.diff_analysis.classification === 'fixes_issue'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : analysisResult.diff_analysis.classification === 'introduces_issue'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                            : analysisResult.clean
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {analysisResult.diff_analysis
                          ? analysisResult.diff_analysis.classification.toUpperCase()
                          : analysisResult.clean
                          ? 'CLEAN SO(3)'
                          : 'BUGS DETECTED'}
                      </span>
                    )}
                  </div>

                  {analysisResult ? (
                    <p className="text-xs text-zinc-800 font-sans leading-relaxed">
                      {analysisResult.diff_analysis
                        ? analysisResult.diff_analysis.one_line_verdict
                        : analysisResult.summary}
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-400 font-mono italic">
                      Ready to analyze rigid-body transforms...
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-mono flex items-center justify-between">
                <span>{errorMessage}</span>
                <button
                  onClick={() => handleAnalyze()}
                  className="px-2.5 py-1 bg-rose-600 text-white rounded hover:bg-rose-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Raw JSON Inspector View (If toggled) */}
            {showRawJson && analysisResult && (
              <div className="animate-fade-in">
                <JsonViewer result={analysisResult} />
              </div>
            )}

            {/* Main Findings & Results Sections */}
            {analysisResult && !showRawJson && (
              <div className="space-y-6">
                {analyzerMode === 'diff' && analysisResult.diff_analysis ? (
                  /* Diff Results View */
                  <DiffResultsView diffAnalysis={analysisResult.diff_analysis} />
                ) : (
                  /* Single Snippet Results View */
                  <>
                    <div
                      className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 shadow-2xs font-mono text-xs ${
                        analysisResult.clean
                          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                          : 'bg-amber-50/80 border-amber-300 text-amber-950'
                      }`}
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className="font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded bg-white border border-zinc-200 shrink-0 text-zinc-800">
                          Summary
                        </span>
                        <span className="font-semibold text-xs truncate">
                          {analysisResult.summary}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono ${
                            analysisResult.clean
                              ? 'bg-emerald-600 text-white'
                              : 'bg-rose-600 text-white'
                          }`}
                        >
                          {analysisResult.clean ? 'SO(3) CLEAN' : 'ISSUES DETECTED'}
                        </span>
                      </div>
                    </div>

                    <IssuesList
                      issues={analysisResult.issues || []}
                      onApplyFix={handleApplyFix}
                    />
                  </>
                )}

                {/* Frame Composition Graph Pipeline */}
                <FrameGraph
                  compositionSteps={activeGizmoAnalysis?.composition_steps || []}
                  issues={activeGizmoAnalysis?.issues || []}
                />

                {/* Detected Transforms Table */}
                <TransformsTable
                  transforms={activeGizmoAnalysis?.transforms_detected || []}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-zinc-500 font-mono flex flex-wrap items-center justify-between gap-2">
          <span>TRANS-A.AI • SO(3) / SE(3) Spatial Math & Transform Analyzer</span>
          <span className="text-zinc-400">Powered by Google Gemini 3.6 Flash</span>
        </div>
      </footer>

      {/* User Profile Capture & Details Modal */}
      {session?.user && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          currentProfile={
            userProfile || {
              fullName: session.user.email?.split('@')[0] || 'Robotics Engineer',
              role: 'Robotics & SLAM Engineer',
              organization: 'Autonomous Systems Lab',
              bio: 'Working on SO(3)/SE(3) rigid-body state estimation and robotics.',
              avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
              primaryConvention: 'Hamilton Quaternion (w, x, y, z)',
            }
          }
          userEmail={session.user.email || ''}
          userId={session.user.id}
          onSaveProfile={(updated) => {
            setUserProfile(updated);
          }}
        />
      )}

      {/* Global Technical Blog Article Modal */}
      <BlogArticleModal
        isOpen={isArticleModalOpen}
        onClose={() => setIsArticleModalOpen(false)}
        onEnterWorkspace={() => {
          setIsArticleModalOpen(false);
          setActiveMode('reviewer');
        }}
      />
    </div>
  );
}
