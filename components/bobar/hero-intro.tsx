"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { BrandMark } from "./brand";

const STORAGE_KEY = "bobar-intro-seen";
const DURATION = 1300;
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

    const bounds = target.getBoundingClientRect();
    if (!bounds.width || !bounds.height || typeof overlay.animate !== "function") {
      setActive(false);
      return;
    }

    const animations: Animation[] = [];
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      // Hide synchronously before cancelling the transform: React may commit
      // the portal removal on a later frame under load.
      overlay.style.visibility = "hidden";
      delete target.dataset.intro;
      animations.forEach((animation) => animation.cancel());
      setActive(false);
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") finish();
    };

    // Measure once. Only transforms change during the flight; resizing/scrolling
    // ends the intro so stale coordinates can never move it to the wrong place.
    const scale = Math.max(1, Math.min(420, innerWidth * 0.65, innerHeight * 0.52 * 240 / 280) / bounds.width);
    const startX = (innerWidth - bounds.width * scale) / 2;
    const startY = (innerHeight - bounds.height * scale) / 2;
    const start = `translate3d(${startX}px, ${startY}px, 0) scale(${scale})`;
    const end = `translate3d(${bounds.left}px, ${bounds.top}px, 0) scale(1)`;
    overlay.style.width = `${bounds.width}px`;
    overlay.style.height = `${bounds.height}px`;
    target.dataset.intro = "active";

    try {
      const flight = overlay.animate([
        { transform: start, offset: 0 },
        { transform: start, offset: 1.1 / 1.3, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        { transform: end, offset: 1 },
      ], { duration: DURATION, fill: "both" });
      animations.push(flight);
      flight.onfinish = finish;
      // A slow document response is not a viewed intro. Persist only once
      // the animation actually exists, rather than when hydration begins.
      seenInMemory = true;
      try {
        sessionStorage.setItem(STORAGE_KEY, "true");
      } catch {
        // The in-memory guard remains available when storage is disabled.
      }

      document.querySelectorAll<HTMLElement>(".site-header, .hero-copy h1, .hero-copy .subtitle, .hero-actions")
        .forEach((element, index) => {
          animations.push(element.animate([{ opacity: 0.45 }, { opacity: 1 }], {
            duration: 450, delay: index * 45, fill: "both", easing: "ease-out",
          }));
        });
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
      animations.forEach((animation) => animation.cancel());
      events.forEach((event) => window.removeEventListener(event, finish));
      preference.removeEventListener("change", finish);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, targetRef]);

  return active ? createPortal(
    <div className="hero-intro" ref={overlayRef} aria-hidden="true">
      <BrandMark movingTeeth eyes />
    </div>,
    document.body,
  ) : null;
}
