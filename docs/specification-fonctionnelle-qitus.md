# Spécification fonctionnelle — Qitus
Version : 1.0
Date : 2026-05-23
Statut : DRAFT
Auteur : Codex

## 1. Vue d'ensemble produit

Qitus permet à une TPE, PME ou entreprise individuelle de transformer ses flux bancaires, justificatifs, écritures, TVA, rapprochements et travaux de clôture en un dossier comptable exploitable par l'utilisateur et par son expert-comptable.

Cette spec couvre le périmètre fonctionnel de Qitus : espace entreprise, imports bancaires, catégorisation, écritures, TVA, pièces, documents, rapprochements, clôture, factures électroniques entrantes, dossier expert-comptable, connecteurs, notifications, audit, abonnement et conformité beta.

Cette spec exclut explicitement la tenue multi-société complète, l'émission de factures clients, la télétransmission fiscale, les paiements, EBICS, la certification Plateforme Agréée, la signature électronique certifiée et la modification comptable par un expert externe.

### Glossaire

| Terme | Définition |
|---|---|
| Entreprise | Entité juridique unique gérée dans Qitus. |
| Exercice | Période comptable active utilisée pour les imports, écritures, documents et clôture. |
| Import | Lot de mouvements bancaires chargé par CSV ou connecteur. |
| Transaction | Mouvement bancaire normalisé provenant d'un import. |
| Catégorisation | Proposition ou confirmation du compte comptable appliqué à une transaction. |
| Écriture | Enregistrement comptable équilibré débit/crédit. |
| OD | Opération diverse de clôture, créée uniquement après validation utilisateur. |
| Pièce | Justificatif attaché à une transaction, écriture, OD ou facture. |
| FEC | Fichier des écritures comptables exportable pour contrôle. |
| PA | Plateforme Agréée pour la réception réglementaire de factures électroniques. |
| Dossier EC | Dossier partagé à l'expert-comptable, avec preuves, documents, commentaires et validation. |

## 2. Carte des blocs fonctionnels

```text
┌─────────────────────┐
│ 1. Espace           │
│ entreprise/exercice │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│ 2. Connecteurs      │────▶│ 3. Imports &        │────▶│ 4. Catégorisation   │
│ & sources externes  │     │ transactions        │     │ & écritures         │
└─────────┬───────────┘     └─────────┬───────────┘     └─────────┬───────────┘
          │                           │                           │
          ▼                           ▼                           ▼
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│ 5. Factures         │────▶│ 6. Pièces &         │────▶│ 7. TVA              │
│ électroniques       │     │ preuves             │     │ déclarative         │
└─────────┬───────────┘     └─────────┬───────────┘     └─────────┬───────────┘
          │                           │                           │
          └──────────────┬────────────┴──────────────┬────────────┘
                         ▼                           ▼
              ┌─────────────────────┐     ┌─────────────────────┐
              │ 8. Rapprochements   │────▶│ 9. Clôture & OD     │
              └─────────┬───────────┘     └─────────┬───────────┘
                        │                           │
                        ▼                           ▼
              ┌─────────────────────┐     ┌─────────────────────┐
              │ 10. Documents       │────▶│ 11. Dossier EC      │
              │ & exports           │     │ collaboratif        │
              └─────────┬───────────┘     └─────────┬───────────┘
                        │                           │
                        └──────────────┬────────────┘
                                       ▼
                         ┌─────────────────────┐
                         │ 12. Notifications   │
                         │ audit & abonnement  │
                         └─────────────────────┘
```

## Bloc 1 — Espace entreprise, utilisateur et exercice

### Responsabilité
Gérer l'accès utilisateur, l'entreprise active, son profil fiscal et l'exercice comptable actif.

### Acteurs
Utilisateur final, système d'authentification, système de facturation, webhook d'identité.

### Données manipulées
| Donnée | Type | Source | Obligatoire | Contraintes |
|---|---|---|---|---|
| utilisateur_id | Identifiant | Système d'authentification | Oui | Stable, unique, non modifiable par l'utilisateur. |
| email | Email | Système d'authentification | Oui | Format email valide, 254 caractères max. |
| nom_entreprise | Texte | Utilisateur | Oui | 2 à 120 caractères. |
| siren_siret | Texte | Utilisateur | Non | 9 ou 14 chiffres si renseigné. |
| régime_tva | Enum | Utilisateur | Oui | FRANCHISE, RÉEL_SIMPLIFIÉ, RÉEL_NORMAL. |
| exigibilité_tva | Enum | Utilisateur | Oui | ENCAISSEMENTS, DÉBITS, MIXTE. |
| exercice_actif | Période | Utilisateur | Oui | Date début < date fin, durée 1 à 24 mois. |
| statut_exercice | Enum | Qitus | Oui | OUVERT, CLÔTURÉ. |

### Règles métier
- **RM-ESPACE-01** : Un utilisateur authentifié DOIT avoir une entreprise active avant d'accéder aux fonctions comptables.
  - Condition : utilisateur connecté sans entreprise finalisée.
  - Résultat attendu : Qitus affiche l'onboarding entreprise.
  - Exception : les pages de connexion, inscription, onboarding, santé système et partage externe restent accessibles.
- **RM-ESPACE-02** : Un exercice CLÔTURÉ NE DOIT PAS accepter de mutation comptable.
  - Condition : statut_exercice = CLÔTURÉ.
  - Résultat attendu : les imports, validations OD, synchronisations et corrections sont refusés.
  - Exception : la consultation, les exports et le dossier EC restent accessibles.
- **RM-ESPACE-03** : Un changement de régime TVA DOIT créer un diagnostic de recalcul si des écritures existent.
  - Condition : régime_tva modifié après génération d'écritures.
  - Résultat attendu : Qitus signale que les écritures existantes ne produisent pas encore une TVA exploitable.
  - Exception : aucune alerte n'est créée si aucune écriture n'existe.
- **RM-ESPACE-04** : Les données de démonstration NE DOIVENT PAS être créées dans un espace utilisateur réel sans action explicite.
  - Condition : mode authentifié réel.
  - Résultat attendu : Qitus démarre avec une entreprise à compléter.
  - Exception : le mode local de démonstration peut charger un dataset contrôlé.

### Comportements utilisateur
- **Précondition** : utilisateur nouvellement inscrit.
  - **Action** : il renseigne le nom d'entreprise, l'exercice et le régime fiscal.
  - **Postcondition** : l'entreprise est activée.
  - **Feedback utilisateur** : Qitus ouvre le tableau de bord.
- **Précondition** : exercice ouvert.
  - **Action** : l'utilisateur modifie son régime TVA.
  - **Postcondition** : le profil fiscal est mis à jour.
  - **Feedback utilisateur** : Qitus affiche les impacts à traiter.

### Cas limites et erreurs
| Cas | Déclencheur | Comportement attendu |
|---|---|---|
| SIRET invalide | Saisie autre que 9 ou 14 chiffres | Refus de sauvegarde avec message de correction. |
| Exercice incohérent | Date fin ≤ date début | Refus de sauvegarde. |
| Webhook identité dupliqué | Même événement reçu deux fois | Traitement idempotent, sans doublon utilisateur. |
| Suppression d'identité externe | Webhook de suppression | Compte marqué supprimé ou anonymisé sans suppression des écritures. |

### Dépendances
- **Fournit à** : tous les blocs — entreprise, exercice actif, profil fiscal, statut d'exercice.
- **Consomme de** : Bloc 12 — abonnement et droits d'usage.
- **Services externes** : fournisseur d'identité, fournisseur de facturation si abonnement actif.

### Contraintes non-fonctionnelles
- Sécurité : les données d'identité NE DOIVENT PAS exposer de secrets.
- Disponibilité : si le webhook d'identité échoue, la première requête utilisateur DOIT pouvoir créer un profil minimal.

## Bloc 2 — Connecteurs et sources externes

### Responsabilité
Présenter et piloter les connexions Qonto bancaire, Stripe, Open Banking et Qonto PA sans exposer de secrets ni de vocabulaire de test en production.

### Acteurs
Utilisateur final, provider bancaire, Qonto Business API, Stripe, provider Open Banking, Plateforme Agréée, webhook externe, système de test interne.

### Données manipulées
| Donnée | Type | Source | Obligatoire | Contraintes |
|---|---|---|---|---|
| type_connecteur | Enum | Qitus | Oui | QONTO_BANCAIRE, STRIPE, OPEN_BANKING, QONTO_PA. |
| statut_connecteur | Enum | Qitus | Oui | Non configuré, À connecter, Connecté, Synchronisé, À reconnecter, Erreur configuration, PA en attente partenaire, Réception PA conforme. |
| secret_provider | Secret | Environnement sécurisé | Non | Jamais affiché, jamais stocké dans les données métier. |
| consentement_bancaire | Statut | Provider Open Banking | Non | Actif, expiré, révoqué, erreur. |
| dernière_sync | Date-heure | Qitus | Non | ISO 8601. |
| mode_test_interne | Booléen | Configuration Qitus | Oui | Faux par défaut. |

### Règles métier
- **RM-CONN-01** : L'interface produit NE DOIT PAS afficher les termes techniques de test.
  - Condition : mode_test_interne = faux.
  - Résultat attendu : aucun libellé visible ne contient mock, fixture, sandbox, generic_pa ou adapter.
  - Exception : les documents techniques internes peuvent contenir ces termes.
- **RM-CONN-02** : Les connecteurs de test DOIVENT être accessibles uniquement en mode test interne.
  - Condition : mode_test_interne = vrai.
  - Résultat attendu : Qitus affiche le banc de test interne.
  - Exception : aucun bouton de test interne n'est affiché si mode_test_interne = faux.
- **RM-CONN-03** : Qonto bancaire et Qonto PA DOIVENT utiliser des statuts et credentials distincts.
  - Condition : les deux connecteurs sont configurés.
  - Résultat attendu : une erreur Qonto bancaire ne modifie pas le statut Qonto PA.
  - Exception : N/A.
- **RM-CONN-04** : Une synchronisation externe DOIT être refusée si l'exercice est clôturé.
  - Condition : statut_exercice = CLÔTURÉ.
  - Résultat attendu : Qitus affiche une erreur lisible.
  - Exception : consultation du statut connecteur autorisée.
- **RM-CONN-05** : Une erreur provider DOIT être affichée sans secret.
  - Condition : provider retourne une erreur.
  - Résultat attendu : message utilisateur générique et action recommandée.
  - Exception : N/A.

### Comportements utilisateur
- **Précondition** : connecteur Qonto bancaire configuré.
  - **Action** : l'utilisateur lance une synchronisation Qonto.
  - **Postcondition** : les mouvements nouveaux sont transmis au bloc Imports.
  - **Feedback utilisateur** : compteur de mouvements récupérés et importés.
- **Précondition** : provider Open Banking configuré.
  - **Action** : l'utilisateur connecte une banque.
  - **Postcondition** : un consentement bancaire est enregistré.
  - **Feedback utilisateur** : statut `Connecté` ou action de reconnexion.
- **Précondition** : mode_test_interne = vrai.
  - **Action** : l'utilisateur lance un test interne.
  - **Postcondition** : des données simulées sont créées avec marqueur de test.
  - **Feedback utilisateur** : bandeau `Données simulées, non conformes production`.

### Cas limites et erreurs
| Cas | Déclencheur | Comportement attendu |
|---|---|---|
| Secret manquant | Connecteur live sans variable requise | Statut `Erreur configuration`. |
| Consentement expiré | Date d'expiration dépassée | Statut `À reconnecter`. |
| Provider indisponible | Erreur réseau ou 5xx | Échec de sync sans suppression des données existantes. |
| Webhook dupliqué | Même identifiant événement | Traitement une seule fois. |
| Sync en doublon | Même transaction déjà importée | Aucune transaction dupliquée. |

### Dépendances
- **Fournit à** : Bloc 3 — mouvements bancaires normalisés ; Bloc 5 — factures fournisseur reçues ; Bloc 12 — statuts, alertes et audit.
- **Consomme de** : Bloc 1 — entreprise et exercice ; Bloc 12 — droits d'usage.
- **Services externes** : Qonto Business API, Stripe API, provider Open Banking, Plateforme Agréée.

### Contraintes non-fonctionnelles
- Sécurité : les secrets NE DOIVENT PAS apparaître dans l'interface, les logs, les exports ou l'audit.
- Performance : la lecture de statut des connecteurs DOIT répondre en moins de 500 ms hors provider externe.

## Bloc 3 — Imports et transactions bancaires

### Responsabilité
Transformer les mouvements bancaires locaux ou connectés en transactions normalisées, vérifiables et prêtes à catégoriser.

### Acteurs
Utilisateur final, connecteur bancaire, worker d'import, système de validation.

### Données manipulées
| Donnée | Type | Source | Obligatoire | Contraintes |
|---|---|---|---|---|
| import_id | Identifiant | Qitus | Oui | Unique par import. |
| source_import | Enum | Qitus | Oui | CSV_UPLOAD, OPEN_BANKING, QONTO_API. |
| fichier_source | Fichier | Utilisateur ou connecteur | Oui | CSV pour import bancaire ; taille max définie par abonnement. |
| transaction_id | Identifiant | Qitus | Oui | Unique par transaction. |
| date_transaction | Date | Fichier ou provider | Oui | Incluse dans l'exercice ou signalée hors période. |
| libellé | Texte | Fichier ou provider | Oui | 1 à 280 caractères. |
| montant | Décimal | Fichier ou provider | Oui | Deux décimales, non nul. |
| statut_import | Enum | Qitus | Oui | Brouillon, parsing, revue, terminé, erreur. |

### Règles métier
- **RM-IMP-01** : Un import DOIT conserver sa source.
  - Condition : import créé.
  - Résultat attendu : la source CSV, Open Banking ou Qonto API est consultable.
  - Exception : N/A.
- **RM-IMP-02** : Une transaction déjà importée NE DOIT PAS être dupliquée.
  - Condition : même identifiant source ou même empreinte date/montant/libellé.
  - Résultat attendu : Qitus ignore le doublon.
  - Exception : si les identifiants source diffèrent et les montants diffèrent, Qitus crée une transaction distincte.
- **RM-IMP-03** : Un import incomplet DOIT aller en revue.
  - Condition : colonnes manquantes, compte inconnu ou catégorisation incertaine.
  - Résultat attendu : statut_import = revue.
  - Exception : erreur de fichier illisible = statut erreur.
- **RM-IMP-04** : La suppression d'un import DOIT supprimer ses transactions et écritures d'import.
  - Condition : confirmation utilisateur valide.
  - Résultat attendu : les données immédiates de l'import sont supprimées.
  - Exception : pièces, OD, profil, règles et audit sont conservés.
- **RM-IMP-05** : La relance de catégorisation NE DOIT PAS écraser les corrections utilisateur confirmées.
  - Condition : import en revue ou erreur avec lignes parsées.
  - Résultat attendu : seules les catégorisations non verrouillées sont recalculées.
  - Exception : transaction manuelle ou confirmée conservée.

### Comportements utilisateur
- **Précondition** : exercice ouvert.
  - **Action** : l'utilisateur importe un CSV bancaire.
  - **Postcondition** : les transactions sont créées ou mises en revue.
  - **Feedback utilisateur** : Qitus affiche le nombre de lignes importées, en revue et en erreur.
- **Précondition** : import en revue avec règles disponibles.
  - **Action** : l'utilisateur relance la catégorisation.
  - **Postcondition** : les transactions non confirmées sont recalculées.
  - **Feedback utilisateur** : Qitus affiche le nouveau statut de l'import.
- **Précondition** : import existant.
  - **Action** : l'utilisateur demande la suppression.
  - **Postcondition** : Qitus affiche un aperçu avant confirmation.
  - **Feedback utilisateur** : compteurs d'imports, transactions, écritures et lignes supprimables.

### Cas limites et erreurs
| Cas | Déclencheur | Comportement attendu |
|---|---|---|
| CSV sans date | Colonne date absente | Import bloqué en mapping ou erreur lisible. |
| Montant nul | Ligne bancaire à zéro | Ligne signalée, pas d'écriture automatique. |
| Encodage invalide | Fichier illisible | Import en erreur avec message lisible. |
| Exercice clôturé | Import ou reset demandé | Action refusée. |
| Reset imports avec pièces liées | Suppression d'écritures importées | Pièces conservées et signalées comme potentiellement orphelines. |

### Dépendances
- **Consomme de** : Bloc 2 — flux bancaires ; Bloc 1 — exercice actif.
- **Fournit à** : Bloc 4 — transactions à catégoriser ; Bloc 8 — transactions à rapprocher ; Bloc 12 — événements d'activité.
- **Services externes** : N/A pour import CSV ; provider bancaire via Bloc 2.

### Contraintes non-fonctionnelles
- Performance : un import de 500 lignes DOIT produire un retour de statut exploitable sans timeout utilisateur.
- Disponibilité : si l'écriture comptable échoue, les transactions parsées restent consultables.

## Bloc 4 — Catégorisation et écritures comptables

### Responsabilité
Transformer les transactions confirmées en écritures comptables équilibrées, avec comptes, TVA et statut de revue.

### Acteurs
Utilisateur final, moteur de catégorisation, système de règles comptables, système de génération d'écritures.

### Données manipulées
| Donnée | Type | Source | Obligatoire | Contraintes |
|---|---|---|---|---|
| compte_comptable | Texte | Règle ou utilisateur | Oui | Format PCG numérique, 3 à 10 caractères. |
| taux_tva | Décimal ou nul | Règle ou utilisateur | Non | 0, 2.1, 5.5, 10, 20 ou aucune TVA. |
| nature_tva | Enum | Règle ou utilisateur | Non | Achat/vente domestique, intracom, autoliquidation, exonéré, hors champ. |
| statut_catégorisation | Enum | Qitus | Oui | Proposé, à vérifier, confirmé, corrigé, manuel. |
| écriture_id | Identifiant | Qitus | Non | Présent seulement après génération. |
| ligne_débit | Décimal | Qitus | Oui si écriture | Deux décimales, ≥ 0. |
| ligne_crédit | Décimal | Qitus | Oui si écriture | Deux décimales, ≥ 0. |

### Règles métier
- **RM-ECR-01** : Une écriture DOIT être équilibrée.
  - Condition : écriture générée.
  - Résultat attendu : total débit = total crédit.
  - Exception : aucune écriture n'est créée si l'équilibre ne peut pas être garanti.
- **RM-ECR-02** : Une transaction à vérifier NE DOIT PAS générer de document final sans signalement.
  - Condition : statut_catégorisation = à vérifier.
  - Résultat attendu : Qitus bloque ou avertit selon le document demandé.
  - Exception : consultation de la transaction autorisée.
- **RM-ECR-03** : Une correction utilisateur DOIT primer sur les règles automatiques.
  - Condition : transaction confirmée ou corrigée manuellement.
  - Résultat attendu : relance de catégorisation sans modification.
  - Exception : l'utilisateur modifie explicitement la correction.
- **RM-ECR-04** : Une règle mise à jour DOIT s'appliquer aux futurs imports.
  - Condition : pack de règles actif.
  - Résultat attendu : nouvelles transactions catégorisées avec les règles actives.
  - Exception : écritures existantes inchangées.
- **RM-ECR-05** : Une écriture existante NE DOIT PAS être reconstruite sans action explicite.
  - Condition : changement de règle, TVA ou profil fiscal.
  - Résultat attendu : Qitus signale l'impact.
  - Exception : action utilisateur de recalcul prévue et auditée.

### Comportements utilisateur
- **Précondition** : transaction en revue.
  - **Action** : l'utilisateur choisit un compte, taux TVA et nature TVA.
  - **Postcondition** : la catégorisation est confirmée.
  - **Feedback utilisateur** : Qitus affiche l'écriture générée ou la raison du blocage.
- **Précondition** : règle applicable détectée.
  - **Action** : Qitus propose une catégorisation.
  - **Postcondition** : la transaction sort de revue si la confiance est suffisante.
  - **Feedback utilisateur** : origine de la suggestion visible.

### Cas limites et erreurs
| Cas | Déclencheur | Comportement attendu |
|---|---|---|
| Compte inconnu | Compte hors PCG attendu | Catégorisation mise en revue. |
| TVA incompatible | Taux et nature incohérents | Refus de validation. |
| Écriture déjà générée | Relance de catégorisation | Pas de doublon d'écriture. |
| Règle trop large | Plusieurs fournisseurs affectés | Avertissement avant activation. |

### Dépendances
- **Consomme de** : Bloc 3 — transactions ; Bloc 1 — régime fiscal ; Bloc 12 — règles à jour.
- **Fournit à** : Bloc 7 — lignes TVA ; Bloc 8 — lignes à rapprocher ; Bloc 10 — journal et FEC ; Bloc 9 — base de clôture.
- **Services externes** : N/A.

### Contraintes non-fonctionnelles
- Audit : toute correction utilisateur DOIT être tracée.
- Sécurité : les écritures validées NE DOIVENT PAS être modifiées silencieusement.

## Bloc 5 — Factures électroniques entrantes

### Responsabilité
Recevoir, lire, conserver, rapprocher et proposer la comptabilisation des factures fournisseurs structurées sans émission de factures clients.

### Acteurs
Utilisateur final, Plateforme Agréée, provider de test interne, système de parsing, expert-comptable lecteur.

### Données manipulées
| Donnée | Type | Source | Obligatoire | Contraintes |
|---|---|---|---|---|
| facture_id | Identifiant | Qitus | Oui | Unique. |
| provenance_facture | Enum | Qitus | Oui | Upload manuel, PA réelle, test interne. |
| format_facture | Enum | Fichier | Oui | Factur-X, UBL, CII, non structuré. |
| fournisseur | Texte | Facture | Non | 1 à 160 caractères si présent. |
| numéro_facture | Texte | Facture | Non | 1 à 80 caractères si présent. |
| date_facture | Date | Facture | Non | ISO 8601 si présente. |
| montant_ht | Décimal | Facture | Non | Deux décimales, ≥ 0. |
| montant_tva | Décimal | Facture | Non | Deux décimales, ≥ 0. |
| montant_ttc | Décimal | Facture | Non | Deux décimales, ≥ 0. |
| statut_facture | Enum | Qitus | Oui | Reçue, parsée, rapprochée, brouillon, comptabilisée, à revoir, erreur. |

### Règles métier
- **RM-EINV-01** : Une facture reçue NE DOIT PAS créer d'écriture automatiquement.
  - Condition : facture importée ou reçue.
  - Résultat attendu : Qitus crée ou met à jour la facture.
  - Exception : aucune.
- **RM-EINV-02** : Une facture structurée DOIT conserver sa source.
  - Condition : XML ou Factur-X détecté.
  - Résultat attendu : Qitus conserve le fichier original et le payload structuré.
  - Exception : parsing impossible = statut erreur avec fichier conservé.
- **RM-EINV-03** : Une facture de test interne NE DOIT PAS être marquée conforme PA.
  - Condition : provenance_facture = test interne.
  - Résultat attendu : conformité réception = non.
  - Exception : aucune.
- **RM-EINV-04** : Une facture PA réelle DOIT exposer sa preuve de réception.
  - Condition : facture reçue via PA validée.
  - Résultat attendu : identifiants PA, statut PA et horodatage de réception visibles.
  - Exception : si la PA ne fournit pas la preuve, la facture reste non conforme.
- **RM-EINV-05** : L'approbation d'un brouillon comptable DOIT créer une écriture dédiée.
  - Condition : brouillon prêt et utilisateur approuve.
  - Résultat attendu : écriture fournisseur créée.
  - Exception : exercice clôturé ou brouillon déséquilibré = approbation refusée.

### Comportements utilisateur
- **Précondition** : facture XML ou Factur-X disponible.
  - **Action** : l'utilisateur l'ajoute dans Qitus.
  - **Postcondition** : les données structurées sont extraites.
  - **Feedback utilisateur** : Qitus affiche fournisseur, numéro, montants et TVA.
- **Précondition** : facture parsée.
  - **Action** : l'utilisateur génère un brouillon comptable.
  - **Postcondition** : brouillon prêt ou à revoir.
  - **Feedback utilisateur** : lignes proposées et justification.
- **Précondition** : facture PA reçue.
  - **Action** : l'utilisateur consulte l'audit de réception.
  - **Postcondition** : aucune mutation.
  - **Feedback utilisateur** : statut PA et preuve visibles.

### Cas limites et erreurs
| Cas | Déclencheur | Comportement attendu |
|---|---|---|
| XML invalide | Fichier structuré non parsable | Statut erreur, message lisible, fichier conservé. |
| Doublon facture | Même source ou même checksum | Mise à jour ou ignore sans doublon. |
| Facture annulée | Statut PA annulé | Facture marquée à revoir, aucune écriture supprimée automatiquement. |
| Facture déjà payée | Transaction bancaire existante | Suggestion de rapprochement sans réécriture silencieuse. |
| Multi-taux TVA | Plusieurs taux dans XML | Ventilation visible et utilisée dans le brouillon. |

### Dépendances
- **Consomme de** : Bloc 2 — PA et test interne ; Bloc 6 — stockage de pièces ; Bloc 4 — politiques comptables.
- **Fournit à** : Bloc 4 — brouillons d'écriture ; Bloc 6 — preuve forte ; Bloc 7 — TVA structurée ; Bloc 11 — dossier EC.
- **Services externes** : Plateforme Agréée contractée.

### Contraintes non-fonctionnelles
- Conformité : Qitus NE DOIT PAS se présenter comme PA.
- Sécurité : tokens PA et secrets webhook NE DOIVENT PAS être exposés.

## Bloc 6 — Pièces, preuves et couverture justificative

### Responsabilité
Gérer les justificatifs, leur rattachement, leur audit de disponibilité et leur rôle dans la couverture comptable.

### Acteurs
Utilisateur final, système d'extraction locale, expert-comptable lecteur.

### Données manipulées
| Donnée | Type | Source | Obligatoire | Contraintes |
|---|---|---|---|---|
| pièce_id | Identifiant | Qitus | Oui | Unique. |
| fichier_pièce | Fichier | Utilisateur ou facture | Oui | PDF, image, texte ou XML ; taille max définie par abonnement. |
| type_preuve | Enum | Qitus ou utilisateur | Non | Facture, reçu, contrat, relevé, autre. |
| lien_preuve | Relation | Utilisateur ou Qitus | Non | Transaction, écriture, OD, facture ou exercice. |
| hash_fichier | Empreinte | Qitus | Oui | Calculée à l'upload. |
| statut_extraction | Enum | Qitus | Oui | Non lancé, réussi, échoué, non applicable. |
| exigence_preuve | Enum | Qitus | Non | Requise, recommandée, satisfaite. |

### Règles métier
- **RM-PREUVE-01** : Une pièce uploadée DOIT être conservée même si elle n'est pas rattachée.
  - Condition : upload réussi.
  - Résultat attendu : pièce visible comme non rattachée.
  - Exception : fichier interdit ou illisible = refus avant création.
- **RM-PREUVE-02** : Une exigence requise DOIT être marquée satisfaite seulement par un lien compatible.
  - Condition : pièce liée à une exigence.
  - Résultat attendu : exigence retirée de la file active.
  - Exception : type ou montant incompatible = exigence reste active.
- **RM-PREUVE-03** : Les pièces recommandées NE DOIVENT PAS bloquer la génération documentaire.
  - Condition : pièce recommandée manquante.
  - Résultat attendu : avertissement seulement.
  - Exception : si une règle de clôture rend la pièce requise.
- **RM-PREUVE-04** : Un fichier local manquant DOIT être signalé sans erreur applicative.
  - Condition : métadonnée présente mais fichier absent.
  - Résultat attendu : audit stockage indique `manquant`.
  - Exception : N/A.

### Comportements utilisateur
- **Précondition** : exigence de preuve active.
  - **Action** : l'utilisateur fournit une pièce depuis l'exigence.
  - **Postcondition** : pièce uploadée et rattachée.
  - **Feedback utilisateur** : exigence satisfaite.
- **Précondition** : pièce non rattachée.
  - **Action** : l'utilisateur choisit une transaction ou écriture.
  - **Postcondition** : lien de preuve créé.
  - **Feedback utilisateur** : couverture mise à jour.

### Cas limites et erreurs
| Cas | Déclencheur | Comportement attendu |
|---|---|---|
| Fichier trop volumineux | Upload dépasse quota | Refus avec message clair. |
| Extraction échouée | OCR ou lecture impossible | Pièce conservée et corrigeable manuellement. |
| Lien cassé | Entité comptable supprimée | Audit signale lien cassé. |
| Pièce sans écriture | Import supprimé après rattachement | Pièce conservée et signalée. |

### Dépendances
- **Consomme de** : Bloc 3, 4, 5, 9 — entités à justifier.
- **Fournit à** : Bloc 10 — bundle de preuve ; Bloc 11 — dossier EC ; Bloc 12 — alertes de couverture.
- **Services externes** : N/A en mode local ; stockage objet si configuré.

### Contraintes non-fonctionnelles
- Sécurité : les fichiers doivent rester accessibles uniquement aux utilisateurs autorisés.
- Intégrité : le hash du fichier DOIT être conservé dans le paquet de preuve.

## Bloc 7 — TVA déclarative

### Responsabilité
Calculer la position TVA, contrôler la cohérence des écritures, générer des brouillons CA3/CA12 locaux et signaler les écritures à recalculer.

### Acteurs
Utilisateur final, système de clôture, dossier EC.

### Données manipulées
| Donnée | Type | Source | Obligatoire | Contraintes |
|---|---|---|---|---|
| régime_tva | Enum | Bloc 1 | Oui | FRANCHISE, RÉEL_SIMPLIFIÉ, RÉEL_NORMAL. |
| taux_tva | Décimal ou nul | Bloc 4 ou 5 | Non | 0, 2.1, 5.5, 10, 20 ou aucune TVA. |
| nature_tva | Enum | Bloc 4 ou 5 | Non | Nature compatible avec taux. |
| période_tva | Période | Utilisateur ou Qitus | Oui | Incluse dans l'exercice. |
| déclaration_tva | Document brouillon | Qitus | Non | CA3 ou CA12, non télétransmis. |
| statut_fraîcheur | Enum | Qitus | Oui | Active, obsolète, remplacée. |

### Règles métier
- **RM-TVA-01** : Une entreprise en franchise NE DOIT PAS générer de CA3 ou CA12.
  - Condition : régime_tva = FRANCHISE.
  - Résultat attendu : statut non applicable.
  - Exception : contrôle de seuil possible.
- **RM-TVA-02** : Une déclaration TVA DOIT être brouillon local.
  - Condition : génération demandée.
  - Résultat attendu : document local consultable et téléchargeable.
  - Exception : télétransmission interdite.
- **RM-TVA-03** : Un régime réel sans lignes TVA DOIT produire une alerte action requise.
  - Condition : écritures existantes sans comptes TVA attendus.
  - Résultat attendu : Qitus indique de recalculer ou revoir les imports.
  - Exception : aucune écriture existante = position à zéro acceptable.
- **RM-TVA-04** : Une déclaration DOIT devenir obsolète après changement TVA pertinent.
  - Condition : correction TVA, import, OD, profil fiscal ou écriture postérieure.
  - Résultat attendu : statut obsolète.
  - Exception : modification sans impact TVA = pas d'obsolescence.
- **RM-TVA-05** : Les comptes TVA DOIVENT être rapprochés avec la déclaration.
  - Condition : régime réel.
  - Résultat attendu : écarts signalés.
  - Exception : franchise = non applicable.

### Comportements utilisateur
- **Précondition** : régime réel et écritures TVA présentes.
  - **Action** : l'utilisateur génère une CA3 ou CA12.
  - **Postcondition** : brouillon actif créé.
  - **Feedback utilisateur** : montants par taux, nature et net à payer/crédit.
- **Précondition** : régime TVA changé après import.
  - **Action** : l'utilisateur ouvre TVA.
  - **Postcondition** : aucune écriture modifiée.
  - **Feedback utilisateur** : alerte expliquant les écritures à recalculer.

### Cas limites et erreurs
| Cas | Déclencheur | Comportement attendu |
|---|---|---|
| Taux manquant | Transaction taxable sans taux | Issue TVA bloquante. |
| Nature manquante | Transaction réelle sans nature | Issue TVA bloquante. |
| Déclaration à zéro suspecte | Régime réel avec écritures hors TVA | Alerte action requise. |
| Brouillon remplacé | Régénération même période | Ancien brouillon marqué remplacé, un seul actif. |

### Dépendances
- **Consomme de** : Bloc 1 — profil fiscal ; Bloc 4 — écritures ; Bloc 5 — TVA structurée ; Bloc 9 — OD TVA.
- **Fournit à** : Bloc 10 — documents TVA ; Bloc 11 — dossier EC ; Bloc 12 — impacts.
- **Services externes** : N/A.

### Contraintes non-fonctionnelles
- Conformité : les déclarations TVA générées NE SONT PAS télétransmises.
- Audit : chaque génération et remplacement DOIT être tracé.

## Bloc 8 — Rapprochements

### Responsabilité
Comparer ligne à ligne les sources bancaires, Stripe, tiers et comptes d'attente avec les écritures comptables.

### Acteurs
Utilisateur final, système de connecteurs, expert-comptable lecteur.

### Données manipulées
| Donnée | Type | Source | Obligatoire | Contraintes |
|---|---|---|---|---|
| domaine_rapprochement | Enum | Qitus | Oui | Banque, Stripe, tiers, attente. |
| run_rapprochement | Identifiant | Qitus | Non | Créé à chaque lancement. |
| match | Relation | Qitus ou utilisateur | Non | Deux entités, écart montant, écart date, confiance. |
| issue | Objet de revue | Qitus | Non | Stable, ouverte, résolue, ignorée. |
| note_utilisateur | Texte | Utilisateur | Oui si ignore/résout | 3 à 1000 caractères. |
| fraîcheur | Enum | Qitus | Oui | Jamais lancé, à jour, à relancer. |

### Règles métier
- **RM-RAPP-01** : Un rapprochement DOIT être relancé après changement comptable pertinent.
  - Condition : import, correction, écriture, OD ou sync postérieure au run.
  - Résultat attendu : statut `à relancer`.
  - Exception : changement hors domaine = pas d'obsolescence.
- **RM-RAPP-02** : Une issue ignorée DOIT conserver une note.
  - Condition : utilisateur ignore une issue.
  - Résultat attendu : issue non bloquante mais auditée.
  - Exception : note absente = action refusée.
- **RM-RAPP-03** : Une issue bloquante ouverte DOIT bloquer la clôture concernée.
  - Condition : banque non rapprochée ou compte d'attente ouvert.
  - Résultat attendu : clôture bloquée.
  - Exception : génération documentaire MVP peut rester autorisée avec avertissement.
- **RM-RAPP-04** : Stripe DOIT rester un rapprochement, pas une source de facturation.
  - Condition : sync Stripe.
  - Résultat attendu : events, payouts, frais et refunds alimentent le rapprochement.
  - Exception : aucune facture client créée.

### Comportements utilisateur
- **Précondition** : transactions bancaires importées.
  - **Action** : l'utilisateur lance rapprochement banque.
  - **Postcondition** : matches et issues créés.
  - **Feedback utilisateur** : progression, écarts, lignes non matchées.
- **Précondition** : issue ouverte.
  - **Action** : l'utilisateur résout ou ignore avec note.
  - **Postcondition** : issue change de statut.
  - **Feedback utilisateur** : file de revue mise à jour.

### Cas limites et erreurs
| Cas | Déclencheur | Comportement attendu |
|---|---|---|
| Transaction sans écriture | Import incomplet | Issue bancaire ouverte. |
| Ligne bancaire sans transaction | Écriture manuelle banque | Issue bancaire ouverte. |
| Frais Stripe non comptabilisés | Event fee sans écriture | Issue Stripe ouverte. |
| Compte 471 ouvert | Solde restant | Issue compte d'attente bloquante. |
| Reopen issue | Issue résolue rouverte | Statut ouvert sans perte d'audit. |

### Dépendances
- **Consomme de** : Bloc 3 — transactions ; Bloc 4 — écritures ; Bloc 2 — Stripe et banque.
- **Fournit à** : Bloc 9 — propositions OD d'écart ; Bloc 10 — rapports ; Bloc 11 — dossier EC.
- **Services externes** : Stripe via Bloc 2.

### Contraintes non-fonctionnelles
- Audit : résolution, ignore et réouverture DOIVENT être tracés.
- Sécurité : aucune OD d'écart ne doit être créée automatiquement.

## Bloc 9 — Clôture, workpapers et OD validables

### Responsabilité
Gérer les travaux de clôture, hypothèses, propositions d'OD, preuves associées, validation ou rejet motivé.

### Acteurs
Utilisateur final, expert-comptable lecteur, système de rapprochement, système TVA.

### Données manipulées
| Donnée | Type | Source | Obligatoire | Contraintes |
|---|---|---|---|---|
| workpaper | Objet métier | Utilisateur ou Qitus | Non | Brouillon, prêt, archivé. |
| type_od | Enum | Qitus | Oui si OD | FNP, FAE, PCA, stock, provision, emprunt, paie, TVA, IS, rapprochement. |
| proposition_od | Objet métier | Qitus | Non | Brouillon, prête, approuvée, rejetée, obsolète. |
| calcul | JSON métier | Qitus | Oui si proposition | Montants et hypothèses lisibles. |
| note_rejet | Texte | Utilisateur | Oui si rejet | 3 à 1000 caractères. |
| preuve_requise | Booléen | Qitus | Oui | Selon type d'OD. |

### Règles métier
- **RM-CLOT-01** : Une OD NE DOIT PAS être créée sans validation utilisateur.
  - Condition : proposition prête.
  - Résultat attendu : aucune écriture tant que non approuvée.
  - Exception : aucune.
- **RM-CLOT-02** : Une proposition approuvée DOIT être immuable.
  - Condition : proposition statut approuvée.
  - Résultat attendu : modification refusée.
  - Exception : une nouvelle proposition peut être générée si l'exercice est rouvert.
- **RM-CLOT-03** : Une proposition obsolète NE DOIT PAS être approuvée.
  - Condition : workpaper, pièce, écriture, TVA ou rapprochement modifié après calcul.
  - Résultat attendu : approbation refusée.
  - Exception : recalcul explicite préalable.
- **RM-CLOT-04** : Une OD avec preuve requise NE DOIT PAS être approuvée sans pièce compatible.
  - Condition : preuve_requise = vrai.
  - Résultat attendu : approbation bloquée.
  - Exception : rejet motivé autorisé.
- **RM-CLOT-05** : La clôture finale DOIT vérifier les étapes obligatoires.
  - Condition : utilisateur demande la clôture.
  - Résultat attendu : Qitus bloque si transactions en revue, OD obligatoires ouvertes, rapprochements bloquants ou preuves requises manquantes.
  - Exception : avertissements non bloquants affichés.

### Comportements utilisateur
- **Précondition** : workpaper brouillon.
  - **Action** : l'utilisateur renseigne hypothèses et marque prêt.
  - **Postcondition** : proposition OD générable.
  - **Feedback utilisateur** : aperçu du calcul.
- **Précondition** : proposition OD prête et fraîche.
  - **Action** : l'utilisateur approuve.
  - **Postcondition** : écriture OD créée.
  - **Feedback utilisateur** : lien vers l'écriture OD.
- **Précondition** : proposition OD contestée.
  - **Action** : l'utilisateur rejette avec note.
  - **Postcondition** : proposition rejetée et auditée.
  - **Feedback utilisateur** : rejet visible dans couverture et bundle.

### Cas limites et erreurs
| Cas | Déclencheur | Comportement attendu |
|---|---|---|
| Preuve absente | Approbation OD avec preuve requise | Refus lisible. |
| Workpaper modifié | Proposition existante | Proposition à recalculer. |
| Exercice clôturé | Validation OD | Action refusée. |
| Rejet sans note | Utilisateur confirme rejet | Refus. |
| OD déjà approuvée | Nouvelle approbation | Idempotence, pas de doublon d'écriture. |

### Dépendances
- **Consomme de** : Bloc 4 — écritures ; Bloc 6 — preuves ; Bloc 7 — TVA ; Bloc 8 — issues de rapprochement.
- **Fournit à** : Bloc 10 — documents et FEC ; Bloc 11 — workpapers et OD ; Bloc 12 — impacts.
- **Services externes** : N/A.

### Contraintes non-fonctionnelles
- Audit : tout changement d'état DOIT être traçable.
- Intégrité : une OD validée DOIT être équilibrée.

## Bloc 10 — Documents, FEC, exports et paquet de preuve

### Responsabilité
Produire, rafraîchir, télécharger et auditer les documents comptables et le paquet de preuve local.

### Acteurs
Utilisateur final, expert-comptable lecteur, système de stockage.

### Données manipulées
| Donnée | Type | Source | Obligatoire | Contraintes |
|---|---|---|---|---|
| document_type | Enum | Qitus | Oui | FEC, balance, bilan, compte de résultat, liasse, TVA, bundle, dossier EC. |
| document_status | Enum | Qitus | Oui | Généré, obsolète, erreur, absent. |
| generated_at | Date-heure | Qitus | Non | ISO 8601. |
| fichier_document | Fichier | Qitus | Non | Téléchargeable si généré. |
| manifest | JSON métier | Qitus | Oui pour bundle | Liste artefacts, hash, statuts. |
| fraîcheur_document | Enum | Qitus | Oui | Frais ou à régénérer. |

### Règles métier
- **RM-DOC-01** : Un document DOIT devenir obsolète après mutation comptable pertinente.
  - Condition : import, correction, OD validée, profil fiscal ou pièce pertinente postérieure.
  - Résultat attendu : statut obsolète.
  - Exception : mutation sans impact documentaire = pas d'obsolescence.
- **RM-DOC-02** : Le FEC DOIT être cohérent avec le journal.
  - Condition : génération ou précontrôle FEC.
  - Résultat attendu : écritures équilibrées, chronologiques et exportables.
  - Exception : erreurs bloquantes affichées.
- **RM-DOC-03** : Le paquet de preuve DOIT inclure les manifestes métier disponibles.
  - Condition : bundle généré.
  - Résultat attendu : pièces, hash, TVA, rapprochements, OD, workpapers, audit si présents.
  - Exception : artefact manquant signalé dans le manifest.
- **RM-DOC-04** : Un fichier manquant NE DOIT PAS provoquer d'erreur applicative.
  - Condition : stockage indisponible ou fichier absent.
  - Résultat attendu : statut manquant et message lisible.
  - Exception : N/A.

### Comportements utilisateur
- **Précondition** : écritures sans blocage.
  - **Action** : l'utilisateur génère le FEC.
  - **Postcondition** : document téléchargeable.
  - **Feedback utilisateur** : statut généré ou liste de blocages.
- **Précondition** : preuves et documents disponibles.
  - **Action** : l'utilisateur génère le paquet de preuve.
  - **Postcondition** : manifest complet produit.
  - **Feedback utilisateur** : lien de téléchargement.

### Cas limites et erreurs
| Cas | Déclencheur | Comportement attendu |
|---|---|---|
| Journal déséquilibré | Génération FEC | Blocage. |
| Document déjà obsolète | Téléchargement demandé | Téléchargement autorisé avec avertissement d'obsolescence. |
| PDF indisponible | Rendu PDF échoue | Source structurée conservée, PDF marqué optionnel si applicable. |
| Storage manquant | Fichier supprimé | Audit signale manquant. |

### Dépendances
- **Consomme de** : Bloc 4 — journal ; Bloc 6 — pièces ; Bloc 7 — TVA ; Bloc 8 — rapports ; Bloc 9 — OD.
- **Fournit à** : Bloc 11 — dossier EC ; Bloc 12 — fraîcheur et activité.
- **Services externes** : stockage objet si activé.

### Contraintes non-fonctionnelles
- Performance : génération document standard DOIT retourner un statut exploitable sans blocage UI prolongé.
- Intégrité : chaque document généré DOIT avoir une trace d'audit.

## Bloc 11 — Dossier expert-comptable collaboratif

### Responsabilité
Préparer, figer, partager, commenter, valider et exporter un dossier comptable complet pour l'expert-comptable.

### Acteurs
Utilisateur final, expert-comptable externe, système de partage.

### Données manipulées
| Donnée | Type | Source | Obligatoire | Contraintes |
|---|---|---|---|---|
| snapshot_dossier | Manifest | Qitus | Non | État figé daté, unique par création. |
| lien_partage | Jeton | Qitus | Non | Hashé, expirant ou révocable. |
| demande_ec | Objet de revue | Expert | Non | Info, warning, bloquant. |
| commentaire | Texte | Utilisateur ou expert | Non | 1 à 4000 caractères. |
| statut_revue | Enum | Qitus | Oui si revue | Brouillon, en revue, changements demandés, prêt, validé, annulé. |
| signoff | Validation | Expert | Non | Nom, email, date, note. |

### Règles métier
- **RM-EC-01** : L'expert externe NE DOIT PAS modifier la comptabilité.
  - Condition : accès par lien partagé.
  - Résultat attendu : seules demandes, commentaires et validation EC sont autorisés.
  - Exception : aucune.
- **RM-EC-02** : Un snapshot DOIT devenir obsolète après modification pertinente.
  - Condition : import, correction, OD, pièce, document, TVA, rapprochement ou clôture postérieure.
  - Résultat attendu : statut obsolète visible côté utilisateur et expert.
  - Exception : commentaire EC sans impact comptable.
- **RM-EC-03** : Une demande EC bloquante ouverte DOIT empêcher le signoff.
  - Condition : demande severity = bloquant et statut ouvert.
  - Résultat attendu : validation finale refusée.
  - Exception : demande résolue ou levée avec note.
- **RM-EC-04** : L'export cabinet DOIT correspondre au snapshot final.
  - Condition : export demandé.
  - Résultat attendu : manifest vérifié.
  - Exception : snapshot obsolète = export bloqué.

### Comportements utilisateur
- **Précondition** : dossier prêt.
  - **Action** : l'utilisateur crée un snapshot.
  - **Postcondition** : état transmis figé.
  - **Feedback utilisateur** : lien de partage disponible.
- **Précondition** : expert ouvre le lien.
  - **Action** : il crée une demande de pièce.
  - **Postcondition** : demande visible côté utilisateur.
  - **Feedback utilisateur** : notification ou file de revue.
- **Précondition** : toutes demandes bloquantes résolues.
  - **Action** : expert valide le dossier.
  - **Postcondition** : signoff enregistré.
  - **Feedback utilisateur** : dossier exportable.

### Cas limites et erreurs
| Cas | Déclencheur | Comportement attendu |
|---|---|---|
| Lien expiré | Expert ouvre lien expiré | Accès refusé. |
| Snapshot obsolète | Modification après partage | Bandeau obsolescence. |
| Demande bloquante ouverte | Signoff demandé | Refus. |
| Artefact export manquant | Fichier absent | Export bloqué avec liste des manques. |

### Dépendances
- **Consomme de** : Blocs 6, 7, 8, 9, 10, 12.
- **Fournit à** : Bloc 12 — activité, notifications et statut dossier.
- **Services externes** : N/A hors partage par lien.

### Contraintes non-fonctionnelles
- Sécurité : lien partagé DOIT être non devinable et révocable.
- Audit : demandes, réponses, résolutions et signoff DOIVENT être tracés.

## Bloc 12 — Notifications, audit, abonnement et readiness

### Responsabilité
Informer l'utilisateur des actions nécessaires, tracer les événements, contrôler les droits d'usage et afficher la readiness beta.

### Acteurs
Utilisateur final, système interne, webhook de facturation, cron, admin technique.

### Données manipulées
| Donnée | Type | Source | Obligatoire | Contraintes |
|---|---|---|---|---|
| notification | Objet | Qitus | Non | Dédoublonnée, lue, masquée ou active. |
| activité | Événement | Qitus | Oui pour mutation | Action, entité, date, metadata non secrète. |
| abonnement | Statut | Qitus ou Stripe | Oui | Stub local ou plan actif. |
| quota_usage | Nombre | Qitus | Oui | Mensuel ou minute selon droit. |
| readiness_check | Objet | Qitus | Oui | Prêt, warning, bloqué. |
| change_impact | Diagnostic | Qitus | Non | Ok, warning, action requise, bloqué. |

### Règles métier
- **RM-TRANS-01** : Toute mutation métier DOIT produire une activité.
  - Condition : import, correction, sync, génération, validation, rejet, partage.
  - Résultat attendu : événement visible dans l'activité.
  - Exception : lecture seule non tracée sauf accès partagé sensible.
- **RM-TRANS-02** : Une notification DOIT être dédupliquée par cause métier.
  - Condition : même alerte recalculée.
  - Résultat attendu : une seule notification active.
  - Exception : cause différente = nouvelle notification.
- **RM-TRANS-03** : Les secrets NE DOIVENT PAS être présents dans activité, notification, status ou readiness.
  - Condition : erreur provider ou config.
  - Résultat attendu : message masqué et action lisible.
  - Exception : aucune.
- **RM-TRANS-04** : Un droit d'usage dépassé DOIT bloquer l'action concernée.
  - Condition : quota atteint.
  - Résultat attendu : action refusée et message de plan.
  - Exception : consultation autorisée.
- **RM-TRANS-05** : La readiness beta DOIT distinguer blocage et avertissement.
  - Condition : check exécuté.
  - Résultat attendu : statut prêt, warning ou bloqué.
  - Exception : check non applicable marqué explicitement.

### Comportements utilisateur
- **Précondition** : notification active.
  - **Action** : l'utilisateur l'ouvre, la marque lue ou la masque.
  - **Postcondition** : statut notification mis à jour.
  - **Feedback utilisateur** : compteur ajusté.
- **Précondition** : utilisateur consulte l'activité.
  - **Action** : il filtre par date, type ou entité.
  - **Postcondition** : aucune mutation métier.
  - **Feedback utilisateur** : liste filtrée.
- **Précondition** : admin technique consulte readiness.
  - **Action** : il ouvre les diagnostics.
  - **Postcondition** : aucune mutation.
  - **Feedback utilisateur** : liste des checks et actions recommandées.

### Cas limites et erreurs
| Cas | Déclencheur | Comportement attendu |
|---|---|---|
| Webhook facturation dupliqué | Même identifiant événement | Traitement idempotent. |
| Notification source supprimée | Entité disparue | Notification expirée ou résolue. |
| Metadata longue | Activity avec payload volumineux | Affichage tronqué ou replié sans débordement global. |
| Provider secret dans erreur | Erreur externe brute | Message nettoyé avant stockage. |

### Dépendances
- **Consomme de** : tous les blocs.
- **Fournit à** : tous les blocs — droits, alertes, audit, readiness.
- **Services externes** : Stripe billing si activé, système d'observabilité si activé.

### Contraintes non-fonctionnelles
- Performance : le tableau de bord ne doit charger que les diagnostics prioritaires.
- Sécurité : les logs et exports d'audit NE DOIVENT PAS contenir de secrets.

## 4. Matrice de dépendances inter-blocs

| Bloc | 1 Espace | 2 Connecteurs | 3 Imports | 4 Écritures | 5 Factures | 6 Preuves | 7 TVA | 8 Rapproch. | 9 Clôture | 10 Docs | 11 Dossier EC | 12 Transverse |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 Espace | ∅ | → | → | → | → | → | → | → | → | → | → | ↔ |
| 2 Connecteurs | ← | ∅ | → | ∅ | → | ∅ | ∅ | → | ∅ | ∅ | ∅ | ↔ |
| 3 Imports | ← | ← | ∅ | → | ∅ | ∅ | → | → | → | → | ∅ | ↔ |
| 4 Écritures | ← | ∅ | ← | ∅ | ← | → | → | → | → | → | → | ↔ |
| 5 Factures | ← | ← | ∅ | → | ∅ | → | → | ∅ | ∅ | → | → | ↔ |
| 6 Preuves | ← | ∅ | ← | ← | ← | ∅ | ∅ | ∅ | → | → | → | ↔ |
| 7 TVA | ← | ∅ | ← | ← | ← | ∅ | ∅ | ∅ | → | → | → | ↔ |
| 8 Rapproch. | ← | ← | ← | ← | ∅ | ∅ | ∅ | ∅ | → | → | → | ↔ |
| 9 Clôture | ← | ∅ | ← | ← | ∅ | ← | ← | ← | ∅ | → | → | ↔ |
| 10 Docs | ← | ∅ | ← | ← | ← | ← | ← | ← | ← | ∅ | → | ↔ |
| 11 Dossier EC | ← | ∅ | ∅ | ← | ← | ← | ← | ← | ← | ← | ∅ | ↔ |
| 12 Transverse | ↔ | ↔ | ↔ | ↔ | ↔ | ↔ | ↔ | ↔ | ↔ | ↔ | ↔ | ∅ |

## 5. Exigences transverses

- **Authentification** : toute page métier DOIT nécessiter un utilisateur authentifié, sauf lien partagé externe et endpoints santé.
- **Autorisation** : un utilisateur NE DOIT accéder qu'aux données de son entreprise active.
- **Localisation** : l'interface utilisateur DOIT afficher les libellés métier en français.
- **Montants** : les montants affichés DOIVENT être formatés en euros avec deux décimales quand la devise est EUR.
- **Audit** : toute mutation métier DOIT créer une entrée d'activité sans secret.
- **Accessibilité** : les actions principales DOIVENT avoir un libellé visible ou accessible.
- **RGPD** : Qitus DOIT permettre export, anonymisation légère et suppression protégée selon statut comptable.
- **Sécurité provider** : les secrets de providers NE DOIVENT PAS être stockés dans les données métier ni exposés dans les exports.
- **Exercice clôturé** : toute mutation comptable DOIT être refusée sur exercice clôturé.
- **Aucune mutation silencieuse** : Qitus NE DOIT PAS modifier écritures, OD, rapprochements ou documents générés sans action explicite.
- **Freshness** : tout état dérivé obsolète DOIT être signalé avec cause et action recommandée.
- **Mode test interne** : les données simulées DOIVENT être signalées comme non conformes production.

## 6. Hors scope explicite

- Qitus NE couvre PAS l'émission de factures clients.
- Qitus NE couvre PAS la numérotation légale de factures sortantes.
- Qitus NE couvre PAS l'e-reporting fiscal.
- Qitus NE couvre PAS la télétransmission de TVA, liasse ou FEC.
- Qitus NE couvre PAS EBICS.
- Qitus NE couvre PAS l'initiation de paiement.
- Qitus NE devient PAS Plateforme Agréée.
- Qitus NE fournit PAS de certification légale autonome.
- Qitus NE remplace PAS la validation d'un expert-comptable.
- Qitus NE permet PAS à l'expert externe de modifier la comptabilité.
- Qitus NE gère PAS un portail cabinet multi-client complet.
- Qitus NE réécrit PAS automatiquement les écritures existantes après changement de règle, TVA ou profil fiscal.
- Qitus NE stocke PAS de secrets bancaires utilisateur dans les données métier.

## Questions ouvertes

1. Le niveau de détail légal attendu pour la conformité PA réelle DOIT être confirmé après contrat avec Qonto PA ou une autre PA.
2. La politique exacte de quotas par plan DOIT être figée pour les imports, pièces, chat et stockage.
3. La durée de conservation des fichiers et activités après anonymisation utilisateur DOIT être validée juridiquement.
4. Le comportement de réouverture d'un exercice clôturé DOIT être spécifié avant activation production.
5. Les critères de blocage entre documents MVP et clôture complète DOIVENT être stabilisés avec l'expert-comptable référent.
6. La liste définitive des pièces requises par type d'OD DOIT être validée métier.
7. La PA cible et les statuts réglementaires exacts DOIVENT être confirmés dès réception de la documentation partenaire.
