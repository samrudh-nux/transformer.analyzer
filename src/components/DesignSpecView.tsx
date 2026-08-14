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
// @ts-ignore - JS file import
import { supabase } from '../supabaseClient';

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
        </div>
      </div>

      {/* Main Grid Section: Research Article + Quick Access / Workspace Card */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-4 w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left 8 Cols: Architectural Overview & Research Brief Cards */}
        <div className="lg:col-span-8 space-y-6">

          {/* Technical Brief Feature Banner */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-6 sm:p-7 shadow-sm border border-indigo-800/40 relative overflow-hidden space-y-4">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-xs font-mono font-medium">
                <BookOpen className="w-3.5 h-3.5 text-indigo-300" />
                <span>TECHNICAL BRIEF & SYSTEM ARCHITECTURE</span>
              </span>
              <span className="text-xs text-slate-400 font-mono">5 min read • Empirical Analysis</span>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
                Rigid-Body Kinematics & Static Semantic Verification Architecture
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 font-sans mt-2 leading-relaxed">
                An empirical study on why quaternion memory layouts, gimbal singularities, and inverse frame composition silently corrupt robotic state estimation without syntax warnings — and how our hybrid static AST + AI analyzer catches them automatically.
              </p>
            </div>

            <div className="pt-1 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setIsArticleOpen(true)}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-sm transition-all active:scale-[0.98]"
              >
                <BookOpen className="w-4 h-4" />
                <span>Open in Reader Modal</span>
                <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
              </button>

              <div className="flex items-center space-x-2 text-xs text-slate-300 font-mono px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                <span>By <strong className="text-white font-semibold">SAMRUDH</strong> (CS Student)</span>
              </div>
            </div>
          </div>

          {/* Key Capabilities 2x2 Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 font-sans">
                Convention Drift & Normalization Detection
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                Automatically identifies Hamilton vs JPL quaternion ordering <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[11px]">[w,x,y,z]</code> vs <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[11px]">[x,y,z,w]</code>, unit norm drift, and Euler gimbal singularities.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Boxes className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 font-sans">
                Explicit Frame Graph Composition
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                Traces chained transformations <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[11px]">T_A_B · T_B_C</code>, flagging inverse direction errors (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[11px]">T_A_B</code> vs <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[11px]">T_B_A</code>) that invert coordinate physical reality.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 font-sans">
                Calibrated AI Confidence Modeling
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                Distinguishes code-provable mathematical proofs from unstated hardware conventions, eliminating hallucinated false positives with honest uncertainty scores.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Rotate3d className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 font-sans">
                Live 3D Frame Chain Visualization
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                Renders interactive 3D orthogonal coordinate gizmos in WebGL, with solid axes for verified frames and dashed lines for unverified/inferred frames.
              </p>
            </div>

          </div>

          {/* Real-World Case Study Highlight Box */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-mono font-bold text-indigo-700 uppercase tracking-wider">
                <BarChart3 className="w-4 h-4" />
                <span>Empirical Case Study: ArduPilot & PX4</span>
              </div>
              <button
                onClick={() => setIsArticleOpen(true)}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 underline flex items-center space-x-1"
              >
                <span>Read case details</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              Peer-reviewed research uncovered 14 silent bugs in world-leading flight autopilots. TRANS-A.AI flags real issues (such as ArduPilot Issue #28113 where camera mount orientation is computed and silently overwritten) with calibrated severity and human-actionable fix recommendations.
            </p>
          </div>

        </div>

        {/* Right 4 Cols: Sticky Auth / Access Workspace Card */}
        <div id="auth-portal-section" className="lg:col-span-4 lg:sticky lg:top-20">
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

                {/* Google SSO Button */}
                <button
                  onClick={async () => {
                    try {
                      const { error } = await supabase.auth.signInWithOAuth({
                        provider: 'google',
                        options: {
                          redirectTo: window.location.origin,
                        },
                      });
                      if (error) throw error;
                    } catch (e) {
                      console.warn('Google sign-in exception:', e);
                    }
                  }}
                  type="button"
                  className="w-full py-2 px-4 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition-all flex items-center justify-center space-x-2"
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
                    Supabase Authentication secured. Sign in with your registered credentials or Google account to unlock all features.
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
