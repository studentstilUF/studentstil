import type { Context } from '@netlify/functions';

/** Ett fel som ska visas för användaren med en viss HTTP-statuskod. */
export class HttpError extends Error {
  readonly status: number;
  readonly fieldErrors: Partial<Record<string, string>> | undefined;

  constructor(status: number, message: string, fieldErrors?: Partial<Record<string, string>>) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

type JsonInit = { status?: number; headers?: Record<string, string> };

/** JSON-svar. Cachas inte som standard, eftersom de flesta svar är personliga. */
export function json(data: unknown, init: JsonInit = {}): Response {
  return Response.json(data, {
    status: init.status ?? 200,
    headers: { 'Cache-Control': 'no-store', ...init.headers },
  });
}

type Handler = (req: Request, context: Context) => Promise<Response>;

/**
 * Omsluter en funktion så att alla fel blir begripliga JSON-svar på svenska.
 * Oväntade fel loggas (syns under Netlify → Logs → Functions) men detaljerna
 * visas aldrig för besökaren.
 */
export function handle(handler: Handler): Handler {
  return async (req, context) => {
    try {
      return await handler(req, context);
    } catch (error) {
      if (error instanceof HttpError) {
        return json(
          {
            error: error.message,
            ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
          },
          { status: error.status },
        );
      }
      console.error(error);
      return json({ error: 'Något gick fel hos oss. Försök igen om en stund.' }, { status: 500 });
    }
  };
}

export function requireMethod(req: Request, ...methods: readonly string[]): void {
  if (!methods.includes(req.method)) throw new HttpError(405, 'Metoden stöds inte.');
}

/**
 * CSRF-skydd: anrop som ändrar data måste komma från vår egen sajt.
 * Webbläsare skickar alltid med Origin på POST-anrop.
 */
export function requireSameOrigin(req: Request): void {
  if (req.headers.get('origin') !== new URL(req.url).origin) {
    throw new HttpError(403, 'Anropet kom inte från vår sajt.');
  }
}

const MAX_BODY_CHARS = 20_000;

export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > MAX_BODY_CHARS) throw new HttpError(413, 'Förfrågan är för stor.');
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    throw new HttpError(400, 'Ogiltig förfrågan.');
  }
}
