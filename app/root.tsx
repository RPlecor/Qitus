import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from "@remix-run/react";
import { ClerkProvider } from "@clerk/remix";
import { rootAuthLoader } from "@clerk/remix/ssr.server";
import { assertRuntimeConfig, getRuntimeConfig } from "~/modules/runtime-config.server";
import stylesheet from "~/styles/paperasse.css?url";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap",
  },
  { rel: "stylesheet", href: stylesheet },
];

export async function loader(args: LoaderFunctionArgs) {
  const config = getRuntimeConfig();
  if (config.authMode !== "clerk") return json({ authMode: "dev" });
  assertRuntimeConfig(config);
  return rootAuthLoader(args, () => ({ authMode: "clerk" }), {
    publishableKey: config.clerkPublishableKey,
    secretKey: config.clerkSecretKey,
  });
}

export default function App() {
  const data = useLoaderData<typeof loader>() as { authMode: string; clerkState?: unknown };
  const body = (
    <>
      <Outlet />
      <ScrollRestoration />
      <Scripts />
    </>
  );

  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {data.authMode === "clerk" ? <ClerkProvider clerkState={data.clerkState as never}>{body}</ClerkProvider> : body}
      </body>
    </html>
  );
}
