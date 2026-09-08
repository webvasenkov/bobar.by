import { env } from "@/lib/runtime";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const json = (value: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store", ...headers } });

export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== (env.SITE_ORIGIN || new URL(request.url).origin))
    throw new HttpError(403, "Недопустимый источник запроса.");
}

export async function readBytes(request: Request, max: number) {
  if (Number(request.headers.get("content-length")) > max) throw new HttpError(413, "Файл или запрос слишком большой.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Пустой запрос.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) { await reader.cancel(); throw new HttpError(413, "Файл или запрос слишком большой."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

export async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new HttpError(415, "Ожидается JSON.");
  const bytes = await readBytes(request, 16_384);
  try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown; }
  catch { throw new HttpError(400, "Не удалось прочитать данные."); }
}

export function handleApi(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try { return await handler(request); }
    catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error("Admin request failed", new URL(request.url).pathname);
      return json({ error: "Не удалось выполнить запрос. Данные формы сохранены на экране – попробуйте ещё раз." }, 503);
    }
  };
}
