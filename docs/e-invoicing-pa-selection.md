# Sélection d'une Plateforme Agréée

Qitus ne devient pas Plateforme Agréée. Qitus se connecte à une PA immatriculée quand un contrat, une sandbox et une documentation API sont disponibles.

## Critères de sélection

- Immatriculation PA vérifiable sur impots.gouv.
- API de réception des factures fournisseurs disponible en sandbox.
- Webhooks signés pour disponibilité, rejet, annulation et changement de statut.
- Téléchargement du XML source et du visuel PDF si disponible.
- Identifiants provider stables pour dédoublonnage.
- Export de preuve : statut PA, horodatage de réception, identifiants et audit.
- Documentation des cas d'erreur et de révocation de mandat.
- Conditions commerciales et SLA lisibles.
- Périmètre e-reporting documenté, même si hors scope Qitus actuel.

## Statuts Qitus

- `not_started` : aucune PA réelle n'est choisie.
- `evaluating` : une PA est en analyse, mais contrat/API/sandbox incomplets.
- `sandbox_ready` : la sandbox Qitus valide le parcours, sans conformité légale.
- `selected` : une PA réelle est configurée et son Adapter concret doit passer le contract test.
- `blocked` : une information provider essentielle manque.

## Décision produit

Une facture uploadée ou reçue via mock/sandbox peut être exploitée comptablement, mais elle n'est pas marquée comme réception PA conforme. Seul un Adapter PA concret validé pourra retourner `receptionCompliant=true`.
