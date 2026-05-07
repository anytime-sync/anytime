"use client";

import { useEffect, useRef } from "react";
import { useTasks } from "@/hooks/use-tasks";

/**
 * Celebrations — opt-in micro-rewards.
 *
 * Watches Today's quadrant 1 count. When it transitions from >0 to 0
 * within the same session, fires a tiny confetti burst (canvas-based,
 * no library — keeps the bundle slim). The chime is lightweight HTML5
 * Audio with a soft tone; users can mute via the OS or the per-app
 * toggle in Settings (added as `celebrations_enabled`).
 *
 * Side-effect-only component: renders nothing. Mount once in app-shell
 * or on /app/today.
 */
export function Celebrations({ enabled = true }: { enabled?: boolean }) {
  const { data: tasks = [] } = useTasks({ view: "today" });
  const prevQ1OpenRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const openQ1 = tasks.filter(
      (t) => !t.is_completed && (t.priority ?? 0) >= 4
    ).length;

    // Only celebrate the transition: had-some-then-zero.
    if (
      prevQ1OpenRef.current !== null &&
      prevQ1OpenRef.current > 0 &&
      openQ1 === 0
    ) {
      fireConfetti();
    }
    prevQ1OpenRef.current = openQ1;
  }, [tasks, enabled]);

  return null;
}

/** Tiny canvas-confetti — ~80 lines, no dep. Runs for ~1.4s then
 *  removes the canvas. Skipped on prefers-reduced-motion. */
function fireConfetti() {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9999";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const colors = ["#a67d3d", "#caa769", "#d4a373", "#9a8c98", "#f3e7d3"];
  type Bit = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number; color: string };
  const N = 90;
  const bits: Bit[] = [];
  const cx = canvas.width / 2;
  for (let i = 0; i < N; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
    const speed = 6 + Math.random() * 8;
    bits.push({
      x: cx + (Math.random() - 0.5) * 60,
      y: canvas.height * 0.55,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.4,
      size: 6 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }

  const start = performance.now();
  const duration = 1400;
  function frame(now: number) {
    const elapsed = now - start;
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const b of bits) {
      b.x += b.vx;
      b.y += b.vy;
      b.vy += 0.32;     // gravity
      b.vx *= 0.995;    // air drag
      b.rot += b.vr;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.fillStyle = b.color;
      ctx.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2);
      ctx.restore();
    }
    if (elapsed < duration) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(frame);
}
