"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
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
          <button className="mobile-menu" aria-label="Открыть меню">
            Меню <Menu size={20} />
          </button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="mobile-panel"
          showCloseButton={false}
          aria-describedby={undefined}
        >
          <SheetTitle className="sr-only">Навигация BOBAR</SheetTitle>
          <SheetClose className="menu-close" aria-label="Закрыть меню">
            <X />
          </SheetClose>
          <Brand />
          <nav aria-label="Мобильная навигация">
            {[...links, ["#contact", "Обсудить проект"]].map(([href, text]) => (
              <a key={href} href={href} onClick={() => setOpen(false)}>
                {text}
              </a>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
