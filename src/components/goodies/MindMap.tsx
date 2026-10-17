import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronsDownUp, ChevronsUpDown, LocateFixed, Maximize2, Minimize2 } from 'lucide-react';
import type { IMarkmapOptions, Markmap } from 'markmap-view';
import ErrorBoundary from '../ErrorBoundary';
import type { MindmapNode } from '../../utils/mindmap';

/** Canvas height preset. `compact` suits maps embedded in long-form writing. */
export type MindMapSize = 'default' | 'compact';

/** Props of the `MindMap` island. Every value must be serializable. */
export interface MindMapProps {
  /** Tree built at build time with `outlineToMindmap`. */
  root: MindmapNode;
  /** Accessible name of the map region. */
  label: string;
  /** Depth that starts unfolded: 1 shows only the root, 2 adds the main branches. Default 2. */
  initialExpandLevel?: number;
  /** Canvas height preset. Default `default`. */
  size?: MindMapSize;
  /** Sentence appended to the load-error message, pointing readers to an alternative. */
  fallbackHint?: string;
  /** Show Expand all / Collapse all on desktop widths. Default true. */
  showExpandControls?: boolean;
}

type MarkmapNode = Parameters<IMarkmapOptions['color']>[0];
type Status = 'loading' | 'ready' | 'error';
type TouchPoint = { x: number; y: number };

const FONT_TIMEOUT_MS = 1500;
const HINT_EMPHASIS_MS = 1400;
const MAX_BRANCH_TOKENS = 24;
const SCALE_EXTENT: [number, number] = [0.15, 4];
/** d3-zoom's default multiplies Ctrl+wheel by 10 (meant for trackpad pinch), which makes a mouse notch zoom 4×. */
const WHEEL_ZOOM_RATE = 0.002;
const PINCH_WHEEL_BOOST = 10;
const TRACKPAD_DELTA_LIMIT = 50;
const RENDERED_MARK = 'mindmap:rendered';

/** Reads `--mindmap-branch-N` tokens from variables.css (single source of truth for colours). */
function readBranchPalette(): string[] {
  const styles = getComputedStyle(document.documentElement);
  const palette: string[] = [];
  for (let index = 1; index <= MAX_BRANCH_TOKENS; index += 1) {
    const value = styles.getPropertyValue(`--mindmap-branch-${index}`).trim();
    if (!value) break;
    palette.push(value);
  }
  return palette;
}

function readAccent(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim();
}

/** Waits for the page font so markmap measures node boxes with the final glyph widths. */
async function waitForFont(element: Element): Promise<void> {
  const { fontFamily } = getComputedStyle(element);
  const loads = ['400 16px', '600 17px', '700 22px'].map((spec) =>
    document.fonts.load(`${spec} ${fontFamily}`),
  );
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS));
  await Promise.race([Promise.all(loads).then(() => undefined), timeout]);
}

/** Folds every node at or below `level` (1 = root), matching markmap's `initialExpandLevel`. */
function foldFromLevel(node: MarkmapNode, level: number): void {
  node.payload = { ...node.payload, fold: node.state.depth >= level ? 1 : 0 };
  node.children.forEach((child) => foldFromLevel(child, level));
}

function hasNodeData(element: Element): element is Element & { __data__: MarkmapNode } {
  return '__data__' in element;
}

function midpoint(touches: TouchList, origin: DOMRect): TouchPoint {
  const [a, b] = [touches[0], touches[1]];
  return {
    x: (a.clientX + b.clientX) / 2 - origin.left,
    y: (a.clientY + b.clientY) / 2 - origin.top,
  };
}

function distance(touches: TouchList): number {
  return Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY,
  );
}

function MindMapInner({
  root,
  label,
  initialExpandLevel = 2,
  size = 'default',
  fallbackHint,
  showExpandControls = true,
}: MindMapProps) {
  const hintId = useId();
  const figureRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const markmapRef = useRef<Markmap | null>(null);
  const fullscreenRef = useRef(false);
  const scaleRef = useRef(1);
  const hintTimerRef = useRef<number | undefined>(undefined);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hintEmphasis, setHintEmphasis] = useState(false);

  const fit = useCallback(() => {
    void markmapRef.current?.fit();
  }, []);

  const refold = async (level: number) => {
    const markmap = markmapRef.current;
    const data = markmap?.state.data;
    if (!markmap || !data) return;
    foldFromLevel(data, level);
    await markmap.renderData();
    await markmap.fit();
  };
  const expandAll = () => void refold(Number.POSITIVE_INFINITY);
  const collapseAll = () => void refold(initialExpandLevel);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let cancelled = false;
    let markmap: Markmap | null = null;
    let accent = readAccent();
    const palette = readBranchPalette();

    const color = (node: MarkmapNode): string => {
      const branch = node.payload?.branch;
      if (typeof branch !== 'number' || branch < 0 || palette.length === 0) return accent;
      return palette[branch % palette.length];
    };

    const themeObserver = new MutationObserver(() => {
      accent = readAccent();
      void markmap?.renderData();
    });

    async function create(target: SVGSVGElement) {
      const [{ Markmap: MarkmapView }] = await Promise.all([
        import('markmap-view'),
        waitForFont(target),
      ]);
      if (cancelled) return;
      // markmap mutates the tree it renders, so hand it a copy of the island props.
      markmap = MarkmapView.create(
        target,
        {
          color,
          duration: 300,
          embedGlobalCSS: false,
          fitRatio: 0.96,
          initialExpandLevel,
          maxInitialScale: 1.1,
          maxWidth: 320,
          paddingX: 10,
          pan: false,
          spacingHorizontal: 72,
          spacingVertical: 8,
        },
        structuredClone(root),
      );
      markmapRef.current = markmap;
      const zoom = markmap.zoom;
      // Wheel zooms only with Ctrl/Cmd; touch is ours unless the map is full screen.
      zoom.scaleExtent(SCALE_EXTENT).filter((event: Event) => {
        if (event instanceof WheelEvent) return event.ctrlKey || event.metaKey;
        if (event instanceof TouchEvent) return fullscreenRef.current;
        return !(event instanceof MouseEvent && event.button !== 0);
      });
      zoom.on('zoom.mindmap', (event: { transform: { k: number } }) => {
        scaleRef.current = event.transform.k;
      });
      zoom.wheelDelta((event: WheelEvent) => {
        const pixels =
          event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 20 : event.deltaY;
        const boost = Math.abs(pixels) < TRACKPAD_DELTA_LIMIT ? PINCH_WHEEL_BOOST : 1;
        return -pixels * WHEEL_ZOOM_RATE * boost;
      });
      markmap.svg.on('dblclick.zoom', null);
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      });
      requestAnimationFrame(() => {
        performance.mark(RENDERED_MARK);
      });
      setStatus('ready');
    }

    create(svg).catch((reason: unknown) => {
      if (cancelled) return;
      console.error('Mind map failed to load:', reason);
      setError(reason instanceof Error ? reason.message : String(reason));
      setStatus('error');
    });

    return () => {
      cancelled = true;
      themeObserver.disconnect();
      markmap?.destroy();
      markmapRef.current = null;
    };
  }, [root, initialExpandLevel]);

  // Two-finger pan + pinch when embedded, so a single finger keeps scrolling the page.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let last: { mid: TouchPoint; dist: number } | null = null;

    const onTouchStart = (event: TouchEvent) => {
      if (fullscreenRef.current || event.touches.length !== 2) return;
      // Claim the two-finger gesture before the browser starts scrolling or zooming the page.
      event.preventDefault();
      last = {
        mid: midpoint(event.touches, svg.getBoundingClientRect()),
        dist: distance(event.touches),
      };
    };
    const onTouchMove = (event: TouchEvent) => {
      const markmap = markmapRef.current;
      if (!markmap || !last || fullscreenRef.current || event.touches.length !== 2) return;
      event.preventDefault();
      const mid = midpoint(event.touches, svg.getBoundingClientRect());
      const dist = distance(event.touches);
      const k = scaleRef.current;
      markmap.zoom.translateBy(markmap.svg, (mid.x - last.mid.x) / k, (mid.y - last.mid.y) / k);
      markmap.zoom.scaleBy(markmap.svg, dist / last.dist, [mid.x, mid.y]);
      last = { mid, dist };
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) last = null;
    };

    svg.addEventListener('touchstart', onTouchStart, { passive: false });
    svg.addEventListener('touchmove', onTouchMove, { passive: false });
    svg.addEventListener('touchend', onTouchEnd, { passive: true });
    svg.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      svg.removeEventListener('touchstart', onTouchStart);
      svg.removeEventListener('touchmove', onTouchMove);
      svg.removeEventListener('touchend', onTouchEnd);
      svg.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  // Keep fullscreen state in sync with the native API and Escape for the CSS fallback.
  useEffect(() => {
    const onFullscreenChange = () => {
      const active = document.fullscreenElement === figureRef.current;
      fullscreenRef.current = active;
      setIsFullscreen(active);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && fullscreenRef.current && !document.fullscreenElement) {
        fullscreenRef.current = false;
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    const usingFallback = isFullscreen && !document.fullscreenElement;
    if (usingFallback) document.documentElement.dataset.mindmapFullscreen = 'true';
    else delete document.documentElement.dataset.mindmapFullscreen;
    // Wait a frame for the new size before fitting.
    const frame = requestAnimationFrame(() => fit());
    return () => cancelAnimationFrame(frame);
  }, [isFullscreen, fit]);

  useEffect(() => () => window.clearTimeout(hintTimerRef.current), []);

  const toggleFullscreen = async () => {
    const figure = figureRef.current;
    if (!figure) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    if (fullscreenRef.current) {
      fullscreenRef.current = false;
      setIsFullscreen(false);
      return;
    }
    if (document.fullscreenEnabled) {
      try {
        await figure.requestFullscreen();
        return;
      } catch (reason: unknown) {
        console.warn('Native full screen unavailable, using the CSS fallback:', reason);
      }
    }
    fullscreenRef.current = true;
    setIsFullscreen(true);
  };

  /** Lets a click on a node label fold/unfold it (markmap only wires the small circle). */
  const onCanvasClick = (event: React.MouseEvent<SVGSVGElement>) => {
    const markmap = markmapRef.current;
    if (!markmap || !(event.target instanceof Element)) return;
    if (event.target.closest('circle')) return;
    const node = event.target.closest('.markmap-node');
    if (!node || !hasNodeData(node) || node.__data__.children.length === 0) return;
    // Ctrl/Cmd-click unfolds the whole subtree, matching markmap's own circle behaviour.
    void markmap.toggleNode(node.__data__, event.ctrlKey || event.metaKey);
  };

  /** Plain wheel scrolls the page; briefly highlight the Ctrl/Cmd hint instead of trapping it. */
  const onCanvasWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    if (event.ctrlKey || event.metaKey || fullscreenRef.current) return;
    setHintEmphasis(true);
    window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => setHintEmphasis(false), HINT_EMPHASIS_MS);
  };

  const FullscreenIcon = isFullscreen ? Minimize2 : Maximize2;
  const fullscreenLabel = isFullscreen ? 'Exit full screen' : 'Full screen';

  return (
    <figure
      ref={figureRef}
      className="mindmap"
      data-fullscreen={isFullscreen ? 'true' : 'false'}
      data-size={size}
      aria-label={label}
    >
      <svg
        ref={svgRef}
        className="mindmap__canvas markmap"
        aria-describedby={hintId}
        onClick={onCanvasClick}
        onWheel={onCanvasWheel}
      />

      <div className="mindmap__toolbar">
        {showExpandControls && (
          <>
            <button
              type="button"
              className="mindmap__control mindmap__control--desktop"
              onClick={expandAll}
              disabled={status !== 'ready'}
              aria-label="Expand all"
              title="Expand all"
            >
              <ChevronsUpDown className="mindmap__control-icon" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="mindmap__control mindmap__control--desktop"
              onClick={collapseAll}
              disabled={status !== 'ready'}
              aria-label="Collapse all"
              title="Collapse all"
            >
              <ChevronsDownUp className="mindmap__control-icon" aria-hidden="true" />
            </button>
          </>
        )}
        <button
          type="button"
          className="mindmap__control"
          onClick={fit}
          disabled={status !== 'ready'}
          aria-label="Fit map to screen"
        >
          <LocateFixed className="mindmap__control-icon" aria-hidden="true" />
          <span className="mindmap__control-label">Fit</span>
        </button>
        <button
          type="button"
          className="mindmap__control"
          onClick={() => void toggleFullscreen()}
          aria-pressed={isFullscreen}
          aria-label={fullscreenLabel}
        >
          <FullscreenIcon className="mindmap__control-icon" aria-hidden="true" />
          <span className="mindmap__control-label">{fullscreenLabel}</span>
        </button>
      </div>

      <p id={hintId} className="mindmap__hint" data-emphasis={hintEmphasis ? 'true' : 'false'}>
        <span className="mindmap__hint-pointer">
          Click a topic to fold or unfold · drag to pan · Ctrl/⌘ + scroll to zoom
        </span>
        <span className="mindmap__hint-touch">
          Tap a topic to fold or unfold · two fingers to pan and zoom
        </span>
      </p>

      {status === 'loading' && (
        <p className="mindmap__status" role="status">
          Loading mind map…
        </p>
      )}
      {status === 'error' && (
        <p className="mindmap__status" role="alert">
          The mind map could not load ({error}).{fallbackHint && ` ${fallbackHint}`}
        </p>
      )}
    </figure>
  );
}

export default function MindMap(props: MindMapProps) {
  return (
    <ErrorBoundary>
      <MindMapInner {...props} />
    </ErrorBoundary>
  );
}
