import React, { useState } from 'react';
import {
  BookOpen,
  X,
  Rotate3d,
  User,
  Sparkles,
  Share2,
  Bookmark,
  Check,
  ArrowRight,
  Zap,
  Boxes,
  Cpu,
  BarChart3,
  AlertTriangle
} from 'lucide-react';

interface BlogArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnterWorkspace?: () => void;
}

export const BlogArticleModal: React.FC<BlogArticleModalProps> = ({
  isOpen,
  onClose,
  onEnterWorkspace,
}) => {
  const [copied, setCopied] = useState(false);
  const [bookmarked, setBookmarked] = useState(() => {
    return localStorage.getItem('article_bookmarked_samrudh') === 'true';
  });

  if (!isOpen) return null;

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleToggleBookmark = () => {
    const nextState = !bookmarked;
    setBookmarked(nextState);
    localStorage.setItem('article_bookmarked_samrudh', String(nextState));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header Bar */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                  Technical Overview
                </span>
                <span className="text-slate-400 text-xs hidden sm:inline">• 5 min read</span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white font-sans tracking-tight">
                TRANS-A.AI: Technical Brief & Architecture
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleToggleBookmark}
              className={`p-2 rounded-lg text-xs font-sans transition-all flex items-center space-x-1 ${
                bookmarked
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
              title={bookmarked ? 'Bookmarked' : 'Save article'}
            >
              <Bookmark className={`w-3.5 h-3.5 ${bookmarked ? 'fill-amber-400 text-amber-400' : ''}`} />
              <span className="hidden sm:inline text-xs">{bookmarked ? 'Saved' : 'Save'}</span>
            </button>

            <button
              onClick={handleShare}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-all flex items-center space-x-1"
              title="Share article link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline text-xs">{copied ? 'Copied' : 'Share'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Article Body */}
        <div className="p-6 sm:p-10 overflow-y-auto space-y-8 text-slate-800 font-sans leading-relaxed text-sm">
          {/* Article Title & Metadata Banner */}
          <div className="border-b border-slate-100 pb-6 space-y-4">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 font-sans tracking-tight leading-tight">
              Eliminating Silent SO(3) & SE(3) Coordinate Bugs in Autonomous Systems
            </h1>

            <p className="text-base text-slate-600 font-sans font-normal leading-relaxed">
              Why convention drift, quaternion vector ordering, and frame inversion are dangerous silent failure modes in robotics — and how this tool catches them before a human reviewer has to.
            </p>

            {/* Creator & Author Info Box */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <div className="flex items-center space-x-3.5">
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-600 shadow-xs">
                    <User className="w-6 h-6 text-slate-500" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 text-sm font-sans">
                      SAMRUDH
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-mono font-bold uppercase tracking-wider">
                      Creator, CS Student
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-sans mt-0.5">
                    1st Year Computer Science Undergrad
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 text-xs font-mono">
                <span className="text-indigo-600 font-semibold px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-md">TRANS-A.AI Architecture</span>
              </div>
            </div>
          </div>

          {/* Section 1: The Problem */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-indigo-600 font-mono text-xs font-bold uppercase tracking-wider">
              <Zap className="w-4 h-4" />
              <span>1. The Hidden Trap in Spatial Robotics</span>
            </div>
            
            <p className="text-slate-700 leading-relaxed">
              In autonomous robotics, computer vision, and spatial computing, rigid-body transformations are foundational to state estimation. Rotations in <strong className="text-slate-900 font-semibold">SO(3)</strong> and transforms in <strong className="text-slate-900 font-semibold">SE(3)</strong> share a notorious flaw: they can be dimensionally and syntactically perfect while being semantically wrong — the kind of bug that doesn't crash and doesn't fail a unit test, but silently corrupts physical behavior.
            </p>

            <ul className="space-y-2.5 pt-1 text-xs text-slate-700">
              <li className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="font-bold text-slate-900 font-mono flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                  <span>Hamilton vs. JPL quaternion convention</span>
                </span>
                <p className="text-slate-600 pl-3">
                  scalar-first <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">[w,x,y,z]</code> vs scalar-last <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">[x,y,z,w]</code>. Mixing them produces a valid-looking but incorrect rotation with no error thrown.
                </p>
              </li>

              <li className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="font-bold text-slate-900 font-mono flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                  <span>Frame inversion</span>
                </span>
                <p className="text-slate-600 pl-3">
                  confusing <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">T_A_B</code> with its inverse <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">T_B_A</code> sends estimates in the wrong direction entirely.
                </p>
              </li>

              <li className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="font-bold text-slate-900 font-mono flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                  <span>Euler singularities</span>
                </span>
                <p className="text-slate-600 pl-3">
                  angle sequences that behave normally until a specific orientation (gimbal lock), where the representation itself breaks down.
                </p>
              </li>
            </ul>

            <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs space-y-1">
              <span className="font-bold font-mono text-amber-800 uppercase tracking-wider block text-[11px]">
                Real-World Empirical Evidence
              </span>
              <p className="text-amber-900/90 leading-relaxed">
                This isn't a hypothetical problem: peer-reviewed research (SA4U, 2021) found 14 previously undetected bugs of exactly this class in ArduPilot and PX4 — two of the most widely deployed open-source flight autopilots in the world.
              </p>
            </div>
          </div>

          {/* Section 2: What this tool does */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center space-x-2 text-indigo-600 font-mono text-xs font-bold uppercase tracking-wider">
              <Boxes className="w-4 h-4" />
              <span>2. What this tool does</span>
            </div>

            <p className="text-slate-700 leading-relaxed">
              An AI-assisted semantic code reviewer for SO(3)/SE(3) code, built on Google's Gemini models. Paste a code snippet (tested against real Python/SciPy and C++/Eigen-based robotics code), and it:
            </p>

            <ul className="space-y-2 text-xs text-slate-700 pl-1 list-disc list-inside marker:text-indigo-600 font-sans">
              <li>Constructs an explicit frame graph of every rotation/transform variable</li>
              <li>Traces composition order and flags frame chain inconsistencies</li>
              <li>Detects normalization violations, convention ambiguity, and known bug patterns</li>
              <li>Renders an interactive 3D visualization of the frame chain, with well-evidenced frames shown as solid axes and unverified/inferred frames shown as dashed — the tool visually represents its own uncertainty rather than guessing confidently</li>
              <li>Suggests specific fixes for human review — it does not auto-modify code</li>
            </ul>

            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-slate-600 font-semibold">
                <span>Real example — caught in ArduPilot's camera mount code:</span>
                <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">ArduPilot Issue #28113</span>
              </div>

              <div className="bg-slate-950 text-slate-100 p-4 rounded-xl border border-slate-800 font-mono text-xs space-y-2">
                <pre className="text-slate-300 overflow-x-auto leading-relaxed text-[11px]">
{`Quaternion quat;
// ...
mount->get_poi(get_mount_instance(), quat, loc, poi_loc);  // populates quat
// ...
quat.from_euler(radians(roll), radians(pitch), radians(yaw) + AP::ahrs().get_yaw());
// ^ silently overwrites the value get_poi() just computed`}
                </pre>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-slate-900 font-semibold">Flagged at 90% confidence:</strong> the orientation returned by <code className="font-mono bg-slate-200/70 px-1 py-0.5 rounded text-slate-900">get_poi()</code> is computed and then immediately discarded. Source: a real, currently open ArduPilot issue (#28113).
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Why this approach, specifically */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center space-x-2 text-indigo-600 font-mono text-xs font-bold uppercase tracking-wider">
              <Cpu className="w-4 h-4" />
              <span>3. Why this approach, specifically</span>
            </div>

            <div className="space-y-3 text-xs text-slate-700 font-sans">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="font-bold text-slate-900 font-sans text-sm block">
                  1. Catches what shape-checkers structurally can't
                </span>
                <p className="text-slate-600 leading-relaxed">
                  Tools like <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">jaxtyping</code> and <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">TensorSensor</code> verify tensor shapes — this bug class is dimensionally valid and shape-correct, and invisible to that layer.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="font-bold text-slate-900 font-sans text-sm block">
                  2. Calibrated confidence, not blind confidence
                </span>
                <p className="text-slate-600 leading-relaxed">
                  The analyzer distinguishes claims verifiable from the code itself (composition order, normalization) from claims that depend on external, unstated knowledge (sensor conventions, undocumented function semantics) — and caps confidence accordingly instead of guessing with false certainty. See the benchmark section below for a real example of this working.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="font-bold text-slate-900 font-sans text-sm block">
                  3. Interactive 3D visualization with honest uncertainty encoding
                </span>
                <p className="text-slate-600 leading-relaxed">
                  Not just a text report — visually represents solid vs. dashed axes based on verification confidence.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="font-bold text-slate-900 font-sans text-sm block">
                  4. Diff mode
                </span>
                <p className="text-slate-600 leading-relaxed">
                  Analyze what a code change actually does to frame/rotation correctness, not just the end state.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="font-bold text-slate-900 font-sans text-sm block">
                  5. Save and organize your reviewed snippets
                </span>
                <p className="text-slate-600 leading-relaxed">
                  Keep your verified transform functions indexed in a persistent workspace.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Benchmark & Validation */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center space-x-2 text-indigo-600 font-mono text-xs font-bold uppercase tracking-wider">
              <BarChart3 className="w-4 h-4" />
              <span>4. Benchmark & Validation — an honest account</span>
            </div>

            <p className="text-xs text-slate-500 font-sans italic border-l-2 border-indigo-400 pl-3">
              This section reports actual results, including a self-correction, not a highlight reel.
            </p>

            <div className="space-y-4 text-xs text-slate-700">
              <div className="space-y-1.5">
                <span className="font-bold text-slate-900 font-mono text-xs block text-indigo-700">
                  Synthetic adversarial testing:
                </span>
                <p className="leading-relaxed text-slate-600">
                  A 7-case test suite covering normalization bugs, genuine convention ambiguity, orthonormality drift, active/passive confusion, a no-transforms control case, and two minimal pairs (identical code, one physically meaningful change) — used specifically to test whether the tool reasons about physics or pattern-matches on surface structure. It correctly discriminated both minimal pairs and independently identified the quaternion double-cover (antipodal sign) problem without being prompted to look for it.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 space-y-1.5">
                <span className="font-bold text-indigo-950 font-mono text-xs block">
                  A real self-correction, found during real-world testing:
                </span>
                <p className="leading-relaxed text-indigo-900/90">
                  When tested against real PX4 flight controller code, the analyzer initially flagged a distance calculation at 95% confidence, high severity — incorrectly. The formula was PX4's own deliberate, documented design (confirmed via a code comment and the same pattern appearing in three separate sensor files). After adding an explicit rule distinguishing code-verifiable claims from claims requiring external hardware/domain knowledge, the same test case re-run correctly dropped to 45% confidence, low severity, with an explicit "verify against platform documentation" caveat instead of a confident wrong fix. This fix was then confirmed to generalize to a structurally different case (unknown external function semantics in ArduPilot code) without weakening genuinely correct high-confidence findings nearby.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 space-y-1">
                <span className="font-bold text-slate-900 font-mono text-xs block">
                  Known limitation, stated plainly:
                </span>
                <p className="leading-relaxed text-slate-600">
                  This is an early-stage tool. AI-driven analysis can be wrong, and it should supplement code review, not replace it. The validation work above is ongoing.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-mono">
            Created by <span className="font-bold text-slate-900">SAMRUDH</span> — CS Student
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-xl transition-all"
            >
              Close Reader
            </button>

            {onEnterWorkspace && (
              <button
                onClick={() => {
                  onClose();
                  onEnterWorkspace();
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center space-x-2 active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                <span>Launch Workspace</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
