"use client";

import { useId, useState } from "react";
import { Check, ImagePlus, LoaderCircle, Monitor, Smartphone, Trash2 } from "lucide-react";

type ScreenshotUploadProps = {
  variant: "desktop" | "mobile";
  sources: string[];
  projectName: string;
  loading: boolean;
  disabled: boolean;
  onSelect: (files: File[]) => void;
  onRemove: (source: string) => void;
};

export function ScreenshotUpload({ variant, sources, projectName, loading, disabled, onSelect, onRemove }: ScreenshotUploadProps) {
  const id = useId();
  const [dimensions, setDimensions] = useState<Record<string, { width: number; height: number }>>({});
  const mobile = variant === "mobile";
  const title = mobile ? "Для телефона" : "Для компьютера";
  const DeviceIcon = mobile ? Smartphone : Monitor;
  const hint = mobile
    ? "Рекомендуем 780 × 1688 px. Подойдёт и 390 × 844 px."
    : "Рекомендуем 1440 × 900 px или 1920 × 1080 px.";

  return (
    <div className="admin-screenshot">
      <div className="admin-upload-heading"><DeviceIcon size={20} aria-hidden="true" /><span>{title}</span></div>
      <p id={`${id}-hint`} className="admin-upload-recommendation">{hint}</p>
      <label className="admin-upload-zone" data-disabled={disabled || sources.length >= 8} htmlFor={id}>
        <input
          id={id}
          className="admin-file-input"
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          aria-label={`Скриншот ${title.toLowerCase()}`}
          aria-describedby={`${id}-hint ${id}-format`}
          disabled={disabled || sources.length >= 8}
          onChange={event => {
            onSelect(Array.from(event.target.files || []));
            event.target.value = "";
          }}
        />
        <span className="admin-upload-icon" aria-hidden="true">
          {loading ? <LoaderCircle className="admin-upload-spinner" size={24} /> : <ImagePlus size={24} strokeWidth={1.6} />}
        </span>
        <span className="admin-upload-copy">
          <span className="admin-upload-action">{loading ? "Загружаем…" : sources.length ? "Добавить скриншоты" : "Прикрепить скриншоты"}</span>
          <span id={`${id}-format`} className="admin-upload-format">PNG, JPEG, WebP · до 8 МБ</span>
        </span>
      </label>
      <div className="admin-screenshot-list">
        {sources.map((source, index) => <figure key={source}>
          <div className={`admin-preview ${mobile ? "admin-preview-mobile" : ""}`}>
            <img src={source} alt={`${title}: ${projectName || "предпросмотр"}, ${index + 1}`} loading="lazy"
              onLoad={event => {
                const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
                setDimensions(previous => ({ ...previous, [source]: { width, height } }));
              }} />
          </div>
          <figcaption className="admin-upload-status">
            <Check size={16} aria-hidden="true" /> {index === 0 ? "Обложка" : `Скриншот ${index + 1}`}
            {dimensions[source] && <span>· {dimensions[source].width} × {dimensions[source].height} px</span>}
          </figcaption>
          <button type="button" className="admin-link" disabled={disabled}
            aria-label={`Удалить скриншот ${index + 1} ${title.toLowerCase()}`}
            onClick={() => onRemove(source)}><Trash2 size={16} aria-hidden="true" /> Удалить</button>
        </figure>)}
      </div>
      {loading && <span className="admin-upload-announcement" role="status">Загружаем скриншот {title.toLowerCase()}…</span>}
    </div>
  );
}
