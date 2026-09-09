import { ArrowRight, MessageCircle, LockKeyhole, Headphones, MessagesSquare, ListChecks, Code2, Rocket } from "lucide-react";
import { Header } from "@/components/bobar/header";
import { Brand } from "@/components/bobar/brand";
import { HeroMark, RevealEffects } from "@/components/bobar/motion";
import { Portfolio } from "@/components/bobar/portfolio";
import { HeroSlogans } from "@/components/bobar/hero-slogans";
import { Faq } from "@/components/bobar/faq";
import { ContactForm } from "@/components/bobar/contact-form";
import { steps } from "@/lib/content";
import { listProjects } from "@/lib/projects";
import type { Project } from "@/lib/project-types";

export const dynamic = "force-dynamic";

const stepIcons = [MessagesSquare, ListChecks, Code2, Rocket];

export default async function Home() {
  let projects: Project[] = [];
  let portfolioUnavailable = false;
  try { projects = await listProjects(); }
  catch { portfolioUnavailable = true; console.error("Portfolio storage unavailable"); }
  return (
    <div id="top">
      <a className="skip-link" href="#main">
        К содержимому
      </a>
      <Header />
      <main id="main">
        <section className="hero container" aria-labelledby="hero-title">
          <div className="hero-copy">
            <h1 id="hero-title">
              Строю сайты
              <br />
              для бизнеса
            </h1>
            <HeroSlogans />
            <div className="hero-actions">
              <a className="button" href="#contact">
                Обсудить проект <ArrowRight size={22} />
              </a>
              <a className="text-link" href="#work">
                Смотреть работы
              </a>
            </div>
          </div>
          <HeroMark />
        </section>
        {portfolioUnavailable ? <section id="work" className="section container">
          <h2>Мои работы</h2><p className="subtitle">Не удалось загрузить работы. Попробуйте обновить страницу.</p>
        </section> : <Portfolio projects={projects} />}
        <section
          id="pricing"
          className="pricing section container"
          aria-labelledby="pricing-title"
          data-reveal
        >
          <h2 id="pricing-title">Понятная стоимость</h2>
          <div className="pricing-layout">
            <dl className="price-list">
              {[
                ["Лендинг", "590"],
                ["Сайт компании", "990"],
                ["Магазин / Custom", "1690"],
              ].map(([name, price]) => (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd>
                    от {price}{"\u00a0"}<img className="currency-symbol" src="/byn-symbol.svg" width="24" height="24" alt="белорусских рублей" />
                  </dd>
                </div>
              ))}
            </dl>
            <div className="pricing-note">
              <p>
                После короткого обсуждения задачи фиксируем стоимость до начала
                работы.
              </p>
              <a className="button" href="#contact">
                Рассчитать проект <ArrowRight size={20} />
              </a>
            </div>
          </div>
        </section>
        <section
          id="process"
          className="process section container"
          aria-labelledby="process-title"
          data-reveal
        >
          <h2 id="process-title">
            От идеи
            <br />
            до запуска
          </h2>
          <ol>
            {steps.map(([name, description], index) => {
              const Icon = stepIcons[index];
              return (
              <li key={name}>
                <div className="step-heading"><Icon size={28} strokeWidth={1.5} aria-hidden="true" /><span className="step-number">0{index + 1}</span></div>
                <h3>{name}</h3>
                <p>{description}</p>
              </li>
              );
            })}
          </ol>
        </section>
        <section
          className="about section container"
          aria-labelledby="about-title"
          data-reveal
        >
          <h2 id="about-title">
            Ваш сайт
            <br />
            создаю я
          </h2>
          <div>
            <p className="about-intro">Я Денис, разработчик BOBAR.</p>
            <p className="subtitle">
              Вы обсуждаете проект напрямую со мной – и я же отвечаю за дизайн,
              разработку и запуск.
            </p>
            <ul className="promises">
              <li>
                <MessageCircle aria-hidden="true" size={25} strokeWidth={1.5} />
                <span>Напрямую{" "}<br />с разработчиком.</span>
              </li>
              <li>
                <LockKeyhole aria-hidden="true" size={25} strokeWidth={1.5} />
                <span>Цена фиксируется{" "}<br />заранее.</span>
              </li>
              <li>
                <Headphones aria-hidden="true" size={25} strokeWidth={1.5} />
                <span>Остаюсь на связи{" "}<br />после запуска.</span>
              </li>
            </ul>
          </div>
        </section>
        <Faq />
        <section
          id="contact"
          className="contact section container"
          aria-labelledby="contact-title"
          data-reveal
        >
          <h2 id="contact-title">
            Есть идея?
            <br />
            Давайте построим
          </h2>
          <p className="subtitle">
            Расскажите о задаче – я предложу решение,
            <br className="desktop-break" /> стоимость и сроки.
          </p>
          <ContactForm />
        </section>
      </main>
      <footer className="site-footer container">
        <Brand />
        <div>
          <span>© 2026 BOBAR</span>
          <span>bobar.by</span>
          <a href="#contact">Связаться ↑</a>
        </div>
      </footer>
      <RevealEffects />
    </div>
  );
}
