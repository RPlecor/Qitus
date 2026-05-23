# Guide utilisateur Qitus

Ce guide est la source officielle utilisée par l'assistant Qitus pour répondre aux questions sur le fonctionnement du produit. Il décrit ce que l'utilisateur voit à l'écran, avec le vocabulaire Qitus, sans jargon interne.

Qitus aide à préparer un dossier comptable exploitable : importer les opérations, vérifier les transactions, rattacher les justificatifs, suivre la TVA, préparer la clôture, générer les documents et constituer le dossier expert-comptable.

Qitus ne remplace pas l'expert-comptable pour les arbitrages complexes. Il guide l'utilisateur, trace les décisions et signale les points à relire.

## Prise en main

### Ce que Qitus fait pour vous

- Qitus centralise les opérations bancaires, les justificatifs, les écritures, les contrôles, la TVA, les documents et le dossier expert-comptable.
- Qitus transforme les transactions importées en écritures lorsque la catégorisation est fiable.
- Qitus prépare des brouillons et des propositions lorsque l'utilisateur doit relire ou valider.
- Qitus affiche toujours le prochain clic utile quand une action est attendue.

### Ce que Qitus ne fait pas seul

- Qitus ne valide pas une OD de clôture à votre place.
- Qitus ne clôture pas un exercice sans action explicite.
- Qitus ne supprime pas des imports ou des données sans confirmation.
- Qitus ne donne pas encore de réponse sur les règles comptables générales dans l'assistant V1.

### Parcours recommandé

1. Ouvrir [Tableau de bord](/dashboard) pour voir l'état du dossier.
2. Ouvrir [Imports](/imports) pour importer ou vérifier les fichiers bancaires.
3. Ouvrir [Transactions](/transactions) pour traiter les lignes à vérifier.
4. Ouvrir [Justificatifs](/pieces) pour rattacher les preuves utiles.
5. Ouvrir [Contrôle](/controle) pour comprendre les points à corriger.
6. Ouvrir [TVA](/tva) si l'entreprise déclare la TVA.
7. Ouvrir [Rapprochements](/rapprochements) pour comparer banque, Stripe, tiers et comptes d'attente.
8. Ouvrir [Documents](/documents) pour générer FEC, balance, états et dossier de preuves.
9. Ouvrir [Clôture](/cloture) et [OD de clôture](/cloture/od) lorsque le dossier est prêt.
10. Ouvrir [Dossier expert-comptable](/dossier-ec) pour préparer le partage au cabinet.

## Navigation Qitus

La barre latérale regroupe les pages par usage.

- `Tableau de bord` : point d'entrée et prochaines actions.
- `Opérations` : Imports, Transactions, Justificatifs, Factures entrantes.
- `Comptabilité` : Écritures, TVA, Rapprochements, Contrôle.
- `Clôture & export` : Clôture, OD de clôture, Immobilisations, Documents, Dossier expert-comptable.
- `Paramètres` : entreprise, exercices, connecteurs, règles, abonnement, confidentialité.
- `Aide` : assistant Qitus.

## Statuts visibles

- `À vérifier` : l'utilisateur doit relire ou corriger.
- `À compléter` : une preuve, une information ou une action améliore le dossier.
- `À mettre à jour` : un document ou un état ne reflète plus les dernières données.
- `Brouillon` : l'élément existe mais n'est pas encore validé.
- `Validé` : l'utilisateur a approuvé l'élément.
- `Rejeté` : l'utilisateur a refusé l'élément avec une note ou une raison.
- `Bloqué` : Qitus empêche l'action tant que la cause n'est pas résolue.
- `À jour` : l'élément correspond aux données actuelles.

## Actions courantes

- `Importer un CSV` : ajouter un relevé bancaire.
- `Associer les colonnes` : indiquer à Qitus quelles colonnes du fichier correspondent aux dates, libellés et montants.
- `Relancer la catégorisation` : recalculer le classement d'un import déjà lu.
- `Vérifier les transactions` : relire les lignes incertaines.
- `Rattacher un justificatif` : lier une preuve à une transaction ou une écriture.
- `Relancer le rapprochement` : recalculer la comparaison entre les données.
- `Régénérer les documents` : produire une version à jour.
- `Relire les OD` : valider ou rejeter les propositions de clôture.

<!-- qitus-guide-section: sourceId=guide-tableau-de-bord surface=dashboard href=/dashboard -->
## Tableau de bord

### Objectif

Le Tableau de bord montre l'état global du dossier et les prochaines actions à réaliser.

### Quand l'utiliser

- Au début de chaque session.
- Après un import.
- Avant de générer des documents.
- Avant de clôturer un exercice.

### Champs affichés

- Nom de l'entreprise.
- Exercice actif.
- Chiffre d'affaires, charges, résultat et trésorerie.
- Nombre de transactions à vérifier.
- État des documents.
- OD brouillons.
- Couverture du dossier expert-comptable.
- Impacts à traiter.
- État du dossier.
- Dernières transactions.

### Statuts possibles

- `Exploitation cohérente` : les compteurs principaux sont alignés.
- `À vérifier` : une partie du dossier demande une action.
- `À mettre à jour` : des documents ou calculs doivent être régénérés.
- `Bloqué` : une action importante est empêchée par un contrôle.

### Actions disponibles

- [Importer des transactions](/imports).
- [Vérifier les transactions](/transactions).
- [Ouvrir le contrôle](/controle).
- [Relire les OD](/cloture/od).
- [Ouvrir les documents](/documents).
- [Ouvrir la couverture](/couverture).

### Automatisations

Qitus calcule les compteurs, détecte les impacts et signale les actions prioritaires. Il ne valide pas les décisions comptables à votre place.

### Validations utilisateur

L'utilisateur doit confirmer les transactions incertaines, relire les OD, résoudre les blocages et décider quand générer ou partager les documents.

### Erreurs fréquentes

- Le Tableau de bord indique des documents à mettre à jour : ouvrir [Documents](/documents).
- Le Tableau de bord indique des transactions à vérifier : ouvrir [Transactions](/transactions).
- Le Tableau de bord indique une clôture bloquée : ouvrir [Contrôle](/controle) ou [OD de clôture](/cloture/od).

<!-- qitus-guide-section: sourceId=guide-imports surface=imports href=/imports -->
## Imports

### Objectif

La page Imports sert à ajouter, suivre, réparer, supprimer ou relancer les imports de l'exercice actif.

### Quand l'utiliser

- Pour déposer un relevé CSV.
- Pour comprendre pourquoi un fichier est en revue.
- Pour associer les colonnes d'un fichier.
- Pour relancer la catégorisation après une mise à jour de règles ou de profil.
- Pour supprimer un import ou réinitialiser les imports de l'exercice actif.

### Champs affichés

- Nom du fichier.
- Date d'import.
- Source de l'import.
- Statut.
- Nombre de lignes lues.
- Nombre de transactions créées.
- Nombre de transactions à vérifier.
- Actions disponibles.

### Statuts possibles

- `En attente` : Qitus n'a pas encore traité le fichier.
- `Lecture du fichier` : Qitus lit le contenu.
- `Colonnes à associer` : l'utilisateur doit indiquer la signification des colonnes.
- `Catégorisation` : Qitus classe les lignes.
- `En revue` : certaines lignes demandent une vérification.
- `Terminé` : l'import est traité.
- `Erreur` : le fichier n'a pas pu être traité.

### Actions disponibles

- `Importer un CSV`.
- `Associer les colonnes`.
- `Relancer la catégorisation`.
- `Supprimer`.
- `Réinitialiser les imports de cet exercice`.
- [Ouvrir les transactions](/transactions).

### Automatisations

Qitus détecte les colonnes connues, crée les transactions, applique les règles fiables et prépare les écritures quand la catégorisation est complète.

### Validations utilisateur

L'utilisateur doit associer les colonnes ambiguës, corriger les lignes en revue, confirmer les actions destructives et relancer explicitement une catégorisation déjà produite.

### Erreurs fréquentes

- Fichier non lisible : vérifier qu'il s'agit bien d'un CSV.
- Colonnes non reconnues : ouvrir l'association des colonnes.
- Transactions sur des comptes d'attente : relancer la catégorisation après correction des règles ou du profil.
- Import bloqué car l'exercice est fermé : rouvrir l'exercice n'est possible que depuis la clôture, avec prudence.

<!-- qitus-guide-section: sourceId=guide-transactions surface=transactions href=/transactions -->
## Transactions

### Objectif

La page Transactions permet de relire les mouvements importés, corriger leur catégorisation et rattacher les justificatifs.

### Quand l'utiliser

- Après un import.
- Quand le Tableau de bord signale des transactions à vérifier.
- Quand la TVA ou les documents ne reflètent pas les opérations attendues.
- Quand une transaction doit être rattachée à un justificatif.

### Champs affichés

- Date.
- Libellé.
- Montant.
- Compte proposé.
- Statut.
- Justificatif lié.
- Détail de catégorisation.
- Action de correction ou confirmation.

### Statuts possibles

- `Catégorisé` : Qitus a classé la transaction.
- `À vérifier` : l'utilisateur doit relire.
- `Confirmé` : la décision est validée.
- `Corrigé` : l'utilisateur a modifié le classement.
- `À rattacher` : un justificatif peut être ajouté.

### Actions disponibles

- `Ouvrir`.
- `Catégoriser`.
- `Confirmer`.
- `Corriger`.
- `Rattacher un justificatif`.
- [Ouvrir les justificatifs](/pieces).

### Automatisations

Qitus applique les règles exactes et les correspondances fiables. Les suggestions incertaines restent à valider.

### Validations utilisateur

L'utilisateur valide les corrections, confirme les suggestions incertaines et choisit les justificatifs à rattacher.

### Erreurs fréquentes

- Une transaction reste en compte d'attente : corriger la catégorisation.
- Une transaction ne crée pas de TVA : vérifier le régime TVA et relancer la catégorisation de l'import si nécessaire.
- Une transaction n'a pas de justificatif : rattacher une pièce si elle existe.

<!-- qitus-guide-section: sourceId=guide-justificatifs surface=pieces href=/pieces -->
## Justificatifs

### Objectif

La page Justificatifs permet de déposer, consulter, relire et rattacher les preuves d'opérations.

### Quand l'utiliser

- Pour ajouter une facture, un reçu, un contrat ou un relevé.
- Pour rattacher une pièce à une transaction ou une écriture.
- Pour relire une lecture automatique.
- Pour améliorer la couverture du dossier.

### Champs affichés

- Nom de la pièce.
- Type de fichier.
- Date de dépôt.
- Statut de lecture.
- Transaction ou écriture liée.
- Score de rapprochement si Qitus propose un lien.

### Statuts possibles

- `Déposée` : la pièce est conservée.
- `Lecture terminée` : Qitus a extrait des informations exploitables.
- `Pièce à relire` : l'extraction doit être vérifiée.
- `Lecture automatique impossible` : la pièce reste disponible mais non lue.
- `Archivée` : la pièce n'est plus utilisée dans le flux courant.

### Actions disponibles

- `Ajouter une pièce`.
- `Relire la pièce`.
- `Rattacher`.
- `Télécharger`.
- `Archiver`.
- [Ouvrir les transactions](/transactions).

### Automatisations

Qitus peut proposer un rapprochement entre une pièce et une transaction si les montants, dates ou libellés concordent.

### Validations utilisateur

L'utilisateur confirme les rattachements et relit les pièces dont la lecture automatique est incertaine.

### Erreurs fréquentes

- Pièce sans écriture : la pièce existe mais n'est pas liée.
- Écriture sans justificatif rattaché : la preuve peut être ajoutée.
- Lecture automatique impossible : la pièce peut rester probante même sans extraction.

<!-- qitus-guide-section: sourceId=guide-factures-entrantes surface=factures-entrantes href=/factures-entrantes -->
## Factures entrantes

### Objectif

La page Factures entrantes permet de traiter les factures fournisseur structurées ou déposées manuellement.

### Quand l'utiliser

- Pour consulter une facture électronique reçue.
- Pour vérifier les données extraites.
- Pour rapprocher une facture d'une transaction.
- Pour créer un brouillon comptable à relire.

### Champs affichés

- Fournisseur.
- Numéro de facture.
- Date.
- Montants hors taxe, TVA et total.
- Provenance.
- Statut de lecture.
- Brouillon comptable.
- Rapprochement proposé.

### Statuts possibles

- `Reçue`.
- `Lecture terminée`.
- `Lecture à vérifier`.
- `Brouillon prêt`.
- `Comptabilisée`.
- `Rejetée`.

### Actions disponibles

- `Ouvrir`.
- `Relire`.
- `Rapprocher`.
- `Créer un brouillon`.
- `Approuver`.
- `Rejeter`.

### Automatisations

Qitus lit les données structurées et prépare des propositions. Aucune écriture n'est créée sans approbation utilisateur.

### Validations utilisateur

L'utilisateur valide le rapprochement, approuve le brouillon comptable ou rejette la facture avec une note.

### Erreurs fréquentes

- Facture non reconnue : vérifier le format du fichier.
- Montant différent de la transaction : relire le rapprochement.
- Réception non conforme PA : la facture est exploitable, mais ne prouve pas une réception réglementaire via une Plateforme Agréée réelle.

<!-- qitus-guide-section: sourceId=guide-ecritures surface=ecritures href=/ecritures -->
## Écritures

### Objectif

La page Écritures affiche le journal comptable généré ou validé dans Qitus.

### Quand l'utiliser

- Pour vérifier les écritures créées depuis les imports.
- Pour contrôler les débits et crédits.
- Pour comprendre une ligne comptable.
- Pour vérifier les écritures issues de factures entrantes ou d'OD.

### Champs affichés

- Date.
- Journal.
- Libellé.
- Compte.
- Débit.
- Crédit.
- Source.
- Pièce liée.

### Statuts possibles

- `Équilibrée` : débit et crédit sont cohérents.
- `À vérifier` : une ligne mérite une revue.
- `Issue d'import`.
- `Issue de facture entrante`.
- `Issue d'OD`.

### Actions disponibles

- `Ouvrir`.
- `Voir la transaction`.
- `Voir la pièce`.
- `Exporter le journal`.

### Automatisations

Qitus crée les écritures d'import quand la catégorisation est complète et non ambiguë. Les écritures liées à une facture ou une OD demandent une validation explicite.

### Validations utilisateur

L'utilisateur relit les écritures sensibles, les OD et les brouillons comptables avant validation.

### Erreurs fréquentes

- Écriture absente après import : vérifier le statut de l'import.
- Compte d'attente présent : corriger les transactions.
- TVA absente : vérifier le régime TVA et les lignes TVA.

<!-- qitus-guide-section: sourceId=guide-tva surface=tva href=/tva -->
## TVA

### Objectif

La page TVA affiche la position TVA et les brouillons de déclaration.

### Quand l'utiliser

- Si l'entreprise déclare la TVA.
- Après un import.
- Après un changement de régime TVA.
- Avant de générer une CA3 ou CA12.

### Champs affichés

- Régime TVA.
- TVA collectée.
- TVA déductible.
- TVA nette.
- Déclarations brouillon.
- Contrôles TVA.
- Alertes de recalcul.

### Statuts possibles

- `À jour`.
- `À mettre à jour`.
- `Brouillon`.
- `Contrôle à traiter`.
- `Génération bloquée`.

### Actions disponibles

- `Régénérer`.
- `Ouvrir la revue TVA`.
- `Ouvrir les imports`.
- `Vérifier les transactions`.
- [Ouvrir le profil](/profil).

### Automatisations

Qitus calcule la TVA à partir des écritures contenant des lignes TVA. Il peut préparer un brouillon lorsque les contrôles ne bloquent pas.

### Validations utilisateur

L'utilisateur doit vérifier les transactions, relancer la catégorisation ou corriger les paramètres si les écritures ne contiennent pas de lignes TVA.

### Erreurs fréquentes

- TVA à zéro après changement de régime : relancer la catégorisation des imports concernés.
- Déclaration à zéro alors que l'activité est taxable : vérifier les transactions et les comptes TVA.
- Génération bloquée : ouvrir la revue TVA.

<!-- qitus-guide-section: sourceId=guide-rapprochements surface=rapprochements href=/rapprochements -->
## Rapprochements

### Objectif

La page Rapprochements compare les données pour repérer les écarts.

### Quand l'utiliser

- Après un import bancaire.
- Après une synchronisation Stripe.
- Avant la clôture.
- Quand le Tableau de bord signale un rapprochement à relancer.

### Champs affichés

- Type de rapprochement.
- Dernier calcul.
- Matches exacts.
- Écarts.
- Points ouverts.
- Actions disponibles.

### Statuts possibles

- `À relancer`.
- `À jour`.
- `Écart à vérifier`.
- `Confirmé`.
- `Ignoré avec note`.

### Actions disponibles

- `Relancer le rapprochement`.
- `Ouvrir la revue`.
- `Confirmer`.
- `Ignorer avec note`.
- `Créer une proposition OD` quand un écart durable le justifie.

### Automatisations

Qitus confirme les rapprochements exacts quand les données concordent clairement. Les écarts restent en revue.

### Validations utilisateur

L'utilisateur confirme les écarts, ajoute une note ou valide une proposition OD.

### Erreurs fréquentes

- Rapprochement jamais lancé : cliquer sur `Relancer le rapprochement`.
- Écart bancaire : vérifier la transaction et la pièce associée.
- Stripe non configuré : ouvrir [Connecteurs](/connecteurs).

<!-- qitus-guide-section: sourceId=guide-controle surface=controle href=/controle -->
## Contrôle

### Objectif

La page Contrôle liste les points à corriger, compléter ou comprendre avant les documents et la clôture.

### Quand l'utiliser

- Avant de générer les documents.
- Avant de clôturer.
- Quand une action est bloquée.
- Quand Qitus signale un point à traiter.

### Champs affichés

- Points ouverts.
- Contrôles de cohérence.
- Justificatifs à compléter.
- Pièces à relire.
- Actions recommandées.

### Statuts possibles

- `Ouvert`.
- `À compléter`.
- `À relire`.
- `Bloquant`.
- `Résolu`.

### Actions disponibles

- `Ouvrir le contrôle`.
- `Corriger les transactions`.
- `Rattacher une pièce`.
- `Relire les OD`.
- `Régénérer les documents` quand les blocages sont levés.

### Automatisations

Qitus regroupe les contrôles issus des transactions, justificatifs, documents, TVA, rapprochements et clôture.

### Validations utilisateur

L'utilisateur traite les points bloquants et choisit les corrections.

### Erreurs fréquentes

- `Écritures sans justificatif rattaché` : ce n'est pas toujours bloquant, mais cela indique une couverture à compléter.
- `Pièce à relire` : ouvrir la pièce et vérifier les informations lues.
- Génération bloquée : suivre le bouton principal affiché dans le message.

<!-- qitus-guide-section: sourceId=guide-cloture surface=cloture href=/cloture -->
## Clôture

### Objectif

La page Clôture guide les étapes de fin d'exercice.

### Quand l'utiliser

- En fin d'exercice.
- Quand les imports, transactions, TVA, documents et rapprochements sont prêts.
- Pour fermer l'exercice après validation des points importants.

### Champs affichés

- Étapes de clôture.
- État des prérequis.
- Blocages.
- Actions de clôture.
- Statut de l'exercice.

### Statuts possibles

- `Ouvert`.
- `Prêt à clôturer`.
- `Bloqué`.
- `Clôturé`.
- `À rouvrir avec prudence`.

### Actions disponibles

- `Démarrer`.
- `Ouvrir le contrôle`.
- `Relire les OD`.
- `Générer les documents`.
- `Clôturer l'exercice`.
- `Rouvrir l'exercice`.

### Automatisations

Qitus vérifie les prérequis et prépare les étapes. Il ne clôture pas l'exercice sans confirmation.

### Validations utilisateur

L'utilisateur valide les OD, résout les blocages et confirme la clôture.

### Erreurs fréquentes

- Clôture bloquée : ouvrir [Contrôle](/controle).
- OD à relire : ouvrir [OD de clôture](/cloture/od).
- Documents à mettre à jour : ouvrir [Documents](/documents).

<!-- qitus-guide-section: sourceId=guide-od-cloture surface=cloture-od href=/cloture/od -->
## OD de clôture

### Objectif

La page OD de clôture présente les propositions d'écritures d'ajustement à relire.

### Quand l'utiliser

- Avant la clôture.
- Quand Qitus signale des OD brouillon.
- Quand une feuille de travail ou une pièce a changé.

### Champs affichés

- Type d'OD.
- Libellé lisible.
- Montants.
- Justification.
- Feuille de travail liée.
- Pièce associée.
- Statut de revue.

### Statuts possibles

- `À relire`.
- `Validée`.
- `Rejetée`.
- `À recalculer`.
- `Pièce à compléter`.

### Actions disponibles

- `Ouvrir`.
- `Valider`.
- `Rejeter`.
- `Recalculer`.
- `Rattacher une pièce`.

### Automatisations

Qitus prépare des propositions lorsque les données le permettent. Il peut signaler qu'une proposition doit être recalculée.

### Validations utilisateur

Une OD de clôture demande toujours une validation explicite avant de devenir une écriture.

### Erreurs fréquentes

- OD à recalculer : recalculer avant validation.
- Pièce à compléter : rattacher la preuve demandée.
- Libellé incompréhensible : ouvrir le détail pour lire la justification métier.

<!-- qitus-guide-section: sourceId=guide-immobilisations surface=immobilisations href=/immobilisations -->
## Immobilisations

### Objectif

La page Immobilisations suit les biens durables et leurs amortissements.

### Quand l'utiliser

- Quand une transaction correspond à un achat durable.
- Avant de relire les OD d'amortissement.
- Avant la clôture.

### Champs affichés

- Nom du bien.
- Date d'acquisition.
- Montant.
- Durée d'amortissement.
- Valeur restante.
- Écriture ou transaction liée.

### Statuts possibles

- `À vérifier`.
- `Actif`.
- `Amorti`.
- `À rattacher`.

### Actions disponibles

- `Ouvrir`.
- `Confirmer`.
- `Corriger`.
- `Voir l'écriture`.

### Automatisations

Qitus peut repérer des candidats à immobiliser. Il ne décide pas seul d'un traitement sensible.

### Validations utilisateur

L'utilisateur confirme la nature du bien, les montants et les durées si nécessaire.

### Erreurs fréquentes

- Achat durable classé en charge : corriger la transaction ou relire la proposition.
- Amortissement manquant : vérifier les OD de clôture.

<!-- qitus-guide-section: sourceId=guide-documents surface=documents href=/documents -->
## Documents

### Objectif

La page Documents génère et télécharge les fichiers du dossier.

### Quand l'utiliser

- Après vérification des transactions.
- Après validation des OD.
- Avant le partage au cabinet.
- Quand Qitus indique que des documents sont à mettre à jour.

### Champs affichés

- Type de document.
- Statut.
- Date de génération.
- Fraîcheur.
- Action disponible.

### Statuts possibles

- `À jour`.
- `À mettre à jour`.
- `Brouillon`.
- `Génération bloquée`.
- `Remplacé`.

### Actions disponibles

- `Générer`.
- `Régénérer`.
- `Télécharger`.
- `Ouvrir le contrôle`.
- `Ouvrir le dossier de preuves`.

### Automatisations

Qitus sait détecter qu'un document est ancien après une écriture, une OD ou une modification de profil.

### Validations utilisateur

L'utilisateur lance la génération ou résout les contrôles bloquants.

### Erreurs fréquentes

- Génération bloquée : cliquer sur `Ouvrir le contrôle`.
- Documents à mettre à jour : cliquer sur `Régénérer`.
- FEC absent : vérifier que le journal est exportable.

<!-- qitus-guide-section: sourceId=guide-dossier-ec surface=dossier-ec href=/dossier-ec -->
## Dossier expert-comptable

### Objectif

La page Dossier expert-comptable prépare le dossier à transmettre au cabinet.

### Quand l'utiliser

- Après génération des documents.
- Avant d'envoyer le dossier à l'expert-comptable.
- Pour suivre les demandes et commentaires du cabinet.

### Champs affichés

- État transmis.
- Documents inclus.
- Justificatifs.
- Demandes ouvertes.
- Commentaires.
- Validation finale.

### Statuts possibles

- `À préparer`.
- `Prêt`.
- `À mettre à jour`.
- `En revue`.
- `Validé`.
- `Export incomplet`.

### Actions disponibles

- `Préparer le dossier`.
- `Exporter`.
- `Partager`.
- `Répondre`.
- `Résoudre une demande`.

### Automatisations

Qitus prépare un état du dossier et signale les changements survenus après transmission.

### Validations utilisateur

L'utilisateur choisit quand partager le dossier, répondre au cabinet et valider l'export final.

### Erreurs fréquentes

- Dossier à mettre à jour : préparer un nouvel état.
- Demande bloquante ouverte : répondre ou résoudre la demande.
- Document absent : ouvrir [Documents](/documents).

<!-- qitus-guide-section: sourceId=guide-parametres surface=parametres href=/parametres -->
## Paramètres

### Objectif

La page Paramètres regroupe les réglages de l'espace Qitus.

### Quand l'utiliser

- Pour modifier les informations de l'entreprise.
- Pour vérifier l'exercice actif.
- Pour configurer les connecteurs.
- Pour gérer les règles, l'abonnement ou la confidentialité.

### Champs affichés

- Entreprise.
- Exercices.
- Régime fiscal et TVA.
- Connecteurs.
- Règles de classement.
- Règles comptables.
- Abonnement.
- Confidentialité.

### Statuts possibles

- `À configurer`.
- `Configuré`.
- `À vérifier`.
- `Erreur de configuration`.

### Actions disponibles

- [Ouvrir le compte](/profil).
- [Ouvrir les exercices](/exercices).
- [Configurer les connecteurs](/connecteurs).
- [Ouvrir l'abonnement](/abonnement).
- [Ouvrir les règles de classement](/corrections).

### Automatisations

Qitus utilise ces informations pour guider les imports, la TVA, les documents et la clôture.

### Validations utilisateur

L'utilisateur valide les informations d'entreprise, le régime fiscal, la TVA et les connecteurs.

### Erreurs fréquentes

- TVA incohérente : ouvrir le compte et vérifier le régime.
- Connecteur non configuré : ouvrir Connecteurs.
- Mauvais exercice : ouvrir Exercices.

<!-- qitus-guide-section: sourceId=guide-connecteurs surface=connecteurs href=/connecteurs -->
## Connecteurs

### Objectif

La page Connecteurs regroupe les connexions externes de Qitus.

### Quand l'utiliser

- Pour connecter Qonto bancaire.
- Pour configurer Stripe.
- Pour connecter une banque non-Qonto via Open Banking.
- Pour suivre la pré-activation Qonto PA pour les factures électroniques.

### Champs affichés

- Nom du connecteur.
- État de configuration.
- Dernière mise à jour.
- Dernier message lisible.
- Action disponible.

### Statuts possibles

- `Non configuré`.
- `À connecter`.
- `Connecté`.
- `Synchronisé`.
- `À reconnecter`.
- `Erreur de configuration`.
- `PA en attente partenaire`.
- `Réception PA conforme`.

### Actions disponibles

- `Configurer`.
- `Connecter`.
- `Mettre à jour`.
- `Reconnecter`.
- `Ouvrir les imports`.

### Automatisations

Qitus peut récupérer des données depuis un connecteur configuré et signaler les rapprochements à relancer.

### Validations utilisateur

L'utilisateur fournit les accès, choisit les comptes à connecter et confirme les synchronisations importantes.

### Erreurs fréquentes

- Connexion bancaire indisponible : importer un CSV en attendant.
- Consentement expiré : reconnecter.
- Qonto PA en attente : la réception conforme sera activée après validation partenaire.

<!-- qitus-guide-section: sourceId=guide-regles-classement surface=corrections href=/corrections -->
## Règles de classement

### Objectif

La page Règles de classement permet de gérer les corrections appliquées aux transactions similaires.

### Quand l'utiliser

- Après plusieurs corrections identiques.
- Pour comprendre pourquoi une transaction est classée d'une certaine manière.
- Pour améliorer les futurs imports.

### Champs affichés

- Libellé de règle.
- Critère.
- Compte appliqué.
- Statut.
- Impact estimé.

### Statuts possibles

- `Active`.
- `À vérifier`.
- `Désactivée`.
- `Conflit`.

### Actions disponibles

- `Créer`.
- `Modifier`.
- `Désactiver`.
- `Voir l'impact`.

### Automatisations

Qitus applique les règles exactes aux futurs imports. Les règles proposées restent à valider quand elles ne sont pas strictement certaines.

### Validations utilisateur

L'utilisateur confirme les règles proposées et corrige les conflits.

### Erreurs fréquentes

- Règle trop large : vérifier l'impact avant de l'activer.
- Transaction mal classée : corriger la transaction, puis ajuster la règle.

<!-- qitus-guide-section: sourceId=guide-regles-comptables surface=regles-comptables href=/regles-comptables -->
## Règles comptables

### Objectif

La page Règles comptables indique la version des règles Qitus appliquées aux futurs imports.

### Quand l'utiliser

- Pour vérifier que les règles Qitus sont à jour.
- Pour comprendre si des transactions existantes pourraient être concernées par une mise à jour.
- Pour consulter les sources officielles suivies par Qitus.

### Champs affichés

- Version active.
- Statut.
- Sources consultées.
- Transactions concernées.
- Packs de règles.

### Statuts possibles

- `Disponible`.
- `Actif`.
- `À examiner en interne`.
- `Remplacé`.

### Actions disponibles

- `Ouvrir les imports`.
- `Mettre à jour maintenant` si l'action est disponible en environnement autorisé.

### Automatisations

Qitus applique automatiquement les règles actives aux futurs imports. Les écritures déjà générées ne sont pas modifiées automatiquement.

### Validations utilisateur

L'utilisateur relance explicitement une catégorisation si une mise à jour doit être appliquée aux données existantes.

### Erreurs fréquentes

- Transactions concernées mais inchangées : ouvrir Imports et relancer la catégorisation si nécessaire.
- Source officielle non consultée : attendre la prochaine mise à jour ou déclencher l'action interne si disponible.

<!-- qitus-guide-section: sourceId=guide-abonnement surface=abonnement href=/abonnement -->
## Abonnement

### Objectif

La page Abonnement affiche le plan, les quotas et les actions de facturation.

### Quand l'utiliser

- Quand une limite est atteinte.
- Pour consulter l'usage mensuel.
- Pour ouvrir le portail de facturation.

### Champs affichés

- Plan.
- Statut.
- Quotas.
- Usage.
- Actions disponibles.

### Statuts possibles

- `Actif`.
- `Essai`.
- `Limite atteinte`.
- `Paiement à vérifier`.

### Actions disponibles

- `Ouvrir le portail`.
- `Changer de plan`.
- `Voir l'usage`.

### Automatisations

Qitus vérifie les droits avant les actions soumises à quota, comme l'assistant ou certains imports selon le plan.

### Validations utilisateur

L'utilisateur choisit les changements d'abonnement et confirme les actions de paiement.

### Erreurs fréquentes

- Limite de questions atteinte : ouvrir Abonnement.
- Portail indisponible : vérifier la configuration de facturation.

<!-- qitus-guide-section: sourceId=guide-exercices surface=exercices href=/exercices -->
## Exercices

### Objectif

La page Exercices permet de choisir et gérer la période comptable active.

### Quand l'utiliser

- Après l'onboarding.
- Pour vérifier l'année de travail.
- Avant un import.
- Avant une clôture.

### Champs affichés

- Année ou période.
- Date de début.
- Date de fin.
- Statut.
- Exercice actif.

### Statuts possibles

- `Ouvert`.
- `Actif`.
- `Clôturé`.

### Actions disponibles

- `Activer`.
- `Créer`.
- `Ouvrir`.

### Automatisations

Qitus rattache les imports, transactions, documents et contrôles à l'exercice actif.

### Validations utilisateur

L'utilisateur choisit le bon exercice avant d'importer ou de corriger des données.

### Erreurs fréquentes

- Données absentes : vérifier que le bon exercice est actif.
- Import refusé : l'exercice est peut-être clôturé.

<!-- qitus-guide-section: sourceId=guide-compte surface=profil href=/profil -->
## Compte et entreprise

### Objectif

La page Compte et entreprise permet de vérifier les informations de l'entreprise, du dirigeant, du régime fiscal et de la TVA.

### Quand l'utiliser

- Pendant ou après l'onboarding.
- Avant un import important.
- Quand la TVA semble incorrecte.
- Quand un document doit reprendre les informations légales.

### Champs affichés

- Nom de l'entreprise.
- SIREN ou SIRET.
- Adresse.
- Forme juridique.
- Régime fiscal.
- Régime TVA.
- Exigibilité TVA.
- Dirigeant.
- Capital.

### Statuts possibles

- `Complet`.
- `À compléter`.
- `À vérifier`.

### Actions disponibles

- `Enregistrer`.
- `Modifier`.
- `Ouvrir les imports`.
- `Ouvrir la TVA`.

### Automatisations

Qitus utilise le profil pour guider la TVA, les documents et les règles appliquées aux imports.

### Validations utilisateur

L'utilisateur confirme tout changement de régime fiscal, de TVA ou d'information légale.

### Erreurs fréquentes

- TVA à zéro après changement de régime : relancer la catégorisation des imports.
- Mauvais nom sur les documents : corriger le profil, puis régénérer les documents.

<!-- qitus-guide-section: sourceId=guide-activite surface=activity href=/activity -->
## Activité

### Objectif

La page Activité affiche l'historique lisible des actions importantes.

### Quand l'utiliser

- Pour comprendre ce qui a changé.
- Pour vérifier qu'une action a été réalisée.
- Pour auditer une suppression, une relance, une génération ou une synchronisation.

### Champs affichés

- Date.
- Action.
- Élément concerné.
- Utilisateur ou système.
- Résumé.

### Statuts possibles

- `Réussi`.
- `Échec`.
- `Demandé`.
- `Terminé`.

### Actions disponibles

- `Ouvrir l'élément`.
- `Filtrer`.
- `Exporter` si disponible.

### Automatisations

Qitus trace les automatisations, les suggestions, les validations et les actions sensibles.

### Validations utilisateur

Aucune validation n'est généralement faite depuis l'activité. Elle sert à comprendre et vérifier.

### Erreurs fréquentes

- Action introuvable : vérifier la période ou l'exercice.
- Message trop technique : se référer à la page métier concernée.

<!-- qitus-guide-section: sourceId=guide-assistant-qitus surface=chat href=/chat -->
## Aide et assistant Qitus

### Objectif

L'assistant Qitus répond aux questions sur l'utilisation du produit.

### Quand l'utiliser

- Pour comprendre une page.
- Pour savoir quelle action faire ensuite.
- Pour comprendre un statut.
- Pour retrouver une page ou une action.

### Champs affichés

- Conversation.
- Réponse de l'assistant.
- Sources Qitus.
- Zone de message.
- Suggestions contextuelles.

### Statuts possibles

- `En ligne`.
- `Limite atteinte`.
- `Réponse impossible pour le moment`.

### Actions disponibles

- `Poser une question`.
- `Réessayer`.
- `Ouvrir la source`.
- `Ouvrir l'aide Qitus`.

### Automatisations

L'assistant recherche dans ce guide et répond uniquement si des sources Qitus fiables sont disponibles.

### Validations utilisateur

L'utilisateur reste responsable des décisions comptables. L'assistant ne modifie rien.

### Erreurs fréquentes

- Question de règle comptable générale : l'assistant V1 indique que ce sujet sera couvert en V2.
- Demande d'action : l'assistant explique où cliquer, mais ne réalise pas l'action.
- Réponse sans source : Qitus doit refuser plutôt qu'inventer.

## Confidentialité et limites

- L'assistant Qitus est un outil pédagogique.
- Il ne constitue pas un avis comptable.
- Il ne peut pas créer, modifier, valider ou supprimer des données.
- Les questions hors Qitus sont refusées en V1.
- Les données sensibles doivent être minimisées avant tout appel à un fournisseur IA.

## Glossaire utilisateur

- `Transaction` : mouvement bancaire importé.
- `Écriture` : traduction comptable d'une opération.
- `Compte` : code de classement comptable.
- `Justificatif` : preuve d'une opération.
- `OD` : écriture d'ajustement ou de clôture à valider.
- `FEC` : fichier officiel des écritures comptables.
- `TVA collectée` : TVA sur les ventes.
- `TVA déductible` : TVA sur les achats.
- `Rapprochement` : comparaison entre plusieurs sources de données.
- `Dossier expert-comptable` : dossier préparé pour le cabinet.
