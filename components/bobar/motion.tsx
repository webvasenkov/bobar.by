"use client";
import { useEffect, useRef } from "react";
import { BrandMark } from "./brand";
import { HeroIntro } from "./hero-intro";

export function HeroMark() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mark = ref.current;
    const hero = mark?.closest<HTMLElement>(".hero");
    if (!mark || !hero) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const reset = () => {
      cancelAnimationFrame(frame);
      mark.style.setProperty("--mark-x", "0px");
      mark.style.setProperty("--mark-y", "0px");
      mark.style.setProperty("--rotate", "0deg");
      mark.style.setProperty("--tilt", "0deg");
      mark.style.setProperty("--teeth-x", "0px");
      mark.style.setProperty("--teeth-y", "0px");
      mark.style.setProperty("--eye-x", "0px");
      mark.style.setProperty("--eye-y", "0px");
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || preference.matches || mark.dataset.intro === "active") return;
      const bounds = hero.getBoundingClientRect();
      const markBounds = mark.getBoundingClientRect();
      if (markBounds.bottom < 0 || markBounds.top > window.innerHeight) return;
      const centerX = markBounds.left + markBounds.width * (130.5 / 240);
      const centerY = markBounds.top + markBounds.height * (216 / 280);
      const normalize = (value: number) => Math.max(-1, Math.min(1, value));
      const x = normalize(((event.clientX - bounds.left) / bounds.width - 0.5) * 2);
      const y = normalize(((event.clientY - bounds.top) / bounds.height - 0.5) * 2);
      const dx = (event.clientX - centerX) / 180;
      const dy = (event.clientY - centerY) / 180;
      const distance = Math.max(1, Math.hypot(dx, dy));
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        mark.style.setProperty("--teeth-x", `${(dx / distance) * 3}px`);
        mark.style.setProperty("--teeth-y", `${(dy / distance) * 2}px`);
        mark.style.setProperty("--eye-x", `${(dx / distance) * 8}px`);
        mark.style.setProperty("--eye-y", `${(dy / distance) * 7}px`);
        mark.style.setProperty("--mark-x", `${x * 7}px`);
        mark.style.setProperty("--mark-y", `${y * 5}px`);
        mark.style.setProperty("--rotate", `${x * 7}deg`);
        mark.style.setProperty("--tilt", `${-y * 5}deg`);
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", reset);
    window.addEventListener("blur", reset);
    preference.addEventListener("change", reset);
    return () => {
      reset();
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", reset);
      window.removeEventListener("blur", reset);
      preference.removeEventListener("change", reset);
    };
  }, []);

  return (
    <>
      <div className="hero-mark" ref={ref}><BrandMark movingTeeth eyes /></div>
      <HeroIntro targetRef={ref} />
    </>
  );
}

export function RevealEffects() {
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches || !("IntersectionObserver" in window)) return;
    const elements = [...document.querySelectorAll<HTMLElement>("[data-reveal]")];
    const showAll = () => elements.forEach((element) => element.classList.add("is-visible"));
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.08 },
    );
    elements.forEach((element) => {
      // Content already painted in the viewport must never disappear on hydration.
      if (element.getBoundingClientRect().top < innerHeight) return;
      element.classList.add("will-reveal");
      observer.observe(element);
    });
    const onPreference = () => {
      if (preference.matches) {
        showAll();
        observer.disconnect();
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof Element) {
        event.target.closest("[data-reveal]")?.classList.add("is-visible");
      }
    };
    preference.addEventListener("change", onPreference);
    document.addEventListener("focusin", onFocus);
    return () => {
      observer.disconnect();
      elements.forEach((element) => element.classList.remove("will-reveal", "is-visible"));
      preference.removeEventListener("change", onPreference);
      document.removeEventListener("focusin", onFocus);
    };
  }, []);
  return null;
}
