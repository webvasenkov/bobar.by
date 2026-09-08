"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { gsap } from "gsap";
import { BrandMark } from "./brand";

const STORAGE_KEY = "bobar-intro-seen";
const DURATION = 1.3;
let seenInMemory = false;

/** A decorative FLIP overlay. The real mascot always reserves its grid space. */
export function HeroIntro({ targetRef }: { targetRef: RefObject<HTMLDivElement | null> }) {
  const [active, setActive] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const eligibleRef = useRef<boolean | null>(null);

  useLayoutEffect(() => {
    // Cache this decision for Strict Mode's effect replay, but not for a new mount.
    if (eligibleRef.current === null) {
      let seen = seenInMemory;
      try {
        seen ||= sessionStorage.getItem(STORAGE_KEY) === "true";
      } catch {
        // Storage can be disabled; the in-memory guard still covers navigation.
      }
      // Explicit preview links can replay an already-seen intro without
      // clearing the visitor's session or ignoring reduced motion.
      const replay = new URLSearchParams(location.search).get("intro") === "1";
      eligibleRef.current = (!seen || replay) &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches &&
        document.visibilityState === "visible" &&
        !location.hash && window.scrollY === 0 &&
        (document.activeElement === document.body || document.activeElement === null);
    }
    setActive(eligibleRef.current);
  }, []);

  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    const target = targetRef.current;
    if (!active || !overlay || !target) return;

    const mascot = overlay.querySelector<HTMLElement>(".hero-intro-mascot");
    const backdrop = overlay.querySelector<HTMLElement>(".hero-intro-backdrop");
    const face = mascot?.querySelector("svg");
    const bounds = target.getBoundingClientRect();
    if (!mascot || !backdrop || !face || !bounds.width || !bounds.height) {
      setActive(false);
      return;
    }

    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let context: gsap.Context | undefined;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      overlay.style.visibility = "hidden";
      delete target.dataset.intro;
      context?.revert();
      setActive(false);
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") finish();
    };

    // FLIP: measure the real responsive slot; animate only its inverse transform.
    // Scroll and resize finish immediately rather than following stale bounds.
    const scale = Math.max(1, Math.min(420, innerWidth * 0.65, innerHeight * 0.52 * 240 / 280) / bounds.width);
    mascot.style.width = `${bounds.width}px`;
    mascot.style.height = `${bounds.height}px`;
    target.dataset.intro = "active";

    try {
      context = gsap.context(() => {
        const pupils = face.querySelectorAll(".mascot-pupil");
        gsap.set(mascot, {
          x: (innerWidth - bounds.width * scale) / 2,
          y: (innerHeight - bounds.height * scale) / 2,
          scale, transformOrigin: "0 0", force3D: true,
        });
        // Both pupils follow the same continuous circle; the eye shapes stay fixed.
        gsap.set(pupils, { x: 0, y: 0 });
        const setX = gsap.quickSetter(pupils, "x", "px");
        const setY = gsap.quickSetter(pupils, "y", "px");
        const gaze = { angle: -Math.PI / 2, radius: 0 };
        const updateGaze = () => {
          setX(Math.cos(gaze.angle) * gaze.radius);
          setY(Math.sin(gaze.angle) * gaze.radius);
        };
        const scene = gsap.timeline({ defaults: { ease: "sine.inOut" }, onComplete: finish });
        scene.to(gaze, { radius: 6, duration: 0.1, onUpdate: updateGaze }, 0)
          .to(gaze, { angle: Math.PI * 1.5, duration: 0.64, onUpdate: updateGaze }, 0.1)
          .to(gaze, { radius: 0, duration: 0.12, onUpdate: updateGaze }, 0.74);

        scene.to(mascot, {
          x: bounds.left, y: bounds.top, scale: 1,
          duration: DURATION - 0.75, ease: "power3.inOut",
        }, 0.75)
          .to(backdrop, { opacity: 0, duration: 0.5, ease: "power2.inOut" }, 0.75)
          .fromTo(".site-header, .hero-copy h1, .hero-copy .subtitle, .hero-actions",
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: 0.36, stagger: 0.04, ease: "power2.out" }, 0.8);
      });
      seenInMemory = true;
      try {
        sessionStorage.setItem(STORAGE_KEY, "true");
      } catch {
        // The in-memory guard remains available when storage is disabled.
      }
    } catch {
      finish();
    }

    const events = ["pointerdown", "keydown", "wheel", "touchstart", "scroll", "resize", "pagehide"] as const;
    events.forEach((event) => window.addEventListener(event, finish, { passive: true }));
    preference.addEventListener("change", finish);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      finished = true;
      delete target.dataset.intro;
      context?.revert();
      events.forEach((event) => window.removeEventListener(event, finish));
      preference.removeEventListener("change", finish);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, targetRef]);

  return active ? createPortal(
    <div className="hero-intro" ref={overlayRef} aria-hidden="true">
      <div className="hero-intro-backdrop" />
      <div className="hero-intro-mascot"><BrandMark movingTeeth eyes /></div>
    </div>,
    document.body,
  ) : null;
}
