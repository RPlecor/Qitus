# Analyse execution etapes 1 a 4 - Paperasse SaaS MVP

Date d'analyse : 2026-05-19

Objectif : transformer le repo `romainsimon/paperasse` en socle metier d'un SaaS web, sans developper l'application a ce stade.

Sources inspectees :
- Repo GitHub public `romainsimon/paperasse`, clone temporaire du 2026-05-19.
- `package.json`, `company.example.json`, scripts `scripts/`, connecteurs `integrations/`.
- Cadrage local backend v3, prototype frontend 28 ecrans, fixtures locales.

## 1. Audit technique des scripts Paperasse

### Conclusion courte

Le repo Paperasse est principalement CLI-first. Pour le SaaS, l'integration fiable passe par un `PaperasseAdapter` qui prepare un repertoire de travail compatible avec le repo, execute les scripts CLI, puis recupere les outputs.

Certains modules sont importables et peuvent etre reutilises directement, mais les generateurs documents ne le sont pas encore sans refactor upstream.

### Scripts et integration recommandee

| Fichier | Role | Importable | Recommandation SaaS |
|---|---|---:|---|
| `scripts/generate-fec.js` | Genere FEC 18 colonnes depuis `company.json` + `data/journal-entries.json` | Non | Executer avec `child_process.execFile` dans un workdir isole |
| `scripts/generate-statements.js` | Genere `bilan.md`, `compte-de-resultat.md`, `balance.md` | Non | Executer avec `execFile`, puis lire `output/*.md` |
| `scripts/generate-pdfs.js` | Convertit les Markdown generes en PDFs via Puppeteer | Non | Executer cote worker uniquement, avec Chromium disponible |
| `scripts/calc.js` | Calculs CCA, amortissement, IS, prorata, TVA simplifiee | Oui, partiel | Importer les helpers exportes pour tests/calculs backend |
| `integrations/qonto/fetch.js` | Fetch Qonto et transformation transaction | Oui, partiel | Importer `transformTransaction`; executer fetch reel via worker isole |
| `integrations/stripe/fetch.js` | Fetch Stripe balance tx/payouts | Oui, partiel | Importer fetchers si les secrets sont injectes par company |
| `scripts/generate-facturx.js` | Genere XML CII/PDF Factur-X | Non | Hors MVP initial, sauf si facturation devient un pilier produit |
| `scripts/validate-facture.js` | Valide mentions obligatoires facture | Non | V1 facturation |
| `scripts/import-stripe-invoices.js` | Importe factures Stripe | Non | V1 facturation/Stripe avance |
| `scripts/upload-qonto-attachments.js` | Upload justificatifs Qonto | Non | V1/V2 connecteurs avances |
| `scripts/update_data.py` | Met a jour/verifie donnees reglementaires | CLI Python | Cron quotidien ou hebdomadaire separe |

### Observations structurantes

- `generate-fec.js`, `generate-statements.js` et `generate-pdfs.js` appellent `main()` directement et lisent depuis `ROOT = path.join(__dirname, '..')`. Ils ne sont donc pas faits pour recevoir des objets en memoire.
- Le `--output` existe pour FEC/etats/PDFs, mais les inputs restent implicitement `company.json`, `data/journal-entries.json`, `data/pcg_YYYY.json` et `templates/`.
- `generate-pdfs.js` depend de Puppeteer. Le worker Render devra embarquer Chromium ou utiliser une image compatible.
- `calc.js` est le meilleur candidat a une reutilisation deterministe directe : il protege contre les calculs mentaux et reflete l'esprit de l'annexe.
- `company.example.json` reel differe du schema cible du cadrage local : les champs sont `tax`, `banks`, `naf`, `president.first_name/last_name`, `invoicing`, `einvoicing`, `payment`, pas `tax_regime`, `bank_accounts`, `naf_code`, etc.

## 2. Specification cible du PaperasseAdapter

### Role

Le `PaperasseAdapter` doit faire l'isolation entre :
- le monde SaaS : Prisma, PostgreSQL, objets types, multi-tenant, fichiers S3 ;
- le monde Paperasse : repo filesystem single-user, `company.json`, `data/*.json`, `output/*`.

### Contrat minimal MVP

```ts
interface PaperasseAdapter {
  toPaperasseCompany(company: CompanyWithRelations): PaperasseCompanyJson;
  toPaperasseJournalEntries(entries: JournalEntryWithLines[]): PaperasseJournalEntry[];
  prepareWorkDir(input: PaperasseWorkDirInput): Promise<PaperasseWorkDir>;
  runFec(workDir: PaperasseWorkDir): Promise<GeneratedArtifact>;
  runStatements(workDir: PaperasseWorkDir): Promise<GeneratedArtifact[]>;
  runPdfs(workDir: PaperasseWorkDir): Promise<GeneratedArtifact[]>;
  cleanupWorkDir(workDir: PaperasseWorkDir): Promise<void>;
}
```

### Mapping `Company` SaaS vers `company.json` reel

| SaaS | Paperasse reel |
|---|---|
| `company.name` | `name` |
| `company.legalForm` | `legal_form` |
| `company.capital` | `capital` |
| adresse eclatee | `address` chaine lisible |
| `company.siren` | `siren` |
| `company.siret` | `siret` |
| `company.rcs` | `rcs` |
| `company.nafCode` | `naf` |
| dirigeant | `president.title`, `first_name`, `last_name`, `civility` |
| exercice actif | `fiscal_year.start`, `end`, `is_first_year` |
| regime TVA | `tax.regime_tva` |
| regime IS | `tax.regime_is` |
| taux TVA defaut | `tax.tva_rate` |
| comptes bancaires | `banks[].id`, `name`, `account`, `fec_account` |
| Stripe | `stripe_accounts[]` |
| Qonto | `qonto.enabled` |
| facturation | `invoicing`, `einvoicing`, `payment` |

### Workdir attendu

```txt
/tmp/paperasse-{companyId}-{jobId}/
├── company.json
├── data/
│   ├── journal-entries.json
│   ├── pcg_2026.json
│   ├── nomenclature-liasse-fiscale.csv
│   └── sources.json
├── templates/
├── scripts/
└── output/
```

### Regles d'execution

- Toujours utiliser `execFile`, jamais une commande shell composee.
- Passer un timeout par script.
- Capturer stdout/stderr dans `DocumentJobLog`.
- Stocker `scriptVersion` avec le hash du repo Paperasse utilise.
- Supprimer le workdir apres upload, avec cron de nettoyage en filet de securite.
- Ne jamais ecrire de secret en clair dans le workdir. Pour Qonto/Stripe, injecter les secrets via env au worker.

## 3. Nettoyage et etat des fixtures

### Nettoyage realise

`fixtures/README.md` a ete aligne avec l'etat reel du dossier :
- transactions normalisees : 26, pas 63 ;
- categorisations attendues : 14 cas, pas un fichier complet par transaction ;
- fichiers separes `ambiguous-cases.json`, `immobilisations.json`, `pca-cca.json`, `rapprochement-bancaire.json` absents, remplaces par `cloture-context.json` ;
- ecritures : extrait de 16 ecritures, pas journal annuel complet ;
- ajout d'une section "etat actuel" et des points a completer.

### Incoherences encore a traiter

| Fixture | Probleme | Decision recommandee |
|---|---|---|
| `normalized-2025-q1.json` | Description annonce 42 transactions, fichier contient 26 objets | Corriger la meta ou completer le fichier |
| `expected-categorizations.json` | Resume annonce 42 transactions, fichier contient 14 cas | Transformer en dataset partiel explicite ou completer a 26 |
| `ambiguous_cases_summary` | `low_confidence_ids` contient 1 id mais annonce 3 low confidence | Recalculer apres completion |
| `stripe-transactions.json` | Payouts et `fees_summary` semblent incoherents en ordre de grandeur | Recalculer depuis une regle source unique |
| `etats-financiers-summary.json` | Cibles indicatives extrapolees, non derivees du journal complet | Ne pas utiliser comme assertion comptable stricte |

### Golden dataset recommande

Pour lancer le dev avec des tests fiables :
1. `fixtures/minimal/` : 10 transactions couvrant parsing, lookup, pattern, correction, IA residuelle.
2. `fixtures/q1/` : Qonto complet Q1, categorisation complete, ecritures completes.
3. `fixtures/closing/` : journal clos + amortissements + CCA + IS + FEC attendu.
4. `fixtures/stripe/` : charges, fees, refunds, payouts avec montants reconciliables.

## 4. Perimetre MVP recommande

### MVP conseille

Le MVP doit prouver la boucle comptable centrale, pas tout le perimetre Paperasse.

Perimetre recommande :
1. Auth + onboarding entreprise.
2. Export `Company` vers `company.json` compatible Paperasse.
3. Import CSV Qonto/BNP/SG/Boursorama.
4. Normalisation + deduplication.
5. Categorisation deterministe : `VendorMapping`, patterns, corrections.
6. IA seulement pour les transactions residuelles ambigues.
7. Correction utilisateur + apprentissage par regles.
8. Generation ecritures en partie double.
9. Dashboard basique : CA, charges, resultat, tresorerie, transactions a verifier.
10. Generation FEC + balance + bilan + compte de resultat via scripts Paperasse.
11. Documents stockes et telechargeables.
12. Chat comptable contextuel, limite et tracke en cout.

### A mettre en phase suivante

- Cloture annuelle complete en 12 etapes.
- Connecteurs Qonto/Stripe live.
- Stripe Billing avance.
- Factur-X et facturation electronique.
- Audit CAC et simulation controle fiscal.
- Multi-company reel.

### Justification

Ce MVP maximise la reutilisation de Paperasse, limite la surface reglementaire, reduit le cout IA et donne vite une valeur SaaS tangible : importer, categoriser, corriger, generer les documents.

Le vrai moat produit est l'association :
- regles deterministes tracables ;
- skills Paperasse pour les cas ambigus et le chat ;
- documents officiels generes par scripts reutilises ;
- UX SaaS simple pour des dirigeants qui ne veulent pas manipuler un repo.
