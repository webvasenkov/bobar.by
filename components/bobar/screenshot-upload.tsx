"use client";

import { useId, useState } from "react";
import { Check, ImagePlus, LoaderCircle, Monitor, Smartphone } from "lucide-react";

type ScreenshotUploadProps = {
  variant: "desktop" | "mobile";
  source: string;
  projectName: string;
  loading: boolean;
  disabled: boolean;
  onSelect: (file: File | undefined) => void;
};

export function ScreenshotUpload({ variant, source, projectName, loading, disabled, onSelect }: ScreenshotUploadProps) {
  const id = useId();
  const [dimensions, setDimensions] = useState<{ source: string; width: number; height: number } | null>(null);
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
      <label className="admin-upload-zone" data-disabled={disabled} htmlFor={id}>
        <input
          id={id}
          className="admin-file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label={`Скриншот ${title.toLowerCase()}`}
          aria-describedby={`${id}-hint ${id}-format`}
          disabled={disabled}
          onChange={event => {
            onSelect(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <span className="admin-upload-icon" aria-hidden="true">
          {loading ? <LoaderCircle className="admin-upload-spinner" size={24} /> : <ImagePlus size={24} strokeWidth={1.6} />}
        </span>
        <span className="admin-upload-copy">
          <span className="admin-upload-action">{loading ? "Загружаем…" : source ? "Заменить скриншот" : "Прикрепить скриншот"}</span>
          <span id={`${id}-format`} className="admin-upload-format">PNG, JPEG, WebP · до 8 МБ</span>
        </span>
      </label>
      {source && <>
        <div className={`admin-preview ${mobile ? "admin-preview-mobile" : ""}`}>
          <img
            src={source}
            alt={`${title}: ${projectName || "предпросмотр"}`}
            onLoad={event => setDimensions({ source, width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          />
        </div>
        <p className="admin-upload-status" role="status">
          <Check size={16} aria-hidden="true" /> Скриншот загружен
          {dimensions?.source === source && <span>· {dimensions.width} × {dimensions.height} px</span>}
        </p>
      </>}
      {loading && <span className="admin-upload-announcement" role="status">Загружаем скриншот {title.toLowerCase()}…</span>}
    </div>
  );
}
