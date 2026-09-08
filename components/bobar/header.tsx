"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ArrowUpRight, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Brand } from "./brand";

const links = [
  ["#work", "Работы"],
  ["#pricing", "Стоимость"],
  ["#process", "Как работаю"],
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const destination = useRef<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  function navigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!document.getElementById(href.slice(1))) return;
    event.preventDefault();
    destination.current = href;
    setOpen(false);
  }

  function finishClosing(event: Event) {
    // Radix otherwise focuses the header trigger after the anchor has scrolled.
    // Wait for the panel to unmount and its scroll lock to release before moving.
    event.preventDefault();
    const href = destination.current;
    destination.current = null;
    const section = href && document.getElementById(href.slice(1));
    if (!section) {
      trigger.current?.focus({ preventScroll: true });
      return;
    }
    const heading = section.querySelector<HTMLElement>("h1, h2") ?? section;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    if (window.location.hash !== href) window.history.pushState(null, "", href);
    section.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start",
    });
  }

  return (
    <header className="site-header container">
      <Brand />
      <nav className="desktop-nav" aria-label="Основная навигация">
        {links.map(([href, text]) => (
          <a key={href} href={href}>
            {text}
          </a>
        ))}
      </nav>
      <a className="header-cta" href="#contact">
        Обсудить проект
      </a>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button ref={trigger} className="mobile-menu" aria-label="Открыть меню">
            <span className="menu-toggle-icon" aria-hidden="true"><span /><span /></span>
          </button>
        </SheetTrigger>
        <SheetContent
          side="top"
          className="mobile-panel"
          showCloseButton={false}
          aria-describedby={undefined}
          onCloseAutoFocus={finishClosing}
        >
          <SheetTitle className="sr-only">Навигация BOBAR</SheetTitle>
          <div className="mobile-panel-header">
            <Brand onClick={(event) => navigate(event, "#top")} />
            <SheetClose className="menu-close" aria-label="Закрыть меню">
              <X size={25} strokeWidth={1.5} />
            </SheetClose>
          </div>
          <nav aria-label="Мобильная навигация">
            {[...links, ["#contact", "Обсудить проект"]].map(([href, text]) => (
              <a key={href} href={href} onClick={(event) => navigate(event, href)}>
                {text}
                {href === "#contact" && <ArrowUpRight size={23} aria-hidden="true" />}
              </a>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
