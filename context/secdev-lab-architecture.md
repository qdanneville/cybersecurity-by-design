# `secdev-lab` — Architecture du laboratoire

Formation 21h · Sécurité côté développement · OWASP Top 10:2025 · Node/TypeScript · OIDC · Secrets · Kubernetes · 3 jours consécutifs

---

## 0. Révision d'une décision antérieure

**Abandon des branches `mX-vulnerable` / `mX-fixed`.**

Raison : en salle, un apprenant à mi-lab a des modifications non commitées. `git checkout m2-vulnerable` échoue ou écrase son travail. Sur 12 personnes × 7 modules, c'est garanti d'arriver 5 fois par jour et de casser le rythme.

**Remplacé par** : une seule branche `main`, code vulnérable en permanence. Les correctifs de référence vivent dans `solutions/mX-*.patch`. L'apprenant bloqué fait `make solution M=m1-idor`, qui applique le patch. L'apprenant qui veut repartir propre fait `make reset`.

Bénéfice secondaire : le diff `git diff` de l'apprenant *est* son livrable. Tu peux le lire, le commenter, le comparer au patch de référence.

---

## 0 bis. Révision de périmètre — septembre 2026

Le client demande trois ajouts explicites :

1. **Fédération d'identité** — OAuth 2.0, OpenID Connect, Keycloak. Contexte réel : leurs applications s'appuient sur **NC Connect**.
2. **Gestion des secrets** — mots de passe, clés, jetons, coffre-fort.
3. **Conteneurs et Kubernetes.**

**Décision : on reste à 21h, on rééquilibre.** Le public est un profil fullstack senior : M1 et M2 étaient déjà dimensionnés pour absorber des juniors, et le document notait que les seniors les finissent en avance. C'est là qu'on reprend le temps.

| | Avant | Après | Jour |
|---|---|---|---|
| M0 Fondations | 2h | **1h30** | J1 |
| M1 Contrôle d'accès | 4h | **3h** | J1 |
| M2 Injections | 3h | **2h30** | J1 |
| M3 Authentification & session | 3h | **1h30** | J2 |
| **M4 Fédération d'identité (OIDC, NC Connect, Keycloak)** | — | **2h30** | J2 |
| M5 Configuration, crypto & **secrets** (ex-M4) | 3h | 3h, dont ~1h45 secrets | J2 |
| M6 Supply chain (ex-M5) | 3h | **2h** | J3 |
| **M7 Conteneurs & Kubernetes** | — | **2h30** | J3 |
| M8 Journalisation & échecs (ex-M6) | 1h30 | **1h** | J3 |
| M9 Synthèse / CTF (ex-M7) | 1h30 | 1h30 | J3 |

Justifications des coupes :

- **M3 passe à 1h30** parce qu'une bonne partie de son contenu est *déléguée au fournisseur d'identité* dès qu'on fait de l'OIDC. On garde JWT, cookies, hachage, énumération — le socle nécessaire pour comprendre M4 — et M3 se termine sur « ce qui reste à l'application quand l'IdP fait l'authentification ». M3 + M4 forment un bloc de 4h cohérent.
- **M6 passe à 2h** parce que la moitié « artefacts » (SBOM d'image, provenance, signature) migre dans M7. Rien n'est perdu, c'est déplacé là où c'est concret.
- **M8 passe à 1h** : c'était déjà assumé comme sous-doté. Les secrets dans les logs sont traités en M5.

Alternative si le client accepte d'allonger : **28h / 4 jours**, en rendant à M1/M2/M6 leur durée initiale et en portant M7 à 3h30 (ajout d'un lab admission control avec Kyverno). À proposer, pas à imposer : la version 21h tient.

**Sur NC Connect** : on ne branche *pas* le lab sur NC Connect réel (réseau interne, pas de comptes de test à distribuer, et on ne fait pas d'exercice offensif contre un service public). On simule avec un realm Keycloak `nc-connect-sim`. Le dernier quart d'heure de M4 est une revue de l'intégration réelle, faite à partir de la documentation officielle NC Connect. **À récupérer avant la préparation de M4** : doc d'intégration fournisseur, scopes et claims exposés, exigences PKCE, endpoints de déconnexion, disponibilité d'un environnement de recette. Ne rien affirmer en salle sur NC Connect qui ne soit pas dans cette doc.

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
│   │   │   └── oidc/         # login fédéré (BFF) : callback, validation id_token, liaison de compte
│   │   │   ├── users/            # profil, rôles
│   │   │   ├── products/         # catalogue, recherche, import image
│   │   │   ├── orders/           # commandes, factures PDF
│   │   │   ├── coupons/          # règles de remise (merge → proto pollution)
│   │   │   ├── payments/         # webhook fournisseur (intégrité)
│   │   │   └── admin/            # back-office
│   │   ├── middleware/           # auth, errors, cors, rate-limit
│   │   └── lib/                  # crypto, pdf, http-client, merge, secrets (client OpenBao)
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
│   ├── m4-identity/
│   │   ├── overlay.yml           # keycloak
│   │   └── realm-nc-connect-sim.json   # realm + clients volontairement mal configurés
│   ├── m5-config-secrets/
│   │   ├── overlay.yml           # openbao (dev mode)
│   │   └── bao-init.sh           # moteur database, policies, AppRole
│   ├── m6-supply-chain/
│   │   ├── overlay.yml           # verdaccio + gitea + runner
│   │   └── evil-package/         # @secdev/price-utils piégé
│   ├── m7-k8s/
│   │   ├── k3d-config.yml        # cluster 1 nœud, network policies actives
│   │   ├── manifests/            # déploiement vulnérable de l'app (kustomize)
│   │   └── Dockerfile.vulnerable # root, node:latest, .env copié, devDeps en prod
│   ├── m8-observability/
│   │   └── overlay.yml           # loki + grafana (ou pointe vers le VPS)
│   └── m9-ctf/
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
| `make tools` | Installe `kubectl`, `k3d`, `trivy`, `gitleaks` en versions épinglées et vérifiées par checksum dans `./.bin`. Rien en global. |

`make up M=m7` a un comportement particulier : il arrête la stack compose, crée le cluster k3d, y importe les images locales (`k3d image import`, aucun pull) et applique les manifests. `make down` supprime le cluster.

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
| M4 | `state` absent ou non comparé | `GET /auth/oidc/callback` → CSRF de login | A07 / A01 |
| M4 | Client public sans PKCE | client `shop-spa` du realm | A07 |
| M4 | `nonce` non vérifié | validation de l'`id_token` | A07 |
| M4 | `id_token` décodé sans vérif JWKS / `iss` / `aud` / `exp` | `oidc/verify.ts` | A07 |
| M4 | API qui accepte un access token émis pour un autre client | `middleware/auth.ts` sans contrôle d'`aud` | A01 / A07 |
| M4 | `redirect_uri` générique `https://shop.lab/*` + open redirect `?returnTo=` | realm + `oidc/callback` → vol de code | A01 |
| M4 | Liaison de compte par `email` au lieu de `iss`+`sub` | `oidc/link-account.ts` → prise de contrôle | A07 |
| M4 | Tokens OIDC en `localStorage` | front — corrigé par le passage en BFF | A07 |
| M4 | Logout local uniquement | session Keycloak survivante | A07 |
| M5 | Mots de passe en MD5 | `lib/crypto.ts` | A04 |
| M5 | `Math.random()` pour les tokens | reset de mot de passe | A04 |
| M5 | CORS `origin: true` + `credentials` | `middleware/cors.ts` | A02 |
| M5 | Helmet absent, `x-powered-by` | `server.ts` | A02 |
| M5 | `.env` commité, secret en dur | historique git du dépôt | A02 |
| M5 | `DATABASE_URL` complète loguée au démarrage | `server.ts` | A02 / A09 |
| M5 | `GET /api/health?verbose=1` renvoie `process.env` | `admin/health.ts` | A02 |
| M5 | Même clé de signature JWT en dev et en prod | `.env.example` recopié tel quel | A04 |
| M5 | Identifiants PostgreSQL statiques, jamais tournés | → identifiants dynamiques OpenBao (TTL 1h) | A04 |
| M5 | Rotation de clé impossible sans casser les sessions | pas de `kid`, une seule clé | A04 |
| M6 | `postinstall` malveillant | `@secdev/price-utils` via Verdaccio | A03 |
| M6 | Dépendance typosquattée | `lodahs` dans `package.json` | A03 |
| M6 | Webhook paiement non signé | `POST /api/payments/webhook` | A08 |
| M6 | CI qui exfiltre les secrets | pipeline Gitea piégé | A03 |
| M7 | Image root, `node:latest`, devDeps en prod | `Dockerfile.vulnerable` | A02 |
| M7 | `.env` copié dans une couche puis supprimé | visible via `docker history` / `dive` | A02 |
| M7 | Socket Docker monté dans un conteneur | sidecar « monitoring » | A02 |
| M7 | Pod `privileged` + `hostPath: /` | déploiement `debug-tools` | A02 |
| M7 | Jeton de ServiceAccount monté + RBAC `get secrets` sur le namespace | `manifests/rbac.yml` | A01 / A02 |
| M7 | Aucune NetworkPolicy | l'app joint OpenBao, Postgres, tout | A02 |
| M7 | Secret K8s « chiffré » en base64 dans le dépôt | `manifests/secret.yml` | A02 / A04 |
| M7 | Pas de `resources.limits` | voisin bruyant, lien avec A10 | A10 |
| M8 | Aucun audit sur changement de rôle | `admin/users.service.ts` | A09 |
| M8 | `unhandledRejection` → DoS | `import-image` sans catch | A10 |
| M8 | Stack trace en réponse HTTP | `middleware/errors.ts` | A10 |
| M8 | `catch {}` silencieux sur vérif de paiement | fail-open | A10 |

**M8 est volontairement sous-doté en temps (1h) alors qu'il porte 2 catégories.** Assume-le : A09 et A10 se démontrent vite et se corrigent vite. Ne les gonfle pas artificiellement pour faire joli sur le programme.

### 3 bis. Les trois blocs ajoutés, en détail

#### M4 — Fédération d'identité (2h30)

**Dispositif.** Keycloak (`quay.io/keycloak/keycloak`, `start-dev --import-realm`) avec un realm `nc-connect-sim` qui joue le rôle de NC Connect : même forme de parcours (authorization code), utilisateurs de test, claims d'identité. Deux clients : `shop-bff` (confidentiel, le bon modèle cible) et `shop-spa` (public, mal configuré : wildcard sur `redirect_uri`, implicit flow et direct access grants activés, PKCE non exigé).

**Déroulé.**

| Durée | Contenu |
|---|---|
| 30 min | Modèle mental : OAuth ≠ OIDC, qui émet quoi pour qui. Schéma du flux code + PKCE, dessiné au tableau, pas en slide. |
| 60 min | Labs : CSRF de login via `state`, vol de code via redirect wildcard + open redirect, forge d'`id_token` non vérifié, prise de contrôle par liaison sur `email`. |
| 30 min | Correction architecturale : passage en BFF, cookies de session applicative, tokens jamais exposés au navigateur. |
| 15 min | Revue Keycloak : durcir les clients `shop-spa` / `shop-bff` dans la console, export du realm, diff. Keycloak en *identity brokering* devant un IdP externe — le schéma probable de leur prod. |
| 15 min | Transposition NC Connect : checklist d'intégration appliquée à la doc réelle. |

**La nuance senior du module** : *on ne rattache jamais un compte par e-mail*. Un IdP (ou un second IdP ajouté plus tard en brokering) qui laisse passer un `email` non vérifié permet de se connecter en tant que n'importe qui. Le seul identifiant fiable est le couple `iss` + `sub`. Deuxième nuance : l'`id_token` est destiné au client, l'access token à l'API — une API qui accepte un `id_token`, ou un access token émis pour un autre client, est un *confused deputy*.

**Prouver.** Les tests ne dépendent pas de Keycloak : le harness expose un mini-IdP en mémoire (`jose` + paire de clés générée au démarrage des tests) avec `forgeIdToken({ iss, aud, nonce, signWith })`. Un test signe avec une clé attaquante, un autre avec un mauvais `aud`, un troisième rejoue un `nonce` — tous doivent être refusés. `make test` reste rapide et hors ligne.

#### M5 — Gestion des secrets (≈ 1h45 sur les 3h du module)

**Dispositif.** OpenBao en mode dev (fork open source de Vault sous MPL — évite la question de licence BSL de HashiCorp Vault ; l'API et le CLI sont compatibles, on mentionne Vault et les coffres managés AWS/Azure/GCP à l'oral). `bao-init.sh` configure le moteur `database` sur le Postgres du lab, une policy minimale et un AppRole pour l'app.

**Fil rouge.** L'app part de `.env` + identifiants Postgres statiques et arrive à :

1. l'app s'authentifie auprès d'OpenBao (AppRole en compose, puis auth Kubernetes en M7 — même code, autre méthode) ;
2. elle obtient des identifiants Postgres **dynamiques** (TTL 1h, renouvelés par bail) ;
3. la clé de signature JWT est récupérée du coffre, avec `kid` : on fait une rotation en live, les sessions en cours restent valides pendant la période de double validité.

**Chasse aux fuites** (10 min, très efficace en salle) : `gitleaks detect` sur l'historique, `docker history` sur l'image, lecture des logs de démarrage, `/api/health?verbose=1`, `ps aux` sur un secret passé en argument. Cinq lieux de fuite, un seul secret.

**La nuance senior du module** : *un secret qui a fui se révoque, il ne se supprime pas*. Réécrire l'historique Git ne sert à rien si la valeur est encore valide. Et un secret qu'on ne sait pas faire tourner sans coupure est un secret qu'on ne fera jamais tourner — d'où le `kid`.

**Prouver.** Test qui échoue si une réponse HTTP ou une ligne de log contient une valeur du coffre (le harness injecte des secrets canari et scanne `res.text` et le buffer du logger). `gitleaks` en hook pre-commit et en étape CI (réutilisé en M6).

#### M7 — Conteneurs et Kubernetes (2h30)

**Dispositif.** k3d (k3s dans Docker, 1 nœud, ~1 Go RAM). k3s embarque un contrôleur de NetworkPolicy : les policies sont réellement appliquées, pas juste acceptées. Outil unique d'analyse : **Trivy** (image, config Dockerfile/manifests, secrets, cluster) — un seul binaire, une seule base à mettre dans le bundle hors-ligne.

**Déroulé.**

| Durée | Contenu |
|---|---|
| 20 min | Ce qu'isole un conteneur (et ce qu'il n'isole pas). Démo : socket Docker monté → root sur l'hôte en une commande. |
| 40 min | Image : réécrire `Dockerfile.vulnerable` → multi-stage, `node:22-slim` ou distroless épinglé par digest, `USER node`, pas de devDeps. `trivy image` avant/après, SBOM avec `trivy --format cyclonedx` (lien M6). |
| 50 min | **Attaque en chaîne** : l'injection de commande de M2 dans le pod → lecture du jeton de ServiceAccount → `kubectl get secrets` depuis le pod → identifiants Postgres. Puis on casse la chaîne maillon par maillon : `automountServiceAccountToken: false`, RBAC minimal, NetworkPolicy default-deny, secrets via OpenBao (auth Kubernetes) plutôt qu'en Secret K8s. |
| 30 min | Pod Security Standards : label `restricted` sur le namespace → les manifests vulnérables sont rejetés, on corrige le `securityContext` (`runAsNonRoot`, `readOnlyRootFilesystem`, `allowPrivilegeEscalation: false`, `capabilities.drop: [ALL]`, `seccompProfile: RuntimeDefault`) + `resources.limits`. |
| 10 min | Ce qui relève du dev vs de l'équipe plateforme — éviter qu'ils repartent en croyant devoir administrer le cluster. |

**La nuance senior du module** : *l'attaque en chaîne*. Aucune des failles prise seule n'est critique ; ensemble, une injection de commande dans une app métier devient la lecture de tous les secrets du namespace. C'est le moment où M1, M2, M5 et M7 se rejoignent — à garder pour la fin de J3, juste avant le CTF.

**Prouver.** Les preuves sont des assertions sur le cluster, exécutées par `make test M=m7` :

```bash
# doit répondre "no"
kubectl auth can-i get secrets --as=system:serviceaccount:shop:app -n shop
# doit échouer (NetworkPolicy)
kubectl exec deploy/app -n shop -- wget -T 2 -qO- http://openbao.vault:8200
# doit sortir en code 0
trivy config --exit-code 1 --severity HIGH,CRITICAL labs/m7-k8s/manifests/
```

Le format reste « échoue avant, passe après » — c'est ce qui compte pour la transposition.

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
# ce que fait `make up M=m6`
docker compose \
  -f docker-compose.base.yml \
  -f labs/m6-supply-chain/overlay.yml \
  up -d
```

| Fichier | Services |
|---|---|
| `docker-compose.base.yml` | `app`, `postgres`, `redis` |
| `m2/overlay.yml` | + `mailhog` (reset de mot de passe observable) |
| `m4/overlay.yml` | + `keycloak` (~700 Mo RAM, démarrage 20-40 s — à lancer pendant l'apport théorique) |
| `m5/overlay.yml` | + `openbao` (dev mode, ~150 Mo) |
| `m6/overlay.yml` | + `verdaccio`, `gitea`, `gitea-runner` |
| `m7` | pas d'overlay : cluster k3d à la place de la stack compose (voir `make up M=m7`) |
| `m8/overlay.yml` | + `loki`, `grafana` (ou proxy vers le VPS) |
| `m9/overlay.yml` | app en mode CTF, seed différent, scoreboard |

Empreinte cible : **< 2 GB RAM et < 90 s de démarrage** pour la base. Drizzle aide ici : pas d'étape de génération de client au build, les migrations s'appliquent en SQL au démarrage. Au-delà, tu perds les laptops modestes et tu passes tes pauses à dépanner.

Pics mémoire à surveiller : **M4** (base + Keycloak ≈ 2,7 Go) et **M7** (k3d + images ≈ 1,5-2 Go, la stack compose est arrêtée). Sur un poste 8 Go avec IDE et navigateur, c'est tenable mais serré : `make check` doit mesurer la RAM *libre*, pas la RAM totale, et le prérequis passe à « 16 Go fortement recommandés ».

Bundle hors-ligne : ajouter `keycloak`, `openbao`, `rancher/k3s`, l'image `k3d-tools`/`k3d-proxy`, et le cache de base Trivy (`trivy image --download-db-only`, puis `--skip-db-update` en salle). Sans ce dernier point, le premier `trivy` de J3 télécharge ~500 Mo × 12 postes.

---

## 6. VPS : ne l'achète pas maintenant

Sans effectif, tu ne peux pas dimensionner. Et tu n'as pas besoin de le savoir.

**Provisionne à J-3, détruis à J+1.** Vultr, DigitalOcean et Linode facturent à l'heure sur leur région Sydney. Un `cloud-init.yml` versionné dans `infra/` reconstruit la machine en une commande. Coût réel : ~96 heures d'instance au lieu d'un abonnement mensuel qui tourne à vide pendant ta préparation.

Corollaire : **teste le provisionnement deux fois pendant la préparation**, détruis, recommence. Le script doit être fiable, pas la machine.

Rôles du VPS, par ordre de valeur :

1. **Miroir de registry Docker** — les apprenants pullent depuis Sydney (~30-40 ms) et non depuis Docker Hub via l'Europe. C'est le gain le plus tangible de toute l'infra.
2. **Grafana/Loki mutualisé (M8)** — trop lourd sur 12 laptops.
3. **Gitea + runner piégé (M6)** — démo magistrale, pas de manipulation individuelle. Le pipeline corrigé intègre `gitleaks` et `trivy`.
4. **Cible et scoreboard du CTF (M9)** — ici le partagé devient un atout.
5. **code-server de secours** — pour le laptop qui lâche le J2.

**Pas de cluster Kubernetes mutualisé pour M7.** Le lab inclut un pod `privileged` avec `hostPath: /` : sur un cluster partagé, un apprenant qui s'évade prend le nœud de tout le monde. M7 tourne en k3d local, point. Le poste qui ne peut pas le faire travaille en binôme.

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
| **P1** | M3 + **M4 OIDC** + **M5 secrets** — demandés explicitement par le client, donc contractuels | 4-5 j |
| **P2** | **M7 Kubernetes** + M6 supply chain | 4 j |
| **P2 bis** | M8, M9 CTF + scoreboard (le CTF doit contenir au moins une faille OIDC et une faille K8s) | 2-3 j |
| **P3** | Docs Docusaurus, pistes senior, quiz Kahoot | 2 j |
| **P4** | `cloud-init` VPS + bundle hors-ligne + répétition générale | 1-2 j |

Après P1, tu as une formation de 2 jours qui couvre déjà deux des trois demandes du client. C'est le point de non-retour à viser en premier. M7 est le module le plus risqué techniquement (k3d sur Windows/WSL2, Docker Desktop sur Mac ARM) : ne le laisse pas glisser en dernier.

**Répétition générale obligatoire** : fais tourner M1 à M4 et M7 en conditions réelles sur une machine vierge, chronomètre en main. Les estimations de durée d'un concepteur sur son propre lab sont systématiquement optimistes de 30 à 40 %.

---

## 9. Points de vigilance

- **Briefing légal en M0**, 5 minutes, sans négociation. Périmètre = le lab et rien d'autre. En inter-entreprises, mentionne explicitement l'interdiction de tester sur les systèmes de leur employeur sans autorisation écrite.
- **Réseau Docker interne** pour tous les services. La seule sortie externe autorisée est le lab SSRF, et sa cible est un service interne au compose.
- **Les seniors vont finir en avance sur M1 et M2.** La piste `senior.md` doit exister dès P0, pas en P3. Sinon tu as trois personnes qui s'ennuient dès le J1 après-midi et tu perds la salle.
- **Ne construis pas de plateforme de quiz.** Kahoot en fin de module pour l'énergie collective, quiz statique dans la doc pour l'asynchrone. Zéro développement.
- **Le Keycloak du lab est volontairement mal configuré.** Nomme le realm `nc-connect-sim`, jamais `nc-connect`, et mets un bandeau « SIMULATION » sur la page de login (thème Keycloak). Personne ne doit repartir avec une capture d'écran qui ressemble au vrai NC Connect.
- **k3d et le socket Docker** : `make up M=m7` a besoin du socket Docker de l'hôte — exactement la configuration que M7 dénonce. Dis-le en salle, c'est un bon moment : sur un poste de dev qu'on possède, c'est acceptable ; dans un conteneur de prod ou un runner CI partagé, non.
- **Vérifie le paquet piégé de M6** : il doit être inoffensif pour de vrai (écrit un fichier témoin dans `/tmp`, pas de reverse shell fonctionnel). Un exercice qui simule l'exfiltration sans l'exécuter enseigne exactement la même chose et ne te crée aucun problème.
