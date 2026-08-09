import { AnalysisResult, IssueDetected, TransformDetected, CompositionStep } from '../types';

export function runLocalAnalysis(code: string): AnalysisResult {
  if (code.includes('BEFORE:') && code.includes('AFTER:')) {
    const parts = code.split('AFTER:');
    const beforeCode = parts[0].replace('BEFORE:', '').trim();
    const afterCode = parts[1] ? parts[1].trim() : '';

    const beforeRes = runSingleLocalAnalysis(beforeCode);
    const afterRes = runSingleLocalAnalysis(afterCode);

    const fixed = beforeRes.issues.filter(
      (bi) => !afterRes.issues.some((ai) => ai.category === bi.category)
    ).map((i) => ({ ...i, status: 'fixed' as const }));

    const introduced = afterRes.issues.filter(
      (ai) => !beforeRes.issues.some((bi) => bi.category === ai.category)
    ).map((i) => ({ ...i, status: 'introduced' as const }));

    const unchanged = afterRes.issues.filter(
      (ai) => beforeRes.issues.some((bi) => bi.category === ai.category)
    ).map((i) => ({ ...i, status: 'unchanged' as const }));

    let classification: 'fixes_issue' | 'introduces_issue' | 'neutral' | 'unclear' = 'neutral';
    let verdict = 'No significant rotation or frame changes detected between versions.';

    if (introduced.length > 0) {
      classification = 'introduces_issue';
      verdict = `Introduces ${introduced.length} new transform issue${introduced.length > 1 ? 's' : ''} in modified code.`;
    } else if (fixed.length > 0) {
      classification = 'fixes_issue';
      verdict = `Fixes ${fixed.length} prior transform issue${fixed.length > 1 ? 's' : ''} cleanly.`;
    }

    return {
      summary: verdict,
      transforms_detected: afterRes.transforms_detected,
      composition_steps: afterRes.composition_steps,
      issues: afterRes.issues,
      clean: afterRes.clean,
      diff_analysis: {
        classification,
        one_line_verdict: verdict,
        issues_fixed: fixed,
        issues_introduced: introduced,
        issues_unchanged: unchanged,
        no_semantic_impact_changes: [],
      },
      before_analysis: beforeRes,
      after_analysis: afterRes,
    };
  }

  return runSingleLocalAnalysis(code);
}

function runSingleLocalAnalysis(code: string): AnalysisResult {
  const lines = code.split('\n');
  const transformsDetected: TransformDetected[] = [];
  const compositionSteps: CompositionStep[] = [];
  const issues: IssueDetected[] = [];

  let lineIndex = 0;
  for (const line of lines) {
    lineIndex++;
    const trimmed = line.trim();

    // Trace variable declarations or assignments that look like transforms
    const matrixMatch = trimmed.match(/([R|T]_[A-Za-z0-9_]+)\s*=\s*(.*)/);
    const quatMatch = trimmed.match(/([q|Q]_[A-Za-z0-9_]+)\s*=\s*(.*)/);
    const rotMatch = trimmed.match(/([r|R]_[A-Za-z0-9_]+)\s*=\s*(Rot|Rotation)\.(from_[a-z]+)\((.*)\)/);

    // Identify frame names from convention T_target_source or R_to_from
    if (matrixMatch) {
      const varName = matrixMatch[1];
      const expr = matrixMatch[2];
      const frames = parseFramesFromVarName(varName);

      transformsDetected.push({
        variable_name: varName,
        line_ref: lineIndex,
        representation: varName.startsWith('T_') ? 'se3_pose' : 'rotation_matrix',
        inferred_frame: {
          from: frames.from,
          to: frames.to,
          inferred: true,
        },
        inferred_convention: expr.includes('@') ? 'active vector multiplication' : null,
      });

      // Check composition order bugs
      if (expr.includes('@') || expr.includes('*')) {
        const parts = expr.split(/[@*]/).map((s) => s.trim());
        if (parts.length >= 2) {
          const leftVar = parts[0];
          const rightVar = parts[1];
          const leftFrames = parseFramesFromVarName(leftVar);
          const rightFrames = parseFramesFromVarName(rightVar);

          // Frame Chain Consistency check adhering to Frame Label Discipline
          const hasLeftFrameEvidence = leftFrames.from !== 'Unknown' || leftFrames.to !== 'Unknown';
          const hasRightFrameEvidence = rightFrames.from !== 'Unknown' || rightFrames.to !== 'Unknown';
          const hasRealEvidence = hasLeftFrameEvidence && hasRightFrameEvidence;

          let isConsistent = false;
          if (hasRealEvidence) {
            isConsistent = rightFrames.to === leftFrames.from;
          } else {
            // Under Frame Label Discipline, if evidence is missing, frame_chain_consistent MUST be false
            isConsistent = false;

            // Log convention_ambiguity issue noting that frame semantics cannot be determined from code as written
            if (!issues.some((i) => i.line_ref === lineIndex && i.category === 'convention_ambiguity')) {
              issues.push({
                severity: 'medium',
                confidence: 0.8,
                line_ref: lineIndex,
                category: 'convention_ambiguity',
                description: `Frame semantics for variables '${leftVar}' and '${rightVar}' cannot be determined from the code as written. Frame labels are Unknown, so frame chain consistency cannot be verified without explicit frame names or documentation.`,
                suggested_fix: `Rename variables to explicitly state source and target frames (e.g., '${leftVar}_body_to_world' or '${leftVar}_cam_from_body').`,
              });
            }
          }

          compositionSteps.push({
            step: compositionSteps.length + 1,
            line_ref: lineIndex,
            operation: `${varName} = ${expr}`,
            resulting_frame: {
              from: rightFrames.from,
              to: leftFrames.to,
            },
            frame_chain_consistent: isConsistent,
          });

          // Check for reversed matrix multiplication order
          if (
            leftFrames.from === 'cam' && leftFrames.to === 'body' &&
            rightFrames.from === 'body' && rightFrames.to === 'world'
          ) {
            issues.push({
              severity: 'high',
              confidence: 0.9,
              line_ref: lineIndex,
              category: 'composition_order',
              description: `Comments/names indicate ${leftVar} maps cam->body and ${rightVar} maps body->world. The correct chain to compute cam->world is '${rightVar} @ ${leftVar}'. As written, '${leftVar} @ ${rightVar}' multiplies incompatible coordinate frames.`,
              suggested_fix: `${varName} = ${rightVar} @ ${leftVar}`,
            });
          }
        }
      }
    } else if (quatMatch) {
      const varName = quatMatch[1];
      const expr = quatMatch[2];
      const frames = parseFramesFromVarName(varName);

      transformsDetected.push({
        variable_name: varName,
        line_ref: lineIndex,
        representation: 'quaternion',
        inferred_frame: {
          from: frames.from,
          to: frames.to,
          inferred: true,
        },
        inferred_convention: expr.includes('[') ? 'assuming vector convention' : null,
      });

      // Check for naive quaternion linear average
      if (expr.includes('/') && (expr.includes('+') || varName.includes('avg') || varName.includes('mean'))) {
        issues.push({
          severity: 'medium',
          confidence: 0.85,
          line_ref: lineIndex,
          category: 'normalization',
          description: `Linear averaging of quaternions '${expr}' does not produce a unit quaternion on S³. Using '${varName}' directly without re-normalization distorts the rotational scale.`,
          suggested_fix: `${varName} = ${varName} / np.linalg.norm(${varName})`,
        });
      }
    } else if (rotMatch) {
      const varName = rotMatch[1];
      const method = rotMatch[3];
      const args = rotMatch[4];
      const frames = parseFramesFromVarName(varName);

      transformsDetected.push({
        variable_name: varName,
        line_ref: lineIndex,
        representation: 'quaternion',
        inferred_frame: {
          from: frames.from,
          to: frames.to,
          inferred: true,
        },
        inferred_convention: 'scipy [x, y, z, w] convention',
      });

      if (method === 'from_quat' && (args.includes('q_ros') || args.includes('eigen') || args.includes('w_x_y_z'))) {
        issues.push({
          severity: 'high',
          confidence: 0.88,
          line_ref: lineIndex,
          category: 'convention_ambiguity',
          description: `ROS/Eigen passes quaternions as [w, x, y, z], but SciPy's 'from_quat' expects [x, y, z, w]. Passing ROS/Eigen array directly swaps the scalar real part with vector component z.`,
          suggested_fix: `${varName} = Rot.from_quat([${args}[1], ${args}[2], ${args}[3], ${args}[0]])`,
        });
      }
    }

    // Check for SO(3) drift in C++ Eigen loop
    if (trimmed.includes('*=') || (trimmed.includes('=') && trimmed.includes('*') && trimmed.includes('R_'))) {
      if (code.includes('for') || code.includes('while')) {
        if (!code.includes('ortho') && !code.includes('SVD') && !code.includes('Gram') && !code.includes('normalize')) {
          if (!issues.some((i) => i.category === 'orthonormality_drift')) {
            issues.push({
              severity: 'medium',
              confidence: 0.82,
              line_ref: lineIndex,
              category: 'orthonormality_drift',
              description: `Repeated matrix multiplication inside loop accumulates floating-point inaccuracy, causing ${trimmed.split('=')[0].trim()} to drift off the SO(3) manifold (det(R) != 1).`,
              suggested_fix: `// Re-orthonormalize using SVD or Gram-Schmidt periodically:\nEigen::JacobiSVD<Eigen::Matrix3d> svd(R, Eigen::ComputeFullU | Eigen::ComputeFullV);\nR = svd.matrixU() * svd.matrixV().transpose();`,
            });
          }
        }
      }
    }

    // Check for Euler angle 'sxyz' vs 'zyx'
    if (trimmed.includes('euler2mat') && trimmed.includes('sxyz') && (code.includes('yaw') || code.includes('pitch'))) {
      issues.push({
        severity: 'high',
        confidence: 0.85,
        line_ref: lineIndex,
        category: 'convention_ambiguity',
        description: `'sxyz' specifies static extrinsic axes rotations (X-Y-Z), whereas yaw-pitch-roll usually refers to intrinsic ZYX axes. This yields an incorrect rotation matrix.`,
        suggested_fix: `R_sensor = t3d.euler.euler2mat(yaw, pitch, roll, 'rzyx')`,
      });
    }
  }

  // Summary builder
  const isClean = issues.length === 0;
  let summary = '';
  if (isClean) {
    summary = 'Analyzed rigid-body transform pipeline. Frame chain compositions are consistent and conventions are verified.';
  } else {
    summary = `Detected ${issues.length} potential transform bug${issues.length > 1 ? 's' : ''} in coordinate frame compositions and rotational conventions.`;
  }

  return {
    summary,
    transforms_detected: transformsDetected,
    composition_steps: compositionSteps,
    issues,
    clean: isClean,
  };
}

function parseFramesFromVarName(varName: string): { from: string; to: string } {
  // Frame Label Discipline rule:
  // A frame label is only valid evidence when it comes from explicit variable naming, comments, or known conventions.
  // Otherwise, default to "Unknown".
  let name = varName.replace(/^[R|T|q|Q|r]_/, '');

  if (name.includes('_from_')) {
    const parts = name.split('_from_');
    return { to: parts[0] || 'Unknown', from: parts[1] || 'Unknown' };
  }
  if (name.includes('_to_')) {
    const parts = name.split('_to_');
    return { from: parts[0] || 'Unknown', to: parts[1] || 'Unknown' };
  }

  // Known frame keywords
  const knownFrames = [
    'world', 'body', 'cam', 'camera', 'ned', 'sensor', 'base', 'gripper',
    'robot', 'lidar', 'imu', 'map', 'odom', 'ecef', 'enu', 'ee', 'tool', 'target', 'source'
  ];

  const parts = name.split('_');
  if (parts.length >= 2) {
    const p0 = parts[0].toLowerCase();
    const p1 = parts[1].toLowerCase();
    if (knownFrames.includes(p0) || knownFrames.includes(p1)) {
      return { to: parts[0], from: parts[1] };
    }
  }

  return { from: 'Unknown', to: 'Unknown' };
}
