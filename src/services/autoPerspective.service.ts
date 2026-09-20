/**
 * Automatic vanishing-point detection for line drawings / photos.
 *
 * Pipeline: Sobel edges → Hough transform where each edge pixel only votes for line angles
 * close to its own edge orientation → strongest lines (non-maximum suppressed) → repeatedly
 * pick the point that the most remaining lines converge on (RANSAC-style) → that is a vanishing
 * point; remove its lines and look for the next. Lines that are (almost) vertical or horizontal
 * are ignored: they are parallel to the picture plane and never converge to a finite point.
 *
 * It is a heuristic: it needs clear straight construction lines (buildings, rooms, roads, boxes)
 * and will find nothing useful in organic drawings.
 */

export interface DetectedVanishingPoint {
  /** Position in the original image/canvas pixel coordinates (may lie outside the canvas). */
  x: number;
  y: number;
  /** How many detected lines converge here. */
  support: number;
}

/** A straight line found in the drawing, with how well it agrees with the detected vanishing points. */
export interface DetectedLine {
  /** Endpoints of the part of the line that is actually drawn, in original canvas pixels. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Index into the detected points of the nearest vanishing point (−1 if there are none). */
  vp: number;
  /** Angle in degrees between this line and the direction straight at that vanishing point. */
  deviation: number;
  /** 'ok' converges; 'off' misses the vanishing point by a small angle (a likely drawing error). */
  status: 'ok' | 'off' | 'unrelated';
  weight: number;
  /** Which way to turn the line (pivoting on its base) to point at the vanishing point, as seen on screen. */
  turnClockwise: boolean;
  /** The end of the line you would pivot on (farthest from the vanishing point), in canvas pixels. */
  baseX: number;
  baseY: number;
}

interface Line {
  rho: number;
  theta: number; // radians, line normal direction: x·cosθ + y·sinθ = ρ
  weight: number;
}

const MAX_SIDE = 256;

export interface PerspectiveDetection {
  points: DetectedVanishingPoint[];
  lines: number;
  segments: DetectedLine[];
}

export function detectVanishingPoints(source: HTMLCanvasElement, background = '#ffffff'): PerspectiveDetection {
  const scale = Math.min(1, MAX_SIDE / Math.max(source.width, source.height));
  const w = Math.max(16, Math.round(source.width * scale));
  const h = Math.max(16, Math.round(source.height * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const luma = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) luma[i] = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
  return detectFromLuma(luma, w, h, 1 / scale);
}

/** Core, canvas-free implementation (testable in Node). `toOriginal` scales results back up. */
export function detectFromLuma(luma: Float32Array, w: number, h: number, toOriginal = 1): PerspectiveDetection {
  // Sobel
  const mags: number[] = [];
  const gxA = new Float32Array(w * h);
  const gyA = new Float32Array(w * h);
  const magA = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = luma[i - w + 1] + 2 * luma[i + 1] + luma[i + w + 1] - (luma[i - w - 1] + 2 * luma[i - 1] + luma[i + w - 1]);
      const gy = luma[i + w - 1] + 2 * luma[i + w] + luma[i + w + 1] - (luma[i - w - 1] + 2 * luma[i - w] + luma[i - w + 1]);
      gxA[i] = gx;
      gyA[i] = gy;
      magA[i] = Math.hypot(gx, gy);
      if (magA[i] > 0.05) mags.push(magA[i]);
    }
  }
  if (mags.length < 30) return { points: [], lines: 0, segments: [] };

  // Hough accumulator: θ in 1° steps over [0,180), ρ offset by the image diagonal.
  const diag = Math.ceil(Math.hypot(w, h));
  const rhoBins = diag * 2 + 1;
  const acc = new Float32Array(180 * rhoBins);
  const cos = new Float32Array(180);
  const sin = new Float32Array(180);
  for (let t = 0; t < 180; t++) {
    cos[t] = Math.cos((t * Math.PI) / 180);
    sin[t] = Math.sin((t * Math.PI) / 180);
  }
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const m = magA[i];
      if (m < 0.25) continue;
      // Line normal = gradient direction.
      const gdeg = ((Math.atan2(gyA[i], gxA[i]) * 180) / Math.PI + 180) % 180;
      for (let d = -4; d <= 4; d++) {
        const t = (Math.round(gdeg) + d + 180) % 180;
        const rho = Math.round(x * cos[t] + y * sin[t]) + diag;
        acc[t * rhoBins + rho] += m * (1 - Math.abs(d) / 6);
      }
    }
  }

  // Peaks with non-maximum suppression in a 9×9 (θ,ρ) neighbourhood.
  const candidates: Line[] = [];
  let maxVal = 0;
  for (let i = 0; i < acc.length; i++) if (acc[i] > maxVal) maxVal = acc[i];
  const floor = maxVal * 0.18;
  for (let t = 0; t < 180; t++) {
    for (let r = 4; r < rhoBins - 4; r++) {
      const v = acc[t * rhoBins + r];
      if (v < floor) continue;
      let isMax = true;
      for (let dt = -4; dt <= 4 && isMax; dt++) {
        for (let dr = -4; dr <= 4; dr++) {
          if (dt === 0 && dr === 0) continue;
          const tt = (t + dt + 180) % 180;
          if (acc[tt * rhoBins + r + dr] > v || (acc[tt * rhoBins + r + dr] === v && (dt < 0 || (dt === 0 && dr < 0)))) {
            isMax = false;
            break;
          }
        }
      }
      if (isMax) candidates.push({ rho: r - diag, theta: (t * Math.PI) / 180, weight: v });
    }
  }
  candidates.sort((a, b) => b.weight - a.weight);
  // Drop lines parallel to the picture plane: normals near 0°/180° (vertical lines) or 90° (horizontal lines).
  const lines = candidates
    .filter((l) => {
      const deg = (l.theta * 180) / Math.PI;
      return Math.abs(deg - 90) > 4 && Math.min(deg, 180 - deg) > 4;
    })
    .slice(0, 60);
  if (lines.length < 3) return { points: [], lines: lines.length, segments: [] };

  // Distance from point to line (normalised ρ,θ form ⇒ direct).
  const dist = (p: { x: number; y: number }, l: Line) => Math.abs(p.x * Math.cos(l.theta) + p.y * Math.sin(l.theta) - l.rho);
  const intersect = (a: Line, b: Line) => {
    const det = Math.cos(a.theta) * Math.sin(b.theta) - Math.sin(a.theta) * Math.cos(b.theta);
    if (Math.abs(det) < 0.05) return null; // near-parallel: intersection would be at infinity
    return {
      x: (a.rho * Math.sin(b.theta) - b.rho * Math.sin(a.theta)) / det,
      y: (b.rho * Math.cos(a.theta) - a.rho * Math.cos(b.theta)) / det,
    };
  };

  const points: DetectedVanishingPoint[] = [];
  const smallPoints: { x: number; y: number }[] = [];
  let remaining = lines.slice();
  const tol = Math.max(3, Math.min(w, h) * 0.02);
  // A real vanishing point explains a good share of all strong lines; in a scribble, chance
  // convergences only ever explain a small fraction.
  const minSupport = Math.max(5, Math.ceil(lines.length * 0.2));
  for (let round = 0; round < 3 && remaining.length >= 5; round++) {
    let best: { p: { x: number; y: number }; members: Line[] } | null = null;
    for (let i = 0; i < remaining.length; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        const p = intersect(remaining[i], remaining[j]);
        // Keep candidates within a few image sizes: a huge "point" is just nearly-parallel lines.
        if (!p || Math.abs(p.x) > w * 8 || Math.abs(p.y) > h * 8) continue;
        // A vanishing point candidate counts a line as converging if the line passes near it,
        // with the tolerance growing with distance to keep angular tolerance constant.
        const members = remaining.filter((l) => {
          const centre = { x: w / 2, y: h / 2 };
          const far = Math.max(1, Math.hypot(p.x - centre.x, p.y - centre.y));
          return dist(p, l) < tol * Math.max(1, far / (Math.max(w, h) * 0.5) * 0.6);
        });
        const score = members.reduce((s, l) => s + l.weight, 0);
        const bestScore = best ? best.members.reduce((s, l) => s + l.weight, 0) : 0;
        if (members.length >= minSupport && score > bestScore) best = { p, members };
      }
    }
    if (!best) break;
    // Refine: least-squares intersection of the member lines.
    let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
    for (const l of best.members) {
      const cx = Math.cos(l.theta), sy = Math.sin(l.theta);
      a11 += cx * cx; a12 += cx * sy; a22 += sy * sy;
      b1 += cx * l.rho; b2 += sy * l.rho;
    }
    const det = a11 * a22 - a12 * a12;
    const p = Math.abs(det) > 1e-6 ? { x: (a22 * b1 - a12 * b2) / det, y: (a11 * b2 - a12 * b1) / det } : best.p;
    points.push({ x: p.x * toOriginal, y: p.y * toOriginal, support: best.members.length });
    smallPoints.push(p);
    const used = new Set(best.members);
    remaining = remaining.filter((l) => !used.has(l));
  }

  // ---- classify every strong line against the vanishing points (only meaningful if we found some)
  const segments: DetectedLine[] = [];
  if (smallPoints.length > 0) {
    for (const l of lines) {
      // Refine the Hough line (1° / 1 px quantisation) with a total-least-squares fit to the edge
      // pixels that support it, keeping only the longest contiguous run so two separate
      // collinear strokes are not merged into one long "line".
      let cx = Math.cos(l.theta);
      let sy = Math.sin(l.theta);
      let rho = l.rho;
      let cluster: { x: number; y: number; t: number }[] = [];
      for (let iter = 0; iter < 3; iter++) {
        const dxl = -sy;
        const dyl = cx;
        const pts: { x: number; y: number; t: number; m: number }[] = [];
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const m = magA[y * w + x];
            if (m < 0.25) continue;
            if (Math.abs(x * cx + y * sy - rho) > (iter === 0 ? 2.2 : 1.6)) continue;
            pts.push({ x, y, t: x * dxl + y * dyl, m });
          }
        }
        if (pts.length < 6) {
          cluster = [];
          break;
        }
        pts.sort((p1, p2) => p1.t - p2.t);
        let bestRun: typeof pts = [];
        let bestMass = 0;
        let run: typeof pts = [pts[0]];
        const close = (run2: typeof pts) => {
          const mass = run2.reduce((acc, q) => acc + q.m, 0);
          if (mass > bestMass) {
            bestMass = mass;
            bestRun = run2;
          }
        };
        for (let i = 1; i < pts.length; i++) {
          if (pts[i].t - pts[i - 1].t > 6) {
            close(run);
            run = [];
          }
          run.push(pts[i]);
        }
        close(run);
        cluster = bestRun;
        // total least squares on the run
        let mx = 0, my = 0;
        for (const q of cluster) { mx += q.x; my += q.y; }
        mx /= cluster.length; my /= cluster.length;
        let sxx = 0, sxy = 0, syy = 0;
        for (const q of cluster) { const ux = q.x - mx, uy = q.y - my; sxx += ux * ux; sxy += ux * uy; syy += uy * uy; }
        const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy); // direction of the principal axis
        const ndx = Math.cos(ang), ndy = Math.sin(ang);
        // normal form: normal = (−ndy, ndx)
        cx = -ndy;
        sy = ndx;
        if (cx < 0 || (cx === 0 && sy < 0)) { cx = -cx; sy = -sy; }
        rho = mx * cx + my * sy;
      }
      if (cluster.length < 6) continue;
      const dxl = -sy;
      const dyl = cx;
      let tMin = Infinity, tMax = -Infinity;
      for (const q of cluster) {
        const t = q.x * dxl + q.y * dyl;
        if (t < tMin) tMin = t;
        if (t > tMax) tMax = t;
      }
      if (!(tMax - tMin > 8)) continue;
      const ox = cx * rho;
      const oy = sy * rho;
      const mxp = ox + dxl * ((tMin + tMax) / 2);
      const myp = oy + dyl * ((tMin + tMax) / 2);
      // Deviation = how far the line must turn, pivoting on its end farthest from the vanishing
      // point (where you'd start the stroke), to aim exactly at it.
      const ex1 = ox + dxl * tMin, ey1 = oy + dyl * tMin, ex2 = ox + dxl * tMax, ey2 = oy + dyl * tMax;
      let bestVp = 0;
      let bestDev = Infinity;
      let bestCw = true;
      let bestBase = { x: ex1, y: ey1 };
      smallPoints.forEach((vp, i) => {
        const d1 = Math.hypot(vp.x - ex1, vp.y - ey1);
        const d2 = Math.hypot(vp.x - ex2, vp.y - ey2);
        const [bx, by, dist0] = d1 > d2 ? [ex1, ey1, d1] : [ex2, ey2, d2];
        const [ox2, oy2] = d1 > d2 ? [ex2, ey2] : [ex1, ey1];
        const vx = (vp.x - bx) / Math.max(1e-6, dist0);
        const vy = (vp.y - by) / Math.max(1e-6, dist0);
        const dev = (Math.acos(Math.min(1, Math.abs(vx * dxl + vy * dyl))) * 180) / Math.PI;
        if (dev < bestDev) {
          bestDev = dev;
          bestVp = i;
          // line direction (base → other end) versus the direction base → vanishing point
          bestCw = (ox2 - bx) * vy - (oy2 - by) * vx > 0;
          bestBase = { x: bx, y: by };
        }
      });
      // Skip near-duplicates (Hough often reports one stroke twice).
      const dup = segments.some((q) => {
        const qx = (q.x1 + q.x2) / 2 / toOriginal, qy = (q.y1 + q.y2) / 2 / toOriginal;
        return Math.abs(qx * cx + qy * sy - rho) < 4 && Math.hypot(qx - mxp, qy - myp) < Math.hypot(ex2 - ex1, ey2 - ey1) * 0.6 + 4;
      });
      if (dup) continue;
      segments.push({
        x1: (ox + dxl * tMin) * toOriginal,
        y1: (oy + dyl * tMin) * toOriginal,
        x2: (ox + dxl * tMax) * toOriginal,
        y2: (oy + dyl * tMax) * toOriginal,
        vp: bestVp,
        deviation: bestDev,
        status: bestDev < 2 ? 'ok' : bestDev <= 20 ? 'off' : 'unrelated',
        weight: l.weight,
        turnClockwise: bestCw,
        baseX: bestBase.x * toOriginal,
        baseY: bestBase.y * toOriginal,
      });
    }
  }
  return { points, lines: lines.length, segments };
}
