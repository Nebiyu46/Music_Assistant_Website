import { useEffect, useRef } from "react";

const NOTE_COLORS = ["#c8ff00", "#00e5ff", "#ff3cac", "#ff9100", "#a78bfa"];
const NOTE_SYMBOLS = ["♩", "♪", "♫", "♬", "𝄞", "𝄢"];

export default function FallingNotes() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);

    // Create note particles
    const particles = Array.from({ length: 55 }, () => makeParticle(W, H, true));

    function makeParticle(w, h, randomY = false) {
      return {
        x: Math.random() * w,
        y: randomY ? Math.random() * h : -40,
        speed: 0.6 + Math.random() * 1.1,
        size: 14 + Math.random() * 22,
        symbol: NOTE_SYMBOLS[Math.floor(Math.random() * NOTE_SYMBOLS.length)],
        color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
        opacity: 0.08 + Math.random() * 0.22,
        drift: (Math.random() - 0.5) * 0.3,
        rotation: (Math.random() - 0.5) * 0.02,
        angle: Math.random() * Math.PI * 2,
      };
    }

    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.font = `${p.size}px serif`;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillText(p.symbol, 0, 0);
        ctx.restore();

        p.y += p.speed;
        p.x += p.drift;
        p.angle += p.rotation;

        if (p.y > H + 50) {
          Object.assign(p, makeParticle(W, H, false));
        }
      }

      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}
