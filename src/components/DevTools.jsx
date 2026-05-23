import React, { useState, useEffect, useRef, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════════
   DevTools — Universal in-game element inspector & tweaker
   Toggle with Ctrl+Shift+D. Works on any screen.
   Remove by deleting the <DevTools /> import from Game.jsx.
   ═══════════════════════════════════════════════════════════════════ */

const PANEL_Z = 99999;
const HIGHLIGHT_Z = 99998;

// ─── Sub-components ─────────────────────────────────────────────
function Slider({ label, value, min, max, step = 1, unit = 'px', onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
      <span style={{ width: 70, color: '#aaa', flexShrink: 0 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ flex: 1, height: 12, accentColor: '#44ff88' }} />
      <span style={{ width: 52, textAlign: 'right', color: '#44ff88', fontWeight: 'bold', flexShrink: 0 }}>
        {typeof value === 'number' ? (step < 1 ? value.toFixed(2) : value) : value}{unit}
      </span>
    </div>
  );
}

function Section({ title, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ borderTop: '1px solid #333', paddingTop: 6, marginTop: 4 }}>
      <div onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer', fontSize: 10, fontWeight: 'bold', color: '#44ff88', letterSpacing: 1, marginBottom: open ? 6 : 0, userSelect: 'none' }}>
        {open ? '▼' : '▶'} {title}
      </div>
      {open && <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>}
    </div>
  );
}

// ─── Mesh Warp System ───────────────────────────────────────────
const WARP_MODES = { simple: 2, medium: 3, detailed: 4, fine: 5 };
const WARP_LABELS = { simple: 'Simple (4pt)', medium: 'Medium (9pt)', detailed: 'Detailed (16pt)', fine: 'Fine (25pt)' };

// Generate default grid points for NxN grid (normalized 0-1)
function makeGrid(n) {
  const pts = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const nx = c / (n - 1), ny = r / (n - 1);
      const isCorner = (r === 0 || r === n - 1) && (c === 0 || c === n - 1);
      const isEdge = !isCorner && (r === 0 || r === n - 1 || c === 0 || c === n - 1);
      pts.push({ id: `${r}_${c}`, r, c, nx, ny, dx: 0, dy: 0, type: isCorner ? 'corner' : isEdge ? 'edge' : 'interior' });
    }
  }
  return pts;
}

// Bilinear interpolation of displacement at (px, py) from grid points
function interpolateDisplacement(px, py, grid, n) {
  // Find grid cell
  const cellW = 1 / (n - 1), cellH = 1 / (n - 1);
  const gc = Math.min(Math.floor(px / cellW), n - 2);
  const gr = Math.min(Math.floor(py / cellH), n - 2);
  const lx = (px - gc * cellW) / cellW;
  const ly = (py - gr * cellH) / cellH;
  // 4 surrounding points
  const tl = grid[gr * n + gc], tr = grid[gr * n + gc + 1];
  const bl = grid[(gr + 1) * n + gc], br = grid[(gr + 1) * n + gc + 1];
  if (!tl || !tr || !bl || !br) return [0, 0];
  const dx = tl.dx * (1 - lx) * (1 - ly) + tr.dx * lx * (1 - ly) + bl.dx * (1 - lx) * ly + br.dx * lx * ly;
  const dy = tl.dy * (1 - lx) * (1 - ly) + tr.dy * lx * (1 - ly) + bl.dy * (1 - lx) * ly + br.dy * lx * ly;
  return [dx, dy];
}

// Apply bezier smoothing to edge points
function snapToCurve(grid, n) {
  const smoothed = grid.map(p => ({ ...p }));
  // For each edge, smooth the intermediate points using cubic interpolation from corners
  const edges = [
    { fixed: 'r', val: 0, vary: 'c' },       // top edge
    { fixed: 'r', val: n - 1, vary: 'c' },    // bottom edge
    { fixed: 'c', val: 0, vary: 'r' },         // left edge
    { fixed: 'c', val: n - 1, vary: 'r' },     // right edge
  ];
  edges.forEach(({ fixed, val, vary }) => {
    const edgePts = smoothed.filter(p => p[fixed] === val).sort((a, b) => a[vary] - b[vary]);
    if (edgePts.length <= 2) return;
    const first = edgePts[0], last = edgePts[edgePts.length - 1];
    for (let i = 1; i < edgePts.length - 1; i++) {
      const t = i / (edgePts.length - 1);
      // Catmull-Rom-ish smoothing: weighted average pulling toward a curve
      const avgDx = first.dx * (1 - t) + last.dx * t;
      const avgDy = first.dy * (1 - t) + last.dy * t;
      // Blend 60% original, 40% smoothed interpolation
      edgePts[i].dx = edgePts[i].dx * 0.6 + avgDx * 0.4;
      edgePts[i].dy = edgePts[i].dy * 0.6 + avgDy * 0.4;
    }
  });
  // Smooth interior points toward their neighbors
  for (let iter = 0; iter < 2; iter++) {
    for (const p of smoothed) {
      if (p.type !== 'interior') continue;
      const neighbors = smoothed.filter(q => Math.abs(q.r - p.r) + Math.abs(q.c - p.c) === 1);
      if (neighbors.length === 0) continue;
      const avgDx = neighbors.reduce((s, q) => s + q.dx, 0) / neighbors.length;
      const avgDy = neighbors.reduce((s, q) => s + q.dy, 0) / neighbors.length;
      p.dx = p.dx * 0.5 + avgDx * 0.5;
      p.dy = p.dy * 0.5 + avgDy * 0.5;
    }
  }
  return smoothed;
}

// Generate displacement map canvas from grid
function generateDisplacementMap(grid, n, width, height, scale) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  const d = imgData.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x / (width - 1), py = y / (height - 1);
      const [dx, dy] = interpolateDisplacement(px, py, grid, n);
      const idx = (y * width + x) * 4;
      // R = horizontal displacement, G = vertical, 128 = neutral
      d[idx] = Math.max(0, Math.min(255, 128 + dx * scale));
      d[idx + 1] = Math.max(0, Math.min(255, 128 + dy * scale));
      d[idx + 2] = 128;
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL();
}

// ─── Default adjustments ────────────────────────────────────────
const DEFAULT_ADJ = {
  x: 0, y: 0, w: 0, h: 0, scale: 1, rotation: 0, opacity: 1,
  perspective: 800, rotateX: 0, rotateY: 0, skewX: 0, skewY: 0,
  marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
  paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
  warpMode: 'simple',
  warpGrid: makeGrid(2), // 2x2 = 4 corners
};

function getElId(el) {
  const tag = el.tagName.toLowerCase();
  const cls = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
  const id = el.id ? '#' + el.id : '';
  return `${tag}${id}${cls}`;
}

// ─── SVG filter ID management ───────────────────────────────────
let filterCounter = 0;

// ═══════════════════════════════════════════════════════════════════
export default function DevTools({ externalActivate, onActivateConsumed }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (externalActivate) {
      setActive(true);
      if (onActivateConsumed) onActivateConsumed();
    }
  }, [externalActivate]);

  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [adj, setAdj] = useState({ ...DEFAULT_ADJ });
  const [history, setHistory] = useState([]);
  const [showGrid, setShowGrid] = useState(false);
  const [showRulers, setShowRulers] = useState(false);
  const [elInfo, setElInfo] = useState(null);
  const origStylesRef = useRef(new Map());
  const initialAdjRef = useRef(null);
  const highlightRef = useRef(null);
  const panelRef = useRef(null);
  const filterIdRef = useRef(`devtools-warp-${++filterCounter}`);
  const dispMapRef = useRef(null); // current displacement map data URL

  // Toggle dev mode
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') { e.preventDefault(); setActive(a => !a); }
      if (e.key === 'Escape' && active && selected) { e.preventDefault(); e.stopPropagation(); setSelected(null); setAdj({ ...DEFAULT_ADJ }); }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [active, selected]);

  // Deactivate: restore non-locked elements and cleanup SVG filter
  useEffect(() => {
    if (!active) {
      setHovered(null); setSelected(null); setAdj({ ...DEFAULT_ADJ });
      origStylesRef.current.forEach((origCss, el) => {
        const locked = history.find(h => h.el === el && h.locked);
        if (!locked) { try { el.style.cssText = origCss; el.style.filter = ''; } catch (_) {} }
      });
      const svgEl = document.getElementById('devtools-svg-filters');
      if (svgEl) svgEl.remove();
    }
  }, [active, history]);

  // Element info
  useEffect(() => {
    if (!selected) { setElInfo(null); return; }
    const cs = window.getComputedStyle(selected);
    const rect = selected.getBoundingClientRect();
    setElInfo({ tag: selected.tagName.toLowerCase(), id: selected.id || '', classes: (typeof selected.className === 'string' ? selected.className : '').trim().split(/\s+/).filter(Boolean), width: Math.round(rect.width), height: Math.round(rect.height), position: cs.position, transform: cs.transform === 'none' ? 'none' : cs.transform.slice(0, 40) + '...', opacity: cs.opacity });
  }, [selected, adj]);

  // Apply adjustments + warp filter to selected element
  useEffect(() => {
    if (!selected) return;
    if (!origStylesRef.current.has(selected)) origStylesRef.current.set(selected, selected.style.cssText);
    const s = selected.style;
    s.position = 'relative';

    const transforms = [];
    if (adj.x !== 0 || adj.y !== 0) transforms.push(`translate(${adj.x}px, ${adj.y}px)`);
    if (adj.scale !== 1) transforms.push(`scale(${adj.scale})`);
    if (adj.rotation !== 0) transforms.push(`rotate(${adj.rotation}deg)`);
    if (adj.rotateX !== 0) transforms.push(`rotateX(${adj.rotateX}deg)`);
    if (adj.rotateY !== 0) transforms.push(`rotateY(${adj.rotateY}deg)`);
    if (adj.skewX !== 0 || adj.skewY !== 0) transforms.push(`skew(${adj.skewX}deg, ${adj.skewY}deg)`);
    s.transform = transforms.length > 0 ? transforms.join(' ') : '';
    if (adj.perspective !== 800) s.perspective = `${adj.perspective}px`;
    s.opacity = adj.opacity;
    if (adj.w > 0) s.width = `${adj.w}px`;
    if (adj.h > 0) s.height = `${adj.h}px`;
    if (adj.marginTop || adj.marginRight || adj.marginBottom || adj.marginLeft) s.margin = `${adj.marginTop}px ${adj.marginRight}px ${adj.marginBottom}px ${adj.marginLeft}px`;
    if (adj.paddingTop || adj.paddingRight || adj.paddingBottom || adj.paddingLeft) s.padding = `${adj.paddingTop}px ${adj.paddingRight}px ${adj.paddingBottom}px ${adj.paddingLeft}px`;

    // Warp: generate displacement map and apply SVG filter
    const hasWarp = adj.warpGrid.some(p => p.dx !== 0 || p.dy !== 0);
    if (hasWarp) {
      const n = WARP_MODES[adj.warpMode];
      const rect = selected.getBoundingClientRect();
      // Generate displacement map at reduced resolution for performance
      const mapW = Math.min(Math.round(rect.width), 256);
      const mapH = Math.min(Math.round(rect.height), 256);
      const dataUrl = generateDisplacementMap(adj.warpGrid, n, mapW, mapH, 2.0);
      dispMapRef.current = dataUrl;
      // Update SVG filter
      const filterId = filterIdRef.current;
      let svgEl = document.getElementById('devtools-svg-filters');
      if (!svgEl) {
        svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgEl.id = 'devtools-svg-filters';
        svgEl.setAttribute('width', '0');
        svgEl.setAttribute('height', '0');
        svgEl.style.position = 'absolute';
        document.body.appendChild(svgEl);
      }
      // Max displacement in pixels
      const maxDisp = Math.max(rect.width, rect.height) * 0.5;
      svgEl.innerHTML = `<filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB"><feImage href="${dataUrl}" result="dispMap" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none"/><feDisplacementMap in="SourceGraphic" in2="dispMap" xChannelSelector="R" yChannelSelector="G" scale="${maxDisp}" result="warped"/></filter>`;
      s.filter = `url(#${filterId})`;
    } else {
      s.filter = '';
      dispMapRef.current = null;
    }
  }, [adj, selected]);

  // Hover & click tracking
  useEffect(() => {
    if (!active) return;
    const onMove = (e) => {
      if (panelRef.current?.contains(e.target)) { setHovered(null); return; }
      if (highlightRef.current?.contains(e.target)) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && !panelRef.current?.contains(el)) setHovered(el);
    };
    const onClick = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      if (highlightRef.current?.contains(e.target)) return;
      e.preventDefault(); e.stopPropagation();
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || panelRef.current?.contains(el)) return;

      // Save current to history if modified
      if (selected && selected !== el) {
        const isModified = initialAdjRef.current && JSON.stringify(adj) !== JSON.stringify(initialAdjRef.current);
        if (isModified) {
          setHistory(prev => {
            const existing = prev.findIndex(h => h.el === selected);
            const entry = { elId: getElId(selected), adj: { ...adj }, el: selected, locked: existing >= 0 ? prev[existing].locked : false };
            if (existing >= 0) { const n = [...prev]; n[existing] = entry; return n; }
            return [...prev, entry];
          });
          const isLocked = history.find(h => h.el === selected && h.locked);
          if (!isLocked) {
            const orig = origStylesRef.current.get(selected);
            if (orig !== undefined) try { selected.style.cssText = orig; selected.style.filter = ''; } catch (_) {}
          }
        }
      }

      const existing = history.find(h => h.el === el);
      if (existing) {
        const restored = { ...existing.adj };
        setAdj(restored);
        initialAdjRef.current = { ...restored };
      } else {
        const rect = el.getBoundingClientRect();
        const fresh = { ...DEFAULT_ADJ, w: Math.round(rect.width), h: Math.round(rect.height), warpGrid: makeGrid(WARP_MODES[DEFAULT_ADJ.warpMode]) };
        setAdj(fresh);
        initialAdjRef.current = { ...fresh };
      }
      setSelected(el);
    };
    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('click', onClick, true);
    return () => { window.removeEventListener('mousemove', onMove, true); window.removeEventListener('click', onClick, true); };
  }, [active, selected, adj, history]);

  // Helpers
  const set = useCallback((key, val) => setAdj(a => ({ ...a, [key]: val })), []);

  const setWarpPoint = useCallback((ptId, dx, dy) => {
    setAdj(a => ({ ...a, warpGrid: a.warpGrid.map(p => p.id === ptId ? { ...p, dx, dy } : p) }));
  }, []);

  const changeWarpMode = useCallback((mode) => {
    const n = WARP_MODES[mode];
    const newGrid = makeGrid(n);
    // Carry over displacements from old grid by interpolation
    setAdj(a => {
      const oldN = WARP_MODES[a.warpMode];
      const oldGrid = a.warpGrid;
      const hasOldWarp = oldGrid.some(p => p.dx !== 0 || p.dy !== 0);
      if (hasOldWarp && oldN !== n) {
        newGrid.forEach(p => {
          const [dx, dy] = interpolateDisplacement(p.nx, p.ny, oldGrid, oldN);
          p.dx = dx; p.dy = dy;
        });
      }
      return { ...a, warpMode: mode, warpGrid: newGrid };
    });
  }, []);

  const doSnapToCurve = useCallback(() => {
    setAdj(a => {
      const n = WARP_MODES[a.warpMode];
      return { ...a, warpGrid: snapToCurve(a.warpGrid, n) };
    });
  }, []);

  const resetWarp = useCallback(() => {
    setAdj(a => ({ ...a, warpGrid: makeGrid(WARP_MODES[a.warpMode]) }));
  }, []);

  const copyCSS = () => {
    const lines = [];
    if (adj.x || adj.y) lines.push(`  transform: translate(${adj.x}px, ${adj.y}px);`);
    if (adj.scale !== 1) lines.push(`  transform: scale(${adj.scale});`);
    if (adj.rotation) lines.push(`  transform: rotate(${adj.rotation}deg);`);
    if (adj.opacity !== 1) lines.push(`  opacity: ${adj.opacity};`);
    if (adj.w) lines.push(`  width: ${adj.w}px;`);
    if (adj.h) lines.push(`  height: ${adj.h}px;`);
    if (adj.perspective !== 800) lines.push(`  perspective: ${adj.perspective}px;`);
    if (adj.rotateX) lines.push(`  /* rotateX: ${adj.rotateX}deg */`);
    if (adj.rotateY) lines.push(`  /* rotateY: ${adj.rotateY}deg */`);
    if (adj.skewX || adj.skewY) lines.push(`  transform: skew(${adj.skewX}deg, ${adj.skewY}deg);`);
    ['marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].forEach(k => {
      if (adj[k]) lines.push(`  ${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${adj[k]}px;`);
    });
    // Warp filter
    const hasWarp = adj.warpGrid.some(p => p.dx !== 0 || p.dy !== 0);
    if (hasWarp && dispMapRef.current) {
      lines.push(`  /* Mesh warp: ${adj.warpMode} mode, ${adj.warpGrid.length} points */`);
      lines.push(`  filter: url(#${filterIdRef.current});`);
      lines.push(`  /* Displacement map (base64): ${dispMapRef.current.slice(0, 60)}... */`);
      lines.push(`  /* Embed this SVG filter in your HTML for the warp to work */`);
    }
    const css = `/* ${getElId(selected)} */\n{\n${lines.join('\n')}\n}`;
    navigator.clipboard?.writeText(css);
  };

  const copyJSON = () => {
    const clean = {};
    Object.entries(adj).forEach(([k, v]) => {
      if (k === 'warpGrid') {
        const movedPts = v.filter(p => p.dx !== 0 || p.dy !== 0);
        if (movedPts.length > 0) clean.warpGrid = movedPts.map(p => ({ id: p.id, dx: Math.round(p.dx * 10) / 10, dy: Math.round(p.dy * 10) / 10 }));
        return;
      }
      if (JSON.stringify(v) !== JSON.stringify(DEFAULT_ADJ[k])) clean[k] = v;
    });
    navigator.clipboard?.writeText(JSON.stringify({ element: getElId(selected), ...clean }, null, 2));
  };

  const resetEl = () => {
    if (selected && origStylesRef.current.has(selected)) { selected.style.cssText = origStylesRef.current.get(selected); selected.style.filter = ''; }
    const rect = selected?.getBoundingClientRect();
    setAdj({ ...DEFAULT_ADJ, w: rect ? Math.round(rect.width) : 0, h: rect ? Math.round(rect.height) : 0, warpGrid: makeGrid(WARP_MODES[DEFAULT_ADJ.warpMode]) });
  };

  const toggleLock = (idx) => {
    setHistory(prev => {
      const n = [...prev];
      n[idx] = { ...n[idx], locked: !n[idx].locked };
      if (n[idx].locked === false) {
        const orig = origStylesRef.current.get(n[idx].el);
        if (orig !== undefined) try { n[idx].el.style.cssText = orig; n[idx].el.style.filter = ''; } catch (_) {}
      } else {
        // Re-apply — simplified, just re-select to trigger effect
        const el = n[idx].el;
        const a = n[idx].adj;
        if (!origStylesRef.current.has(el)) origStylesRef.current.set(el, el.style.cssText);
        const s = el.style;
        s.position = 'relative';
        const transforms = [];
        if (a.x || a.y) transforms.push(`translate(${a.x}px, ${a.y}px)`);
        if (a.scale !== 1) transforms.push(`scale(${a.scale})`);
        if (a.rotation) transforms.push(`rotate(${a.rotation}deg)`);
        if (a.rotateX) transforms.push(`rotateX(${a.rotateX}deg)`);
        if (a.rotateY) transforms.push(`rotateY(${a.rotateY}deg)`);
        if (a.skewX || a.skewY) transforms.push(`skew(${a.skewX}deg, ${a.skewY}deg)`);
        s.transform = transforms.join(' ') || '';
        s.opacity = a.opacity;
        if (a.w) s.width = `${a.w}px`;
        if (a.h) s.height = `${a.h}px`;
      }
      return n;
    });
  };

  const reselect = (entry) => { setAdj({ ...entry.adj }); setSelected(entry.el); };
  const restoreFromHistory = (idx) => {
    const entry = history[idx];
    const orig = origStylesRef.current.get(entry.el);
    if (orig !== undefined) try { entry.el.style.cssText = orig; entry.el.style.filter = ''; } catch (_) {}
    setHistory(prev => prev.filter((_, i) => i !== idx));
    if (selected === entry.el) { setSelected(null); setAdj({ ...DEFAULT_ADJ }); }
  };

  if (!active) return null;

  const hovRect = hovered && hovered !== selected ? hovered.getBoundingClientRect() : null;
  const selRect = selected ? selected.getBoundingClientRect() : null;

  // Warp grid points positioned over the selected element
  const warpHandles = selected && selRect ? adj.warpGrid.map(p => ({
    ...p,
    screenX: selRect.left + p.nx * selRect.width + p.dx,
    screenY: selRect.top + p.ny * selRect.height + p.dy,
    color: p.type === 'corner' ? '#ff4444' : p.type === 'edge' ? '#ffcc00' : '#44ff88',
  })) : [];

  const btnStyle = { padding: '4px 10px', fontSize: 9, fontWeight: 'bold', background: 'rgba(68,255,136,0.1)', border: '1px solid #44ff8844', borderRadius: 3, color: '#44ff88', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 0.5 };

  return (
    <>
      {/* DEV MODE badge */}
      <div style={{ position: 'fixed', top: 6, left: 6, zIndex: PANEL_Z + 1, padding: '3px 10px', background: 'rgba(0,0,0,0.85)', border: '1px solid #44ff88', borderRadius: 3, fontSize: 10, fontWeight: 'bold', color: '#44ff88', letterSpacing: 2, pointerEvents: 'none', fontFamily: "'Share Tech Mono', monospace" }}>DEV MODE</div>

      {/* Hover highlight */}
      {hovRect && <div ref={highlightRef} style={{ position: 'fixed', left: hovRect.left - 2, top: hovRect.top - 2, width: hovRect.width + 4, height: hovRect.height + 4, border: '2px solid rgba(68,255,136,0.6)', borderRadius: 2, pointerEvents: 'none', zIndex: HIGHLIGHT_Z, boxShadow: '0 0 8px rgba(68,255,136,0.3)' }} />}

      {/* Selected highlight */}
      {selRect && <div style={{ position: 'fixed', left: selRect.left - 2, top: selRect.top - 2, width: selRect.width + 4, height: selRect.height + 4, border: '2px solid #ff8844', borderRadius: 2, pointerEvents: 'none', zIndex: HIGHLIGHT_Z, boxShadow: '0 0 12px rgba(255,136,68,0.4)' }} />}

      {/* Warp grid handles */}
      {warpHandles.map(p => (
        <div key={p.id}
          style={{ position: 'fixed', left: p.screenX - 5, top: p.screenY - 5, width: 10, height: 10, background: p.color, border: '1.5px solid #fff', borderRadius: '50%', cursor: 'move', zIndex: PANEL_Z, boxShadow: `0 0 4px ${p.color}88`, opacity: 0.9 }}
          title={`${p.id} (${Math.round(p.dx)}, ${Math.round(p.dy)})`}
          onMouseDown={(e) => {
            e.preventDefault(); e.stopPropagation();
            const startX = e.clientX, startY = e.clientY;
            const startDx = p.dx, startDy = p.dy;
            const onMove = (ev) => setWarpPoint(p.id, startDx + ev.clientX - startX, startDy + ev.clientY - startY);
            const onUp = () => { window.removeEventListener('mousemove', onMove, true); window.removeEventListener('mouseup', onUp, true); };
            window.addEventListener('mousemove', onMove, true);
            window.addEventListener('mouseup', onUp, true);
          }}
        />
      ))}

      {/* Warp grid lines (connect adjacent points) */}
      {selected && selRect && (() => {
        const n = WARP_MODES[adj.warpMode];
        const lines = [];
        adj.warpGrid.forEach(p => {
          // Right neighbor
          if (p.c < n - 1) {
            const right = adj.warpGrid.find(q => q.r === p.r && q.c === p.c + 1);
            if (right) lines.push({ x1: selRect.left + p.nx * selRect.width + p.dx, y1: selRect.top + p.ny * selRect.height + p.dy, x2: selRect.left + right.nx * selRect.width + right.dx, y2: selRect.top + right.ny * selRect.height + right.dy });
          }
          // Bottom neighbor
          if (p.r < n - 1) {
            const below = adj.warpGrid.find(q => q.r === p.r + 1 && q.c === p.c);
            if (below) lines.push({ x1: selRect.left + p.nx * selRect.width + p.dx, y1: selRect.top + p.ny * selRect.height + p.dy, x2: selRect.left + below.nx * selRect.width + below.dx, y2: selRect.top + below.ny * selRect.height + below.dy });
          }
        });
        return (
          <svg style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: HIGHLIGHT_Z }}>
            {lines.map((l, i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />)}
          </svg>
        );
      })()}

      {/* Grid overlay */}
      {showGrid && <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: HIGHLIGHT_Z - 1, backgroundImage: 'repeating-linear-gradient(0deg, rgba(68,255,136,0.08) 0px, rgba(68,255,136,0.08) 1px, transparent 1px, transparent 50px), repeating-linear-gradient(90deg, rgba(68,255,136,0.08) 0px, rgba(68,255,136,0.08) 1px, transparent 1px, transparent 50px)' }} />}

      {/* Rulers */}
      {showRulers && (<>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 20, background: 'rgba(0,0,0,0.8)', zIndex: PANEL_Z - 1, display: 'flex', alignItems: 'flex-end', pointerEvents: 'none' }}>
          {Array.from({ length: Math.ceil(window.innerWidth / 100) }, (_, i) => <div key={i} style={{ position: 'absolute', left: i * 100, bottom: 0, fontSize: 8, color: '#44ff88', borderLeft: '1px solid #44ff8844', height: '100%', paddingLeft: 2, display: 'flex', alignItems: 'flex-end' }}>{i * 100}</div>)}
        </div>
        <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: 20, background: 'rgba(0,0,0,0.8)', zIndex: PANEL_Z - 1, pointerEvents: 'none' }}>
          {Array.from({ length: Math.ceil(window.innerHeight / 100) }, (_, i) => <div key={i} style={{ position: 'absolute', top: i * 100, left: 0, fontSize: 8, color: '#44ff88', borderTop: '1px solid #44ff8844', width: '100%', paddingTop: 1, paddingLeft: 2 }}>{i * 100}</div>)}
        </div>
      </>)}

      {/* Control panel */}
      <div ref={panelRef} style={{ position: 'fixed', top: 30, left: 6, width: 320, maxHeight: 'calc(100vh - 50px)', overflowY: 'auto', overflowX: 'hidden', background: 'linear-gradient(180deg, rgba(10,10,10,0.96) 0%, rgba(5,5,5,0.98) 100%)', border: '1px solid #44ff8844', borderRadius: 6, padding: 12, zIndex: PANEL_Z, fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#ccc', boxShadow: '0 4px 24px rgba(0,0,0,0.8)', scrollbarWidth: 'thin', scrollbarColor: '#44ff8844 transparent' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 'bold', color: '#44ff88', letterSpacing: 1 }}>ELEMENT INSPECTOR</span>
          <button onClick={() => setActive(false)} style={{ ...btnStyle, color: '#ff6644', borderColor: '#ff664444' }}>EXIT DEV MODE</button>
        </div>

        {!selected ? (
          <div style={{ padding: 12, textAlign: 'center', opacity: 0.5, fontSize: 11 }}>Click any element to select it</div>
        ) : (<>
          {/* Element info */}
          {elInfo && (
            <div style={{ background: 'rgba(68,255,136,0.05)', border: '1px solid #44ff8822', borderRadius: 4, padding: 8, marginBottom: 8, fontSize: 9, lineHeight: 1.6 }}>
              <div><span style={{ color: '#888' }}>Tag:</span> <span style={{ color: '#ff8844' }}>&lt;{elInfo.tag}&gt;</span>{elInfo.id && <span style={{ color: '#44aaff' }}>{elInfo.id}</span>}</div>
              {elInfo.classes.length > 0 && <div><span style={{ color: '#888' }}>Class:</span> <span style={{ color: '#aa88ff' }}>{elInfo.classes.join(' ')}</span></div>}
              <div><span style={{ color: '#888' }}>Size:</span> {elInfo.width} x {elInfo.height}px</div>
              <div><span style={{ color: '#888' }}>Position:</span> {elInfo.position} <span style={{ color: '#888' }}>Opacity:</span> {elInfo.opacity}</div>
            </div>
          )}

          <Section title="POSITION & SIZE">
            <Slider label="X offset" value={adj.x} min={-500} max={500} unit="px" onChange={v => set('x', v)} />
            <Slider label="Y offset" value={adj.y} min={-500} max={500} unit="px" onChange={v => set('y', v)} />
            <Slider label="Width" value={adj.w} min={10} max={2000} unit="px" onChange={v => set('w', v)} />
            <Slider label="Height" value={adj.h} min={10} max={2000} unit="px" onChange={v => set('h', v)} />
            <Slider label="Scale" value={adj.scale} min={0.1} max={3} step={0.05} unit="x" onChange={v => set('scale', v)} />
            <Slider label="Rotation" value={adj.rotation} min={0} max={360} unit="°" onChange={v => set('rotation', v)} />
            <Slider label="Opacity" value={adj.opacity} min={0} max={1} step={0.05} unit="" onChange={v => set('opacity', v)} />
          </Section>

          <Section title="PERSPECTIVE & WARP">
            <Slider label="Perspective" value={adj.perspective} min={100} max={2000} unit="px" onChange={v => set('perspective', v)} />
            <Slider label="RotateX" value={adj.rotateX} min={-60} max={60} unit="°" onChange={v => set('rotateX', v)} />
            <Slider label="RotateY" value={adj.rotateY} min={-60} max={60} unit="°" onChange={v => set('rotateY', v)} />
            <Slider label="SkewX" value={adj.skewX} min={-30} max={30} unit="°" onChange={v => set('skewX', v)} />
            <Slider label="SkewY" value={adj.skewY} min={-30} max={30} unit="°" onChange={v => set('skewY', v)} />
          </Section>

          {/* ���── MESH WARP ─── */}
          <Section title={`MESH WARP (${adj.warpGrid.length}pt)`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ color: '#aaa', fontSize: 9 }}>Grid Density:</span>
              {Object.entries(WARP_LABELS).map(([mode, label]) => (
                <button key={mode} onClick={() => changeWarpMode(mode)} style={{ ...btnStyle, padding: '2px 6px', fontSize: 8, color: adj.warpMode === mode ? '#44ff88' : '#666', borderColor: adj.warpMode === mode ? '#44ff88' : '#44ff8833' }}>{label.split(' ')[0]}</button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, marginBottom: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff4444', display: 'inline-block', flexShrink: 0 }} /> Corner
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffcc00', display: 'inline-block', flexShrink: 0, marginLeft: 8 }} /> Edge
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#44ff88', display: 'inline-block', flexShrink: 0, marginLeft: 8 }} /> Interior
            </div>
            <div style={{ fontSize: 9, color: '#888', marginBottom: 6 }}>Drag colored dots on the element to warp. Points moved: {adj.warpGrid.filter(p => p.dx !== 0 || p.dy !== 0).length}/{adj.warpGrid.length}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button onClick={doSnapToCurve} style={btnStyle}>Snap to Curve</button>
              <button onClick={resetWarp} style={{ ...btnStyle, color: '#ffaa44', borderColor: '#ffaa4444' }}>Reset Warp</button>
            </div>
            {/* Individual point controls (collapsible) */}
            {adj.warpGrid.filter(p => p.dx !== 0 || p.dy !== 0).length > 0 && (
              <div style={{ marginTop: 6, maxHeight: 120, overflowY: 'auto', border: '1px solid #222', borderRadius: 3, padding: 4 }}>
                {adj.warpGrid.filter(p => p.dx !== 0 || p.dy !== 0).map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, padding: '1px 0' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.type === 'corner' ? '#ff4444' : p.type === 'edge' ? '#ffcc00' : '#44ff88', flexShrink: 0 }} />
                    <span style={{ width: 28, color: '#888' }}>{p.id}</span>
                    <span style={{ color: '#44ff88' }}>dx:{Math.round(p.dx)}</span>
                    <span style={{ color: '#44ff88' }}>dy:{Math.round(p.dy)}</span>
                    <button onClick={() => setWarpPoint(p.id, 0, 0)} style={{ ...btnStyle, padding: '0 4px', fontSize: 7, lineHeight: '12px' }}>0</button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="SPACING">
            <div style={{ fontSize: 9, color: '#888', marginBottom: 2 }}>Margin</div>
            <Slider label="Top" value={adj.marginTop} min={-100} max={200} unit="px" onChange={v => set('marginTop', v)} />
            <Slider label="Right" value={adj.marginRight} min={-100} max={200} unit="px" onChange={v => set('marginRight', v)} />
            <Slider label="Bottom" value={adj.marginBottom} min={-100} max={200} unit="px" onChange={v => set('marginBottom', v)} />
            <Slider label="Left" value={adj.marginLeft} min={-100} max={200} unit="px" onChange={v => set('marginLeft', v)} />
            <div style={{ fontSize: 9, color: '#888', marginBottom: 2, marginTop: 4 }}>Padding</div>
            <Slider label="Top" value={adj.paddingTop} min={0} max={200} unit="px" onChange={v => set('paddingTop', v)} />
            <Slider label="Right" value={adj.paddingRight} min={0} max={200} unit="px" onChange={v => set('paddingRight', v)} />
            <Slider label="Bottom" value={adj.paddingBottom} min={0} max={200} unit="px" onChange={v => set('paddingBottom', v)} />
            <Slider label="Left" value={adj.paddingLeft} min={0} max={200} unit="px" onChange={v => set('paddingLeft', v)} />
          </Section>

          <Section title="UTILITIES">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              <button onClick={copyCSS} style={btnStyle}>Copy CSS</button>
              <button onClick={copyJSON} style={btnStyle}>Copy JSON</button>
              <button onClick={resetEl} style={{ ...btnStyle, color: '#ffaa44', borderColor: '#ffaa4444' }}>Reset Element</button>
              <button onClick={() => setShowGrid(g => !g)} style={{ ...btnStyle, color: showGrid ? '#44ff88' : '#888', borderColor: showGrid ? '#44ff88' : '#44ff8844' }}>Grid {showGrid ? 'ON' : 'OFF'}</button>
              <button onClick={() => setShowRulers(r => !r)} style={{ ...btnStyle, color: showRulers ? '#44ff88' : '#888', borderColor: showRulers ? '#44ff88' : '#44ff8844' }}>Rulers {showRulers ? 'ON' : 'OFF'}</button>
            </div>
          </Section>
        </>)}

        {/* History */}
        {history.length > 0 && (
          <Section title={`HISTORY (${history.length})`}>
            {history.map((entry, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 0', borderBottom: '1px solid #222' }}>
                <span style={{ flex: 1, fontSize: 9, color: entry.locked ? '#44ff88' : '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.locked && (
                    <svg viewBox="0 0 24 24" width="9" height="9" fill="currentColor" aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 3 }}>
                      <rect x="6" y="11" width="12" height="10" rx="1.2" fill="none" stroke="currentColor" strokeWidth="2"/>
                      <path d="M8 11 V8 A4 4 0 0 1 16 8 V11" fill="none" stroke="currentColor" strokeWidth="2"/>
                      <circle cx="12" cy="16" r="1.4"/>
                    </svg>
                  )}{entry.elId}
                </span>
                <button onClick={() => toggleLock(idx)} style={{ ...btnStyle, padding: '2px 6px', color: entry.locked ? '#44ff88' : '#888', borderColor: entry.locked ? '#44ff8866' : '#44ff8833' }}>{entry.locked ? 'Unlock' : 'Lock'}</button>
                <button onClick={() => reselect(entry)} style={{ ...btnStyle, padding: '2px 6px' }}>Select</button>
                <button onClick={() => restoreFromHistory(idx)} style={{ ...btnStyle, padding: '2px 6px', color: '#ff6644', borderColor: '#ff664444' }}>Restore</button>
              </div>
            ))}
          </Section>
        )}
      </div>
    </>
  );
}
