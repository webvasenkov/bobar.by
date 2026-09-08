import { z } from "zod";

const contactPattern = /^(?:@[A-Za-z][A-Za-z0-9_]{4,31}|\+?[\d\s()\-]{7,24})$/;
export const inquirySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Напишите имя, минимум 2 символа.")
    .max(80, "Не больше 80 символов."),
  contact: z
    .string()
    .trim()
    .regex(
      contactPattern,
      "Укажите номер телефона или Telegram в формате @username.",
    )
    .refine(
      (value) =>
        value.startsWith("@") ||
        (value.replace(/\D/g, "").length >= 7 &&
          value.replace(/\D/g, "").length <= 15),
      "Проверьте номер телефона.",
    ),
  message: z
    .string()
    .trim()
    .min(10, "Расскажите немного подробнее, минимум 10 символов.")
    .max(3000, "Не больше 3000 символов."),
});
export type Inquiry = z.infer<typeof inquirySchema>;
export const inquiryRequestSchema = inquirySchema.extend({
  website: z.string().max(200).default(""),
  requestId: z.string().uuid(),
});
