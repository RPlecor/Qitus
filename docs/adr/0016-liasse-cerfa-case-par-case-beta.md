# ADR 0016 — Liasse CERFA complète case par case avant beta ouverte

## Statut

Acceptée — 2026-05-24

## Contexte

Qitus prépare un dossier fiscal vérifiable. Une source Markdown résumée ne suffit pas pour la beta ouverte : l'utilisateur et l'expert-comptable doivent voir chaque case de la liasse 2033 ou 2050, comprendre ce qui est calculé, ce qui reste à compléter et ce qui bloque.

## Décision

Qitus génère une préparation CERFA complète case par case pour les liasses 2033 et 2050.

Chaque case est présente dans le référentiel actif, avec :

- code de case ;
- tableau ;
- libellé ;
- source attendue ;
- valeur calculée ou vide ;
- statut `calculée`, `à compléter`, `non applicable` ou `bloquée` ;
- résolution interne `calculated`, `zero_by_absence`, `to_complete`, `not_applicable` ou `blocked` ;
- comportement référentiel `emptyBehavior` ;
- famille de calcul `calculationFamily` ;
- complétude de source ;
- raison lisible quand elle n'est pas calculée.

La liasse reste une préparation vérifiable, non télétransmise. La validation finale revient à l'utilisateur ou à l'expert-comptable.

### Gouvernance du zéro fiable

Qitus ne doit pas transformer l'absence de données en zéro par défaut. Une case peut être calculée à zéro uniquement si le référentiel actif et la complétude des sources permettent de justifier ce zéro.

Avant ouverture beta, les cases 2033 et 2050 doivent faire l'objet d'une revue case par case du couple `emptyBehavior` / `calculationFamily`. Cette revue peut être interne Qitus, expert-comptable, ou fondée sur une source officielle exploitable, mais elle doit être documentée.

Règles conservatrices :

- une case de compte de résultat sans mouvement peut être zéro si le journal est exportable ;
- une case de bilan sans solde ne vaut zéro que si la balance est réputée complète ;
- les données fiscales, déclaratives, déficits, affectations, crédits et annexes restent à compléter si la donnée source manque ;
- une case hors régime ou hors forme juridique est non applicable, pas zéro ;
- une case incertaine reste à compléter.

## Conséquences

- `TaxPackageCerfaCenter` devient le centre métier de génération et de contrôle de la liasse.
- `TaxPackageTemplateRenderer` rend la structure CERFA ; il ne porte plus les règles fiscales.
- `TaxPackageCaseResolutionPolicy` décide la résolution de chaque case à partir du référentiel et de la complétude des sources.
- `TaxPackageSourceReadinessCenter` reste un Module interne P0 ; il peut alimenter les synthèses produit sans devenir un écran dédié.
- Le dossier de preuves inclut `tax-package-cerfa-manifest.json`.
- Le manifeste conserve la raison de résolution, notamment pour les cases `zero_by_absence`.
- La beta ouverte est bloquée si le FEC ou la liasse CERFA ne sont pas générables.
- Les cases non calculables ne sont jamais masquées ni forcées à zéro.
