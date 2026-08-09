import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CompositionStep, IssueDetected, TransformDetected } from '../types';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Layers,
  GitCommit,
  Sparkles,
  AlertTriangle,
  Info,
  Box,
  Eye,
  Sliders,
} from 'lucide-react';

interface Gizmo3DProps {
  transforms?: TransformDetected[];
  compositionSteps?: CompositionStep[];
  issues?: IssueDetected[];
  summary?: string;
  code?: string;
}

interface ParsedStepData {
  stepIndex: number;
  stepNumber: number;
  operation: string;
  lineRef: number;
  fromFrame: string;
  toFrame: string;
  isUnknownFrame: boolean;
  isConsistent: boolean;
  hasIssue: boolean;
  issueDescription?: string;
  isConcrete: boolean;
  quaternion: THREE.Quaternion;
  quatArray: [number, number, number, number];
  matrix3x3?: number[][];
}

// Extract numeric quaternion arrays from code text
function parseConcreteQuaternions(code: string = ''): Map<string, [number, number, number, number]> {
  const map = new Map<string, [number, number, number, number]>();
  if (!code) return map;

  // Match pattern: var_name = ... [x, y, z, w] or from_quat([x, y, z, w])
  const lines = code.split('\n');
  const arrayRegex = /([a-zA-Z0-9_]+)\s*=\s*(?:Rot\.from_quat|Quaternion|np\.array)?\(?\s*\[\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*\]/g;

  for (const line of lines) {
    let match: RegExpExecArray | null;
    while ((match = arrayRegex.exec(line)) !== null) {
      const varName = match[1];
      const q0 = parseFloat(match[2]);
      const q1 = parseFloat(match[3]);
      const q2 = parseFloat(match[4]);
      const q3 = parseFloat(match[5]);
      if (!isNaN(q0) && !isNaN(q1) && !isNaN(q2) && !isNaN(q3)) {
        map.set(varName, [q0, q1, q2, q3]);
      }
    }
  }
  return map;
}

export const Gizmo3D: React.FC<Gizmo3DProps> = ({
  transforms = [],
  compositionSteps = [],
  issues = [],
  summary,
  code = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);

  // View state
  const [viewMode, setViewMode] = useState<'chain' | 'overlay'>('chain');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 0.5x, 1x, 2x

  // Animation progress ref for smooth SLERP transitions (0 to 1 between steps)
  const animProgressRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());

  // References for Three.js scene
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const triadsGroupRef = useRef<THREE.Group | null>(null);

  // Parse concrete numeric quats from code
  const concreteQuatsMap = useMemo(() => parseConcreteQuaternions(code), [code]);

  // Build step data models
  const parsedSteps: ParsedStepData[] = useMemo(() => {
    const issueMap = new Map<number, IssueDetected>();
    issues.forEach((i) => issueMap.set(i.line_ref, i));

    return compositionSteps.map((step, idx) => {
      const fromFrame = step.resulting_frame?.from || 'Unknown';
      const toFrame = step.resulting_frame?.to || 'Unknown';
      const isUnknownFrame =
        fromFrame === 'Unknown' ||
        fromFrame === 'unknown' ||
        toFrame === 'Unknown' ||
        toFrame === 'unknown';

      const issue = issueMap.get(step.line_ref);
      const hasIssue = !step.frame_chain_consistent || !!issue;
      const issueDescription = issue?.description;

      // Check if step variables match concrete quat literals in code
      let isConcrete = false;
      let quatArray: [number, number, number, number] = [0, 0, 0, 1];

      // Try matching variable names in operation string
      for (const [varName, quat] of concreteQuatsMap.entries()) {
        if (step.operation.includes(varName)) {
          isConcrete = true;
          quatArray = quat;
          break;
        }
      }

      // If schematic (no literal found in code), assign illustrative distinct step rotation
      const quaternion = new THREE.Quaternion();
      if (isConcrete) {
        // scipy default order [x, y, z, w]
        quaternion.set(quatArray[0], quatArray[1], quatArray[2], quatArray[3]).normalize();
      } else {
        // Illustrative distinct rotations for schematic steps
        const euler = new THREE.Euler(
          (idx + 1) * 0.35,
          (idx + 1) * 0.45,
          (idx + 1) * 0.25,
          'XYZ'
        );
        quaternion.setFromEuler(euler);
      }

      // Calculate 3x3 matrix values
      const matrix = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
      const e = matrix.elements;
      const matrix3x3 = [
        [e[0], e[4], e[8]],
        [e[1], e[5], e[9]],
        [e[2], e[6], e[10]],
      ];

      return {
        stepIndex: idx,
        stepNumber: step.step,
        operation: step.operation,
        lineRef: step.line_ref,
        fromFrame,
        toFrame,
        isUnknownFrame,
        isConsistent: step.frame_chain_consistent,
        hasIssue,
        issueDescription,
        isConcrete,
        quaternion,
        quatArray,
        matrix3x3,
      };
    });
  }, [compositionSteps, issues, concreteQuatsMap]);

  // Current active step
  const activeStep = parsedSteps[currentStepIndex] || null;

  // Auto-advance scrubber when playing
  useEffect(() => {
    if (!isPlaying || parsedSteps.length === 0) return;

    const delay = Math.max(400, 2000 / playbackSpeed);
    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => (prev + 1) % parsedSteps.length);
    }, delay);

    return () => clearInterval(interval);
  }, [isPlaying, parsedSteps.length, playbackSpeed]);

  // Step navigation helpers (auto-pause playback on manual interaction)
  const handlePrevStep = () => {
    setIsPlaying(false);
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextStep = () => {
    setIsPlaying(false);
    setCurrentStepIndex((prev) =>
      Math.min(parsedSteps.length - 1, prev + 1)
    );
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsPlaying(false);
    setCurrentStepIndex(parseInt(e.target.value, 10));
  };

  const togglePlayPause = () => {
    setIsPlaying((prev) => !prev);
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing inside textarea or input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrevStep();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNextStep();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [parsedSteps.length]);

  // Reset view button handler
  const handleResetView = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(3.2, 2.4, 3.8);
      controlsRef.current.target.set(0.8, 0, 0);
      controlsRef.current.update();
    }
  };

  // Main Three.js setup and render loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 320;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // Slate-900 research background
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(3.2, 2.4, 3.8);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Attach global snapshot helper for PDF report generator
    (window as any).__getGizmo3DSnapshot = () => {
      try {
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
          return rendererRef.current.domElement.toDataURL('image/png');
        }
      } catch (err) {
        console.warn('Failed to capture 3D gizmo snapshot:', err);
      }
      return null;
    };

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0.8, 0, 0);
    controlsRef.current = controls;

    // Grid Floor
    const gridHelper = new THREE.GridHelper(8, 16, 0x334155, 0x1e293b);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    // Group for all triads
    const triadsGroup = new THREE.Group();
    scene.add(triadsGroup);
    triadsGroupRef.current = triadsGroup;

    // World Reference Origin Triad (0,0,0)
    const worldGroup = new THREE.Group();
    worldGroup.position.set(0, 0, 0);

    const axisLength = 0.6;
    const createWorldAxis = (dir: THREE.Vector3, color: number) => {
      return new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0, 0), axisLength, color, 0.12, 0.06);
    };

    worldGroup.add(createWorldAxis(new THREE.Vector3(1, 0, 0), 0xef4444)); // Red X
    worldGroup.add(createWorldAxis(new THREE.Vector3(0, 1, 0), 0x10b981)); // Green Y
    worldGroup.add(createWorldAxis(new THREE.Vector3(0, 0, 1), 0x3b82f6)); // Blue Z
    scene.add(worldGroup);

    // Animation loop
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (autoRotate && controlsRef.current) {
        controlsRef.current.autoRotate = true;
        controlsRef.current.autoRotateSpeed = 1.5;
      } else if (controlsRef.current) {
        controlsRef.current.autoRotate = false;
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // Resize observer listener for canvas container
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight || 320;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [autoRotate]);

  // Update triads in 3D scene when parsedSteps, viewMode, or active step changes
  useEffect(() => {
    const triadsGroup = triadsGroupRef.current;
    if (!triadsGroup) return;

    // Clear existing children
    while (triadsGroup.children.length > 0) {
      triadsGroup.remove(triadsGroup.children[0]);
    }

    if (parsedSteps.length === 0) return;

    const axisLength = 0.65;

    parsedSteps.forEach((step, idx) => {
      const stepGroup = new THREE.Group();

      // Position in Chain mode vs Overlay mode
      if (viewMode === 'chain') {
        stepGroup.position.set((idx + 1) * 1.3, 0, 0);
      } else {
        stepGroup.position.set(0, 0, 0);
      }

      // SLERP interpolation target orientation
      stepGroup.quaternion.copy(step.quaternion);

      const isActive = idx === currentStepIndex;

      // Epistemic Uncertainty check: Dashed vs Solid axes
      if (step.isUnknownFrame) {
        // Render dashed translucent axes for Unknown frame labels
        const createDashedAxis = (dir: THREE.Vector3, color: number) => {
          const points = [new THREE.Vector3(0, 0, 0), dir.clone().multiplyScalar(axisLength)];
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          const material = new THREE.LineDashedMaterial({
            color,
            dashSize: 0.08,
            gapSize: 0.05,
            opacity: 0.5,
            transparent: true,
          });
          const line = new THREE.Line(geometry, material);
          line.computeLineDistances();
          return line;
        };

        stepGroup.add(createDashedAxis(new THREE.Vector3(1, 0, 0), 0xf87171));
        stepGroup.add(createDashedAxis(new THREE.Vector3(0, 1, 0), 0x34d399));
        stepGroup.add(createDashedAxis(new THREE.Vector3(0, 0, 1), 0x60a5fa));
      } else {
        // Solid RGB axes for well-evidenced frames
        const createSolidAxis = (dir: THREE.Vector3, color: number) => {
          return new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0, 0), axisLength, color, 0.14, 0.07);
        };

        stepGroup.add(createSolidAxis(new THREE.Vector3(1, 0, 0), 0xe11d48));
        stepGroup.add(createSolidAxis(new THREE.Vector3(0, 1, 0), 0x059669));
        stepGroup.add(createSolidAxis(new THREE.Vector3(0, 0, 1), 0x2563eb));
      }

      // If step has an issue, add a thin amber/rose outline indicator ring
      if (step.hasIssue) {
        const ringGeo = new THREE.RingGeometry(0.35, 0.38, 24);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xf43f5e,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.8,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 2;
        stepGroup.add(ringMesh);
      }

      // If step is active, add subtle active step ring
      if (isActive) {
        const activeRingGeo = new THREE.RingGeometry(0.42, 0.45, 24);
        const activeRingMat = new THREE.MeshBasicMaterial({
          color: 0x6366f1,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
        });
        const activeRing = new THREE.Mesh(activeRingGeo, activeRingMat);
        activeRing.rotation.x = Math.PI / 2;
        stepGroup.add(activeRing);
      }

      triadsGroup.add(stepGroup);

      // In Chain View, draw dashed connector line to previous frame
      if (viewMode === 'chain' && idx > 0) {
        const prevPos = new THREE.Vector3(idx * 1.3, 0, 0);
        const currPos = new THREE.Vector3((idx + 1) * 1.3, 0, 0);
        const lineGeo = new THREE.BufferGeometry().setFromPoints([prevPos, currPos]);
        const lineMat = new THREE.LineDashedMaterial({
          color: 0x475569,
          dashSize: 0.1,
          gapSize: 0.06,
        });
        const line = new THREE.Line(lineGeo, lineMat);
        line.computeLineDistances();
        triadsGroup.add(line);
      }
    });
  }, [parsedSteps, viewMode, currentStepIndex]);

  return (
    <div
      ref={containerRef}
      className="bg-slate-900 rounded-xl border border-slate-800 shadow-sm overflow-hidden flex flex-col h-[460px] max-h-[460px] min-h-[460px] font-mono text-xs"
    >
      {/* Header Controls Bar */}
      <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center space-x-2">
          <Box className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold text-slate-200 tracking-wide font-mono text-xs">
            3D Frame Chain Trace
          </span>

          {activeStep && (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                activeStep.isConcrete
                  ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/60'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {activeStep.isConcrete ? 'Concrete (Numeric)' : 'Schematic'}
            </span>
          )}
        </div>

        {/* Mode Toggle & Scene Controls */}
        <div className="flex items-center space-x-2 flex-wrap">
          {/* View Mode Toggle */}
          <div className="bg-slate-900 p-0.5 rounded border border-slate-800 flex items-center space-x-0.5 text-[11px]">
            <button
              onClick={() => setViewMode('chain')}
              className={`px-2 py-0.5 rounded transition-colors ${
                viewMode === 'chain'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Sequential Chain View along composition path"
            >
              Chain View
            </button>
            <button
              onClick={() => setViewMode('overlay')}
              className={`px-2 py-0.5 rounded transition-colors ${
                viewMode === 'overlay'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Overlaid Rotations View at shared origin"
            >
              Overlay View
            </button>
          </div>

          {/* Reset View */}
          <button
            onClick={handleResetView}
            className="p-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded border border-slate-700 transition-colors"
            title="Reset Camera View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Auto Rotate Toggle */}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`px-2 py-1 rounded border text-[11px] transition-colors ${
              autoRotate
                ? 'bg-indigo-950 text-indigo-300 border-indigo-700'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {autoRotate ? 'Orbit ON' : 'Orbit OFF'}
          </button>
        </div>
      </div>

      {/* Main Container: 3D Canvas + Info Sync Side Panel */}
      <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-1 md:grid-cols-12 relative">
        {/* 3D Canvas Mount (8 cols on md+) */}
        <div className="md:col-span-8 relative h-[250px] md:h-full w-full bg-slate-900 overflow-hidden">
          <div ref={mountRef} className="absolute inset-0 w-full h-full" />

          {/* Empty State Overlay if zero composition steps */}
          {parsedSteps.length === 0 && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-20">
              <Box className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
              <p className="text-slate-300 text-xs font-semibold">
                No Composition Steps Detected
              </p>
              <p className="text-slate-500 text-[11px] mt-1 max-w-xs font-sans">
                Select or paste code containing rigid-body transform compositions to render the 3D frame trace graph.
              </p>
            </div>
          )}

          {/* Canvas RGB Legend Overlay */}
          <div className="absolute bottom-2 left-2 z-10 bg-slate-950/80 backdrop-blur-md px-2.5 py-1.5 rounded border border-slate-800 flex items-center space-x-3 text-[10px]">
            <div className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span className="text-slate-300">X (Red)</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-slate-300">Y (Green)</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span className="text-slate-300">Z (Blue)</span>
            </div>
          </div>
        </div>

        {/* Info Sync Side Panel (4 cols on md+) */}
        <div className="md:col-span-4 bg-slate-950 border-t md:border-t-0 md:border-l border-slate-800 p-3 flex flex-col justify-between space-y-3 overflow-y-auto h-[170px] md:h-full">
          {activeStep ? (
            <div className="space-y-3">
              {/* Step Counter & Status */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                  Step {activeStep.stepNumber} of {parsedSteps.length}
                </span>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    activeStep.isConsistent && !activeStep.hasIssue
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}
                >
                  {activeStep.isConsistent && !activeStep.hasIssue
                    ? 'Consistent'
                    : 'Issue Warning'}
                </span>
              </div>

              {/* Operation String */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Operation
                </span>
                <div className="p-2 bg-slate-900 rounded border border-slate-800 text-indigo-300 font-mono text-[11px] truncate">
                  {activeStep.operation}
                </div>
              </div>

              {/* Frame Labels (From → To) */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Frame Transition
                </span>
                <div className="flex items-center justify-between p-2 bg-slate-900 rounded border border-slate-800 text-[11px]">
                  <span
                    className={`px-1.5 py-0.5 rounded ${
                      activeStep.fromFrame === 'Unknown'
                        ? 'bg-rose-950/60 text-rose-400 border border-rose-800/80 italic'
                        : 'bg-slate-800 text-slate-200'
                    }`}
                  >
                    {activeStep.fromFrame}
                  </span>
                  <span className="text-slate-500">→</span>
                  <span
                    className={`px-1.5 py-0.5 rounded ${
                      activeStep.toFrame === 'Unknown'
                        ? 'bg-rose-950/60 text-rose-400 border border-rose-800/80 italic'
                        : 'bg-indigo-950 text-indigo-300'
                    }`}
                  >
                    {activeStep.toFrame}
                  </span>
                </div>
              </div>

              {/* Numeric Data (if Concrete) */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Numeric Representation</span>
                  <span className="text-[9px] text-slate-600">
                    {activeStep.isConcrete ? '[x,y,z,w]' : 'Illustrative'}
                  </span>
                </span>

                <div className="p-2 bg-slate-900 rounded border border-slate-800 space-y-1 text-[10px] font-mono text-slate-300">
                  <div>
                    <span className="text-slate-500">q: </span>
                    <span>
                      [{activeStep.quatArray.map((n) => n.toFixed(3)).join(', ')}]
                    </span>
                  </div>

                  {activeStep.matrix3x3 && (
                    <div className="text-[9px] text-slate-500 pt-1 border-t border-slate-800/80 space-y-0.5">
                      <div>R = [{activeStep.matrix3x3[0].map((n) => n.toFixed(2)).join(', ')}]</div>
                      <div>    [{activeStep.matrix3x3[1].map((n) => n.toFixed(2)).join(', ')}]</div>
                      <div>    [{activeStep.matrix3x3[2].map((n) => n.toFixed(2)).join(', ')}]</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Issue Caption if present */}
              {activeStep.issueDescription && (
                <div className="p-2 bg-rose-950/40 border border-rose-800/60 rounded text-[10px] text-rose-300 space-y-0.5 font-sans">
                  <div className="font-semibold flex items-center space-x-1 text-rose-400">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Issue at line #{activeStep.lineRef}</span>
                  </div>
                  <p className="leading-snug text-slate-300">{activeStep.issueDescription}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-500 text-[11px] font-mono italic">
              No active step selected.
            </div>
          )}

          {/* Scrubber Transport Controls */}
          {parsedSteps.length > 0 && (
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono gap-1 flex-wrap">
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={togglePlayPause}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-semibold flex items-center space-x-1 transition-all shadow-2xs"
                    title="Toggle auto playback (Spacebar)"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-3 h-3 fill-current" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        <span>Play</span>
                      </>
                    )}
                  </button>

                  {/* Playback speed selector */}
                  <div className="flex items-center bg-slate-900 rounded border border-slate-800 p-0.5 text-[9px]">
                    {[0.5, 1, 2].map((spd) => (
                      <button
                        key={spd}
                        onClick={() => setPlaybackSpeed(spd)}
                        className={`px-1.5 py-0.5 rounded transition-colors ${
                          playbackSpeed === spd
                            ? 'bg-slate-700 text-indigo-300 font-bold'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={handlePrevStep}
                    disabled={currentStepIndex === 0}
                    className="p-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-slate-300 transition-colors"
                    title="Previous step (Left Arrow)"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-1.5 font-bold text-slate-300 text-[11px]">
                    {currentStepIndex + 1}/{parsedSteps.length}
                  </span>
                  <button
                    onClick={handleNextStep}
                    disabled={currentStepIndex === parsedSteps.length - 1}
                    className="p-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-slate-300 transition-colors"
                    title="Next step (Right Arrow)"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Scrubber Slider */}
              <input
                type="range"
                min={0}
                max={Math.max(0, parsedSteps.length - 1)}
                value={currentStepIndex}
                onChange={handleSliderChange}
                className="w-full accent-indigo-500 bg-slate-800 rounded h-1.5 cursor-pointer"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
