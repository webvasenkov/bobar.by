"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, Plus, LogOut } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ScreenshotUpload } from "./screenshot-upload";
import type { Project } from "@/lib/project-types";

class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...options, credentials: "same-origin", cache: "no-store" });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
      ? data.error : "Не удалось выполнить запрос. Попробуйте ещё раз.";
    throw new ApiError(message, response.status);
  }
  return data as T;
}
const jsonOptions = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export function PortfolioAdmin() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editing, setEditing] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const report = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) setSignedIn(false);
    setError(error instanceof Error ? error.message : "Не удалось связаться с сервером.");
  };
  useEffect(() => {
    let mounted = true;
    api("/api/admin/session").then(() => api<Project[]>("/api/admin/projects"))
      .then(data => { if (mounted) { setProjects(data); setSignedIn(true); } })
      .catch(error => { if (mounted) { setSignedIn(false); if (!(error instanceof ApiError && error.status === 401)) report(error); } });
    return () => { mounted = false; };
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/admin/session", jsonOptions("POST", { username: form.get("username"), password: form.get("password") }));
      setProjects(await api<Project[]>("/api/admin/projects"));
      setSignedIn(true);
    } catch (error) { report(error); }
    finally { setBusy(false); }
  }

  async function action(body: unknown) {
    setBusy(true); setError(""); setNotice("");
    try { setProjects(await api<Project[]>("/api/admin/projects", jsonOptions("PATCH", body))); setNotice("Изменения сохранены."); }
    catch (error) { report(error); }
    finally { setBusy(false); }
  }

  const newProject = () => {
    setError(""); setNotice("");
    setEditing({ id: crypto.randomUUID(), name: "", description: "", url: "", desktopImage: "", mobileImage: "", desktopImages: [], mobileImages: [], published: false,
      position: Math.max(-1, ...projects.map(project => project.position)) + 1, version: 0 });
  };

  return <main className="admin-shell">
    <header className="admin-header">
      {/* A full navigation lets beforeunload protect unsaved editor changes. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="admin-brand">BOBAR</a>
      <div className="admin-header-actions">
        <a href="/" target="_blank" rel="noopener noreferrer">Открыть сайт <ArrowUpRight size={16} /></a>
        {signedIn && !editing && <button className="admin-link" disabled={busy} onClick={async () => {
          setBusy(true);
          try { await api("/api/admin/session", { method: "DELETE" }); setSignedIn(false); setProjects([]); setNotice(""); }
          catch (error) { report(error); }
          finally { setBusy(false); }
        }}><LogOut size={16} /> Выйти</button>}
      </div>
    </header>
    {signedIn === null ? <p role="status">Проверяем вход…</p> : !signedIn ?
      <section className="admin-login">
        <h1>Ваши работы.</h1><p>Войдите, чтобы обновить портфолио.</p>
        <form onSubmit={login}>
          <label>Логин<input name="username" autoComplete="username" required autoCapitalize="none" spellCheck={false} /></label>
          <label>Пароль<input name="password" type="password" autoComplete="current-password" required /></label>
          {error && <p className="admin-error" role="alert">{error}</p>}
          <button className="button" disabled={busy}>{busy ? "Входим…" : "Войти"}</button>
        </form>
      </section> : <>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {notice && <p className="admin-notice" role="status">{notice}</p>}
      {editing ? <ProjectEditor key={editing.id} initial={editing} onCancel={() => { setEditing(null); setError(""); }} onSaved={data => {
        setProjects(data); setEditing(null); setError(""); setNotice("Работа сохранена. Опубликованные изменения уже доступны на сайте.");
      }} /> : <>
        <div className="admin-title"><div><h1>Мои работы.</h1><p>{projects.filter(project => project.published).length} на сайте · {projects.length} всего</p></div>
          <button className="button" onClick={newProject} disabled={busy}><Plus size={20} /> Добавить работу</button></div>
        <div className="admin-projects">
          {projects.map((project, index) => <article className="admin-project" key={project.id}>
            <button className="admin-thumb" onClick={() => { setEditing(project); setNotice(""); setError(""); }} aria-label={`Редактировать ${project.name}`}>
              {project.desktopImage ? <img src={project.desktopImage} alt="" /> : <span>Нет скриншота</span>}
            </button>
            <div className="admin-project-info"><h2>{project.name}</h2><p>{project.published ? "Опубликовано" : "Скрыто"}{!project.mobileImage && " · Добавьте мобильный скриншот"}</p>
              <button className="admin-link" onClick={() => { setEditing(project); setNotice(""); setError(""); }}>Редактировать</button></div>
            <div className="admin-project-actions">
              <button className="admin-icon" aria-label={`Поднять ${project.name}`} disabled={busy || index === 0} onClick={() => action({ id: project.id, version: project.version, direction: "up" })}><ArrowUp size={20} /></button>
              <button className="admin-icon" aria-label={`Опустить ${project.name}`} disabled={busy || index === projects.length - 1} onClick={() => action({ id: project.id, version: project.version, direction: "down" })}><ArrowDown size={20} /></button>
              <label className="admin-switch"><Switch checked={project.published} disabled={busy} aria-label={`Показывать ${project.name} на сайте`} onCheckedChange={published => action({ id: project.id, version: project.version, published })} /><span>На сайте</span></label>
            </div>
          </article>)}
        </div>
        <p className="admin-hint">Слайд «Здесь может быть ваш сайт» всегда находится в конце. Скрытые работы доступны только здесь.</p>
      </>}
    </>}
  </main>;
}

function ProjectEditor({ initial, onSaved, onCancel }: {
  initial: Project; onSaved: (projects: Project[]) => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<"desktopImages" | "mobileImages" | null>(null);
  const [localError, setLocalError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const report = (error: unknown) => {
    const expired = error instanceof ApiError && error.status === 401;
    setSessionExpired(expired);
    setLocalError(expired ? "Сессия истекла. Войдите в новой вкладке и повторите сохранение – правки остаются здесь."
      : error instanceof Error ? error.message : "Не удалось связаться с сервером.");
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const change = (key: keyof Project, value: string | boolean) => setDraft(previous => ({ ...previous, [key]: value }));
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function upload(files: File[], field: "desktopImages" | "mobileImages") {
    if (!files.length) return;
    setLocalError("");
    if (draft[field].length + files.length > 8) { setLocalError("Можно добавить до 8 скриншотов для каждого экрана."); return; }
    if (files.some(file => file.size > 8 * 1024 * 1024)) { setLocalError("Максимальный размер одного скриншота – 8 МБ."); return; }
    setUploading(field);
    try {
      // Upload sequentially to bound memory; keep successful files if a later one fails.
      for (const file of files) {
        const result = await api<{ path: string }>("/api/admin/images", { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
        setDraft(previous => ({ ...previous, [field]: [...previous[field], result.path] }));
      }
    } catch (error) { report(error); }
    finally { setUploading(null); }
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setLocalError("");
    try { onSaved(await api<Project[]>("/api/admin/projects", jsonOptions("PUT", draft))); }
    catch (error) { report(error); }
    finally { setBusy(false); }
  }
  return <section className="admin-editor">
    <div className="admin-title"><h1>{initial.version ? "Редактировать работу." : "Новая работа."}</h1></div>
    <form onSubmit={save}>
      <div className="admin-fields">
        <label>Название<input value={draft.name} onChange={event => change("name", event.target.value)} maxLength={100} minLength={2} required placeholder="Название проекта" /></label>
        <label>Ссылка на сайт<input type="url" value={draft.url} onChange={event => change("url", event.target.value)} maxLength={500} required placeholder="https://example.by" /></label>
        <label className="admin-wide">Короткое описание<textarea value={draft.description} onChange={event => change("description", event.target.value)} minLength={5} maxLength={350} rows={3} required placeholder="Какую задачу решает сайт" /></label>
      </div>
      <div className="admin-uploads">
        {(["desktopImages", "mobileImages"] as const).map(field => (
          <ScreenshotUpload
            key={field}
            variant={field === "mobileImages" ? "mobile" : "desktop"}
            sources={draft[field]}
            projectName={draft.name}
            loading={uploading === field}
            disabled={!!uploading || busy}
            onSelect={files => { void upload(files, field); }}
            onRemove={source => setDraft(previous => ({ ...previous, [field]: previous[field].filter(path => path !== source) }))}
          />
        ))}
      </div>
      <p className="admin-hint">До 8 скриншотов для компьютера и до 8 для телефона. Первый будет обложкой. Удаление применяется после сохранения. Лучше снять первый экран сайта. Длинные скриншоты тоже подходят – в слайдере видна верхняя часть. На телефоне показывается мобильная версия.</p>
      {localError && <p className="admin-error" role="alert">{localError}</p>}
      {sessionExpired && <a className="admin-link" href="/admin" target="_blank" rel="noopener noreferrer">Войти в новой вкладке</a>}
      <label className="admin-switch"><Switch aria-label="Показывать работу на сайте" checked={draft.published} onCheckedChange={value => change("published", value)} /><span>Показывать работу на сайте</span></label>
      <div className="admin-save"><button className="button" disabled={busy || !!uploading}>{busy ? "Сохраняем…" : draft.published ? "Сохранить и опубликовать" : "Сохранить скрытой"}</button>
        <button type="button" className="admin-link" disabled={busy || !!uploading} onClick={onCancel}>{dirty ? "Назад без сохранения" : "Назад к работам"}</button></div>
    </form>
  </section>;
}
