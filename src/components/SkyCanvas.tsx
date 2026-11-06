import { useEffect, useRef } from 'react';

export default function SkyCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0;
    let H = 0;
    let animId = 0;

    interface Lantern {
      x: number;
      y: number;
      r: number;
      v: number;
      p: number;
    }

    let lanterns: Lantern[] = [];

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = cv.clientWidth || window.innerWidth;
      H = cv.clientHeight || 450;
      cv.width = W * dpr;
      cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      lanterns = Array.from({ length: Math.round(W / 40) }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 1 + Math.random() * 2.5,
        v: 0.1 + Math.random() * 0.35,
        p: Math.random() * 6.28,
      }));
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      for (const l of lanterns) {
        const a = 0.35 + 0.35 * Math.sin(t / 900 + l.p);
        const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 8);
        g.addColorStop(0, `rgba(242, 184, 75, ${a})`);
        g.addColorStop(1, 'rgba(242, 184, 75, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(l.x, l.y, l.r * 8, 0, 6.28);
        ctx.fill();

        if (!reduce) {
          l.y -= l.v;
          l.x += Math.sin(t / 2000 + l.p) * 0.15;
          if (l.y < -20) {
            l.y = H + 20;
            l.x = Math.random() * W;
          }
        }
      }
      if (!reduce) {
        animId = requestAnimationFrame(draw);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    if (reduce) {
      draw(0);
    } else {
      animId = requestAnimationFrame(draw);
    }

    return () => {
      window.removeEventListener('resize', resize);
      if (animId) cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full block pointer-events-none"
      aria-hidden="true"
    />
  );
}
