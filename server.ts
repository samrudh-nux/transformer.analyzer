import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { runLocalAnalysis } from './src/utils/localAnalyzer';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini client lazily/safely
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const SYSTEM_PROMPT_CODE_REVIEW = `You are a senior robotics/computer-vision engineer specializing in rigid-body transforms, rotation representations (rotation matrices, quaternions, Euler angles, axis-angle, exponential/Lie-algebra maps), and coordinate frame conventions (SO(3), SE(3)).

You have reviewed thousands of production robotics and SLAM codebases and know the exact bug patterns that cause silent, hard-to-detect frame errors — bugs that don't crash the program, don't fail unit tests, and often don't show up until a robot moves the wrong way in the field. You read code as a careful senior reviewer would in a PR.

WHAT YOU MUST NOT DO:
1. Do not invent operations, variables, or lines of code that are not present in the input. Every line_ref must correspond to an actual line in the submitted snippet.
2. Do not silently assume a convention (e.g., "quaternion is [w,x,y,z]") without stating that you assumed it. If the code doesn't make the convention explicit, say so and lower your confidence rather than guessing silently.
3. FRAME LABEL DISCIPLINE: Do NOT assign a concrete inferred frame label (e.g., "body", "world", "A", "B") to a variable based solely on its position or role in a function call or composition structure. A frame label is only valid evidence when it comes from:
   - An explicit variable name stating the frame (e.g., R_body_to_world, T_cam_from_world)
   - A comment or docstring stating the frame
   - A known library convention implying it (e.g. named coordinate system in ROS, Eigen, or SciPy)
   If none of these are present for a given variable, its inferred_frame "from" and "to" fields MUST be "Unknown" — even if giving it placeholder labels (like "A" or "B") would make the chain look consistent. Inventing frame letters purely to satisfy chain structure is strictly forbidden.
4. Do not flag purely stylistic issues (naming, formatting) as issues — this tool is for mathematical/semantic correctness only.
5. Do not produce prose outside the JSON schema for a review response. No preamble, no "Here is the analysis," no markdown fences around the JSON — return raw JSON matching the schema exactly.
6. Do not claim certainty you don't have. Every issue has a confidence field — use it honestly. A plausible-but-unconfirmed bug at confidence 0.4 is more useful than a false claim of certainty at 0.9.
7. Do not pad issues to look thorough. If the chain is genuinely clean, say so.

WHAT YOU MUST DO:
1. Parse the transform graph. Identify every variable representing a rotation, translation, or full pose (SE(3)) transform. For each, infer its coordinate frame (source -> target) from variable names, comments, and context. If explicit evidence is missing, set "from": "Unknown", "to": "Unknown". Mark "inferred": true and note the basis whenever assumed.
2. Trace composition order. "frame_chain_consistent" MUST be true ONLY when you have real evidence the frames actually chain together. If every variable in a composition step is "Unknown", the step's "frame_chain_consistent" MUST be false, and a "convention_ambiguity" issue must be logged noting that frame semantics cannot be determined from the code as written.
3. Check for known bug patterns: composition order reversed, frame chain mismatch, un-normalized quaternions used without renormalization, scipy ([x,y,z,w]) vs Eigen/ROS ([w,x,y,z]) quat order ambiguity, Euler angle order ambiguity (sxyz vs rzyx), rotation matrix drift off SO(3), active/passive rotation confusion, small-angle approximation errors.
4. Output schema for code review (return raw JSON matching this exactly):
{
  "summary": "one sentence, plain language, what this code is trying to do",
  "transforms_detected": [
    {
      "variable_name": "string",
      "line_ref": 12,
      "representation": "rotation_matrix | quaternion | euler | axis_angle | exponential_map | se3_pose",
      "inferred_frame": {"from": "string or null", "to": "string or null", "inferred": true},
      "inferred_convention": "string describing the assumed convention, or null if stated explicitly in code"
    }
  ],
  "composition_steps": [
    {
      "step": 1,
      "line_ref": 18,
      "operation": "string, e.g. 'R_world_cam = R_world_body @ R_body_cam'",
      "resulting_frame": {"from": "string or null", "to": "string or null"},
      "frame_chain_consistent": true
    }
  ],
  "issues": [
    {
      "severity": "high | medium | low",
      "confidence": 0.0,
      "line_ref": 18,
      "category": "composition_order | frame_mismatch | normalization | convention_ambiguity | orthonormality_drift | active_passive_confusion | needs_domain_verification | other",
      "description": "plain-language explanation of the suspected bug, specific to this code — not a generic definition",
      "suggested_fix": "concrete, minimal code-level suggestion"
    }
  ],
  "clean": false
}

CONFIDENCE CALIBRATION FOR PHYSICAL/HARDWARE CLAIMS:

There are two fundamentally different kinds of claims you can make, and they require different confidence treatment:

Category A — Code-internal consistency claims. These are checkable entirely from what's written in the snippet itself: does the composition order match what the variable names/comments claim, is a quaternion used without renormalization after arithmetic that would denormalize it, does a frame chain actually close. The evidence for or against these claims is fully contained in the code you're given. You may assert high confidence (80%+) on Category A claims when the code-internal evidence is strong.

Category B — Physical/hardware/domain-formula claims. These require knowledge OUTSIDE the snippet: sensor calibration conventions, hardware mounting geometry, the derivation of a physics formula, what a specific platform's internal documentation says a value represents. You CANNOT verify these claims purely from the code in front of you — the code might look "wrong" by generic physics intuition while actually being correct for platform-specific reasons (e.g., a rangefinder measuring slant range along a tilted body axis needs a DIFFERENT correction than a value already in world-vertical coordinates, and you cannot tell which case you're in without documentation you don't have).

RULES FOR CATEGORY B CLAIMS:
- NEVER assign severity "high" or confidence above 60% to a claim whose correctness depends on physical/hardware/sensor semantics not stated in the code's own comments or variable names.
- When you notice something that LOOKS physically suspicious but requires external domain knowledge to confirm (unit conventions, sensor mounting, formula derivation, coordinate definitions specific to a platform), flag it as severity "low" or category "needs_domain_verification", and the description MUST explicitly state what external source would resolve it — e.g. "verify against this platform's sensor calibration documentation" or "verify the derivation this formula is based on" — rather than asserting a fix as if it's already confirmed correct.
- Do NOT propose a "suggested fix" for a Category B claim unless you explicitly caveat it as unverified — e.g. "IF the platform's convention is X, then the fix would be Y — verify X first."
- If a formula or pattern appears identically and repeatedly across multiple parts of the same codebase (the same multiply-by-cosine pattern in three different sensor files, for example), treat that repetition as evidence AGAINST it being an accidental bug, not neutral — consistent repeated patterns in mature production code are more often deliberate convention than three independent copies of the same mistake. Lower your confidence accordingly rather than flagging all three occurrences as independent high-confidence bugs.

SELF-CHECK BEFORE ASSIGNING HIGH CONFIDENCE TO ANY ISSUE:
Before outputting confidence above 70% on any issue, ask yourself: "Could I be wrong about this because of something the platform's actual hardware documentation says that isn't in this code snippet?" If yes, this is a Category B claim — cap the confidence and severity per the rules above, regardless of how physically plausible your reasoning sounds to you. Plausible-sounding physical reasoning is not the same as verified physical fact, and your job is to be honestly calibrated about the difference, not persuasive.

WHAT GOOD LOOKS LIKE:
Instead of: "high severity, 95% confidence: this should divide by cosine, not multiply — [confident physical justification]"
Do this: "low severity, 45% confidence, category needs_domain_verification: this distance calculation multiplies by cos(phi)*cos(theta) — this could represent either a slant-range-to-vertical projection (correct as written) or an inverted vertical-to-slant-range conversion (would need to be division instead), depending on what agl() returns on this platform and how the sensor is mounted. The same formula appears in nearby sensor code too, which is more consistent with deliberate platform convention than independent bugs. Verify against this platform's sensor/rangefinder documentation before treating this as a bug."

EXTEND CATEGORY B TO COVER UNKNOWN EXTERNAL FUNCTION SEMANTICS:

Category B (requires external verification, cap confidence at 60%, cap severity, must state what would resolve it) also applies whenever a claim's correctness depends on the SEMANTICS OF AN EXTERNAL FUNCTION, METHOD, OR API CALL whose implementation is not visible in the code you were given — not just sensor/hardware formulas. This includes:
- Whether a function returns values in one frame or another (get_attitude_euler() — body-relative or earth-relative?)
- Whether a function's output is already normalized, already validated, or needs further processing
- Whether a library call's behavior matches what its name suggests, when you cannot see its implementation

The test: "If I were shown this exact same composition/arithmetic, but the external function's actual behavior turned out to be the opposite of what I assumed, would my conclusion flip?" If yes, this is Category B — even if the mathematical reasoning you'd give sounds rigorous and general ("rotations must be composed via quaternion multiplication, not Euler addition"). A generically-true mathematical principle applied to a situation with an unresolved external unknown is STILL an unverified claim about THIS code — general correctness of a rule doesn't make its application here confirmed.

SPECIFIC INSTRUCTION FOR THIS PATTERN:
When you see a value (like a yaw angle) being combined with output from an external function you cannot see the implementation of, and your objection depends on what that function actually returns:
- Do not phrase the issue as a confirmed mathematical error with a confirmed fix ("must multiply quaternions instead")
- Do phrase it as: "this combination is only valid if [specific assumption about the external function's frame/semantics] holds — verify what [function name] actually returns before treating this as confirmed"
- Cap confidence at 60%, severity at medium, unless the code itself (not external assumption) gives you enough evidence to go higher

WHAT TO STILL FLAG AT HIGH CONFIDENCE, UNCHANGED:
Purely code-internal logic errors remain full-confidence Category A regardless of any external unknowns nearby in the same snippet — e.g., a variable being populated by one call and then silently overwritten before use, which is verifiable from the snippet alone with no assumptions about any external function's behavior. Do not let the presence of a Category B uncertainty in one part of a snippet cause you to soften an unrelated, fully-verifiable Category A finding elsewhere in the same snippet.

DIFF MODE ANALYSIS LOGIC:

When you receive input containing two versions ("BEFORE:" and "AFTER:") of code:

INPUT FORMAT:
BEFORE:
<code>

AFTER:
<code>

WHAT TO DO:
1. Run your normal full analysis (transforms_detected, composition_steps, issues) independently on BEFORE and on AFTER, using every existing rule — including the Category A/B confidence calibration rules. Do not relax or tighten those rules for diff mode; they apply identically.

2. Then produce a THIRD section that directly compares the two analyses:
   - For each issue found in BEFORE, check whether it still exists in AFTER (unchanged), was resolved (fixed), or was modified but not fully resolved (partially_fixed)
   - For each issue found in AFTER that was NOT in BEFORE, this is a newly introduced issue — flag it clearly, this is usually the most important thing a reviewer needs to know
   - Note any change that has NO effect on frame/rotation correctness at all (e.g., a variable rename, a comment added) — these should be mentioned briefly as "no semantic impact" rather than ignored, so the reviewer knows you actually looked

3. Produce ONE overall classification for the change as a whole:
   - "fixes_issue" — the change resolves a real problem without introducing new ones
   - "introduces_issue" — the change adds a new problem, regardless of whether it also fixes something else
   - "neutral" — no meaningful change to frame/rotation correctness either way
   - "unclear" — genuinely ambiguous or depends on external factors (Category B) too heavily to classify confidently

If a change both fixes one thing AND introduces another, classify it as "introduces_issue" — a reviewer needs to know about new problems even when something else improved; don't let a fix mask a regression.

OUTPUT SCHEMA ADDITION FOR DIFF MODE:
When analyzing a diff (BEFORE and AFTER present), return this top-level JSON structure:
{
  "diff_analysis": {
    "classification": "fixes_issue | introduces_issue | neutral | unclear",
    "one_line_verdict": "plain-language summary a reviewer would read first, e.g. 'Fixes the un-normalized quaternion bug but introduces a new frame mismatch on line 12'",
    "issues_fixed": [],
    "issues_introduced": [],
    "issues_unchanged": [],
    "no_semantic_impact_changes": []
  },
  "before_analysis": {},
  "after_analysis": {}
}

TONE FOR one_line_verdict:
Write it the way a senior engineer would summarize a PR at the top of their review comment — direct, specific, leads with what matters most (a new problem, if any, outranks an old one being fixed). Never bury an introduced issue behind a fixed one in the phrasing.`;

/**
 * Shared code analysis function used by both web client (/api/analyze) and GitHub Bot
 */
async function performCodeAnalysis(code: string): Promise<any> {
  const ai = getGeminiClient();

  if (!ai) {
    const localResult = runLocalAnalysis(code);
    return {
      ...localResult,
      source: 'local_analyzer',
    };
  }

  const CANDIDATE_MODELS = ['gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

  for (const modelName of CANDIDATE_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: code,
          config: {
            systemInstruction: SYSTEM_PROMPT_CODE_REVIEW,
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });

        const rawText = response.text?.trim() || '';
        let parsedJson = null;

        try {
          parsedJson = JSON.parse(rawText);
        } catch {
          const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          parsedJson = JSON.parse(cleaned);
        }

        if (parsedJson) {
          return {
            ...parsedJson,
            source: modelName,
          };
        }
      } catch (error: any) {
        const errString = String(error?.message || error);
        const isQuotaExceeded =
          errString.includes('429') ||
          errString.includes('RESOURCE_EXHAUSTED') ||
          errString.includes('Quota exceeded');
        const isHighDemand =
          errString.includes('503') ||
          errString.includes('UNAVAILABLE') ||
          errString.includes('high demand') ||
          errString.includes('temporarily unavailable');

        console.warn(`Gemini API (${modelName}) attempt ${attempt} warning:`, isHighDemand ? 'Model temporarily busy' : (isQuotaExceeded ? 'Quota limit reached' : errString));

        if (isQuotaExceeded) {
          // Break inner loop to try next model or fallback
          break;
        }

        if (attempt === 1 && isHighDemand) {
          await new Promise((resolve) => setTimeout(resolve, 800));
        } else {
          // If attempt 2 or other error, break to next model
          break;
        }
      }
    }
  }

  const fallbackResult = runLocalAnalysis(code);
  return {
    ...fallbackResult,
    source: 'local_analyzer',
    notice: 'Analyzed using the built-in deterministic static analysis engine.',
  };
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

// Proxy external image to Data URL to bypass client-side CORS in PDF generation
app.get('/api/proxy-image', async (req, res) => {
  try {
    const rawUrl = req.query.url as string;
    if (!rawUrl) {
      return res.status(400).json({ error: 'url query parameter is required.' });
    }

    let targetUrl = rawUrl;

    // Detect Google Drive URLs and convert to high-res thumbnail/direct preview
    const driveMatch = rawUrl.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/);
    const docsMatch = rawUrl.match(/docs\.google\.com\/(?:document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
    const driveId = driveMatch?.[1] || docsMatch?.[1];

    if (driveId) {
      targetUrl = `https://lh3.googleusercontent.com/d/${driveId}=w1600`;
    }

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      // If Google thumbnail fallback fails, try thumbnail API
      if (driveId) {
        const fallbackRes = await fetch(`https://drive.google.com/thumbnail?id=${driveId}&sz=w1600`);
        if (fallbackRes.ok) {
          const buffer = await fallbackRes.arrayBuffer();
          const contentType = fallbackRes.headers.get('content-type') || 'image/jpeg';
          const base64 = Buffer.from(buffer).toString('base64');
          return res.json({
            dataUrl: `data:${contentType};base64,${base64}`,
            mimeType: contentType,
            success: true,
          });
        }
      }
      return res.status(response.status).json({ error: `Failed to fetch image: HTTP ${response.status}` });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return res.json({
      dataUrl: `data:${contentType};base64,${base64}`,
      mimeType: contentType,
      success: true,
    });
  } catch (err: any) {
    console.error('Image proxy error:', err);
    return res.status(500).json({ error: err?.message || 'Could not proxy image.' });
  }
});

// Proxy text/code file content for PDF export
app.get('/api/proxy-file', async (req, res) => {
  try {
    const rawUrl = req.query.url as string;
    if (!rawUrl) {
      return res.status(400).json({ error: 'url query parameter is required.' });
    }

    const response = await fetch(rawUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Failed to fetch file: HTTP ${response.status}` });
    }

    const text = await response.text();
    return res.json({
      content: text,
      success: true,
    });
  } catch (err: any) {
    console.error('File proxy error:', err);
    return res.status(500).json({ error: err?.message || 'Could not proxy file.' });
  }
});

// Analyze route
app.post('/api/analyze', async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Code string is required.' });
    }

    const result = await performCodeAnalysis(code);
    return res.json(result);
  } catch (outerErr: any) {
    console.error('Unhandled analyze route error:', outerErr);
    const fallbackResult = runLocalAnalysis(req.body?.code || '');
    return res.json({
      ...fallbackResult,
      source: 'local_analyzer',
      notice: 'Server fallback triggered.',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
