"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import type { Project } from "@/lib/project-types";
import { BrandMark } from "./brand";
import { ProjectGallery } from "./project-gallery";

export function Portfolio({ projects }: { projects: Project[] }) {
  const [viewportRef, api] = useEmblaCarousel({
    loop: false,
    align: "start",
    containScroll: "trimSnaps",
    duration: 22,
  });
  const [selected, setSelected] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const total = projects.length + 1;
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!api) return;
    const update = () => setSelected(api.selectedScrollSnap());
    update();
    api.on("select", update);
    api.on("reInit", update);
    return () => {
      api.off("select", update);
      api.off("reInit", update);
    };
  }, [api]);
  useEffect(() => {
    if (!api) return;
    let nearby = false;
    const prepared = new WeakSet<HTMLImageElement>();
    const prepareImages = () => {
      if (!nearby) return;
      const current = api.selectedScrollSnap();
      api.slideNodes().slice(Math.max(0, current - 1), current + 2).forEach((slide) => {
        const image = slide.querySelector("img");
        if (!image || prepared.has(image)) return;
        prepared.add(image);
        image.loading = "eager";
        // Decode adjacent screenshots before a swipe, not during its first frame.
        void image.decode().catch(() => prepared.delete(image));
      });
    };
    const observer = new IntersectionObserver(([entry]) => {
      nearby = entry.isIntersecting;
      prepareImages();
    }, { rootMargin: "400px 0px" });
    observer.observe(api.rootNode());
    api.on("select", prepareImages);
    api.on("reInit", prepareImages);
    return () => {
      observer.disconnect();
      api.off("select", prepareImages);
      api.off("reInit", prepareImages);
    };
  }, [api]);
  const move = useCallback(
    (direction: number) => api?.scrollTo(selected + direction, reducedMotion),
    [api, selected, reducedMotion],
  );

  return (
    <section
      id="work"
      className="portfolio container"
      aria-labelledby="work-title"
      aria-roledescription="карусель"
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          move(event.key === "ArrowRight" ? 1 : -1);
        }
      }}
    >
      <div className="portfolio-heading">
        <h2 id="work-title">Мои работы.</h2>
      </div>
      <div className="portfolio-viewport" ref={viewportRef}>
        <div className="portfolio-track">
          {projects.map((project, index) => (
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              draggable={false}
              className="project-slide project-link"
              key={project.id}
              aria-label={`${index + 1} из ${total}: ${project.name}`}
              aria-roledescription="слайд"
              aria-hidden={selected !== index}
              inert={selected !== index}
            >
              <ProjectGallery project={project} active={selected === index} />
              <div className="project-caption">
                <div>
                  <h3>{project.name}</h3>
                  <p>{project.description}</p>
                </div>
                <span className="project-open">
                  Открыть сайт <ArrowUpRight size={18} />
                </span>
              </div>
            </a>
          ))}
          <article
            className="project-slide invitation-slide"
            aria-label={`${total} из ${total}: Ваш будущий сайт`}
            aria-roledescription="слайд"
            aria-hidden={selected !== projects.length}
            inert={selected !== projects.length}
          >
            <div className="invitation">
              <BrandMark />
              <h3>
                Здесь может быть
                <br />
                ваш сайт.
              </h3>
              <p>Следующий проект – для вашего бизнеса.</p>
              <a className="button" href="#contact">
                Обсудить проект <ArrowRight size={20} />
              </a>
            </div>
            <div className="project-caption invitation-caption">
              <p>Давайте начнём с вашей идеи.</p>
            </div>
          </article>
        </div>
      </div>
      <div className="carousel-controls" aria-label="Переключение работ">
        <button
          onClick={() => move(-1)}
          disabled={selected === 0}
          aria-label="Предыдущая работа"
        >
          <ArrowLeft />
        </button>
        <span aria-live="polite" aria-atomic="true">
          {selected + 1} / {total}
        </span>
        <button
          onClick={() => move(1)}
          disabled={selected === total - 1}
          aria-label="Следующая работа"
        >
          <ArrowRight />
        </button>
      </div>
    </section>
  );
}
