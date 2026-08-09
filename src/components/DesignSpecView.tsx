import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Rotate3d,
  Info,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  BookOpen,
  ArrowRight,
  User,
  Zap,
  Boxes,
  Cpu,
  Terminal,
  FileCode2,
  Check,
  AlertTriangle,
  Layers,
  BarChart3,
  ExternalLink
} from 'lucide-react';
import { SignIn } from './SignIn';
import { SignUp } from './SignUp';
import { BlogArticleModal } from './BlogArticleModal';

interface DesignSpecViewProps {
  onEnterWorkspace: () => void;
  userEmail?: string;
  isAuthenticated?: boolean;
  onSignOut?: () => void;
  onOpenArticleModal?: () => void;
}

export const DesignSpecView: React.FC<DesignSpecViewProps> = ({
  onEnterWorkspace,
  userEmail,
  isAuthenticated = false,
  onSignOut,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');
  const [authSuccess, setAuthSuccess] = useState<boolean>(false);
  const [signedUpEmail, setSignedUpEmail] = useState<string>('');
  const [justSignedUp, setJustSignedUp] = useState<boolean>(false);
  const [isArticleOpen, setIsArticleOpen] = useState<boolean>(false);

  // Automatically transition to workspace if user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      onEnterWorkspace();
    }
  }, [isAuthenticated, onEnterWorkspace]);

  const handleSignUpSuccess = (email: string) => {
    setSignedUpEmail(email);
    setJustSignedUp(true);
    setAuthTab('signin');
  };

  // Faint rotating 3D background coordinate frame gizmo
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(3.2, 2.8, 4.0);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Grid Floor - very light slate
    const gridHelper = new THREE.GridHelper(12, 24, 0xe2e8f0, 0xf1f5f9);
    gridHelper.position.y = -1.2;
    scene.add(gridHelper);

    // Signature Graphic Group (SO(3) Orthogonal Axes)
    const gizmoGroup = new THREE.Group();
    scene.add(gizmoGroup);

    const len = 1.8;
    const arrowX = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), len, 0xef4444, 0.25, 0.12);
    const arrowY = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), len, 0x10b981, 0.25, 0.12);
    const arrowZ = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), len, 0x3b82f6, 0.25, 0.12);

    gizmoGroup.add(arrowX);
    gizmoGroup.add(arrowY);
    gizmoGroup.add(arrowZ);

    // Add faint wireframe unit sphere around origin representing SO(3) Lie group manifold
    const sphereGeo = new THREE.SphereGeometry(1.8, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xcbd5e1,
      wireframe: true,
      transparent: true,
      opacity: 0.18,
    });
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    gizmoGroup.add(sphereMesh);

    let frameId: number;
    let angle = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      angle += 0.0025;
      gizmoGroup.rotation.y = angle;
      gizmoGroup.rotation.x = Math.sin(angle * 0.5) * 0.12;
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-[#fcfcfd] text-slate-900 font-sans flex flex-col justify-between overflow-x-hidden">
      {/* 3D Background Canvas */}
      <div
        ref={mountRef}
        className="absolute inset-0 z-0 pointer-events-none opacity-30 md:opacity-50"
      />

      {/* Hero Header Area */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 pt-10 pb-6 w-full">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-mono font-medium">
            <Rotate3d className="w-3.5 h-3.5 text-indigo-600" />
            <span>TRANS-A.AI • SO(3) / SE(3) Research & Verification</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-950 font-sans leading-[1.15]">
            Eliminating Silent SO(3) & SE(3) Coordinate Bugs in Autonomous Systems
          </h1>

          <p className="text-base sm:text-lg text-slate-600 font-sans leading-relaxed">
            Why convention drift, quaternion vector ordering, and frame inversion are dangerous silent failure modes in robotics — and how this tool catches them before a human reviewer has to.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-500 font-mono">
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <User className="w-3.5 h-3.5 text-indigo-600" />
              <span><strong className="text-slate-900 font-semibold">SAMRUDH</strong> — Creator, CS Student</span>
            </div>
            <button
              onClick={() => setIsArticleOpen(true)}
              className="inline-flex items-center space-x-1 px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors font-medium text-xs"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Read in Reader Modal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid Section: Research Article + Quick Access / Workspace Card */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-4 w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left 8 Cols: Research Content & Paper */}
        <div className="lg:col-span-8 space-y-8">

          {/* Section 1 */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 sm:p-8 space-y-4">
            <div className="flex items-center space-x-2 text-indigo-600 font-mono text-xs font-bold uppercase tracking-wider">
              <Zap className="w-4 h-4" />
              <span>1. The Hidden Trap in Spatial Robotics</span>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">
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

          {/* Section 2 */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 sm:p-8 space-y-4">
            <div className="flex items-center space-x-2 text-indigo-600 font-mono text-xs font-bold uppercase tracking-wider">
              <Boxes className="w-4 h-4" />
              <span>2. What this tool does</span>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">
              An AI-assisted semantic code reviewer for SO(3)/SE(3) code, built on Google's Gemini models. Paste a code snippet (tested against real Python/SciPy and C++/Eigen-based robotics code), and it:
            </p>

            <ul className="space-y-2 text-xs text-slate-700 pl-1 list-disc list-inside marker:text-indigo-600 font-sans">
              <li>Constructs an explicit frame graph of every rotation/transform variable</li>
              <li>Traces composition order and flags frame chain inconsistencies</li>
              <li>Detects normalization violations, convention ambiguity, and known bug patterns</li>
              <li>Renders an interactive 3D visualization of the frame chain, with well-evidenced frames shown as solid axes and unverified/inferred frames shown as dashed — the tool visually represents its own uncertainty rather than guessing confidently</li>
              <li>Suggests specific fixes for human review — it does not auto-modify code</li>
            </ul>

            {/* Code snippet example box */}
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

          {/* Section 3 */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 sm:p-8 space-y-4">
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

          {/* Section 4 */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 sm:p-8 space-y-4">
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

        {/* Right 4 Cols: Sticky Auth / Access Workspace Card */}
        <div className="lg:col-span-4 lg:sticky lg:top-20">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 text-left relative">
            {isAuthenticated ? (
              <div className="space-y-5 text-center animate-fade-in">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>

                <div>
                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-mono mb-2 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Authenticated Session Active</span>
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 font-sans tracking-tight">
                    Welcome Back!
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-1 break-all">
                    {userEmail || 'Signed In User'}
                  </p>
                </div>

                <div className="pt-2 space-y-2.5">
                  <button
                    onClick={onEnterWorkspace}
                    className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Launch Code Reviewer Workspace</span>
                  </button>

                  {onSignOut && (
                    <button
                      onClick={onSignOut}
                      className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl transition-all"
                    >
                      Sign Out
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {authSuccess && (
                  <div className="absolute inset-0 bg-white/95 rounded-2xl z-20 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                    <CheckCircle2 className="w-12 h-12 text-emerald-600 mb-2 animate-bounce" />
                    <h4 className="text-base font-bold text-slate-900">Entering Workspace...</h4>
                    <p className="text-xs text-slate-500 font-mono mt-1">Initializing transform graph engine</p>
                  </div>
                )}

                <div className="mb-5 flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 font-sans tracking-tight">
                      {authTab === 'signin' ? 'Sign in to Workspace' : 'Create Workspace Account'}
                    </h3>
                    <p className="text-xs text-slate-500 font-sans">
                      {authTab === 'signin' ? 'Access your transform review environment' : 'Join the transform graph analyzer'}
                    </p>
                  </div>
                  <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-medium shrink-0">
                    <button
                      type="button"
                      onClick={() => setAuthTab('signin')}
                      className={`px-2 py-0.5 rounded-md transition-all ${
                        authTab === 'signin'
                          ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthTab('signup')}
                      className={`px-2 py-0.5 rounded-md transition-all ${
                        authTab === 'signup'
                          ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Sign Up
                    </button>
                  </div>
                </div>

                {authTab === 'signin' ? (
                  <SignIn
                    initialEmail={signedUpEmail}
                    signUpSuccess={justSignedUp}
                    onSignInSuccess={onEnterWorkspace}
                  />
                ) : (
                  <SignUp onSignUpSuccess={handleSignUpSuccess} />
                )}

                {/* Divider */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-[11px]">
                    <span className="px-2 bg-white text-slate-400 font-sans">or</span>
                  </div>
                </div>

                {/* Direct Launch Button */}
                <button
                  onClick={() => onEnterWorkspace()}
                  type="button"
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center justify-center space-x-2"
                >
                  <Sparkles className="w-4 h-4 text-indigo-200" />
                  <span>Try Analyzer Now (Demo Access)</span>
                </button>

                {/* Google SSO Button */}
                <button
                  onClick={() => onEnterWorkspace()}
                  type="button"
                  className="w-full mt-2 py-2 px-4 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition-all flex items-center justify-center space-x-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-start space-x-1.5 text-[10px] text-slate-400">
                  <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <p>
                    Supabase Auth enabled. You can log in or click "Try Analyzer Now" to review SO(3)/SE(3) code immediately.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Blog Article Modal */}
      <BlogArticleModal
        isOpen={isArticleOpen}
        onClose={() => setIsArticleOpen(false)}
        onEnterWorkspace={onEnterWorkspace}
      />
    </div>
  );
};
