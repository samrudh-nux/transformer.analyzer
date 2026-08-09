# TRANS-A.AI

**An AI-assisted semantic code reviewer for SO(3)/SE(3) rotation and coordinate-frame bugs.**

Shape-checkers like `jaxtyping` and `TensorSensor` catch dimension mismatches.
They can't catch bugs that are dimensionally valid, syntactically correct,
and *physically wrong* — a composition order flipped, a quaternion left
un-normalized, a frame silently confused with its inverse. These bugs don't
crash. They don't fail a unit test. They corrupt state estimation in
production robotics, SLAM, and autonomous systems.

This tool parses rotation/transform-heavy code, builds an explicit frame
graph, and flags exactly this class of bug — with calibrated confidence
that distinguishes what it can verify from the code alone versus what
depends on knowledge it doesn't have.

**[Live Demo](https://transformer-analyzer.vercel.app)** 

> **Best viewed on desktop.** The code editor and 3D visualization aren't
> yet optimized for small screens.

> This is an early-stage, actively-developed tool. AI-driven analysis can
> be wrong. It's built to supplement code review, not replace it — see
> [Validation](#validation--benchmarks) below for an honest account of
> where it's been right and where it's been wrong.

---

## Why this exists

Peer-reviewed research already proved this bug class is real and costly,
not hypothetical:

- **SA4U** (2021) found **14 previously undetected bugs** of this exact
  class in ArduPilot and PX4 — two of the most widely deployed open-source
  flight autopilots in the world — and correctly diagnosed 5 of 6 known
  historical bugs in the same codebases.
- **PHYSFRAME** built a static type-checker specifically for physical
  coordinate frames in ROS-based systems, based on official REP frame
  conventions.

Neither is a tool a working engineer can install and use in five minutes —
one requires building the full firmware with `libclang`, the other is a
research type system. This project is an attempt to close that gap: take
a validated real problem and make it accessible.

---

## Features

- **Semantic frame/rotation analysis** — composition order, frame chain
  consistency, quaternion normalization, orthonormality drift, active vs.
  passive rotation confusion, and convention ambiguity (Hamilton vs. JPL,
  Euler sequence assumptions)
- **Calibrated confidence, not blind confidence** — every finding is
  classified as either code-internal (verifiable from the snippet alone,
  can be asserted with high confidence) or dependent on external
  domain/hardware/API knowledge the model doesn't have (confidence and
  severity are capped, and the finding says explicitly what would need
  verifying). See [Validation](#validation--benchmarks) for how this was
  discovered and fixed.
- **Interactive 3D Frame Chain visualization** — RGB axis triads per
  frame, with well-evidenced frames rendered solid and unverified/inferred
  frames rendered dashed, so the visualization itself reflects the tool's
  own uncertainty rather than guessing confidently. Supports chain view
  and overlay view, step-through playback, and a synced info panel.
- **Diff mode** — paste a before/after pair and get a classification
  (fixes an issue / introduces an issue / neutral / unclear) plus a
  breakdown of exactly which findings changed, so a code change gets
  reviewed on its actual semantic impact, not just re-analyzed twice.
- **PDF export** — generate a shareable report of any analysis, including
  the code, full findings, and a snapshot of the 3D visualization.
- **Google and email one-time-code sign-in**, with a personal vault to
  save and organize analyzed snippets.

---

## Validation & Benchmarks

This section reports what actually happened during testing, including a
real self-correction — not a highlight reel.

### Synthetic adversarial test suite

A 7-case suite designed to test failure modes, not just catch bugs:
normalization violations, genuine convention ambiguity (where the correct
answer is "unknown," not a confident guess), orthonormality drift, active/
passive frame confusion, a no-transforms control case, and two **minimal
pairs** — identical code except for one physically meaningful change —
specifically to test whether the analyzer reasons about the underlying
physics or just pattern-matches on surface structure.

Results: the analyzer correctly discriminated both minimal pairs (e.g.
correctly flipping its verdict on an IMU integration snippet when the
angular velocity frame changed from body to world, requiring a real
understanding of why left- vs. right-multiplication matters) and
independently identified the quaternion double-cover / antipodal-sign
problem in multiple cases without being prompted to look for it.

### Real-world validation, including a documented self-correction

**ArduPilot (`AP_Camera`, issue #28113):** correctly caught a real logic
bug — a quaternion populated by `get_poi()` was immediately overwritten by
`from_euler()` before use, silently discarding the computed value — at 90%
confidence, purely from internal code logic.

**PX4 (`BlockLocalPositionEstimator::flowMeasure`):** the analyzer
initially flagged a distance calculation at **95% confidence, high
severity**, incorrectly — the formula it flagged was PX4's own deliberate,
documented design, confirmed by an explicit code comment and the same
pattern appearing consistently across three separate sensor files. This
triggered a specific fix: a rule distinguishing claims verifiable from the
code alone from claims that depend on external hardware/platform
knowledge. Re-run after the fix, the same case correctly dropped to **45%
confidence, low severity**, with an explicit "verify against platform
documentation" caveat instead of a confident wrong fix — while a separate,
genuinely valid finding in the same snippet (a missing `fabsf()` on a tilt
check) held steady at high confidence, confirming the fix was targeted,
not a blanket reduction in confidence everywhere.

The same underlying fix was then confirmed to generalize to a
structurally different case — a claim depending on the semantics of an
external function (`get_attitude_euler()`) rather than a hardware formula
— without weakening an unrelated, genuinely strong finding in the same
snippet.

### Known limitations

- Tested primarily against Python/SciPy and C++/Eigen-adjacent robotics
  code; broader language coverage is unvalidated.
- Single-snippet and diff-mode analysis only — no cross-file frame tracing
  yet.
- Confidence calibration is an ongoing process, refined by real found
  failures rather than fully solved.

---

## Tech stack

- Analysis: Google Gemini API (structured JSON schema output)
- Frontend: React, Three.js for the 3D visualization
- Backend/data: Supabase (Postgres, Auth, Row Level Security)
- PDF export: client-side generation from analysis results

---

## Getting started

```bash
# clone the repo
git clone <your-repo-url>
cd <repo-name>

# install dependencies
npm install

# set up environment variables
# SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY — see .env.example

# run locally
npm run dev
```

Fill in your own Supabase project and Gemini API key — see the schema
setup notes in `/docs` (or your own migrations folder) before first run.

---

## Roadmap

- [ ] Feedback loop on individual findings, feeding a growing regression
      test suite from real usage
- [ ] Public, browsable library of confirmed real-world bug patterns
- [ ] Cross-file frame tracing
- [ ] Broader language/framework validation (PyTorch, ROS 2 message types)

---

## Acknowledgments

The problem framing for this project is grounded in prior academic work:

- SA4U — practical static analysis for unit/frame type errors, evaluated
  against ArduPilot and PX4
- PHYSFRAME — type checking for physical frames of reference in
  ROS-based robotic systems

This project is not affiliated with either — they're cited here as the
research validating that this bug class is real, not as endorsement.

---
