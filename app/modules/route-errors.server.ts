import { json, redirect } from "@remix-run/node";

export class ExpectedRouteError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
  }
}

export function routeErrorMessage(error: unknown, fallback = "Une erreur est survenue.") {
  if (error instanceof ExpectedRouteError) return error.message;
  if (error instanceof Error) return error.message.split("\n")[0] || fallback;
  return fallback;
}

export function jsonOrRedirectError(request: Request, error: unknown, target: string) {
  const message = routeErrorMessage(error);
  if (request.headers.get("accept")?.includes("application/json")) {
    const status = error instanceof ExpectedRouteError ? error.status : 500;
    return json({ error: message }, { status });
  }
  return redirect(`${target}?error=${encodeURIComponent(message)}`);
}
