import { useEffect, useRef, useState } from "react";

const CANVAS_W = 800;
const CANVAS_H = 500;

function drawOp(ctx, op, scaleX, scaleY) {
  const t = op?.t || "line";
  const p = op?.p || op || {};
  const color = p.c || "#e9fffc";
  const width = Math.max(1, Number(p.w || 3));
  ctx.strokeStyle = color;
  ctx.lineWidth = width * scaleX;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (t === "line") {
    const pts = p.pts || [];
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0][0] * scaleX, pts[0][1] * scaleY);
    for (let i = 1; i < pts.length; i += 1) {
      ctx.lineTo(pts[i][0] * scaleX, pts[i][1] * scaleY);
    }
    ctx.stroke();
  }

  if (t === "circle") {
    const cx = Number(p.cx || 0) * scaleX;
    const cy = Number(p.cy || 0) * scaleY;
    const r = Number(p.r || 0) * scaleX;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export default function CanvasBoard({
  label,
  ops,
  canDraw,
  tool,
  color,
  strokeWidth,
  onDraw,
  hint,
  accent = "A",
}) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState([]);
  const [circleStart, setCircleStart] = useState(null);
  const startTsRef = useRef(0);

  useEffect(() => {
    const updateSize = () => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const w = Math.max(280, Math.floor(rect.width));
      const h = Math.floor((w * CANVAS_H) / CANVAS_W);
      setSize({ w, h });
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size.w, size.h);
    ctx.fillStyle = "rgba(6, 10, 22, 0.9)";
    ctx.fillRect(0, 0, size.w, size.h);

    const scaleX = size.w / CANVAS_W;
    const scaleY = size.h / CANVAS_H;
    ops.forEach((op) => drawOp(ctx, op, scaleX, scaleY));
  }, [ops, size.w, size.h]);

  const toCanvasPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
    return [Math.max(0, Math.min(CANVAS_W, x)), Math.max(0, Math.min(CANVAS_H, y))];
  };

  const handlePointerDown = (e) => {
    if (!canDraw) return;
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    const pt = toCanvasPoint(e);
    setDrawing(true);
    startTsRef.current = Date.now();
    if (tool === "circle") {
      setCircleStart(pt);
    } else {
      setPoints([pt]);
    }
  };

  const handlePointerMove = (e) => {
    if (!canDraw || !drawing) return;
    if (tool === "circle") return;
    const pt = toCanvasPoint(e);
    setPoints((prev) => [...prev, pt]);
  };

  const handlePointerUp = (e) => {
    if (!canDraw || !drawing) return;
    e.preventDefault();
    canvasRef.current.releasePointerCapture(e.pointerId);
    setDrawing(false);

    if (tool === "circle" && circleStart) {
      const end = toCanvasPoint(e);
      const dx = end[0] - circleStart[0];
      const dy = end[1] - circleStart[1];
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r > 2) {
        onDraw({
          t: "circle",
          p: { cx: circleStart[0], cy: circleStart[1], r, c: color, w: strokeWidth },
          start_ts: startTsRef.current,
        });
      }
      setCircleStart(null);
      return;
    }

    if (points.length >= 2) {
      onDraw({
        t: "line",
        p: { pts: points, c: color, w: strokeWidth },
        start_ts: startTsRef.current,
      });
    }
    setPoints([]);
  };

  return (
    <div className={`canvas panel panel--canvas panel--${accent}`} ref={wrapperRef}>
      <div className="canvas__header">
        <div className="canvas__title">{label}</div>
        {hint && <div className="canvas__hint">{hint}</div>}
      </div>
      <canvas
        ref={canvasRef}
        className={canDraw ? "canvas__surface canvas__surface--active" : "canvas__surface"}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      {!canDraw && <div className="canvas__lock">Spectating</div>}
    </div>
  );
}
