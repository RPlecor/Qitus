# Qonto PA API Intake

Ce document est la fiche à remplir dès que Qonto fournit le contrat, la sandbox et la documentation API de réception fournisseur PA.

Qitus ne doit pas déduire ces endpoints depuis la Qonto Business API bancaire. Le connecteur bancaire Qonto et l'Adapter Qonto PA restent deux Adapters distincts.

## Variables attendues

- `E_INVOICE_PROVIDER=qonto_pa`
- `QONTO_PA_BASE_URL`
- `QONTO_PA_CLIENT_ID`
- `QONTO_PA_CLIENT_SECRET`
- `QONTO_PA_WEBHOOK_SECRET`
- `PROVIDER_SECRET_ENCRYPTION_KEY`

## Checklist contractuelle

| Sujet | Statut | Notes |
| --- | --- | --- |
| Contrat partenaire signé | À obtenir | Confirmer périmètre réception fournisseurs. |
| Accès sandbox | À obtenir | URL, credentials, données de test. |
| Authentification API | À documenter | OAuth, client credentials, headers, scopes. |
| Webhooks signés | À documenter | Secret, algorithme, idempotence, retries. |
| Formats entrants | À documenter | UBL, CII, Factur-X, PDF lisible. |
| Statuts PA | À documenter | Disponible, lue, rejetée, annulée, comptabilisée. |
| Acquittements | À documenter | Statuts à remonter vers Qonto PA. |
| Preuve de réception | À documenter | Identifiants, horodatages, journal provider. |
| Pagination et filtres | À documenter | Période, curseur, limites, tri. |
| Erreurs provider | À documenter | Codes, retryable/non-retryable. |

## Endpoints à renseigner

| Flux | Méthode | Endpoint | Auth | Pagination | Payload attendu | Erreurs | Exemple |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Créer connexion/mandat | TBD | TBD | TBD | N/A | TBD | TBD | TBD |
| Callback connexion | TBD | TBD | TBD | N/A | TBD | TBD | TBD |
| Lister factures entrantes | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Télécharger XML/PDF | TBD | TBD | TBD | N/A | TBD | TBD | TBD |
| Lire statut facture | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Acquitter statut | TBD | TBD | TBD | N/A | TBD | TBD | TBD |
| Révoquer connexion | TBD | TBD | TBD | N/A | TBD | TBD | TBD |

## Critère d'activation

`QontoAccreditedPlatformAdapter` peut passer de guarded à réseau seulement quand :

- cette fiche est complète ;
- les secrets sont stockés hors Prisma ;
- les webhooks sont vérifiés et idempotents ;
- `EInvoiceProviderContractTestKit` passe sur sandbox Qonto PA ;
- `receptionCompliant=true` est prouvé uniquement pour les factures réellement reçues via Qonto PA.
