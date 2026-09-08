"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

const slogans = [
  ["Дизайн и разработка напрямую с разработчиком.", "Без студийной наценки."],
  ["От первой идеи до готового сайта.", "Всё в одних руках."],
  ["Продуманный дизайн.", "Удобный сайт на любом экране."],
];

export function HeroSlogans() {
  const root = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const lines = element.querySelectorAll<HTMLElement>(".hero-slogan");
      const timeline = gsap.timeline({ repeat: -1, paused: true });
      lines.forEach((line, index) => {
        timeline.to(line, { opacity: 0, duration: 0.45, ease: "sine.inOut" }, "+=4.5")
          .to(lines[(index + 1) % lines.length], { opacity: 1, duration: 0.55, ease: "sine.inOut" });
      });
      let visible = false;
      const update = () => timeline.paused(!visible || document.hidden ||
        element.matches(":hover, :focus-within"));
      const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        update();
      });
      observer.observe(element);
      const events = ["mouseenter", "mouseleave", "focusin", "focusout"] as const;
      events.forEach((name) => element.addEventListener(name, update));
      document.addEventListener("visibilitychange", update);
      return () => {
        observer.disconnect();
        events.forEach((name) => element.removeEventListener(name, update));
        document.removeEventListener("visibilitychange", update);
      };
    });
    return () => media.revert();
  }, []);

  return (
    <p className="subtitle hero-slogans" ref={root} tabIndex={0}>
      {slogans.map(([first, second]) => (
        <span className="hero-slogan" key={first} aria-hidden="true">
          {first}<br className="desktop-break" /> {second}
        </span>
      ))}
      <span className="sr-only">{slogans[0].join(" ")}</span>
    </p>
  );
}
