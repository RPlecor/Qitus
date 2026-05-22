# Guide utilisateur debutant de Paperasse

Ce guide explique Paperasse comme si vous n'aviez jamais utilise de logiciel SaaS ni de logiciel comptable.

Objectif : vous permettre d'utiliser Paperasse de maniere autonome, page par page, sans connaitre le vocabulaire comptable au depart.

Paperasse sert a :

- importer vos transactions bancaires ;
- transformer ces transactions en ecritures comptables ;
- corriger les operations a revoir ;
- rattacher les justificatifs ;
- suivre la TVA, les rapprochements, la cloture et les documents ;
- preparer un dossier lisible pour votre expert-comptable.

Paperasse ne remplace pas votre expert-comptable pour les arbitrages complexes. Il vous aide a preparer un dossier propre, trace et verifiable.

---

## 1. Les mots a connaitre avant de commencer

### SaaS

Un SaaS est simplement une application accessible dans votre navigateur. Vous cliquez dans les menus, remplissez des formulaires et validez des actions.

### Tableau de bord

C'est la page d'accueil de Paperasse. Elle resume ce qui va bien, ce qui manque et ce qu'il faut faire ensuite.

### Exercice

Un exercice est une periode comptable, souvent une annee. Exemple : du 1er janvier 2025 au 31 decembre 2025.

Toutes les donnees que vous voyez dans Paperasse dependent de l'exercice actif.

### Transaction

Une transaction est une ligne bancaire importee : un paiement, un virement, un encaissement, un prelevement.

Exemples :

- paiement OVH ;
- encaissement client ;
- prelevement URSSAF ;
- frais bancaire.

### Ecriture comptable

Une ecriture comptable est la traduction comptable d'une transaction.

Elle contient des lignes avec des comptes, des debits et des credits. Paperasse cherche toujours a produire des ecritures equilibrees.

### Debit et credit

En comptabilite, chaque ecriture doit avoir autant de debit que de credit.

Pour debuter, retenez seulement ceci :

- une ecriture equilibree est normale ;
- une ecriture desequilibree doit etre corrigee ;
- Paperasse affiche les anomalies quand il en detecte.

### Compte comptable

Un compte est un code qui classe une operation.

Exemples courants :

- `5121` : banque ;
- `471` : compte d'attente, utilise quand Paperasse ne sait pas encore classer ;
- `44566` : TVA deductible sur achats ;
- `44571` : TVA collectee sur ventes ;
- `486` : charges constatees d'avance ;
- `68112` : dotation aux amortissements ;
- `28183` : amortissement du materiel informatique.

### Categorie ou categorisation

C'est le classement d'une transaction dans les bons comptes.

Si Paperasse n'est pas certain, la transaction passe en statut "A verifier".

### Regle de correction

Une regle permet d'appliquer automatiquement une correction a des transactions similaires.

Exemple : toutes les transactions contenant "OVH" vont dans le compte d'hebergement informatique.

### Piece justificative

C'est la preuve d'une operation :

- facture ;
- recu ;
- contrat ;
- releve bancaire ;
- decision utilisateur ;
- validation expert-comptable.

### OD

OD signifie "Operation Diverse".

Ce sont des ecritures comptables de cloture ou d'ajustement, par exemple :

- amortissement ;
- charges constatees d'avance ;
- provision ;
- regularisation TVA ;
- ecart de rapprochement.

Dans Paperasse, une OD n'est jamais creee automatiquement sans validation utilisateur.

### FEC

Le FEC est le Fichier des Ecritures Comptables. C'est un fichier officiel que votre entreprise doit pouvoir produire en cas de controle.

### TVA

La TVA est la taxe sur la valeur ajoutee.

Paperasse peut distinguer :

- TVA deductible : TVA sur vos achats ;
- TVA collectee : TVA sur vos ventes ;
- TVA nette : difference entre les deux.

### CA3 et CA12

Ce sont des declarations TVA.

- CA3 : declaration mensuelle ou periodique, souvent pour le regime reel normal.
- CA12 : declaration annuelle, souvent pour le regime reel simplifie.

Dans Paperasse, ces declarations sont des brouillons locaux, pas une teletransmission fiscale.

### Liasse fiscale

C'est un ensemble de documents fiscaux de fin d'exercice.

Dans Paperasse, la liasse est une source structuree locale, utile pour preparer le dossier, mais pas une teletransmission officielle.

### Expert-comptable ou EC

L'expert-comptable est la personne ou le cabinet qui relit, controle et valide votre dossier.

Paperasse peut preparer un dossier EC partageable en lecture seule.

---

## 2. Comment lire les statuts dans Paperasse

Paperasse utilise souvent des badges de statut.

### Statuts courants

- `A verifier` : vous devez regarder l'element.
- `Corrige` : une correction a ete appliquee.
- `Confirme` : l'element est valide pour le moment.
- `Brouillon` : l'element existe mais n'est pas encore valide.
- `Valide` : l'element a ete approuve.
- `Rejete` : l'element a ete refuse avec une note.
- `A regenerer` : un document est devenu ancien apres une modification.
- `A jour` : le document ou le controle correspond a l'etat actuel.
- `Bloquant` : vous devez traiter ce point avant une etape importante.
- `Warning` ou `Avertissement` : ce n'est pas toujours bloquant, mais il faut comprendre le point.

### Regle simple

Quand vous voyez un bouton d'action, Paperasse attend souvent une decision :

- corriger ;
- valider ;
- rejeter ;
- rattacher une piece ;
- regenerer un document ;
- relancer un rapprochement.

---

## 3. Parcours recommande pour un debutant

Si vous ne savez pas par ou commencer, suivez cet ordre :

1. Ouvrir `Profil` et verifier les informations de l'entreprise.
2. Ouvrir `Exercices` et verifier l'exercice actif.
3. Aller dans `Imports` et importer les transactions bancaires.
4. Aller dans `Transactions` et corriger les lignes "A verifier".
5. Aller dans `Pieces` pour ajouter les justificatifs importants.
6. Aller dans `Ecritures` pour verifier que le journal est equilibre.
7. Aller dans `TVA` si votre entreprise est au regime reel.
8. Aller dans `Rapprochements` pour comparer banque, Stripe, tiers et comptes d'attente.
9. Aller dans `Controle` pour traiter les points de pre-cloture.
10. Aller dans `Documents` pour generer FEC, etats financiers, liasse et paquet de preuve.
11. Aller dans `Couverture EC` pour voir ce qui manque encore.
12. Aller dans `Cloture` quand tout est pret.
13. Aller dans `Dossier EC` pour preparer le partage avec l'expert-comptable.

---

## 4. Navigation generale

La barre laterale est le menu principal. Elle est divisee en groupes.

### Pilotage

- `Tableau de bord` : vue generale.
- `Notifications` : messages importants a traiter.
- `Activite` : historique des actions.

### Operations

- `Imports` : importer des fichiers bancaires.
- `Connecteurs` : connecter ou synchroniser des sources bancaires.
- `Transactions` : consulter et corriger les transactions.
- `Regles` : gerer les regles de correction.
- `Pieces` : ajouter et rattacher des justificatifs.

### Comptabilite

- `Ecritures` : consulter le journal comptable.
- `TVA` : position et declarations TVA.
- `Rapprochements` : rapprocher banque, Stripe, tiers et comptes d'attente.
- `Controle` : points de pre-cloture.
- `Couverture EC` : niveau de couverture du dossier.

### Cloture

- `Cloture` : workflow annuel de cloture.
- `Immobilisations` : registre des biens amortissables.
- `Documents` : generation et telechargement des documents.
- `Dossier EC` : dossier partageable a l'expert-comptable.

### Administration

- `Chat` : assistant comptable en lecture seule.
- `Abonnement` : plan, quotas et usage.
- `Exercices` : gestion des exercices comptables.
- `Demo` : choix du dataset local de demonstration, uniquement en mode developpement.
- `Profil` : informations de l'entreprise et RGPD.

---

## 5. Page Tableau de bord

Chemin : `/dashboard`

Le tableau de bord est votre page d'accueil. Il repond a trois questions :

- ou en est mon dossier ?
- que dois-je traiter maintenant ?
- est-ce que mes donnees sont coherentes ?

### En-tete

Vous voyez le nom de l'entreprise et l'exercice actif.

Exemple : `Bonjour - ACME DIGITAL · Exercice 2025`.

Si l'exercice affiche n'est pas celui que vous voulez, allez dans `Exercices`.

### Bouton `Importer des transactions`

Ce bouton ouvre la page `Imports`.

Utilisez-le quand vous voulez ajouter un fichier bancaire.

### Message de succes demo

Si vous venez de charger un dataset demo, un message peut indiquer que le dataset a ete charge.

### Signal de coherence

Paperasse peut afficher :

- `Exploitation coherente` : les compteurs principaux sont alignes ;
- `Donnees a revoir` : certains compteurs ne sont pas coherents ou des controles demandent attention.

Ce signal ne remplace pas un controle comptable complet. Il indique seulement si les grandes lectures du produit sont alignees.

### Alertes

Les alertes vous indiquent les actions importantes :

- transactions a corriger ;
- documents a regenerer ;
- OD a valider ;
- rapprochements incomplets ;
- blocages de cloture.

Cliquez sur les liens d'action proposes.

### Cartes KPI

Les cartes KPI sont les grands indicateurs.

#### Chiffre d'affaires

Montant total des produits comptabilises sur l'exercice.

Si le montant semble trop faible, verifiez :

- que toutes les transactions de ventes sont importees ;
- que les ventes sont bien categorisees ;
- que les ecritures sont generees.

#### Charges

Montant total des depenses comptabilisees.

Le libelle peut indiquer `Hors cloture`, ce qui signifie que certaines OD de cloture ne sont pas encore prises en compte.

#### Resultat

Difference entre produits et charges.

Un resultat positif indique un benefice comptable provisoire. Un resultat negatif indique une perte comptable provisoire.

#### Tresorerie

Solde du compte bancaire comptable, souvent le compte `5121`.

Ce chiffre doit etre rapproche du releve bancaire.

#### A verifier

Nombre de transactions qui demandent une correction ou une confirmation.

Priorite : reduire ce nombre a zero.

#### Documents

Indique si vos documents sont `A jour` ou `A regenerer`.

Un document devient souvent `A regenerer` apres :

- correction d'une transaction ;
- validation d'une OD ;
- modification TVA ;
- nouvel import.

#### OD brouillon

Nombre d'operations diverses proposees mais non validees.

Une OD brouillon n'a pas encore cree d'ecriture comptable.

#### Couverture EC

Score de couverture du dossier expert-comptable.

Plus le score est haut, plus le dossier contient les preuves attendues.

### Transactions recentes

Le tableau affiche les dernieres transactions.

Colonnes :

- `Date` : date de l'operation bancaire.
- `Libelle` : texte de la banque.
- `Compte` : compte comptable associe ou propose.
- `Montant` : montant de la transaction.
- `Statut` : etat de traitement.

Si une transaction est en `A verifier`, ouvrez `Transactions`.

---

## 6. Page Notifications

Chemin : `/notifications`

Cette page regroupe les messages importants.

Une notification n'est pas une ecriture comptable. C'est un signal pour vous aider a agir.

### Cartes KPI

#### Total

Nombre total de notifications visibles.

#### Non lues

Notifications que vous n'avez pas encore marquees comme lues.

#### Blocages

Notifications bloquantes.

Traitez-les en priorite.

#### Warnings

Notifications d'avertissement.

Elles peuvent ne pas bloquer tout de suite, mais elles expliquent un risque.

### Filtres

- `Tout` : affiche toutes les notifications.
- `Non lues` : affiche seulement celles qui n'ont pas ete lues.
- `Blocages` : affiche les notifications bloquantes.
- `Tout marquer lu` : marque toutes les notifications comme lues.

### Tableau des notifications

Colonnes :

- `Date` : moment de creation de la notification.
- `Severite` : importance du message.
- `Notification` : titre et explication.
- `Action` : lien vers la page utile.
- `Etat` : lue, non lue ou masquee.

### Actions

- `Ouvrir` : va vers la page concernee.
- `Lu` : marque la notification comme lue.
- `Masquer` : cache la notification sans supprimer l'information source.

Si une notification revient apres avoir ete masquee, c'est souvent que le probleme existe toujours ou qu'il a ete recree.

---

## 7. Page Activite

Chemin : `/activity`

Cette page est le journal des evenements du produit.

Elle permet de repondre a :

- qui a fait quoi ?
- quand ?
- sur quel type d'objet ?
- avec quel resultat ?

### Bouton `Exporter CSV`

Telecharge l'historique d'activite au format CSV.

Utile pour l'audit ou pour transmettre un historique a un tiers.

### Raccourcis de filtre

- `Tout` : tous les evenements.
- `Documents` : uniquement les generations, telechargements et erreurs documentaires.
- `Imports` : uniquement les imports.
- `Audit JSON` : export plus structure pour analyse.

### Formulaire de filtre

#### Type

Filtre par type d'objet : document, import, chat, billing, piece, cloture, etc.

#### Action

Filtre par action precise : generation, validation, correction, rejet, upload, etc.

#### Depuis

Date de debut de la periode.

#### Jusqu'a

Date de fin de la periode.

#### Filtrer

Applique les filtres.

### Tableau

Colonnes :

- `Date` : quand l'action a eu lieu.
- `Action` : ce qui s'est passe.
- `Type` : domaine concerne.
- `Exercice` : exercice comptable concerne.
- `Detail` : explication courte.
- `Metadata` : informations techniques complementaires.

La colonne `Metadata` peut contenir du JSON. Ce n'est pas indispensable pour un debutant, mais utile en audit.

---

## 8. Page Imports

Chemin : `/imports`

Cette page sert a importer vos transactions bancaires depuis un fichier CSV.

### Zone d'import CSV

#### Fichier CSV

Choisissez le fichier bancaire exporte depuis votre banque.

Formats supportes selon configuration :

- Qonto ;
- BNP Paribas ;
- Societe Generale ;
- Boursorama ;
- mapping manuel si le format n'est pas reconnu.

#### Lancer l'import

Envoie le fichier a Paperasse.

Paperasse va ensuite :

1. detecter le format ;
2. lire les colonnes ;
3. creer les transactions ;
4. proposer des categories ;
5. generer les ecritures quand c'est possible.

### Historique des imports

Colonnes :

- `Date` : date de l'import.
- `Fichier` : nom du fichier importe.
- `Format` : format reconnu.
- `Etape` : progression du traitement.
- `Progression` : avancement global.
- `Lignes parsed/total` : lignes lues sur total.
- `Categorisees` : transactions ayant recu une categorisation.
- `A verifier` : transactions qui demandent une intervention.
- `Duree` : temps de traitement.
- `Statut` : succes, en cours, erreur ou mapping requis.
- `Actions` : actions disponibles.

### Etapes possibles

- `En attente` : l'import attend de demarrer.
- `Detection CSV` : Paperasse essaie de comprendre le format.
- `Mapping requis` : vous devez indiquer quelles colonnes correspondent a la date, au libelle, au montant, etc.
- `Transactions` : creation des transactions.
- `Categorisation` : classement comptable.
- `Ecritures` : generation des ecritures.
- `Termine` : import fini.

### Actions

- `Mapping` : ouvrir l'ecran de correspondance des colonnes.
- `Retry` : relancer l'import.
- `Retry IA` : relancer la categorisation si disponible.

### Page de mapping

Si Paperasse ne reconnait pas le fichier, il demande de choisir les colonnes.

Champs typiques :

- date de transaction ;
- libelle ;
- montant ;
- contrepartie ;
- reference bancaire ;
- categorie source.

Une fois le mapping valide, Paperasse peut reprendre l'import.

---

## 9. Page Connecteurs

Chemin : `/connecteurs`

Cette page regroupe les connexions externes et les diagnostics d'infrastructure.

En mode local, les connecteurs peuvent etre des mocks ou des fixtures.

### Cartes KPI

#### Open Banking

Indique si un provider bancaire est configure.

Statuts possibles :

- desactive ;
- mock ;
- provider configure ;
- erreur de configuration.

#### Connexions actives

Nombre de connexions bancaires actives en lecture seule.

#### Readiness

Indique si l'environnement beta est pret ou a revoir.

#### Stockage

Indique si les documents et pieces sont stockes en local ou via stockage objet.

### Readiness beta

Tableau des controles d'environnement.

Colonnes :

- `Check` : controle effectue.
- `Statut` : pret, warning ou bloquant.
- `Message` : explication.
- `Action` : correction recommandee.

### Open Banking provider

Section de connexion bancaire.

Actions possibles :

- connecter ;
- synchroniser ;
- deconnecter ;
- reconnecter si le consentement est expire.

### Table des connexions

Colonnes :

- `Connexion` : nom ou identifiant masque.
- `Statut` : active, expiree, erreur ou revoquee.
- `Fraicheur` : indique si la synchronisation est recente.
- `Expiration` : date de fin du consentement.
- `Derniere sync` : derniere synchronisation.
- `Comptes` : comptes bancaires recuperes.
- `Actions` : sync ou reconnexion.

### Connecteurs historiques

Liste les connecteurs connus et leur etat.

Colonnes :

- `Provider` : nom du fournisseur.
- `Source` : origine des donnees.
- `Configured` : indique si la configuration existe.
- `Message` : diagnostic.

### Dernieres synchronisations

Colonnes :

- `Date` : moment de la sync.
- `Statut` : succes ou erreur.
- `Fetch` : donnees recuperees.
- `Importees` : lignes importees.
- `Erreur` : message si echec.

### Audit stockage

Indique si les fichiers attendus sont bien presents.

Colonnes :

- `Type` : document ou piece.
- `Fichier` : nom ou cle de stockage.
- `Disponibilite` : present ou manquant.
- `Taille` : taille du fichier.

---

## 10. Page Transactions

Chemin : `/transactions`

Cette page liste les transactions bancaires importees.

C'est l'une des pages les plus importantes.

### Filtres

#### Recherche

Cherche dans :

- libelle ;
- contrepartie ;
- reference.

Exemple : tapez `stripe`, `ovh`, `urssaf` ou `google`.

#### Statut

Choix possibles :

- `Toutes` : toutes les transactions.
- `A verifier` : transactions a corriger.
- `Categorisees` : transactions classees.
- `Confirmees` : transactions confirmees.
- `Corrigees` : transactions corrigees manuellement.
- `Avec regle` : transactions couvertes par une regle.

#### Du / Au

Filtre par periode.

#### Compte

Filtre par compte comptable.

#### Sens

- `Tous` : toutes les transactions.
- `Decaissements` : sorties d'argent.
- `Encaissements` : entrees d'argent.

#### Par page

Nombre de transactions affichees :

- 25 ;
- 50 ;
- 100.

#### Filtrer

Applique les filtres.

#### Reinitialiser

Revient a la liste complete.

### Badges de filtres actifs

Paperasse affiche les filtres actuellement actifs.

Cela vous aide a comprendre pourquoi certaines transactions n'apparaissent pas.

### Cartes KPI

- `Total` : nombre de transactions dans la liste filtree.
- `A verifier` : nombre de transactions a traiter.
- `Corrigees` : nombre de transactions corrigees.
- `Avec regle` : nombre de transactions associees a une regle.

### Tableau des transactions

Colonnes :

- `Date` : date bancaire.
- `Libelle` : texte fourni par la banque.
- `Compte` : compte comptable affiche.
- `Montant` : montant de l'operation.
- `Statut` : etat de traitement.
- `Regle` : indique si une regle s'applique.
- `Action` : ouvrir, voir ou corriger.

### Pagination

Utilisez `Precedent` et `Suivant` pour changer de page.

---

## 11. Page Detail Transaction

Chemin : `/transactions/:id`

Cette page sert a comprendre et corriger une transaction precise.

### Navigation

- `Retour liste filtree` : revient a la liste avec les memes filtres.
- `Precedente` : transaction precedente dans la file.
- `Suivante` : transaction suivante dans la file.

Si vous etes dans la file `A verifier`, Paperasse peut afficher votre position, par exemple `1 / 2 a corriger`.

### Cartes principales

#### Date

Date de la transaction bancaire.

#### Montant

Montant de la transaction.

Un montant negatif correspond souvent a une depense. Un montant positif correspond souvent a une recette.

#### Compte affiche

Compte comptable actuellement associe.

#### Statut

Etat de la transaction.

### Informations transaction

Vous pouvez voir :

- le libelle bancaire ;
- la contrepartie ;
- la reference source ;
- la justification automatique si elle existe.

### Suggestions

Paperasse propose des categorisations.

Colonnes :

- `Badge` : appliquee, suggeree ou a verifier.
- `Source` : origine de la suggestion.
- `Debit` : compte debit propose.
- `Credit` : compte credit propose.
- `TVA` : taux TVA propose.
- `Nature` : nature TVA proposee.
- `Libelle` : libelle d'ecriture propose.
- `Raison` : explication lisible.

### Regles qui matchent

Liste les regles existantes pouvant s'appliquer a cette transaction.

Colonnes :

- contrepartie ;
- compte prefere ;
- condition ;
- lien vers la regle.

### Ecriture liee

Si une ecriture existe deja, Paperasse affiche :

- numero ;
- journal ;
- libelle ;
- lignes.

### Pieces liees

Affiche les justificatifs rattaches.

Vous pouvez aussi uploader ou rattacher une piece depuis cette page.

### Formulaire de correction

#### Compte debit

Compte a debiter.

Si vous ne savez pas, utilisez la suggestion ou demandez a votre expert-comptable.

#### Compte credit

Compte a crediter.

Pour une transaction bancaire classique, un des comptes est souvent le compte banque `5121`.

#### Libelle ecriture

Texte lisible qui decrit l'ecriture.

Exemple : `Facture OVH hebergement`.

#### Taux TVA

Choix possibles :

- `Aucune TVA` ;
- `0 %` ;
- `2.1 %` ;
- `5.5 %` ;
- `10 %` ;
- `20 %`.

Si votre entreprise est en franchise en base de TVA, choisissez generalement aucune TVA ou 0 selon le cas.

#### Nature TVA

Exemples :

- achat domestique ;
- vente domestique ;
- intracommunautaire ;
- autoliquidation ;
- exonere ;
- hors champ.

#### Apprendre cette correction

Si vous cochez cette case, Paperasse cree une regle pour les prochaines transactions similaires.

#### Valider la categorisation

Applique la correction.

Apres validation, Paperasse peut :

- regenerer l'ecriture ;
- creer une regle ;
- mettre a jour les compteurs ;
- rendre certains documents obsoletes.

---

## 12. Page Regles

Chemin : `/corrections`

Cette page gere les regles de correction.

Une regle sert a automatiser les prochaines categorisations similaires.

### Filtres

#### Recherche

Cherche une contrepartie, un compte ou une note.

#### Statut

- `Toutes` ;
- `Actives` ;
- `Inactives`.

### Creation de regle

#### Contrepartie

Texte a reconnaitre dans une transaction.

Exemple : `OVH`, `GOOGLE`, `URSSAF`.

#### Compte prefere

Compte comptable a utiliser.

#### Libelle compte

Nom lisible du compte.

#### Condition

Condition de declenchement.

Exemple : contient tel mot, egal a telle contrepartie, etc.

#### Note

Explication pour vous ou votre expert-comptable.

#### Creer

Ajoute la regle.

### Tableau des regles

Colonnes :

- `Statut` : active ou inactive.
- `Contrepartie` : texte reconnu.
- `Compte` : compte applique.
- `Condition` : condition de matching.
- `Impact` : nombre de transactions concernees.
- `Note` : explication.
- `Action` : desactiver ou reactiver.

### Detail d'une regle

Chemin : `/corrections/:id`

Vous y voyez :

- statut ;
- compte ;
- impact ;
- sante de la regle ;
- conflits possibles ;
- exemples de transactions matchees.

Si une regle est trop large, desactivez-la et creez une regle plus precise.

---

## 13. Page Pieces

Chemin : `/pieces`

Cette page sert a gerer les justificatifs.

Un justificatif peut etre une facture, un recu, un contrat, un releve ou une decision utilisateur.

### Boutons principaux

#### Revue guidee

Ouvre la page qui liste les pieces manquantes a fournir.

#### Couverture justificatifs

Ouvre la page de couverture EC dediee aux justificatifs.

### Cartes KPI

#### Pieces

Nombre total de pieces connues.

#### Requises manquantes

Nombre de justificatifs obligatoires non encore fournis.

#### Non rattachees

Pieces importees mais non reliees a une transaction ou une ecriture.

#### OCR a revoir

Pieces dont l'extraction automatique a echoue ou doit etre completee manuellement.

### Upload de piece

#### Fichier

Types acceptes :

- PDF ;
- PNG ;
- JPG ou JPEG ;
- TXT.

Taille maximale par fichier : 10 Mo.

#### Uploader

Ajoute la piece.

Paperasse tente une extraction locale si possible. Si l'extraction echoue, la piece reste utilisable.

### Filtres

#### Statut

- actives ;
- uploadees ;
- extraites ;
- OCR echoue ;
- archivees.

#### Vue

- toutes ;
- non rattachees.

### Ecritures sans piece

Liste les ecritures qui devraient avoir une preuve mais n'en ont pas encore.

### Pieces sans ecriture

Liste les fichiers ajoutes mais non relies a un element comptable.

### Tableau des pieces

Colonnes :

- `Fichier` : nom et taille.
- `Statut` : etat de traitement.
- `Fournisseur` : fournisseur extrait ou saisi.
- `Date` : date de facture.
- `TTC` : montant toutes taxes comprises.
- `Liens` : nombre de rattachements.
- `Ouvrir` : acceder au detail.

---

## 14. Page Revue des pieces

Chemin : `/pieces/revue`

Cette page vous guide pour fournir les justificatifs manquants.

### Onglets ou sections

#### A fournir

Pieces requises manquantes.

Priorite haute.

#### Recommandees

Pieces utiles mais pas toujours bloquantes.

#### Satisfaites

Exigences deja couvertes par une piece.

### Tableau des exigences

Colonnes :

- `Preuve` : type attendu, par exemple facture ou contrat.
- `Element` : transaction, ecriture ou OD concernee.
- `Niveau` : requis ou recommande.
- `Action` : fournir une piece ou voir la preuve.

### Fournir une piece

Quand vous uploadez depuis une exigence precise, Paperasse peut rattacher automatiquement la piece au bon element.

C'est la methode recommandee pour les debutants.

---

## 15. Page Detail Piece

Chemin : `/pieces/:id`

Cette page sert a verifier, corriger et rattacher une piece.

### Actions

- `Retour` : revient a la liste.
- `Telecharger` : telecharge le fichier original.

### Cartes KPI

- `Statut` : etat de la piece.
- `Fournisseur` : fournisseur extrait ou saisi.
- `Date` : date de facture.
- `TTC` : montant total.

### Formulaire de metadonnees

#### Fournisseur

Nom du fournisseur ou du client.

#### Date facture

Date indiquee sur la facture.

#### N° facture

Numero de facture.

#### HT

Montant hors taxes.

#### TVA

Montant de TVA.

#### TTC

Montant toutes taxes comprises.

#### Devise

Exemple : EUR.

#### Texte extrait

Texte lu automatiquement depuis le fichier.

Vous pouvez le corriger ou le completer si besoin.

#### Enregistrer

Sauvegarde les corrections manuelles.

### Rattachements

Liste les transactions, ecritures, OD ou exercices relies a cette piece.

Action possible : detacher.

### Suggestions de rattachement

Paperasse propose des liens possibles avec un score.

Le score peut tenir compte :

- du montant ;
- de la date ;
- du fournisseur ;
- du type de preuve attendu.

### Exigences actives

Liste les besoins de preuve non satisfaits.

Action : rattacher cette piece a une exigence.

### Archiver

Archive la piece.

L'archivage ne supprime pas forcement le fichier immediatement. Il le retire du flux actif.

---

## 16. Page Ecritures

Chemin : `/ecritures`

Cette page affiche le journal comptable.

C'est la traduction comptable des transactions et OD.

### Alertes

#### Journal audit

Indique si le journal est exportable et equilibre.

#### Evidence

Indique si des ecritures manquent de pieces.

#### Anomalies

Paperasse peut signaler :

- ecriture sans ligne ;
- ligne avec debit et credit en meme temps ;
- ligne a zero ;
- desequilibre debit/credit.

### Filtres

#### Journal

Exemples :

- `BQ` : journal de banque ;
- `OD` : operations diverses.

#### Source

- import ;
- cloture ;
- manuel.

#### Compte

Filtre par compte comptable.

#### Recherche

Recherche dans les libelles.

#### Du / Au

Filtre par date.

#### Par page

Nombre de lignes affichees.

### Cartes KPI

#### Debit

Total des debits de la selection.

#### Credit

Total des credits de la selection.

#### Equilibre

Indique si debit = credit.

#### Page

Nombre d'ecritures affichees sur la page.

### Tableau

Colonnes :

- `N°` : numero d'ecriture.
- `Date` : date comptable.
- `Journal` : BQ, OD, etc.
- `Source` : origine de l'ecriture.
- `Libelle` : description.
- `Compte` : compte comptable.
- `Debit` : montant au debit.
- `Credit` : montant au credit.

### Exporter CSV

Telecharge les ecritures filtrees ou completes au format CSV.

Cet export ne remplace pas le FEC officiel.

---

## 17. Page Documents

Chemin : `/documents`

Cette page sert a generer et telecharger les documents comptables.

### Alertes

Paperasse peut afficher :

- controles bloquants ;
- documents a regenerer ;
- erreurs de generation ;
- avertissements.

### Carte FEC

Le FEC est le fichier des ecritures comptables.

Action : `Generer`.

Avant de generer le FEC, corrigez les transactions bloquantes si possible.

### Carte Etats financiers

Genere :

- balance ;
- bilan ;
- compte de resultat.

Format local selon configuration.

### Carte Liasse fiscale

Genere une liasse structuree.

Le PDF peut etre optionnel selon l'environnement.

Si le PDF echoue mais que la source structuree existe, le document source reste valable dans Paperasse.

### Audit generation

Affiche la derniere tentative de generation.

Champs possibles :

- type genere ;
- fichiers produits ;
- version de script ;
- duree ;
- message utilisateur ;
- succes ou echec.

### Telecharger paquet de preuve

Disponible quand les documents requis existent.

Le paquet de preuve rassemble :

- FEC ;
- etats financiers ;
- liasse ;
- pieces ;
- rapports de rapprochement ;
- workpapers ;
- OD ;
- audit ;
- manifest.

### Tableau des documents

Colonnes :

- `Date` : date de generation.
- `Type` : FEC, etats, liasse, TVA, bundle, etc.
- `Fichier` : nom du fichier.
- `Etat` : a jour ou a regenerer.
- `Format` : txt, md, html, pdf, json.
- `Taille` : taille du fichier.
- `Ecritures` : nombre d'ecritures prises en compte.
- `Script` : version ou nom du script.
- `Genere par` : utilisateur ou systeme.
- `Telecharger` : lien de telechargement.

---

## 18. Page Controle

Chemin : `/controle`

Cette page liste les points de controle de pre-cloture.

Elle sert a transformer des alertes en actions suivables.

### Cartes KPI

#### Statut

Etat global des controles.

#### Blocages

Nombre de problemes bloquants.

#### Ouverts

Nombre de points encore actifs.

#### OD proposees

Nombre d'operations diverses disponibles ou a relire.

#### Documents

Etat des documents.

#### Pieces

Etat des justificatifs.

### Blocages

Points qui empechent une etape importante.

Exemple : transaction non corrigee.

### Justificatifs

Pieces requises ou recommandees manquantes.

### OD proposees

Operations diverses proposees par Paperasse.

Colonnes :

- `Statut` : brouillon, validee, rejetee.
- `Type` : CCA, amortissement, IS, etc.
- `Libelle` : description.
- `Recalcul` : indique si la proposition est a jour.
- `Montant` : montant principal.
- `Voir` : ouvrir le detail.

### Documents

Indique quels documents sont a jour ou a regenerer.

### Points a revoir

Liste les warnings ou controles non bloquants.

Chaque point peut etre :

- ouvert ;
- resolu ;
- ignore avec note.

### Deja traites

Historique des points resolus ou ignores.

Colonnes :

- `Statut` ;
- `Controle` ;
- `Element` ;
- `Note` ;
- `Voir`.

---

## 19. Page Detail OD

Chemin : `/controle/od/:proposalKey`

Cette page permet de relire une operation diverse avant validation.

Important : une OD brouillon ne cree pas encore d'ecriture.

### Alertes

Vous pouvez voir :

- statut de l'OD ;
- fraicheur ;
- preuve manquante ;
- raison d'obsolescence.

### Cartes KPI

#### Type

Nature de l'OD.

Exemples :

- CCA ;
- amortissement ;
- IS ;
- FNP ;
- provision ;
- variation de stock.

#### Montant

Montant principal calcule.

#### Fraicheur

Indique si la proposition est a jour.

#### Piece

Indique si une preuve est liee.

#### Ecriture

Si l'OD est validee, lien vers l'ecriture creee.

### Hypotheses

Les hypotheses sont les donnees utilisees pour calculer l'OD.

Elles varient selon le type.

#### CCA

- periode couverte ;
- montant rattache a l'exercice suivant ;
- compte de charge ;
- compte `486`.

#### Amortissement

- date de mise en service ;
- base amortissable ;
- duree en annees ;
- prorata jours ;
- compte de dotation ;
- compte d'amortissement.

#### IS

- resultat avant IS ;
- taux ;
- compte IS ;
- compte Etat.

#### Workpapers generiques

Selon le domaine :

- montant ;
- compte debit ;
- compte credit ;
- base de calcul ;
- stock initial et final ;
- capital ;
- taux annuel ;
- nombre de jours.

### Lignes debit/credit

Tableau des lignes proposees.

Colonnes :

- `Compte` ;
- `Libelle` ;
- `Debit` ;
- `Credit`.

Avant validation, verifiez que le total debit egale le total credit.

### Calcul

Affiche :

- version du calcul ;
- dernier calcul ;
- impact resultat ;
- impact bilan ;
- JSON technique du calcul.

### Preuves liees

Liste les pieces rattachees.

Si une preuve est requise et absente, la validation peut etre bloquee.

### Historique

Liste les evenements :

- hypotheses modifiees ;
- recalcul ;
- validation ;
- rejet ;
- reouverture.

### Actions

#### Enregistrer les hypotheses

Sauvegarde vos modifications.

#### Recalculer

Recalcule les lignes a partir des hypotheses.

#### Valider l'OD

Cree l'ecriture comptable OD si elle n'existe pas encore.

Action importante : elle modifie la comptabilite.

#### Rejeter

Refuse la proposition. Une note est requise.

#### Reouvrir

Rouvre une OD rejetee pour la retravailler.

---

## 20. Page TVA

Chemin : `/tva`

Cette page sert a suivre la TVA.

Si votre entreprise est en franchise de TVA, certains elements peuvent etre non applicables.

### Cartes KPI

#### Regime

Regime TVA de l'entreprise :

- franchise ;
- reel simplifie ;
- reel normal.

#### TVA collectee

TVA sur vos ventes, souvent compte `44571`.

#### TVA deductible

TVA sur vos achats, souvent compte `44566`.

#### Net

Difference entre TVA collectee et TVA deductible.

### Filtres periode

#### Debut

Date de debut de periode TVA.

#### Fin

Date de fin.

#### Filtrer

Met a jour les tableaux.

### Controles TVA

Liste les problemes detectes :

- taux manquant ;
- nature TVA manquante ;
- declaration obsolete ;
- compte TVA incoherent.

Actions :

- ouvrir la revue TVA ;
- generer ou regenerer une declaration.

### Tableau par taux

Colonnes :

- `Cle` : taux TVA.
- `Base HT` : base hors taxe.
- `Deductible` : TVA deductible.
- `Collectee` : TVA collectee.
- `Net` : solde.

### Tableau par nature

Regroupe les operations par nature :

- achat domestique ;
- vente domestique ;
- intracommunautaire ;
- autoliquidation ;
- exonere ;
- hors champ.

### Comptes TVA

Colonnes :

- `Compte` ;
- `Libelle` ;
- `Debit` ;
- `Credit` ;
- `Solde`.

### Declarations brouillon

Colonnes :

- `Type` : CA3 ou CA12.
- `Periode` : periode couverte.
- `Statut` : brouillon actif ou remplace.
- `Fraicheur` : a jour ou obsolete.
- `Net` : TVA nette.
- `Ouvrir` : detail.

---

## 21. Page Revue TVA

Chemin : `/tva/revue`

Cette page permet de traiter les problemes TVA un par un.

### Cartes KPI

- `Points` : nombre total de points.
- `Bloquants` : points bloquants.
- `Alertes` : points d'avertissement.

### File de revue

Colonnes :

- `Point` : identifiant lisible.
- `Severite` : bloquant ou warning.
- `Detail` : explication.
- `Traiter` : ouvrir ou resoudre.

### Resolution d'un taux ou d'une nature

Si le point concerne une transaction, Paperasse vous demande :

- taux TVA ;
- nature TVA.

La resolution passe par le flux de correction transaction pour eviter les ecritures TVA incoherentes.

---

## 22. Page Detail Declaration TVA

Chemin : `/tva/:declarationId`

Cette page affiche une declaration TVA brouillon.

### Actions

- `Retour` : revient a la page TVA.
- `Telecharger` : telecharge le brouillon.
- `Regenerer` : cree une nouvelle version si la declaration est obsolete.

### Cartes KPI

- `Statut` : brouillon actif ou remplace.
- `Fraicheur` : a jour ou obsolete.
- `TVA collectee` ;
- `TVA deductible` ;
- `Net`.

### Cases brouillon

Montants declaratifs :

- base HT taxable ;
- TVA collectee ;
- TVA deductible ;
- TVA autoliquidation ;
- TVA nette.

### Sources par taux

Explique d'ou viennent les montants.

### Controles

Liste les controles TVA lies a la declaration.

### Comparaison avec le journal

Affiche les ecarts eventuels entre la declaration et les comptes comptables.

---

## 23. Page Rapprochements

Chemin : `/rapprochements`

Cette page compare les donnees comptables avec d'autres sources :

- banque ;
- Stripe ;
- comptes clients/fournisseurs ;
- comptes d'attente.

### Cartes KPI

#### Blocages

Issues bloquantes.

#### Avertissements

Issues non bloquantes.

#### Progression banque

Pourcentage de lignes rapprochees.

#### Fraicheur

Indique si les rapprochements sont a jour.

### Connecteurs

Tableau des sources disponibles.

Colonnes :

- provider ;
- source ;
- configuration ;
- message.

### Cartes par domaine

#### Banque

Rapproche transactions bancaires et lignes comptables du compte `5121`.

#### Stripe

Rapproche payouts Stripe, evenements Stripe et banque.

#### Tiers

Analyse comptes clients/fournisseurs.

#### Comptes d'attente

Controle les comptes comme `471`, `467`, `511`, `580`.

---

## 24. Page Rapprochement Banque

Chemin : `/rapprochements/banque`

### Cartes KPI

- `Statut ligne a ligne` : etat du rapprochement.
- `Matches` : lignes rapprochees.
- `Issues ouvertes` : problemes actifs.
- `Solde releve` : solde saisi depuis le releve bancaire.

### Lancer rapprochement bancaire

Calcule les correspondances entre transactions bancaires et lignes comptables.

### Solde releve

Montant du releve bancaire a la date de controle.

### Date releve

Date du solde bancaire.

### Confirmer si aucun ecart

Cochez seulement si vous avez verifie que le solde comptable et le releve concordent.

### Tableau des matches

Colonnes :

- `Gauche` : transaction ou source bancaire.
- `Droite` : ligne comptable.
- `Statut` : auto-matche, confirme, unmatched, ignore, difference.
- `Ecart` : difference de montant.
- `Note` : explication utilisateur.
- `Action` : confirmer ou ignorer.

---

## 25. Page Rapprochement Stripe

Chemin : `/rapprochements/stripe`

### Actions

- `Importer fixture Stripe` : charger des donnees locales de test.
- `Sync connecteur` : synchroniser si connecteur configure.
- `Lancer rapprochement` : calculer les matches.

### Cartes KPI

- `Statut` ;
- `Payouts matches` ;
- `Issues ouvertes` ;
- `Progression`.

### Matches payouts

Colonnes :

- `Payout` : versement Stripe.
- `Banque` : transaction bancaire associee.
- `Statut` ;
- `Ecart`.

### Evenements Stripe

Colonnes :

- `Date` ;
- `Type` : charge, fee, refund, dispute, payout.
- `Brut` ;
- `Frais` ;
- `Net`.

---

## 26. Page Revue Rapprochements

Chemin : `/rapprochements/revue`

Cette page liste toutes les issues de rapprochement.

### Filtres

#### Type

- banque ;
- Stripe ;
- tiers ;
- attente.

#### Statut

- open ;
- resolved ;
- ignored ;
- tous.

#### Severite

- blocking ;
- warning.

### Tableau

Colonnes :

- `Point` : identifiant de l'issue.
- `Type` : domaine.
- `Severite` : importance.
- `Statut` : ouvert, resolu ou ignore.
- `Note` : justification utilisateur.
- `Action` : voir, resoudre, ignorer ou reouvrir.

Une resolution ou un ignore doit avoir une note. Cette note sert a l'audit.

---

## 27. Page Couverture EC

Chemin : `/couverture`

Cette page indique si le dossier est suffisamment complet pour un expert-comptable.

Elle ne certifie pas le dossier. Elle montre les zones couvertes, partielles ou manquantes.

### Score global

Pourcentage de couverture.

### Cartes KPI

- `Score` : score global.
- `Couverts` : domaines couverts.
- `Partiels` : domaines incomplets.
- `Manquants` : domaines absents.

### Risques principaux

Liste les risques les plus importants.

Exemples :

- justificatifs manquants ;
- TVA incomplete ;
- rapprochements non traites ;
- dossier EC non valide.

### Tableau des domaines

Colonnes :

- `Domaine` : transactions, TVA, pieces, documents, cloture, etc.
- `Statut` : couvert, partiel, manquant, non applicable.
- `Risque` : faible, moyen ou eleve.
- `Resume` : explication courte.
- `Phase` : phase roadmap associee.
- `Voir` : detail.

---

## 28. Page Detail Couverture

Chemin : `/couverture/:areaCode`

Cette page explique un domaine precis.

### Action recommandee

Indique la prochaine action utile.

### Statut

Etat du domaine.

### Risque

Niveau de risque pour le dossier.

### Prochaine phase

Indique le chantier produit ou la phase associee.

### Preuves disponibles

Liste ce qui existe deja :

- documents ;
- pieces ;
- ecritures ;
- controles ;
- rapports ;
- validations.

### Manques identifies

Liste ce qui manque.

### Cas particulier : justificatifs

La page peut afficher :

- a fournir ;
- recommandees ;
- satisfaites.

Utilisez les liens d'action pour aller vers `Pieces` ou `Revue guidee`.

---

## 29. Page Cloture

Chemin : `/cloture`

Cette page guide la cloture annuelle.

Une cloture annuelle consiste a verifier, ajuster, documenter et verrouiller un exercice.

### Action principale

Selon l'etat :

- `Demarrer la cloture` ;
- `Cloturer l'exercice` ;
- `Reouvrir`.

### Alertes

Paperasse affiche les blocages et warnings.

### Cartes KPI

- `Exercice` : periode concernee.
- `Etapes` : progression des 12 etapes.
- `Blocages` : points bloquants.
- `Cloture` : statut global.

### OD de cloture generalisees

Lien vers `/cloture/od`.

C'est le cockpit des workpapers et OD de cloture.

### Revue expert-comptable

Affiche la derniere validation EC si elle existe.

Vous pouvez creer un lien de partage.

Champs :

- `Libelle` : nom du lien.
- `Expiration` : duree ou date d'expiration.
- `Creer un lien` : genere le lien.

### Liens de partage

Tableau :

- label ;
- validation ;
- expiration ;
- revocation.

### Les 12 etapes

Tableau :

- `N°` : numero d'etape.
- `Etape` : nom.
- `Statut` : pending, ready, done, blocked, skipped.
- `Preuve` : elements disponibles.
- `Action` : action recommandee.
- `Detail` : ouvrir la page de l'etape.

Etapes principales :

1. Balance check.
2. Rapprochement bancaire.
3. Lettrage tiers.
4. Charges et produits constates d'avance.
5. Amortissements.
6. Provisions.
7. TVA.
8. Impot.
9. OD de cloture.
10. Etats financiers.
11. Liasse fiscale.
12. Archive de preuve.

---

## 30. Page OD de Cloture

Chemin : `/cloture/od`

Cette page centralise les workpapers et OD de cloture.

### Cartes KPI

- `Workpapers` : documents de travail.
- `OD a relire` : propositions a valider ou rejeter.
- `OD validees` : OD deja passees en ecritures.
- `Pieces manquantes` : preuves requises absentes.

### Onglets

#### Workpapers

Hypotheses et calculs preparatoires.

#### OD a relire

Propositions pretes a etre validees ou rejetees.

#### Validees

OD deja transformees en ecritures.

#### Rejetees

OD refusees avec note.

#### Pieces manquantes

OD ou workpapers bloquants faute de preuve.

### Actions

#### Generer / mettre a jour les propositions

Cree ou actualise les OD brouillon depuis les workpapers.

#### Recalculer les obsoletes

Recalcule les OD devenues anciennes apres modification.

---

## 31. Page Workpapers

Chemin : `/cloture/workpapers/:kind`

Cette page gere les documents de travail d'un domaine de cloture.

Exemples de domaines :

- FNP ;
- FAE ;
- PCA/CCA ;
- stocks ;
- provisions ;
- emprunts ;
- paie ;
- TVA ;
- IS ;
- ecarts de rapprochement.

### Champs typiques

#### Titre

Nom du workpaper.

#### Statut

- brouillon ;
- pret ;
- archive.

`Pret` signifie pret a generer une proposition d'OD, pas valide comptablement.

#### Hypotheses

Donnees saisies par l'utilisateur.

#### Calcul

Resultat calcule a partir des hypotheses.

#### Piece attendue

Type de justificatif requis ou recommande.

#### Note

Explication utilisateur.

### Actions

- creer ;
- modifier ;
- marquer pret ;
- remettre en brouillon ;
- archiver ;
- generer ou mettre a jour la proposition OD.

---

## 32. Page Immobilisations

Chemin : `/immobilisations`

Cette page liste les biens durables a amortir.

Exemples :

- ordinateur ;
- mobilier ;
- materiel ;
- equipement.

### Formulaire d'ajout

#### Libelle

Nom du bien.

#### Compte

Compte d'immobilisation.

Exemple : materiel informatique.

#### Date acquisition

Date d'achat.

#### Montant

Prix d'achat.

#### Duree annees

Duree d'amortissement.

#### Compte amortissement

Compte de cumul des amortissements.

#### Compte dotation

Compte de charge d'amortissement.

#### Ajouter

Cree l'immobilisation.

### Tableau

Colonnes :

- `Libelle` ;
- `Compte` ;
- `Date` ;
- `Montant` ;
- `Dotation` ;
- `Statut` ;
- `Archiver`.

Une immobilisation peut alimenter les propositions d'amortissement en cloture.

---

## 33. Page Dossier EC

Chemin : `/dossier-ec`

Cette page prepare le dossier pour l'expert-comptable.

Elle regroupe les preuves produites dans les autres pages.

### Alertes

Indiquent si le dossier est pret, partiel, bloque ou obsolete.

### Cartes KPI

- `Score dossier` : niveau global de preparation.
- `Sections pretes` : parties completes.
- `Blocages` : points bloquants.
- `Revue EC` : etat de la revue par l'expert.

### Readiness dossier

Liste les points a traiter avant partage ou export.

Colonnes :

- severite ;
- titre ;
- detail ;
- action.

### Export verification

Indique si l'export final contient tous les artefacts attendus.

### Actions

#### Preparer le dossier

Cree ou met a jour un snapshot du dossier.

#### Partager au cabinet

Cree un lien de revue en lecture seule.

Champs :

- label ;
- duree d'expiration.

#### Exporter dossier final

Produit un export cabinet si les conditions sont remplies.

### Sections du dossier

Colonnes :

- `Section` : FEC, TVA, pieces, rapprochements, etc.
- `Etat` : pret, partiel, bloque, obsolete.
- `Risque` : faible, moyen, eleve.
- `Resume` ;
- `Manques` ;
- `Ouvrir`.

### Revue cabinet

Liste les liens, validations et demandes expert-comptable.

---

## 34. Page Revue Dossier EC

Chemin : `/dossier-ec/revue`

Cette page gere les demandes et commentaires de l'expert-comptable.

### Creer une demande interne

Champs :

- `Section` : partie concernee.
- `Severite` : info, warning ou blocking.
- `Titre` : resume court.
- `Detail` : explication.

### Tableau des demandes

Colonnes :

- `Demande` : titre et contenu.
- `Section` : domaine.
- `Statut` : open, answered, resolved, waived.
- `Severite` : info, warning, blocking.
- `Commentaires` : echanges.
- `Actions` : resoudre, waiver, rouvrir, commenter.

### Regles importantes

- Une demande bloquante ouverte empeche la validation finale.
- Une resolution ou un waiver doit avoir une note.
- L'expert peut commenter et valider, mais ne modifie pas la comptabilite.

---

## 35. Page Snapshots Dossier EC

Chemin : `/dossier-ec/snapshots`

Un snapshot fige l'etat du dossier a un instant donne.

Si vous modifiez la comptabilite apres un snapshot, le snapshot devient obsolete.

### Tableau des snapshots

Colonnes :

- `Snapshot` : identifiant.
- `Statut` : brouillon, soumis, final.
- `Fraicheur` : a jour ou obsolete.
- `Cree le` : date.
- `Voir` : detail.

### Detail snapshot

Affiche :

- raisons d'obsolescence ;
- differences avec l'etat actuel ;
- sections impactees.

### Quand creer un nouveau snapshot

Creez un nouveau snapshot apres :

- correction d'une transaction ;
- validation d'une OD ;
- ajout ou suppression de piece ;
- regeneration de document ;
- nouveau rapprochement ;
- modification TVA ;
- reouverture de cloture.

---

## 36. Portail partage Expert-Comptable

Chemin : `/shared/:token`

Cette page est destinee a l'expert-comptable externe.

Elle est en lecture seule pour la comptabilite.

L'expert peut :

- consulter le dossier ;
- voir les documents ;
- lire les pieces ;
- examiner TVA, rapprochements, cloture ;
- creer des demandes ;
- commenter ;
- valider le dossier.

L'expert ne peut pas :

- modifier une transaction ;
- valider une OD ;
- creer une ecriture ;
- regenerer un document ;
- changer la cloture.

Si le snapshot partage est obsolete, un bandeau l'indique.

---

## 37. Page Chat

Chemin : `/chat`

Le chat est un assistant comptable contextuel en lecture seule.

Il peut expliquer les donnees et orienter vers les pages utiles.

Il ne cree pas :

- d'ecriture ;
- de document ;
- d'OD ;
- de correction.

### Cartes KPI

#### Plan

Votre plan d'abonnement.

#### IA ce mois

Nombre de messages IA utilises sur la periode.

#### Imports ce mois

Nombre d'imports utilises.

#### Documents

Indicateur documentaire.

### Conversations

Liste des conversations existantes.

Action : nouvelle conversation.

### Fil de discussion

Affiche vos messages et les reponses de l'assistant.

### Champ Message

Ecrivez votre question.

Exemples :

- `Pourquoi la cloture est bloquee ?`
- `Quelles transactions restent a corriger ?`
- `Quels documents sont a regenerer ?`

### Envoyer

Envoie le message.

### Contexte utilise

Paperasse peut afficher les modules ou donnees ayant servi a la reponse.

---

## 38. Page Abonnement

Chemin : `/abonnement`

Cette page affiche le plan, les quotas et l'etat du billing.

En mode developpement, le billing peut etre en mode stub.

### Alertes

Indiquent si Stripe est configure ou si l'app utilise un mode local.

### Cartes KPI

- `Plan` : SOLO, ENTREPRISE ou ENTREPRISE_PLUS.
- `Statut` : actif, annule, incomplet, etc.
- `Appels IA` : consommation du quota IA.
- `Imports` : consommation du quota imports.

### Etat des droits

Tableau :

- chat IA ;
- imports ;
- limite par minute ;
- Stripe.

### Changer de plan

Boutons de plan :

- SOLO ;
- ENTREPRISE ;
- ENTREPRISE_PLUS.

### Portail client

Ouvre le portail Stripe si disponible.

### Derniers webhooks billing

Colonnes :

- date ;
- type ;
- statut ;
- erreur.

---

## 39. Page Exercices

Chemin : `/exercices`

Cette page gere les exercices comptables.

### Pourquoi c'est important

L'exercice actif controle presque toutes les donnees affichees.

Si vous ne voyez pas les bonnes transactions, verifiez l'exercice actif.

### Creation d'exercice

#### Debut

Date de debut.

#### Fin

Date de fin.

#### Creer

Cree un nouvel exercice.

Paperasse refuse les dates qui se chevauchent avec un autre exercice.

### Tableau des exercices

Colonnes :

- `Periode` : dates.
- `Statut` : open, closing, closed.
- `Imports` : nombre d'imports.
- `Transactions` : nombre de transactions.
- `Ecritures` : nombre d'ecritures.
- `Documents` : nombre de documents.
- `Action` : activer.

### Activer

Change l'exercice actif.

Attention : cela modifie ce que vous voyez dans toutes les pages.

---

## 40. Page Profil

Chemin : `/profil`

Cette page contient les informations de l'entreprise et les actions RGPD.

### Informations entreprise

#### Nom

Nom de l'entreprise.

#### Forme juridique

Exemples :

- SASU ;
- SAS ;
- SARL ;
- EI.

#### SIREN

Identifiant administratif de l'entreprise.

#### Regime TVA

Choix :

- franchise ;
- reel simplifie ;
- reel normal.

#### Exigibilite TVA

Choix :

- encaissements ;
- debits ;
- mixed.

Si vous ne savez pas, demandez a votre expert-comptable avant de modifier.

#### Impot

Choix :

- IS ;
- IR.

#### Enregistrer

Sauvegarde les informations.

Changer certains champs fiscaux peut rendre des documents obsoletes.

### RGPD

#### Exporter mes donnees

Produit un export de vos donnees.

#### Anonymiser localement

Remplace certaines donnees personnelles ou d'entreprise par des valeurs anonymes.

Les montants et ecritures peuvent rester conserves pour l'audit.

#### Demander suppression

Lance une demande de suppression.

La suppression peut etre progressive pour respecter les obligations comptables.

### Tableau des demandes RGPD

Colonnes :

- `Demande` : type de demande.
- `Statut` : demandee, en cours, terminee, echouee.
- `Date` : date de demande.

---

## 41. Page Demo

Chemin : `/demo`

Cette page n'est disponible qu'en mode developpement local.

Elle sert a charger un scenario de demonstration.

Attention : charger un dataset demo reinitialise les donnees locales.

### Datasets possibles

#### qonto_mvp

Scenario standard MVP.

Utilisez-le pour le parcours de base.

#### multi_bank

Scenario multi-banques CSV.

Utile pour tester les imports et parsers.

#### regime_reel_tva

Scenario avec TVA au regime reel.

Utile pour tester la TVA, les comptes `44566` et `44571`, et les declarations.

#### closing_beta

Scenario de cloture beta.

Utile pour tester immobilisations, rapprochements, workpapers, OD et dossier EC.

### Carte dataset

Champs :

- nom ;
- description ;
- fixtures importees ;
- etat attendu ;
- avertissement de reset destructif.

### Confirmation

Vous devez cocher :

`Je comprends que les donnees locales seront reinitialisees`.

Le bouton reste desactive tant que la case n'est pas cochee.

### Charger ce dataset

Reinitialise le workspace demo et redirige vers le tableau de bord.

---

## 42. Que faire quand Paperasse affiche "A regenerer"

Un document devient `A regenerer` quand les donnees qui ont servi a le produire ont change.

Exemples :

- transaction corrigee ;
- OD validee ;
- piece rattachee ;
- TVA changee ;
- rapprochement relance ;
- workpaper modifie ;
- profil fiscal modifie.

Action recommandee :

1. Comprendre ce qui a change.
2. Aller dans `Documents`.
3. Regenerer le document concerne.
4. Verifier que l'etat repasse a `A jour`.

---

## 43. Que faire quand une transaction est "A verifier"

1. Aller dans `Transactions`.
2. Filtrer sur `A verifier`.
3. Ouvrir la premiere transaction.
4. Lire les suggestions.
5. Choisir ou saisir les comptes.
6. Choisir le taux et la nature TVA si applicable.
7. Cocher `Apprendre cette correction` si vous voulez creer une regle.
8. Cliquer sur `Valider la categorisation`.
9. Passer a la transaction suivante.

Objectif : arriver a zero transaction a verifier.

---

## 44. Que faire quand une piece est manquante

1. Aller dans `Pieces`.
2. Ouvrir `Revue guidee`.
3. Chercher les elements `A fournir`.
4. Cliquer sur `Fournir une piece`.
5. Uploader le fichier.
6. Verifier les champs extraits.
7. Corriger manuellement si besoin.
8. Verifier que l'exigence passe en satisfaite.

---

## 45. Que faire avant de transmettre a l'expert-comptable

Avant partage :

1. `Tableau de bord` : verifier les alertes.
2. `Transactions` : zero transaction a verifier.
3. `Pieces` : traiter les pieces requises.
4. `Ecritures` : journal equilibre.
5. `TVA` : controles traites si regime reel.
6. `Rapprochements` : banque et comptes d'attente traites.
7. `Controle` : points ouverts compris ou resolus.
8. `Documents` : FEC, etats et liasse generes.
9. `Couverture EC` : risques principaux compris.
10. `Cloture` : etapes importantes terminees ou justifiees.
11. `Dossier EC` : preparer snapshot.
12. Creer un lien de partage.

---

## 46. Regles de prudence

### Ne validez pas une OD sans comprendre son effet

Une OD validee cree une vraie ecriture comptable.

Relisez :

- hypotheses ;
- calcul ;
- lignes debit/credit ;
- piece liee ;
- impact resultat/bilan.

### Ne masquez pas un blocage sans note

Si vous ignorez un point, ajoutez une note claire.

Exemple : `Ignore car operation hors exercice, verifie avec EC le 21/05/2026`.

### Ne changez pas le regime TVA au hasard

Le regime TVA influence les ecritures, declarations et documents.

Demandez conseil si vous n'etes pas certain.

### Ne supprimez pas les fichiers locaux manuellement

Si un document ou une piece disparait du stockage, Paperasse peut signaler un artefact manquant.

Utilisez les actions d'archivage ou RGPD prevues.

### Travaillez exercice par exercice

Verifiez toujours l'exercice actif avant de corriger ou generer des documents.

---

## 47. Mini glossaire des comptes frequents

| Compte | Sens debutant |
| --- | --- |
| `5121` | Banque |
| `471` | Compte d'attente |
| `467` | Autres comptes debiteurs ou crediteurs |
| `401` | Fournisseurs |
| `411` | Clients |
| `44566` | TVA deductible |
| `44571` | TVA collectee |
| `4452` | TVA due intracom/autoliquidation selon cas |
| `44551` | TVA a decaisser |
| `44567` | Credit de TVA |
| `486` | Charges constatees d'avance |
| `68112` | Dotation aux amortissements |
| `28183` | Amortissement du materiel informatique |
| `695` | Impot sur les benefices |
| `444` | Etat - impot sur les benefices |

---

## 48. Parcours ultra simple pour votre premiere session

Si vous voulez juste faire un premier tour :

1. Ouvrez `Tableau de bord`.
2. Notez le nombre de transactions a verifier.
3. Ouvrez `Transactions`.
4. Filtrez `A verifier`.
5. Corrigez une transaction.
6. Ouvrez `Ecritures`.
7. Verifiez que l'ecriture existe.
8. Ouvrez `Pieces`.
9. Ajoutez une piece simple.
10. Rattachez-la a la transaction.
11. Ouvrez `Documents`.
12. Generez le FEC.
13. Ouvrez `Couverture EC`.
14. Regardez ce qui manque encore.

Avec ce parcours, vous aurez compris la logique centrale de Paperasse.

---

## 49. En cas de doute

Si vous ne comprenez pas un point :

1. Ne validez pas une ecriture ou une OD au hasard.
2. Lisez la raison affichee par Paperasse.
3. Regardez l'historique dans `Activite`.
4. Consultez la piece justificative.
5. Utilisez le `Chat` pour une explication en lecture seule.
6. Demandez a votre expert-comptable si le point a un impact fiscal ou juridique.

Paperasse est concu pour rendre les decisions visibles et auditables. Le bon reflexe est de documenter vos choix avec des notes et des pieces.

