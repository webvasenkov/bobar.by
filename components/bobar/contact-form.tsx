"use client";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check } from "lucide-react";
import { inquirySchema, type Inquiry } from "@/lib/inquiry";

export function ContactForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Inquiry>({ resolver: zodResolver(inquirySchema) });
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState("");
  const honeypot = useRef<HTMLInputElement>(null);
  const requestId = useRef<string | null>(null);
  const submit = async (values: Inquiry) => {
    setServerError("");
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          website: honeypot.current?.value ?? "",
          requestId: requestId.current,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const result: unknown = await response.json().catch(() => null);
        throw new Error(
          result &&
            typeof result === "object" &&
            "error" in result &&
            typeof result.error === "string"
            ? result.error
            : "Не удалось отправить заявку. Попробуйте ещё раз.",
        );
      }
      setSuccess(true);
    } catch (error) {
      setServerError(
        error instanceof Error && error.name === "Error"
          ? error.message
          : "Не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз.",
      );
    }
  };
  if (success)
    return (
      <div className="form-success" role="status">
        <Check size={34} />
        <h3>Заявка получена.</h3>
        <p>
          Спасибо! Я свяжусь с вами по указанному номеру или в Telegram, чтобы
          обсудить проект.
        </p>
      </div>
    );
  return (
    <form className="contact-form" onSubmit={handleSubmit(submit)} noValidate>
      <div className="form-row">
        <div className="field">
          <label htmlFor="name">Имя</label>
          <input
            id="name"
            autoComplete="name"
            placeholder="Как к вам обращаться"
            maxLength={80}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
            {...register("name")}
          />
          {errors.name && (
            <p className="field-error" id="name-error">
              {errors.name.message}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="contact-field">Телефон / Telegram</label>
          <input
            id="contact-field"
            autoComplete="tel"
            placeholder="Номер или @username"
            maxLength={40}
            aria-invalid={!!errors.contact}
            aria-describedby={errors.contact ? "contact-error" : undefined}
            {...register("contact")}
          />
          {errors.contact && (
            <p className="field-error" id="contact-error">
              {errors.contact.message}
            </p>
          )}
        </div>
      </div>
      <div className="field">
        <label htmlFor="message">Расскажите о проекте</label>
        <textarea
          id="message"
          rows={4}
          placeholder="Какой сайт нужен?"
          maxLength={3000}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "message-error" : undefined}
          {...register("message")}
        />
        {errors.message && (
          <p className="field-error" id="message-error">
            {errors.message.message}
          </p>
        )}
      </div>
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="website">Ваш сайт</label>
        <input
          id="website"
          name="website"
          ref={honeypot}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      {serverError && (
        <p className="field-error" role="alert">
          {serverError}
        </p>
      )}
      <button className="button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Отправляю…" : "Обсудить проект"}
        <ArrowRight size={20} />
      </button>
      <p className="form-note">Контакт нужен, чтобы ответить на заявку.</p>
    </form>
  );
}
