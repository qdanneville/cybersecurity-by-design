# `secdev-lab` — Architecture du laboratoire

Formation 21h · Sécurité côté développement · OWASP Top 10:2025 · Node/TypeScript · 3 jours consécutifs

---

## 0. Révision d'une décision antérieure

**Abandon des branches `mX-vulnerable` / `mX-fixed`.**

Raison : en salle, un apprenant à mi-lab a des modifications non commitées. `git checkout m2-vulnerable` échoue ou écrase son travail. Sur 12 personnes × 7 modules, c'est garanti d'arriver 5 fois par jour et de casser le rythme.

**Remplacé par** : une seule branche `main`, code vulnérable en permanence. Les correctifs de référence vivent dans `solutions/mX-*.patch`. L'apprenant bloqué fait `make solution M=m1-idor`, qui applique le patch. L'apprenant qui veut repartir propre fait `make reset`.

Bénéfice secondaire : le diff `git diff` de l'apprenant *est* son livrable. Tu peux le lire, le commenter, le comparer au patch de référence.

---

## 1. Arborescence

```
secdev-lab/
├── README.md                     # démarrage 5 min, rien d'autre
├── Makefile                      # seule interface apprenant
├── .env.example
├── docker-compose.base.yml       # app + postgres + redis
│
├── app/                          # l'application vulnérable
│   ├── src/
│   │   ├── server.ts
│   │   ├── modules/
│   │   │   ├── auth/             # login, JWT, sessions
│   │   │   ├── users/            # profil, rôles
│   │   │   ├── products/         # catalogue, recherche, import image
│   │   │   ├── orders/           # commandes, factures PDF
│   │   │   ├── coupons/          # règles de remise (merge → proto pollution)
│   │   │   ├── payments/         # webhook fournisseur (intégrité)
│   │   │   └── admin/            # back-office
│   │   ├── middleware/           # auth, errors, cors, rate-limit
│   │   └── lib/                  # crypto, pdf, http-client, merge
│   ├── src/db/
│   │   ├── schema.ts             # tables Drizzle + relations
│   │   ├── index.ts              # client, pool pg
│   │   ├── migrations/           # SQL généré par drizzle-kit, lisible et versionné
│   │   └── seed.ts               # 3 rôles, ~50 commandes, données réalistes
│   ├── drizzle.config.ts
│   ├── tests/
│   │   ├── functional/           # garde-fou : les correctifs ne doivent rien casser
│   │   └── security/             # tests de non-régression sécurité
│   │       ├── _harness.ts       # helpers : loginAs(), rawRequest(), etc.
│   │       └── m1-idor.spec.ts   # UN exemple fourni, le reste écrit par l'apprenant
│   └── package.json
│
├── labs/
│   ├── m1-access-control/
│   │   ├── overlay.yml           # surcouche compose éventuelle
│   │   └── seed-extra.ts
│   ├── m2-injection/
│   ├── m3-auth/
│   ├── m4-config-crypto/
│   ├── m5-supply-chain/
│   │   ├── overlay.yml           # verdaccio + gitea + runner
│   │   └── evil-package/         # @secdev/price-utils piégé
│   ├── m6-observability/
│   │   └── overlay.yml           # loki + grafana (ou pointe vers le VPS)
│   └── m7-ctf/
│       ├── overlay.yml
│       └── scoreboard/
│
├── docs/                         # site apprenant (Docusaurus)
│   └── modules/mX/…
│
├── solutions/
│   ├── m1-idor.patch
│   ├── m1-mass-assignment.patch
│   └── …                         # un patch par faille, pas par module
│
├── infra/
│   ├── cloud-init.yml            # provisionnement VPS
│   ├── Caddyfile                 # TLS + basic auth
│   └── registry-mirror/
│
└── tools/
    ├── verify-lab.sh             # à lancer par l'apprenant AVANT le J1
    ├── offline-bundle.sh         # docker save → clé USB
    └── reset.sh
```

---

## 2. Interface apprenant : le Makefile

Une seule chose à retenir. Zéro commande Docker tapée à la main.

| Commande | Effet |
|---|---|
| `make check` | Vérifie Docker, Node, ports libres, RAM. Sortie verte/rouge sans ambiguïté. |
| `make up M=m1` | Lance la stack du module 1. |
| `make down` | Arrête tout. |
| `make reset` | Base de données re-seedée, code restauré à l'état vulnérable. |
| `make test` | Lance `tests/security` + `tests/functional`. |
| `make solution M=m1-idor` | Applique le patch de référence (filet de sécurité). |
| `make hint M=m1-idor` | Affiche l'indice suivant, progressif (3 niveaux). |

Le système d'indices à 3 niveaux est ce qui absorbe l'écart junior/senior sans que tu aies à te dédoubler en salle.

---

## 3. L'application : un seul domaine, toutes les failles

**Domaine** : plateforme de commandes B2C. Rôles `CUSTOMER` / `SELLER` / `ADMIN`.
**Stack** : Express 5 · TypeScript strict · **Drizzle ORM** · PostgreSQL · Redis · Vitest + Supertest.

### Pourquoi Drizzle est un meilleur choix que Prisma ici

Ce n'est pas un changement neutre — il améliore le lab sur trois points.

**1. La leçon sur l'injection devient plus fine.** Prisma opposait `$queryRaw` (sûr) à `$queryRawUnsafe` (dangereux) : le nom de la méthode contient l'avertissement, l'apprenant n'a rien à comprendre. Drizzle pose le vrai piège du quotidien :

```ts
// Sûr — le template tag paramètre automatiquement
db.execute(sql`SELECT * FROM products WHERE name = ${q}`)

// Vulnérable — interpolation avant que Drizzle ne voie quoi que ce soit
db.execute(sql.raw(`SELECT * FROM products WHERE name = '${q}'`))

// Vulnérable et beaucoup plus réaliste — tri dynamique
db.execute(sql`SELECT * FROM products ORDER BY ${sql.raw(req.query.sort)}`)
```

Le troisième cas est celui qu'on trouve réellement en production : le développeur *a* utilisé le template tag, il *a* paramétré la donnée utilisateur, et il est quand même vulnérable parce qu'un identifiant de colonne ne peut pas être un paramètre lié. C'est exactement le type de nuance qui justifie une formation pour des seniors.

**2. Une faille bonus, gratuite.** `db.select().from(users)` retourne **toutes** les colonnes, `passwordHash` compris. Prisma avait le même comportement mais son client masquait mieux le problème. Ici, l'over-fetching qui fuit dans une réponse JSON devient visible et corrigeable en 5 lignes — un excellent premier exercice pour les juniors.

**3. Gain opérationnel réel sur ta contrainte de bande passante.** Pas de `prisma generate`, pas de téléchargement de binaire moteur (~50 Mo par plateforme), pas d'étape de codegen dans le `Dockerfile`. Le `make up` démarre plus vite et le bundle hors-ligne rétrécit — ce qui compte quand 12 personnes lancent la stack en même temps le J1 à 9h.

Contrepartie honnête : les migrations demandent un peu plus de rigueur de ta part côté préparation (`drizzle-kit generate` puis relecture du SQL). C'est du travail de conception, invisible pour les apprenants.

Un seul domaine métier pour les 3 jours : les apprenants n'ont à comprendre le contexte fonctionnel qu'une fois, le J1 matin. Tout le reste du temps cognitif va à la sécurité.

### Cartographie faille → endpoint → catégorie 2025

| Module | Faille | Surface dans l'app | OWASP |
|---|---|---|---|
| M1 | IDOR | `GET /api/orders/:id`, `GET /api/invoices/:id.pdf` | A01 |
| M1 | Mass assignment | `PATCH /api/users/me` → `.set({...req.body})` non filtré | A01 |
| M1 | Over-fetching de colonnes | `db.select().from(users)` renvoie `passwordHash` | A01 / A04 |
| M1 | Élévation horizontale | rôle lu depuis un claim JWT non revérifié | A01 |
| M1 | SSRF | `POST /api/products/import-image` avec `{url}` | A01 (absorbé) |
| M2 | SQL injection | `GET /api/products/search` via `sql.raw()` | A05 |
| M2 | SQLi par identifiant | `?sort=` interpolé dans `ORDER BY` — le cas piégeux | A05 |
| M2 | Command injection | génération PDF via `exec('wkhtmltopdf …')` | A05 |
| M2 | Prototype pollution | `lib/merge.ts` sur les règles de coupon | A05 / A08 |
| M2 | XSS stocké | avis produit rendu sans échappement | A05 |
| M3 | `jwt.decode()` au lieu de `verify()` | middleware auth | A07 |
| M3 | `alg: none` accepté | vérification JWT permissive | A07 |
| M3 | Absence de rotation de session | login Redis | A07 |
| M3 | Énumération de comptes | messages d'erreur login différenciés | A07 |
| M4 | Mots de passe en MD5 | `lib/crypto.ts` | A04 |
| M4 | `Math.random()` pour les tokens | reset de mot de passe | A04 |
| M4 | CORS `origin: true` + `credentials` | `middleware/cors.ts` | A02 |
| M4 | Helmet absent, `x-powered-by` | `server.ts` | A02 |
| M4 | `.env` commité, secret en dur | historique git du dépôt | A02 |
| M5 | `postinstall` malveillant | `@secdev/price-utils` via Verdaccio | A03 |
| M5 | Dépendance typosquattée | `lodahs` dans `package.json` | A03 |
| M5 | Webhook paiement non signé | `POST /api/payments/webhook` | A08 |
| M5 | CI qui exfiltre les secrets | pipeline Gitea piégé | A03 |
| M6 | Aucun audit sur changement de rôle | `admin/users.service.ts` | A09 |
| M6 | `unhandledRejection` → DoS | `import-image` sans catch | A10 |
| M6 | Stack trace en réponse HTTP | `middleware/errors.ts` | A10 |
| M6 | `catch {}` silencieux sur vérif de paiement | fail-open | A10 |

**M6 est volontairement sous-doté en temps (1h30) alors qu'il porte 2 catégories.** Assume-le : A09 et A10 se démontrent vite et se corrigent vite. Ne les gonfle pas artificiellement pour faire joli sur le programme.

---

## 4. La boucle en 4 temps, appliquée

Chaque faille suit exactement la même trame dans la doc. La répétition du format est un atout : dès la 3ᵉ faille, plus personne ne lit les consignes de navigation.

```
docs/modules/m1-access-control/idor/
├── 00-brief.md        Contexte métier. 5 lignes. "Un client se plaint de voir
│                      la facture d'un autre." Pas de spoil.
├── 01-exploit.md      Reproduire. Requête curl fournie ou à construire.
├── 02-comprendre.md   Le mécanisme. Schéma. Pourquoi le code a l'air correct.
├── 03-corriger.md     À faire soi-même. Indices via `make hint`.
├── 04-prouver.md      Écrire le test qui échoue avant / passe après.
└── senior.md          Variante : PR à reviewer, faille non annoncée.
```

### L'étape « Prouver » — le cœur du dispositif

C'est ce que les apprenants ramèneront au bureau. Fournis le harness et **un seul** exemple complet :

```ts
// tests/security/m1-idor.spec.ts  — FOURNI comme modèle
import { loginAs, api } from './_harness'

it("refuse l'accès à la commande d'un autre client", async () => {
  const alice = await loginAs('alice@example.com')
  const bobOrderId = await seedOrderFor('bob@example.com')

  const res = await api.get(`/api/orders/${bobOrderId}`).set(alice.auth)

  expect(res.status).toBe(404)          // 404, pas 403 : pas de fuite d'existence
  expect(res.body).not.toHaveProperty('total')
})
```

Le détail `404 plutôt que 403` est exactement le genre de nuance qui fait dire à un senior que la formation vaut son prix. Il y en a une par module — repère-les et mets-les en avant à l'oral.

Pour les ~20 autres failles, l'apprenant écrit le test. Les versions de référence sont dans les patches.

---

## 5. Docker : une base, des surcouches

Pas 7 stacks indépendantes — une base et des overlays. Réduit le temps de démarrage inter-modules à quelques secondes.

```bash
# ce que fait `make up M=m5`
docker compose \
  -f docker-compose.base.yml \
  -f labs/m5-supply-chain/overlay.yml \
  up -d
```

| Fichier | Services |
|---|---|
| `docker-compose.base.yml` | `app`, `postgres`, `redis` |
| `m2/overlay.yml` | + `mailhog` (reset de mot de passe observable) |
| `m5/overlay.yml` | + `verdaccio`, `gitea`, `gitea-runner` |
| `m6/overlay.yml` | + `loki`, `grafana` (ou proxy vers le VPS) |
| `m7/overlay.yml` | app en mode CTF, seed différent, scoreboard |

Empreinte cible : **< 2 GB RAM et < 90 s de démarrage** pour la base. Drizzle aide ici : pas d'étape de génération de client au build, les migrations s'appliquent en SQL au démarrage. Au-delà, tu perds les laptops modestes et tu passes tes pauses à dépanner.

---

## 6. VPS : ne l'achète pas maintenant

Sans effectif, tu ne peux pas dimensionner. Et tu n'as pas besoin de le savoir.

**Provisionne à J-3, détruis à J+1.** Vultr, DigitalOcean et Linode facturent à l'heure sur leur région Sydney. Un `cloud-init.yml` versionné dans `infra/` reconstruit la machine en une commande. Coût réel : ~96 heures d'instance au lieu d'un abonnement mensuel qui tourne à vide pendant ta préparation.

Corollaire : **teste le provisionnement deux fois pendant la préparation**, détruis, recommence. Le script doit être fiable, pas la machine.

Rôles du VPS, par ordre de valeur :

1. **Miroir de registry Docker** — les apprenants pullent depuis Sydney (~30-40 ms) et non depuis Docker Hub via l'Europe. C'est le gain le plus tangible de toute l'infra.
2. **Grafana/Loki mutualisé (M6)** — trop lourd sur 12 laptops.
3. **Gitea + runner piégé (M5)** — démo magistrale, pas de manipulation individuelle.
4. **Cible et scoreboard du CTF (M7)** — ici le partagé devient un atout.
5. **code-server de secours** — pour le laptop qui lâche le J2.

Accès : Caddy + TLS + basic auth au minimum. Jamais d'application volontairement vulnérable sur IP publique nue.

---

## 7. Concevoir sans connaître l'effectif

Contraintes à respecter pour que le dispositif tienne de 6 à 20 personnes sans reconception :

- **Binômes obligatoires sur M1 et M2**, junior + senior. Fonctionne à partir de 4 personnes, ne casse pas à 20.
- **CTF final en équipes de 3**, scoreboard commun. Une équipe orpheline de 2 ou 4 ne pose aucun problème.
- **Aucune activité en cercle ou en tour de table** — ça explose au-delà de 10 personnes et ça fait vide en dessous de 6.
- **Kit hors-ligne sur clé USB** : `offline-bundle.sh` produit un tarball d'images. Prépare 4 clés, ça couvre tous les cas.
- **`make check` envoyé une semaine avant** avec consigne de le lancer et de te renvoyer la sortie. C'est ton seul moyen de connaître l'état du parc — et accessoirement d'obtenir enfin l'effectif réel.

---

## 8. Ordre de construction

Le temps de préparation existe, mais l'ordre compte : à tout moment, la version construite doit être une formation livrable, plus courte mais cohérente.

| Priorité | Contenu | Effort estimé |
|---|---|---|
| **P0** | App + seed + harness de tests + M1 + M2 | 4-5 j |
| **P1** | M5 supply chain (le module différenciant) + M3 | 2-3 j |
| **P2** | M4, M6, M7 CTF + scoreboard | 2-3 j |
| **P3** | Docs Docusaurus, pistes senior, quiz Kahoot | 2 j |
| **P4** | `cloud-init` VPS + bundle hors-ligne + répétition générale | 1-2 j |

Après P1, tu as déjà une formation de 2 jours qui tient debout. C'est le point de non-retour à viser en premier.

**Répétition générale obligatoire** : fais tourner M1 à M3 en conditions réelles sur une machine vierge, chronomètre en main. Les estimations de durée d'un concepteur sur son propre lab sont systématiquement optimistes de 30 à 40 %.

---

## 9. Points de vigilance

- **Briefing légal en M0**, 5 minutes, sans négociation. Périmètre = le lab et rien d'autre. En inter-entreprises, mentionne explicitement l'interdiction de tester sur les systèmes de leur employeur sans autorisation écrite.
- **Réseau Docker interne** pour tous les services. La seule sortie externe autorisée est le lab SSRF, et sa cible est un service interne au compose.
- **Les seniors vont finir en avance sur M1 et M2.** La piste `senior.md` doit exister dès P0, pas en P3. Sinon tu as trois personnes qui s'ennuient dès le J1 après-midi et tu perds la salle.
- **Ne construis pas de plateforme de quiz.** Kahoot en fin de module pour l'énergie collective, quiz statique dans la doc pour l'asynchrone. Zéro développement.
- **Vérifie le paquet piégé de M5** : il doit être inoffensif pour de vrai (écrit un fichier témoin dans `/tmp`, pas de reverse shell fonctionnel). Un exercice qui simule l'exfiltration sans l'exécuter enseigne exactement la même chose et ne te crée aucun problème.
