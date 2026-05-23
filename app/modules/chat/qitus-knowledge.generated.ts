import type { QitusUserGuideSection } from "./qitus-knowledge-types";

export const QITUS_USER_GUIDE_SECTIONS: QitusUserGuideSection[] = [
  {
    "sourceId": "guide-tableau-de-bord",
    "title": "Tableau de bord",
    "content": "## Tableau de bord\n\n### Objectif\n\nLe Tableau de bord montre l'état global du dossier et les prochaines actions à réaliser.\n\n### Quand l'utiliser\n\n- Au début de chaque session.\n- Après un import.\n- Avant de générer des documents.\n- Avant de clôturer un exercice.\n\n### Champs affichés\n\n- Nom de l'entreprise.\n- Exercice actif.\n- Chiffre d'affaires, charges, résultat et trésorerie.\n- Nombre de transactions à vérifier.\n- État des documents.\n- OD brouillons.\n- Couverture du dossier expert-comptable.\n- Impacts à traiter.\n- État du dossier.\n- Dernières transactions.\n\n### Statuts possibles\n\n- `Exploitation cohérente` : les compteurs principaux sont alignés.\n- `À vérifier` : une partie du dossier demande une action.\n- `À mettre à jour` : des documents ou calculs doivent être régénérés.\n- `Bloqué` : une action importante est empêchée par un contrôle.\n\n### Actions disponibles\n\n- [Importer des transactions](/imports).\n- [Vérifier les transactions](/transactions).\n- [Ouvrir le contrôle](/controle).\n- [Relire les OD](/cloture/od).\n- [Ouvrir les documents](/documents).\n- [Ouvrir la couverture](/couverture).\n\n### Automatisations\n\nQitus calcule les compteurs, détecte les impacts et signale les actions prioritaires. Il ne valide pas les décisions comptables à votre place.\n\n### Validations utilisateur\n\nL'utilisateur doit confirmer les transactions incertaines, relire les OD, résoudre les blocages et décider quand générer ou partager les documents.\n\n### Erreurs fréquentes\n\n- Le Tableau de bord indique des documents à mettre à jour : ouvrir [Documents](/documents).\n- Le Tableau de bord indique des transactions à vérifier : ouvrir [Transactions](/transactions).\n- Le Tableau de bord indique une clôture bloquée : ouvrir [Contrôle](/controle) ou [OD de clôture](/cloture/od).",
    "href": "/dashboard",
    "surface": "dashboard",
    "audience": "user",
    "anchor": "tableau-de-bord",
    "wordCount": 260
  },
  {
    "sourceId": "guide-imports",
    "title": "Imports",
    "content": "## Imports\n\n### Objectif\n\nLa page Imports sert à ajouter, suivre, réparer, supprimer ou relancer les imports de l'exercice actif.\n\n### Quand l'utiliser\n\n- Pour déposer un relevé CSV.\n- Pour comprendre pourquoi un fichier est en revue.\n- Pour associer les colonnes d'un fichier.\n- Pour relancer la catégorisation après une mise à jour de règles ou de profil.\n- Pour supprimer un import ou réinitialiser les imports de l'exercice actif.\n\n### Champs affichés\n\n- Nom du fichier.\n- Date d'import.\n- Source de l'import.\n- Statut.\n- Nombre de lignes lues.\n- Nombre de transactions créées.\n- Nombre de transactions à vérifier.\n- Actions disponibles.\n\n### Statuts possibles\n\n- `En attente` : Qitus n'a pas encore traité le fichier.\n- `Lecture du fichier` : Qitus lit le contenu.\n- `Colonnes à associer` : l'utilisateur doit indiquer la signification des colonnes.\n- `Catégorisation` : Qitus classe les lignes.\n- `En revue` : certaines lignes demandent une vérification.\n- `Terminé` : l'import est traité.\n- `Erreur` : le fichier n'a pas pu être traité.\n\n### Actions disponibles\n\n- `Importer un CSV`.\n- `Associer les colonnes`.\n- `Relancer la catégorisation`.\n- `Supprimer`.\n- `Réinitialiser les imports de cet exercice`.\n- [Ouvrir les transactions](/transactions).\n\n### Automatisations\n\nQitus détecte les colonnes connues, crée les transactions, applique les règles fiables et prépare les écritures quand la catégorisation est complète.\n\n### Validations utilisateur\n\nL'utilisateur doit associer les colonnes ambiguës, corriger les lignes en revue, confirmer les actions destructives et relancer explicitement une catégorisation déjà produite.\n\n### Erreurs fréquentes\n\n- Fichier non lisible : vérifier qu'il s'agit bien d'un CSV.\n- Colonnes non reconnues : ouvrir l'association des colonnes.\n- Transactions sur des comptes d'attente : relancer la catégorisation après correction des règles ou du profil.\n- Import bloqué car l'exercice est fermé : rouvrir l'exercice n'est possible que depuis la clôture, avec prudence.",
    "href": "/imports",
    "surface": "imports",
    "audience": "user",
    "anchor": "imports",
    "wordCount": 308
  },
  {
    "sourceId": "guide-transactions",
    "title": "Transactions",
    "content": "## Transactions\n\n### Objectif\n\nLa page Transactions permet de relire les mouvements importés, corriger leur catégorisation et rattacher les justificatifs.\n\n### Quand l'utiliser\n\n- Après un import.\n- Quand le Tableau de bord signale des transactions à vérifier.\n- Quand la TVA ou les documents ne reflètent pas les opérations attendues.\n- Quand une transaction doit être rattachée à un justificatif.\n\n### Champs affichés\n\n- Date.\n- Libellé.\n- Montant.\n- Compte proposé.\n- Statut.\n- Justificatif lié.\n- Détail de catégorisation.\n- Action de correction ou confirmation.\n\n### Statuts possibles\n\n- `Catégorisé` : Qitus a classé la transaction.\n- `À vérifier` : l'utilisateur doit relire.\n- `Confirmé` : la décision est validée.\n- `Corrigé` : l'utilisateur a modifié le classement.\n- `À rattacher` : un justificatif peut être ajouté.\n\n### Actions disponibles\n\n- `Ouvrir`.\n- `Catégoriser`.\n- `Confirmer`.\n- `Corriger`.\n- `Rattacher un justificatif`.\n- [Ouvrir les justificatifs](/pieces).\n\n### Automatisations\n\nQitus applique les règles exactes et les correspondances fiables. Les suggestions incertaines restent à valider.\n\n### Validations utilisateur\n\nL'utilisateur valide les corrections, confirme les suggestions incertaines et choisit les justificatifs à rattacher.\n\n### Erreurs fréquentes\n\n- Une transaction reste en compte d'attente : corriger la catégorisation.\n- Une transaction ne crée pas de TVA : vérifier le régime TVA et relancer la catégorisation de l'import si nécessaire.\n- Une transaction n'a pas de justificatif : rattacher une pièce si elle existe.",
    "href": "/transactions",
    "surface": "transactions",
    "audience": "user",
    "anchor": "transactions",
    "wordCount": 232
  },
  {
    "sourceId": "guide-justificatifs",
    "title": "Justificatifs",
    "content": "## Justificatifs\n\n### Objectif\n\nLa page Justificatifs permet de déposer, consulter, relire et rattacher les preuves d'opérations.\n\n### Quand l'utiliser\n\n- Pour ajouter une facture, un reçu, un contrat ou un relevé.\n- Pour rattacher une pièce à une transaction ou une écriture.\n- Pour relire une lecture automatique.\n- Pour améliorer la couverture du dossier.\n\n### Champs affichés\n\n- Nom de la pièce.\n- Type de fichier.\n- Date de dépôt.\n- Statut de lecture.\n- Transaction ou écriture liée.\n- Score de rapprochement si Qitus propose un lien.\n\n### Statuts possibles\n\n- `Déposée` : la pièce est conservée.\n- `Lecture terminée` : Qitus a extrait des informations exploitables.\n- `Pièce à relire` : l'extraction doit être vérifiée.\n- `Lecture automatique impossible` : la pièce reste disponible mais non lue.\n- `Archivée` : la pièce n'est plus utilisée dans le flux courant.\n\n### Actions disponibles\n\n- `Ajouter une pièce`.\n- `Relire la pièce`.\n- `Rattacher`.\n- `Télécharger`.\n- `Archiver`.\n- [Ouvrir les transactions](/transactions).\n\n### Automatisations\n\nQitus peut proposer un rapprochement entre une pièce et une transaction si les montants, dates ou libellés concordent.\n\n### Validations utilisateur\n\nL'utilisateur confirme les rattachements et relit les pièces dont la lecture automatique est incertaine.\n\n### Erreurs fréquentes\n\n- Pièce sans écriture : la pièce existe mais n'est pas liée.\n- Écriture sans justificatif rattaché : la preuve peut être ajoutée.\n- Lecture automatique impossible : la pièce peut rester probante même sans extraction.",
    "href": "/pieces",
    "surface": "pieces",
    "audience": "user",
    "anchor": "justificatifs",
    "wordCount": 240
  },
  {
    "sourceId": "guide-factures-entrantes",
    "title": "Factures entrantes",
    "content": "## Factures entrantes\n\n### Objectif\n\nLa page Factures entrantes permet de traiter les factures fournisseur structurées ou déposées manuellement.\n\n### Quand l'utiliser\n\n- Pour consulter une facture électronique reçue.\n- Pour vérifier les données extraites.\n- Pour rapprocher une facture d'une transaction.\n- Pour créer un brouillon comptable à relire.\n\n### Champs affichés\n\n- Fournisseur.\n- Numéro de facture.\n- Date.\n- Montants hors taxe, TVA et total.\n- Provenance.\n- Statut de lecture.\n- Brouillon comptable.\n- Rapprochement proposé.\n\n### Statuts possibles\n\n- `Reçue`.\n- `Lecture terminée`.\n- `Lecture à vérifier`.\n- `Brouillon prêt`.\n- `Comptabilisée`.\n- `Rejetée`.\n\n### Actions disponibles\n\n- `Ouvrir`.\n- `Relire`.\n- `Rapprocher`.\n- `Créer un brouillon`.\n- `Approuver`.\n- `Rejeter`.\n\n### Automatisations\n\nQitus lit les données structurées et prépare des propositions. Aucune écriture n'est créée sans approbation utilisateur.\n\n### Validations utilisateur\n\nL'utilisateur valide le rapprochement, approuve le brouillon comptable ou rejette la facture avec une note.\n\n### Erreurs fréquentes\n\n- Facture non reconnue : vérifier le format du fichier.\n- Montant différent de la transaction : relire le rapprochement.\n- Réception non conforme PA : la facture est exploitable, mais ne prouve pas une réception réglementaire via une Plateforme Agréée réelle.",
    "href": "/factures-entrantes",
    "surface": "factures-entrantes",
    "audience": "user",
    "anchor": "factures-entrantes",
    "wordCount": 197
  },
  {
    "sourceId": "guide-ecritures",
    "title": "Écritures",
    "content": "## Écritures\n\n### Objectif\n\nLa page Écritures affiche le journal comptable généré ou validé dans Qitus.\n\n### Quand l'utiliser\n\n- Pour vérifier les écritures créées depuis les imports.\n- Pour contrôler les débits et crédits.\n- Pour comprendre une ligne comptable.\n- Pour vérifier les écritures issues de factures entrantes ou d'OD.\n\n### Champs affichés\n\n- Date.\n- Journal.\n- Libellé.\n- Compte.\n- Débit.\n- Crédit.\n- Source.\n- Pièce liée.\n\n### Statuts possibles\n\n- `Équilibrée` : débit et crédit sont cohérents.\n- `À vérifier` : une ligne mérite une revue.\n- `Issue d'import`.\n- `Issue de facture entrante`.\n- `Issue d'OD`.\n\n### Actions disponibles\n\n- `Ouvrir`.\n- `Voir la transaction`.\n- `Voir la pièce`.\n- `Exporter le journal`.\n\n### Automatisations\n\nQitus crée les écritures d'import quand la catégorisation est complète et non ambiguë. Les écritures liées à une facture ou une OD demandent une validation explicite.\n\n### Validations utilisateur\n\nL'utilisateur relit les écritures sensibles, les OD et les brouillons comptables avant validation.\n\n### Erreurs fréquentes\n\n- Écriture absente après import : vérifier le statut de l'import.\n- Compte d'attente présent : corriger les transactions.\n- TVA absente : vérifier le régime TVA et les lignes TVA.",
    "href": "/ecritures",
    "surface": "ecritures",
    "audience": "user",
    "anchor": "ecritures",
    "wordCount": 198
  },
  {
    "sourceId": "guide-tva",
    "title": "TVA",
    "content": "## TVA\n\n### Objectif\n\nLa page TVA affiche la position TVA et les brouillons de déclaration.\n\n### Quand l'utiliser\n\n- Si l'entreprise déclare la TVA.\n- Après un import.\n- Après un changement de régime TVA.\n- Avant de générer une CA3 ou CA12.\n\n### Champs affichés\n\n- Régime TVA.\n- TVA collectée.\n- TVA déductible.\n- TVA nette.\n- Déclarations brouillon.\n- Contrôles TVA.\n- Alertes de recalcul.\n\n### Statuts possibles\n\n- `À jour`.\n- `À mettre à jour`.\n- `Brouillon`.\n- `Contrôle à traiter`.\n- `Génération bloquée`.\n\n### Actions disponibles\n\n- `Régénérer`.\n- `Ouvrir la revue TVA`.\n- `Ouvrir les imports`.\n- `Vérifier les transactions`.\n- [Ouvrir le profil](/profil).\n\n### Automatisations\n\nQitus calcule la TVA à partir des écritures contenant des lignes TVA. Il peut préparer un brouillon lorsque les contrôles ne bloquent pas.\n\n### Validations utilisateur\n\nL'utilisateur doit vérifier les transactions, relancer la catégorisation ou corriger les paramètres si les écritures ne contiennent pas de lignes TVA.\n\n### Erreurs fréquentes\n\n- TVA à zéro après changement de régime : relancer la catégorisation des imports concernés.\n- Déclaration à zéro alors que l'activité est taxable : vérifier les transactions et les comptes TVA.\n- Génération bloquée : ouvrir la revue TVA.",
    "href": "/tva",
    "surface": "tva",
    "audience": "user",
    "anchor": "tva",
    "wordCount": 203
  },
  {
    "sourceId": "guide-rapprochements",
    "title": "Rapprochements",
    "content": "## Rapprochements\n\n### Objectif\n\nLa page Rapprochements compare les données pour repérer les écarts.\n\n### Quand l'utiliser\n\n- Après un import bancaire.\n- Après une synchronisation Stripe.\n- Avant la clôture.\n- Quand le Tableau de bord signale un rapprochement à relancer.\n\n### Champs affichés\n\n- Type de rapprochement.\n- Dernier calcul.\n- Matches exacts.\n- Écarts.\n- Points ouverts.\n- Actions disponibles.\n\n### Statuts possibles\n\n- `À relancer`.\n- `À jour`.\n- `Écart à vérifier`.\n- `Confirmé`.\n- `Ignoré avec note`.\n\n### Actions disponibles\n\n- `Relancer le rapprochement`.\n- `Ouvrir la revue`.\n- `Confirmer`.\n- `Ignorer avec note`.\n- `Créer une proposition OD` quand un écart durable le justifie.\n\n### Automatisations\n\nQitus confirme les rapprochements exacts quand les données concordent clairement. Les écarts restent en revue.\n\n### Validations utilisateur\n\nL'utilisateur confirme les écarts, ajoute une note ou valide une proposition OD.\n\n### Erreurs fréquentes\n\n- Rapprochement jamais lancé : cliquer sur `Relancer le rapprochement`.\n- Écart bancaire : vérifier la transaction et la pièce associée.\n- Stripe non configuré : ouvrir [Connecteurs](/connecteurs).",
    "href": "/rapprochements",
    "surface": "rapprochements",
    "audience": "user",
    "anchor": "rapprochements",
    "wordCount": 173
  },
  {
    "sourceId": "guide-controle",
    "title": "Contrôle",
    "content": "## Contrôle\n\n### Objectif\n\nLa page Contrôle liste les points à corriger, compléter ou comprendre avant les documents et la clôture.\n\n### Quand l'utiliser\n\n- Avant de générer les documents.\n- Avant de clôturer.\n- Quand une action est bloquée.\n- Quand Qitus signale un point à traiter.\n\n### Champs affichés\n\n- Points ouverts.\n- Contrôles de cohérence.\n- Justificatifs à compléter.\n- Pièces à relire.\n- Actions recommandées.\n\n### Statuts possibles\n\n- `Ouvert`.\n- `À compléter`.\n- `À relire`.\n- `Bloquant`.\n- `Résolu`.\n\n### Actions disponibles\n\n- `Ouvrir le contrôle`.\n- `Corriger les transactions`.\n- `Rattacher une pièce`.\n- `Relire les OD`.\n- `Régénérer les documents` quand les blocages sont levés.\n\n### Automatisations\n\nQitus regroupe les contrôles issus des transactions, justificatifs, documents, TVA, rapprochements et clôture.\n\n### Validations utilisateur\n\nL'utilisateur traite les points bloquants et choisit les corrections.\n\n### Erreurs fréquentes\n\n- `Écritures sans justificatif rattaché` : ce n'est pas toujours bloquant, mais cela indique une couverture à compléter.\n- `Pièce à relire` : ouvrir la pièce et vérifier les informations lues.\n- Génération bloquée : suivre le bouton principal affiché dans le message.",
    "href": "/controle",
    "surface": "controle",
    "audience": "user",
    "anchor": "controle",
    "wordCount": 185
  },
  {
    "sourceId": "guide-cloture",
    "title": "Clôture",
    "content": "## Clôture\n\n### Objectif\n\nLa page Clôture guide les étapes de fin d'exercice.\n\n### Quand l'utiliser\n\n- En fin d'exercice.\n- Quand les imports, transactions, TVA, documents et rapprochements sont prêts.\n- Pour fermer l'exercice après validation des points importants.\n\n### Champs affichés\n\n- Étapes de clôture.\n- État des prérequis.\n- Blocages.\n- Actions de clôture.\n- Statut de l'exercice.\n\n### Statuts possibles\n\n- `Ouvert`.\n- `Prêt à clôturer`.\n- `Bloqué`.\n- `Clôturé`.\n- `À rouvrir avec prudence`.\n\n### Actions disponibles\n\n- `Démarrer`.\n- `Ouvrir le contrôle`.\n- `Relire les OD`.\n- `Générer les documents`.\n- `Clôturer l'exercice`.\n- `Rouvrir l'exercice`.\n\n### Automatisations\n\nQitus vérifie les prérequis et prépare les étapes. Il ne clôture pas l'exercice sans confirmation.\n\n### Validations utilisateur\n\nL'utilisateur valide les OD, résout les blocages et confirme la clôture.\n\n### Erreurs fréquentes\n\n- Clôture bloquée : ouvrir [Contrôle](/controle).\n- OD à relire : ouvrir [OD de clôture](/cloture/od).\n- Documents à mettre à jour : ouvrir [Documents](/documents).",
    "href": "/cloture",
    "surface": "cloture",
    "audience": "user",
    "anchor": "cloture",
    "wordCount": 160
  },
  {
    "sourceId": "guide-od-cloture",
    "title": "OD de clôture",
    "content": "## OD de clôture\n\n### Objectif\n\nLa page OD de clôture présente les propositions d'écritures d'ajustement à relire.\n\n### Quand l'utiliser\n\n- Avant la clôture.\n- Quand Qitus signale des OD brouillon.\n- Quand une feuille de travail ou une pièce a changé.\n\n### Champs affichés\n\n- Type d'OD.\n- Libellé lisible.\n- Montants.\n- Justification.\n- Feuille de travail liée.\n- Pièce associée.\n- Statut de revue.\n\n### Statuts possibles\n\n- `À relire`.\n- `Validée`.\n- `Rejetée`.\n- `À recalculer`.\n- `Pièce à compléter`.\n\n### Actions disponibles\n\n- `Ouvrir`.\n- `Valider`.\n- `Rejeter`.\n- `Recalculer`.\n- `Rattacher une pièce`.\n\n### Automatisations\n\nQitus prépare des propositions lorsque les données le permettent. Il peut signaler qu'une proposition doit être recalculée.\n\n### Validations utilisateur\n\nUne OD de clôture demande toujours une validation explicite avant de devenir une écriture.\n\n### Erreurs fréquentes\n\n- OD à recalculer : recalculer avant validation.\n- Pièce à compléter : rattacher la preuve demandée.\n- Libellé incompréhensible : ouvrir le détail pour lire la justification métier.",
    "href": "/cloture/od",
    "surface": "cloture-od",
    "audience": "user",
    "anchor": "od-de-cloture",
    "wordCount": 168
  },
  {
    "sourceId": "guide-immobilisations",
    "title": "Immobilisations",
    "content": "## Immobilisations\n\n### Objectif\n\nLa page Immobilisations suit les biens durables et leurs amortissements.\n\n### Quand l'utiliser\n\n- Quand une transaction correspond à un achat durable.\n- Avant de relire les OD d'amortissement.\n- Avant la clôture.\n\n### Champs affichés\n\n- Nom du bien.\n- Date d'acquisition.\n- Montant.\n- Durée d'amortissement.\n- Valeur restante.\n- Écriture ou transaction liée.\n\n### Statuts possibles\n\n- `À vérifier`.\n- `Actif`.\n- `Amorti`.\n- `À rattacher`.\n\n### Actions disponibles\n\n- `Ouvrir`.\n- `Confirmer`.\n- `Corriger`.\n- `Voir l'écriture`.\n\n### Automatisations\n\nQitus peut repérer des candidats à immobiliser. Il ne décide pas seul d'un traitement sensible.\n\n### Validations utilisateur\n\nL'utilisateur confirme la nature du bien, les montants et les durées si nécessaire.\n\n### Erreurs fréquentes\n\n- Achat durable classé en charge : corriger la transaction ou relire la proposition.\n- Amortissement manquant : vérifier les OD de clôture.",
    "href": "/immobilisations",
    "surface": "immobilisations",
    "audience": "user",
    "anchor": "immobilisations",
    "wordCount": 144
  },
  {
    "sourceId": "guide-documents",
    "title": "Documents",
    "content": "## Documents\n\n### Objectif\n\nLa page Documents génère et télécharge les fichiers du dossier.\n\n### Quand l'utiliser\n\n- Après vérification des transactions.\n- Après validation des OD.\n- Avant le partage au cabinet.\n- Quand Qitus indique que des documents sont à mettre à jour.\n\n### Champs affichés\n\n- Type de document.\n- Statut.\n- Date de génération.\n- Fraîcheur.\n- Action disponible.\n\n### Statuts possibles\n\n- `À jour`.\n- `À mettre à jour`.\n- `Brouillon`.\n- `Génération bloquée`.\n- `Remplacé`.\n\n### Actions disponibles\n\n- `Générer`.\n- `Régénérer`.\n- `Télécharger`.\n- `Ouvrir le contrôle`.\n- `Ouvrir le dossier de preuves`.\n\n### Automatisations\n\nQitus sait détecter qu'un document est ancien après une écriture, une OD ou une modification de profil.\n\n### Validations utilisateur\n\nL'utilisateur lance la génération ou résout les contrôles bloquants.\n\n### Erreurs fréquentes\n\n- Génération bloquée : cliquer sur `Ouvrir le contrôle`.\n- Documents à mettre à jour : cliquer sur `Régénérer`.\n- FEC absent : vérifier que le journal est exportable.",
    "href": "/documents",
    "surface": "documents",
    "audience": "user",
    "anchor": "documents",
    "wordCount": 163
  },
  {
    "sourceId": "guide-dossier-ec",
    "title": "Dossier expert-comptable",
    "content": "## Dossier expert-comptable\n\n### Objectif\n\nLa page Dossier expert-comptable prépare le dossier à transmettre au cabinet.\n\n### Quand l'utiliser\n\n- Après génération des documents.\n- Avant d'envoyer le dossier à l'expert-comptable.\n- Pour suivre les demandes et commentaires du cabinet.\n\n### Champs affichés\n\n- État transmis.\n- Documents inclus.\n- Justificatifs.\n- Demandes ouvertes.\n- Commentaires.\n- Validation finale.\n\n### Statuts possibles\n\n- `À préparer`.\n- `Prêt`.\n- `À mettre à jour`.\n- `En revue`.\n- `Validé`.\n- `Export incomplet`.\n\n### Actions disponibles\n\n- `Préparer le dossier`.\n- `Exporter`.\n- `Partager`.\n- `Répondre`.\n- `Résoudre une demande`.\n\n### Automatisations\n\nQitus prépare un état du dossier et signale les changements survenus après transmission.\n\n### Validations utilisateur\n\nL'utilisateur choisit quand partager le dossier, répondre au cabinet et valider l'export final.\n\n### Erreurs fréquentes\n\n- Dossier à mettre à jour : préparer un nouvel état.\n- Demande bloquante ouverte : répondre ou résoudre la demande.\n- Document absent : ouvrir [Documents](/documents).",
    "href": "/dossier-ec",
    "surface": "dossier-ec",
    "audience": "user",
    "anchor": "dossier-expert-comptable",
    "wordCount": 158
  },
  {
    "sourceId": "guide-parametres",
    "title": "Paramètres",
    "content": "## Paramètres\n\n### Objectif\n\nLa page Paramètres regroupe les réglages de l'espace Qitus.\n\n### Quand l'utiliser\n\n- Pour modifier les informations de l'entreprise.\n- Pour vérifier l'exercice actif.\n- Pour configurer les connecteurs.\n- Pour gérer les règles, l'abonnement ou la confidentialité.\n\n### Champs affichés\n\n- Entreprise.\n- Exercices.\n- Régime fiscal et TVA.\n- Connecteurs.\n- Règles de classement.\n- Règles comptables.\n- Abonnement.\n- Confidentialité.\n\n### Statuts possibles\n\n- `À configurer`.\n- `Configuré`.\n- `À vérifier`.\n- `Erreur de configuration`.\n\n### Actions disponibles\n\n- [Ouvrir le compte](/profil).\n- [Ouvrir les exercices](/exercices).\n- [Configurer les connecteurs](/connecteurs).\n- [Ouvrir l'abonnement](/abonnement).\n- [Ouvrir les règles de classement](/corrections).\n\n### Automatisations\n\nQitus utilise ces informations pour guider les imports, la TVA, les documents et la clôture.\n\n### Validations utilisateur\n\nL'utilisateur valide les informations d'entreprise, le régime fiscal, la TVA et les connecteurs.\n\n### Erreurs fréquentes\n\n- TVA incohérente : ouvrir le compte et vérifier le régime.\n- Connecteur non configuré : ouvrir Connecteurs.\n- Mauvais exercice : ouvrir Exercices.",
    "href": "/parametres",
    "surface": "parametres",
    "audience": "user",
    "anchor": "parametres",
    "wordCount": 166
  },
  {
    "sourceId": "guide-connecteurs",
    "title": "Connecteurs",
    "content": "## Connecteurs\n\n### Objectif\n\nLa page Connecteurs regroupe les connexions externes de Qitus.\n\n### Quand l'utiliser\n\n- Pour connecter Qonto bancaire.\n- Pour configurer Stripe.\n- Pour connecter une banque non-Qonto via Open Banking.\n- Pour suivre la pré-activation Qonto PA pour les factures électroniques.\n\n### Champs affichés\n\n- Nom du connecteur.\n- État de configuration.\n- Dernière mise à jour.\n- Dernier message lisible.\n- Action disponible.\n\n### Statuts possibles\n\n- `Non configuré`.\n- `À connecter`.\n- `Connecté`.\n- `Synchronisé`.\n- `À reconnecter`.\n- `Erreur de configuration`.\n- `PA en attente partenaire`.\n- `Réception PA conforme`.\n\n### Actions disponibles\n\n- `Configurer`.\n- `Connecter`.\n- `Mettre à jour`.\n- `Reconnecter`.\n- `Ouvrir les imports`.\n\n### Automatisations\n\nQitus peut récupérer des données depuis un connecteur configuré et signaler les rapprochements à relancer.\n\n### Validations utilisateur\n\nL'utilisateur fournit les accès, choisit les comptes à connecter et confirme les synchronisations importantes.\n\n### Erreurs fréquentes\n\n- Connexion bancaire indisponible : importer un CSV en attendant.\n- Consentement expiré : reconnecter.\n- Qonto PA en attente : la réception conforme sera activée après validation partenaire.",
    "href": "/connecteurs",
    "surface": "connecteurs",
    "audience": "user",
    "anchor": "connecteurs",
    "wordCount": 180
  },
  {
    "sourceId": "guide-regles-classement",
    "title": "Règles de classement",
    "content": "## Règles de classement\n\n### Objectif\n\nLa page Règles de classement permet de gérer les corrections appliquées aux transactions similaires.\n\n### Quand l'utiliser\n\n- Après plusieurs corrections identiques.\n- Pour comprendre pourquoi une transaction est classée d'une certaine manière.\n- Pour améliorer les futurs imports.\n\n### Champs affichés\n\n- Libellé de règle.\n- Critère.\n- Compte appliqué.\n- Statut.\n- Impact estimé.\n\n### Statuts possibles\n\n- `Active`.\n- `À vérifier`.\n- `Désactivée`.\n- `Conflit`.\n\n### Actions disponibles\n\n- `Créer`.\n- `Modifier`.\n- `Désactiver`.\n- `Voir l'impact`.\n\n### Automatisations\n\nQitus applique les règles exactes aux futurs imports. Les règles proposées restent à valider quand elles ne sont pas strictement certaines.\n\n### Validations utilisateur\n\nL'utilisateur confirme les règles proposées et corrige les conflits.\n\n### Erreurs fréquentes\n\n- Règle trop large : vérifier l'impact avant de l'activer.\n- Transaction mal classée : corriger la transaction, puis ajuster la règle.",
    "href": "/corrections",
    "surface": "corrections",
    "audience": "user",
    "anchor": "regles-de-classement",
    "wordCount": 146
  },
  {
    "sourceId": "guide-regles-comptables",
    "title": "Règles comptables",
    "content": "## Règles comptables\n\n### Objectif\n\nLa page Règles comptables indique la version des règles Qitus appliquées aux futurs imports.\n\n### Quand l'utiliser\n\n- Pour vérifier que les règles Qitus sont à jour.\n- Pour comprendre si des transactions existantes pourraient être concernées par une mise à jour.\n- Pour consulter les sources officielles suivies par Qitus.\n\n### Champs affichés\n\n- Version active.\n- Statut.\n- Sources consultées.\n- Transactions concernées.\n- Packs de règles.\n\n### Statuts possibles\n\n- `Disponible`.\n- `Actif`.\n- `À examiner en interne`.\n- `Remplacé`.\n\n### Actions disponibles\n\n- `Ouvrir les imports`.\n- `Mettre à jour maintenant` si l'action est disponible en environnement autorisé.\n\n### Automatisations\n\nQitus applique automatiquement les règles actives aux futurs imports. Les écritures déjà générées ne sont pas modifiées automatiquement.\n\n### Validations utilisateur\n\nL'utilisateur relance explicitement une catégorisation si une mise à jour doit être appliquée aux données existantes.\n\n### Erreurs fréquentes\n\n- Transactions concernées mais inchangées : ouvrir Imports et relancer la catégorisation si nécessaire.\n- Source officielle non consultée : attendre la prochaine mise à jour ou déclencher l'action interne si disponible.",
    "href": "/regles-comptables",
    "surface": "regles-comptables",
    "audience": "user",
    "anchor": "regles-comptables",
    "wordCount": 181
  },
  {
    "sourceId": "guide-abonnement",
    "title": "Abonnement",
    "content": "## Abonnement\n\n### Objectif\n\nLa page Abonnement affiche le plan, les quotas et les actions de facturation.\n\n### Quand l'utiliser\n\n- Quand une limite est atteinte.\n- Pour consulter l'usage mensuel.\n- Pour ouvrir le portail de facturation.\n\n### Champs affichés\n\n- Plan.\n- Statut.\n- Quotas.\n- Usage.\n- Actions disponibles.\n\n### Statuts possibles\n\n- `Actif`.\n- `Essai`.\n- `Limite atteinte`.\n- `Paiement à vérifier`.\n\n### Actions disponibles\n\n- `Ouvrir le portail`.\n- `Changer de plan`.\n- `Voir l'usage`.\n\n### Automatisations\n\nQitus vérifie les droits avant les actions soumises à quota, comme l'assistant ou certains imports selon le plan.\n\n### Validations utilisateur\n\nL'utilisateur choisit les changements d'abonnement et confirme les actions de paiement.\n\n### Erreurs fréquentes\n\n- Limite de questions atteinte : ouvrir Abonnement.\n- Portail indisponible : vérifier la configuration de facturation.",
    "href": "/abonnement",
    "surface": "abonnement",
    "audience": "user",
    "anchor": "abonnement",
    "wordCount": 134
  },
  {
    "sourceId": "guide-exercices",
    "title": "Exercices",
    "content": "## Exercices\n\n### Objectif\n\nLa page Exercices permet de choisir et gérer la période comptable active.\n\n### Quand l'utiliser\n\n- Après l'onboarding.\n- Pour vérifier l'année de travail.\n- Avant un import.\n- Avant une clôture.\n\n### Champs affichés\n\n- Année ou période.\n- Date de début.\n- Date de fin.\n- Statut.\n- Exercice actif.\n\n### Statuts possibles\n\n- `Ouvert`.\n- `Actif`.\n- `Clôturé`.\n\n### Actions disponibles\n\n- `Activer`.\n- `Créer`.\n- `Ouvrir`.\n\n### Automatisations\n\nQitus rattache les imports, transactions, documents et contrôles à l'exercice actif.\n\n### Validations utilisateur\n\nL'utilisateur choisit le bon exercice avant d'importer ou de corriger des données.\n\n### Erreurs fréquentes\n\n- Données absentes : vérifier que le bon exercice est actif.\n- Import refusé : l'exercice est peut-être clôturé.",
    "href": "/exercices",
    "surface": "exercices",
    "audience": "user",
    "anchor": "exercices",
    "wordCount": 124
  },
  {
    "sourceId": "guide-compte",
    "title": "Compte et entreprise",
    "content": "## Compte et entreprise\n\n### Objectif\n\nLa page Compte et entreprise permet de vérifier les informations de l'entreprise, du dirigeant, du régime fiscal et de la TVA.\n\n### Quand l'utiliser\n\n- Pendant ou après l'onboarding.\n- Avant un import important.\n- Quand la TVA semble incorrecte.\n- Quand un document doit reprendre les informations légales.\n\n### Champs affichés\n\n- Nom de l'entreprise.\n- SIREN ou SIRET.\n- Adresse.\n- Forme juridique.\n- Régime fiscal.\n- Régime TVA.\n- Exigibilité TVA.\n- Dirigeant.\n- Capital.\n\n### Statuts possibles\n\n- `Complet`.\n- `À compléter`.\n- `À vérifier`.\n\n### Actions disponibles\n\n- `Enregistrer`.\n- `Modifier`.\n- `Ouvrir les imports`.\n- `Ouvrir la TVA`.\n\n### Automatisations\n\nQitus utilise le profil pour guider la TVA, les documents et les règles appliquées aux imports.\n\n### Validations utilisateur\n\nL'utilisateur confirme tout changement de régime fiscal, de TVA ou d'information légale.\n\n### Erreurs fréquentes\n\n- TVA à zéro après changement de régime : relancer la catégorisation des imports.\n- Mauvais nom sur les documents : corriger le profil, puis régénérer les documents.",
    "href": "/profil",
    "surface": "profil",
    "audience": "user",
    "anchor": "compte-et-entreprise",
    "wordCount": 174
  },
  {
    "sourceId": "guide-activite",
    "title": "Activité",
    "content": "## Activité\n\n### Objectif\n\nLa page Activité affiche l'historique lisible des actions importantes.\n\n### Quand l'utiliser\n\n- Pour comprendre ce qui a changé.\n- Pour vérifier qu'une action a été réalisée.\n- Pour auditer une suppression, une relance, une génération ou une synchronisation.\n\n### Champs affichés\n\n- Date.\n- Action.\n- Élément concerné.\n- Utilisateur ou système.\n- Résumé.\n\n### Statuts possibles\n\n- `Réussi`.\n- `Échec`.\n- `Demandé`.\n- `Terminé`.\n\n### Actions disponibles\n\n- `Ouvrir l'élément`.\n- `Filtrer`.\n- `Exporter` si disponible.\n\n### Automatisations\n\nQitus trace les automatisations, les suggestions, les validations et les actions sensibles.\n\n### Validations utilisateur\n\nAucune validation n'est généralement faite depuis l'activité. Elle sert à comprendre et vérifier.\n\n### Erreurs fréquentes\n\n- Action introuvable : vérifier la période ou l'exercice.\n- Message trop technique : se référer à la page métier concernée.",
    "href": "/activity",
    "surface": "activity",
    "audience": "user",
    "anchor": "activite",
    "wordCount": 136
  },
  {
    "sourceId": "guide-assistant-qitus",
    "title": "Aide et assistant Qitus",
    "content": "## Aide et assistant Qitus\n\n### Objectif\n\nL'assistant Qitus répond aux questions sur l'utilisation du produit.\n\n### Quand l'utiliser\n\n- Pour comprendre une page.\n- Pour savoir quelle action faire ensuite.\n- Pour comprendre un statut.\n- Pour retrouver une page ou une action.\n\n### Champs affichés\n\n- Conversation.\n- Réponse de l'assistant.\n- Sources Qitus.\n- Zone de message.\n- Suggestions contextuelles.\n\n### Statuts possibles\n\n- `En ligne`.\n- `Limite atteinte`.\n- `Réponse impossible pour le moment`.\n\n### Actions disponibles\n\n- `Poser une question`.\n- `Réessayer`.\n- `Ouvrir la source`.\n- `Ouvrir l'aide Qitus`.\n\n### Automatisations\n\nL'assistant recherche dans ce guide et répond uniquement si des sources Qitus fiables sont disponibles.\n\n### Validations utilisateur\n\nL'utilisateur reste responsable des décisions comptables. L'assistant ne modifie rien.\n\n### Erreurs fréquentes\n\n- Question de règle comptable générale : l'assistant V1 indique que ce sujet sera couvert en V2.\n- Demande d'action : l'assistant explique où cliquer, mais ne réalise pas l'action.\n- Réponse sans source : Qitus doit refuser plutôt qu'inventer.\n\n## Confidentialité et limites\n\n- L'assistant Qitus est un outil pédagogique.\n- Il ne constitue pas un avis comptable.\n- Il ne peut pas créer, modifier, valider ou supprimer des données.\n- Les questions hors Qitus sont refusées en V1.\n- Les données sensibles doivent être minimisées avant tout appel à un fournisseur IA.\n\n## Glossaire utilisateur\n\n- `Transaction` : mouvement bancaire importé.\n- `Écriture` : traduction comptable d'une opération.\n- `Compte` : code de classement comptable.\n- `Justificatif` : preuve d'une opération.\n- `OD` : écriture d'ajustement ou de clôture à valider.\n- `FEC` : fichier officiel des écritures comptables.\n- `TVA collectée` : TVA sur les ventes.\n- `TVA déductible` : TVA sur les achats.\n- `Rapprochement` : comparaison entre plusieurs sources de données.\n- `Dossier expert-comptable` : dossier préparé pour le cabinet.",
    "href": "/chat",
    "surface": "chat",
    "audience": "user",
    "anchor": "aide-et-assistant-qitus",
    "wordCount": 303
  }
];
