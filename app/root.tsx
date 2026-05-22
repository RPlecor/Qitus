import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from "@remix-run/react";
import { ClerkProvider } from "@clerk/remix";
import { rootAuthLoader } from "@clerk/remix/ssr.server";
import { getOptionalWorkspaceShell, type WorkspaceShellContext } from "~/modules/company-workspace/company-workspace.server";
import { assertRuntimeConfig, getRuntimeConfig } from "~/modules/runtime-config.server";
import stylesheet from "~/styles/qitus.css?url";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap",
  },
  { rel: "stylesheet", href: stylesheet },
];

export async function loader(args: LoaderFunctionArgs) {
  const config = getRuntimeConfig();
  if (config.authMode !== "clerk") return json({ authMode: "dev" });
  assertRuntimeConfig(config);
  return rootAuthLoader(args, async () => ({
    authMode: "clerk",
    shell: await getOptionalWorkspaceShell(args),
  }), {
    publishableKey: config.clerkPublishableKey,
    secretKey: config.clerkSecretKey,
    signInUrl: "/login",
    signUpUrl: "/signup",
    signInForceRedirectUrl: "/dashboard",
    signUpForceRedirectUrl: "/dashboard",
  });
}

export default function App() {
  const data = useLoaderData<typeof loader>() as { authMode: string; clerkState?: unknown; shell?: WorkspaceShellContext | null };
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
