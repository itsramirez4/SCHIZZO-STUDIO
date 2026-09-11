import { PenPath, PathPoint, pathToSvgD } from '@/services/path.service';

interface Props {
  path: PenPath;
  previewPoint: PathPoint | null;
  zoom: number;
}

export default function PenOverlay({ path, previewPoint, zoom }: Props) {
  const d = pathToSvgD(path, path.closed ? null : previewPoint);
  const handleR = 4 / zoom;
  const anchorR = 3.5 / zoom;

  return (
    <svg
      className="absolute inset-0 w-full h-full overflow-visible"
      style={{ pointerEvents: 'none' }}
    >
      {d && <path d={d} fill="none" stroke="#5b8cff" strokeWidth={1.5 / zoom} />}

      {/* Control handle lines + points for the last (still-editable) anchor. */}
      {path.points.length > 0 &&
        (() => {
          const last = path.points[path.points.length - 1];
          const showHandles = last.controlOut.x !== last.anchor.x || last.controlOut.y !== last.anchor.y;
          if (!showHandles) return null;
          return (
            <g>
              <line x1={last.anchor.x} y1={last.anchor.y} x2={last.controlOut.x} y2={last.controlOut.y} stroke="#5b8cff" strokeWidth={1 / zoom} />
              <line x1={last.anchor.x} y1={last.anchor.y} x2={last.controlIn.x} y2={last.controlIn.y} stroke="#5b8cff" strokeWidth={1 / zoom} />
              <circle cx={last.controlOut.x} cy={last.controlOut.y} r={handleR} fill="#fff" stroke="#5b8cff" strokeWidth={1 / zoom} />
              <circle cx={last.controlIn.x} cy={last.controlIn.y} r={handleR} fill="#fff" stroke="#5b8cff" strokeWidth={1 / zoom} />
            </g>
          );
        })()}

      {path.points.map((p, i) => (
        <circle
          key={i}
          cx={p.anchor.x}
          cy={p.anchor.y}
          r={i === 0 ? anchorR * 1.4 : anchorR}
          fill={i === 0 ? '#5b8cff' : '#fff'}
          stroke="#5b8cff"
          strokeWidth={1.5 / zoom}
        />
      ))}
    </svg>
  );
}
