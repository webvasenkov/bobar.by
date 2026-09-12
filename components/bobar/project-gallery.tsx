"use client";

import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import type { Project } from "@/lib/project-types";

/** Two image layers keep decoded memory bounded, regardless of gallery length. */
export function ProjectGallery({ project, active }: { project: Project; active: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const incoming = useRef<HTMLPictureElement>(null);
  const [index, setIndex] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(true);
  const desktop = project.desktopImages;
  const phone = project.mobileImages.length ? project.mobileImages : desktop;
  const count = (mobile ? phone : desktop).length;
  const next = (index + 1) % Math.max(1, count);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const screen = matchMedia("(max-width: 767px)");
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let inView = false;
    const update = () => {
      setMobile(screen.matches);
      setReduced(motion.matches);
      setVisible(inView && !document.hidden);
    };
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; update(); });
    observer.observe(element);
    screen.addEventListener("change", update);
    motion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      observer.disconnect();
      screen.removeEventListener("change", update);
      motion.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  const playing = active && visible && !reduced && count > 1;
  useLayoutEffect(() => {
    const layer = incoming.current;
    const image = layer?.querySelector("img");
    if (!playing || !layer || !image) return;
    let cancelled = false;
    let tween: gsap.core.Tween | undefined;
    gsap.set(layer, { opacity: 0 });
    const start = () => {
      if (cancelled || tween || !image.complete || !image.naturalWidth) return;
      tween = gsap.to(layer, { opacity: 1, duration: 0.8, delay: 4,
        ease: "sine.inOut", onComplete: () => setIndex(next) });
    };
    // A responsive <picture> may abort decode while selecting its new source.
    // Its load event restarts preparation instead of leaving the gallery stuck.
    image.addEventListener("load", start);
    void image.decode().then(start).catch(() => {
      if (image.complete && image.naturalWidth) start();
    });
    return () => {
      cancelled = true;
      image.removeEventListener("load", start);
      tween?.kill();
      gsap.set(layer, { opacity: 0 });
    };
  }, [playing, index, next, mobile]);

  const picture = (position: number, overlay = false) => {
    const desktopSrc = desktop[position % Math.max(1, desktop.length)] || project.desktopImage;
    const mobileSrc = phone[position % Math.max(1, phone.length)] || desktopSrc;
    const desktopBlur = project.imagePlaceholders?.[desktopSrc];
    const mobileBlur = project.imagePlaceholders?.[mobileSrc];
    const style = {
      ...(overlay ? { opacity: 0 } : {}),
      "--desktop-blur": desktopBlur ? `url("${desktopBlur}")` : "none",
      "--mobile-blur": mobileBlur ? `url("${mobileBlur}")` : "none",
    } as CSSProperties;
    return <picture key={`${overlay}:${desktopSrc}:${mobileSrc}`} ref={overlay ? incoming : undefined}
      style={style} className="screenshot-picture" aria-hidden={overlay || undefined}>
      <source media="(max-width: 767px)" srcSet={mobileSrc} />
      <img src={desktopSrc}
        alt={overlay ? "" : `Главная страница сайта «${project.name}»`}
        draggable={false} loading={overlay ? "eager" : "lazy"} decoding="async"
        onLoad={event => {
          const image = event.currentTarget;
          const source = image.currentSrc;
          // The native image stays visible without JavaScript too. Clear the background
          // only after decoding, including transparent images, without affecting the GSAP layer.
          void image.decode().then(() => {
            if (image.currentSrc === source && image.parentElement)
              image.parentElement.style.backgroundImage = "none";
          }).catch(() => {});
        }} />
    </picture>;
  };

  return <div className="project-preview" ref={root}>
    {picture(index)}
    {playing && picture(next, true)}
  </div>;
}
