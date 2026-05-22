import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { AppShell, Main, StatusPill, TableShell } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ExpertReviewQueue } from "~/modules/expert-dossier/expert-review-queue.server";
import { ExpertReviewWorkflow } from "~/modules/expert-dossier/expert-review-workflow.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const workflow = new ExpertReviewWorkflow();
  const [review, queue] = await Promise.all([
    workflow.getReview(workspace),
    new ExpertReviewQueue().getReviewQueue(workspace, { status: "all" }),
  ]);
  return json({ review, items: queue.items, summary: queue.summary, error: new URL(args.request.url).searchParams.get("error") });
}

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const form = await args.request.formData();
  const workflow = new ExpertReviewWorkflow();
  const queue = new ExpertReviewQueue();
  try {
    const intent = String(form.get("intent") || "");
    if (intent === "create") {
      await workflow.createReviewItem({ kind: "workspace", workspace }, {
        sectionCode: String(form.get("sectionCode") || "general"),
        severity: String(form.get("severity") || "WARNING") as never,
        title: String(form.get("title") || ""),
        body: String(form.get("body") || ""),
      });
    }
    if (intent === "comment") {
      await queue.answerItem(workspace, {
        itemId: String(form.get("itemId")),
        body: String(form.get("body") || ""),
      });
    }
    if (intent === "resolve") {
      await workflow.resolveReviewItem(workspace, { itemId: String(form.get("itemId")), note: String(form.get("note") || "") });
    }
    if (intent === "waive") {
      await queue.waiveItem(workspace, { itemId: String(form.get("itemId")), note: String(form.get("note") || "") });
    }
    if (intent === "reopen") {
      await workflow.reopenReviewItem(workspace, { itemId: String(form.get("itemId")), note: String(form.get("note") || "") });
    }
    return redirect("/dossier-ec/revue");
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/dossier-ec/revue");
  }
}

export default function DossierReviewPage() {
  const { review, items, summary, error } = useLoaderData<typeof loader>();
  return (
    <AppShell active="dossier-ec">
      <Main title="Revue EC" subtitle="Demandes et commentaires cabinet">
        {error ? <div className="alert red">{error}</div> : null}
        <div className="card card-head">
          <div>
            <strong>{review ? `Revue ${review.status}` : "Aucune revue active"}</strong>
            <div className="sub">{review ? `${summary.open} demande(s) ouvertes · ${summary.blockingOpen} bloquante(s) · ${summary.answered} répondue(s)` : "Crée un partage depuis Dossier EC."}</div>
          </div>
        </div>

        <div className="card">
          <h3>Créer une demande interne</h3>
          <Form method="post" className="form-grid">
            <input type="hidden" name="intent" value="create" />
            <label>Section<input name="sectionCode" defaultValue="general" /></label>
            <label>Sévérité<select name="severity" defaultValue="WARNING"><option>INFO</option><option>WARNING</option><option>BLOCKING</option></select></label>
            <label>Titre<input name="title" required /></label>
            <label>Détail<textarea name="body" required /></label>
            <button className="btn" type="submit">Ajouter</button>
          </Form>
        </div>

        <TableShell>
          <table className="tbl">
            <thead><tr><th>Demande</th><th>Section</th><th>Statut</th><th>Sévérité</th><th>Commentaires</th><th>Actions</th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.title}</strong><div className="sub">{item.body}</div></td>
                  <td className="mono">{item.sectionCode}</td>
                  <td><StatusPill label={item.status} tone={item.status === "RESOLVED" || item.status === "WAIVED" ? "ok" : "warn"} /></td>
                  <td><StatusPill label={item.severity} tone={item.severity === "BLOCKING" ? "error" : item.severity === "WARNING" ? "warn" : "info"} /></td>
                  <td>{item.comments.length}</td>
                  <td>
                    <Form method="post" className="inline-form">
                      <input type="hidden" name="itemId" value={item.id} />
                      <input name="note" placeholder="Note" />
                      <button className="btn btn-sm" name="intent" value="resolve" type="submit">Résoudre</button>
                      <button className="btn btn-sm" name="intent" value="waive" type="submit">Ignorer</button>
                      <button className="btn btn-sm" name="intent" value="reopen" type="submit">Réouvrir</button>
                    </Form>
                    <Form method="post" className="inline-form">
                      <input type="hidden" name="intent" value="comment" />
                      <input type="hidden" name="itemId" value={item.id} />
                      <input name="body" placeholder="Réponse" />
                      <button className="btn btn-sm" type="submit">Répondre</button>
                    </Form>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? <tr><td colSpan={6} className="sub">Aucune demande de revue.</td></tr> : null}
            </tbody>
          </table>
        </TableShell>
      </Main>
    </AppShell>
  );
}
