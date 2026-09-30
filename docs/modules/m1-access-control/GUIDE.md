# M1 — Contrôle d'accès : guide pas à pas

**Durée** : ~3 h · **Niveau** : dev fullstack · **Travail en binôme** (1 junior + 1 senior)

Tu vas attaquer une boutique en ligne volontairement vulnérable, comprendre pourquoi ça marche, la **corriger toi-même**, puis **prouver** que c'est corrigé.

| # | Faille | Ce que tu vas faire |
|---|---|---|
| 1 | **IDOR** | Lire la commande d'un autre client |
| 2 | **Mass assignment** | Te donner toi-même le rôle ADMIN |
| 3 | **Sur-exposition de données** | Voir les hash de mots de passe de tous les users |
| 4 | **Rôle non revérifié** | Garder des droits admin qu'on t'a retirés |
| 5 | **SSRF** | Faire faire des requêtes internes au serveur |

> ⚠️ **Cadre** : tu attaques **uniquement ce lab**, sur ta machine. Jamais un système réel sans autorisation écrite.

---

## 0. Préparation (10 min)

```bash
cp .env.example .env     # une seule fois
make check               # tout doit être vert (curl, jq, docker, RAM, ports)
make up M=m1             # démarre l'appli + la base, et charge les données
```

Attends « `seed complete` ». L'appli répond sur **http://localhost:3000**.

Colle ce bloc dans ton terminal (il te fait gagner du temps ensuite) :

```bash
setopt interactive_comments 2>/dev/null
export B=http://localhost:3000
PW='Password123!'
login() { curl -s -X POST $B/api/auth/login -H 'content-type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"$PW\"}" | jq -r .token; }
```

> 🛠️ **Sous zsh (macOS)** ces 2 pièges sont déjà évités par ce bloc : le `!` du mot de passe est mis entre *quotes simples* (sinon : `zsh: event not found`), et la 1ʳᵉ ligne autorise les commentaires `#` quand on colle du code (sinon : `zsh: bad pattern`). Si tu ouvres un nouveau terminal, **recolle le bloc**.

**Les comptes** (mot de passe pour tous : `Password123!`)

| Email | Rôle | id |
|---|---|---|
| alice@example.com | CUSTOMER | 1 |
| bob@example.com | CUSTOMER | 2 |
| carol@example.com | SELLER | 3 |
| admin@example.com | ADMIN | 4 |

**Vérifie que ça marche** :

```bash
ALICE=$(login alice@example.com); echo ${ALICE:0:30}...
```
→ tu dois voir `eyJhbGciOiJIUzI1NiIsInR5cCI6...` (c'est un *token* JWT : ton badge d'accès).

> 💡 Colle ton token sur https://jwt.io pour lire ce qu'il contient : `sub` (ton id), `email`, **`role`**. Garde ce dernier en tête pour la faille 4.

**Les commandes utiles pendant tout le module**

| Commande | Effet |
|---|---|
| `make test` | Lance tous les tests (au départ : les tests de sécurité sont **rouges**, c'est normal) |
| `make test T=m1-idor` | Lance un seul test |
| `make hint M=m1-idor` | Indice suivant (3 niveaux, du plus vague au plus précis) |
| `make solution M=m1-idor` | Applique la correction de référence (filet de sécurité) |
| `make seed` | Remet les données à zéro (**sans** toucher à ton code) |
| `make reset` | Remet **données ET code** à l'état vulnérable (⚠️ efface tes corrections) |

**La boucle, pour chaque faille** : ① Exploiter → ② Comprendre → ③ Corriger → ④ Vérifier → ⑤ Prouver.
Ton code est dans `app/src/`. Quand tu le sauvegardes, le serveur redémarre tout seul (2 s).

---

## Faille 1 — IDOR (accès direct à un objet)

**Le contexte.** Un client se plaint : « je vois la commande d'un autre ! »

### ① Exploiter
Alice regarde **sa** commande (id 1), puis essaie l'id 2.

```bash
ALICE=$(login alice@example.com)
curl -s $B/api/orders/1 -H "Authorization: Bearer $ALICE"
curl -s $B/api/orders/2 -H "Authorization: Bearer $ALICE"
```

Réponses :
```json
{"id":1,"userId":1,"totalCents":8900,"status":"PAID","createdAt":"..."}
{"id":2,"userId":2,"totalCents":5900,"status":"PAID","createdAt":"..."}
```
🔴 La 2ᵉ commande a `"userId":2` : c'est celle de **Bob**. Alice la lit. Essaie 3, 4, 5… : il suffit de deviner des numéros.

### ② Comprendre
Ouvre `app/src/modules/orders/orders.routes.ts`. Le code vérifie que tu es **connecté** (`requireAuth`) mais jamais que la commande est **à toi**.
> *Authentifié ≠ autorisé.* « Qui es-tu ? » et « As-tu le droit de voir ça ? » sont deux questions différentes.

### ③ Corriger
Essaie seul, puis utilise `make hint M=m1-idor` si tu bloques.

**Solution** :
```ts
const order = rows[0]
// 404 si elle n'existe pas OU si elle n'est pas à toi
if (!order || order.userId !== req.user!.id) { res.status(404).json({ error: 'not found' }); return }
res.json(order)
```

### ④ Vérifier
Même attaque :
```bash
curl -s -w " [HTTP %{http_code}]" $B/api/orders/2 -H "Authorization: Bearer $ALICE"
curl -s -w " [HTTP %{http_code}]" $B/api/orders/1 -H "Authorization: Bearer $ALICE"
```
✅ Attendu :
```
{"error":"not found"} [HTTP 404]                       ← la commande de Bob est refusée
{"id":1,"userId":1,"totalCents":8900,...} [HTTP 200]   ← la sienne marche toujours
```

### ⑤ Prouver
```bash
make test T=m1-idor
```
Avant ta correction : ❌ 1 test échoue. Après : ✅ 2 passent. Ouvre `app/tests/security/m1-idor.spec.ts` et lis-le : c'est **le modèle** pour écrire tes propres tests de non-régression.

> 🎯 **Pourquoi 404 et pas 403 ?** Avec 403, on répond « cette commande existe mais n'est pas à toi » : l'attaquant sait quels ids existent. Avec 404, une commande inexistante et une commande interdite sont **indiscernables**.

---

## Faille 2 — Mass assignment

**Le contexte.** Le profil permet de changer son nom. Que se passe-t-il si on envoie *plus* que le nom ?

### ① Exploiter
```bash
make seed                                  # données propres
ALICE=$(login alice@example.com)
# Avant : Alice n'a pas accès à l'admin
curl -s -w " [HTTP %{http_code}]" $B/api/admin/summary -H "Authorization: Bearer $ALICE"
# Elle "modifie son nom"... et glisse un champ en plus :
curl -s -X PATCH $B/api/users/me -H "Authorization: Bearer $ALICE" \
  -H 'content-type: application/json' -d '{"name":"Alice","role":"ADMIN"}'
```

Réponses :
```
{"error":"forbidden"} [HTTP 403]
{"id":1,"email":"alice@example.com","name":"Alice","passwordHash":"md5:...","role":"ADMIN",...}
```
🔴 `"role":"ADMIN"` : Alice s'est promue elle-même. Il lui reste à se reconnecter pour obtenir un token qui le dit :
```bash
ALICE2=$(login alice@example.com)
curl -s -w " [HTTP %{http_code}]" $B/api/admin/summary -H "Authorization: Bearer $ALICE2"
```
→ `{"secret":"chiffre-affaires-interne","totalCents":1234567} [HTTP 200]` 🔴 Elle lit les chiffres internes.

### ② Comprendre
Dans `app/src/modules/users/users.routes.ts` :
```ts
.set({ ...req.body })     // ← copie TOUT ce que le client envoie
```
Le développeur pense « le client enverra `name` ». Mais **le client envoie ce qu'il veut**.
> Ne jamais faire confiance à la *forme* de ce qui arrive : tu choisis les champs, pas le client.

### ③ Corriger
`make hint M=m1-mass-assignment` si besoin.

**Solution** : liste blanche.
```ts
const { name } = req.body ?? {}
const updated = await db.update(schema.users)
  .set({ name })                       // seulement ce qu'on autorise
  .where(eq(schema.users.id, req.user!.id))
  .returning()
```

### ④ Vérifier
```bash
make seed
ALICE=$(login alice@example.com)
curl -s -X PATCH $B/api/users/me -H "Authorization: Bearer $ALICE" \
  -H 'content-type: application/json' -d '{"name":"Alice2","role":"ADMIN"}'
```
✅ Attendu : `"name":"Alice2"` (accepté) mais `"role":"CUSTOMER"` (ignoré).

### ⑤ Prouver
```bash
make test T=m1-mass-assignment
```
❌ avant → ✅ après.

> 🔎 **Question pour les seniors** : regarde bien la réponse de ta version corrigée. Vois-tu encore quelque chose qui ne devrait pas y être ? *(indice : c'est l'objet de la faille 3.)*

---

## Faille 3 — Sur-exposition de données (over-fetching)

**Le contexte.** Le back-office liste les utilisateurs. Que voit vraiment le front ?

### ① Exploiter
```bash
make seed
ADMIN=$(login admin@example.com)
curl -s $B/api/users -H "Authorization: Bearer $ADMIN" | jq -c '.[0]'
```
Réponse :
```json
{"id":1,"email":"alice@example.com","name":"Alice","passwordHash":"md5:319f4d26e3c536b5dd871bb2c52e3178","role":"CUSTOMER","createdAt":"..."}
```
🔴 Le **hash du mot de passe** est dans la réponse, pour tous les utilisateurs. Même si l'écran ne l'affiche pas, il est dans le JSON : ouvre l'onglet « Réseau » du navigateur et tu le vois.

Et un simple client, lui, est bien bloqué :
```bash
ALICE=$(login alice@example.com)
curl -s -w " [HTTP %{http_code}]" $B/api/users -H "Authorization: Bearer $ALICE"   # → forbidden [HTTP 403]
```
(Le contrôle d'accès est correct ici. Le problème est **ce que renvoie** la route, pas **qui** peut l'appeler.)

### ② Comprendre
```ts
const rows = await db.select().from(schema.users)   // ← toutes les colonnes
res.json(rows)                                       // ← toutes envoyées
```
Avec Drizzle, `select()` sans argument ramène **toutes** les colonnes, `passwordHash` compris. Le jour où on ajoute une colonne sensible, elle fuit automatiquement.
> Défaut sûr = **liste blanche** des colonnes qui sortent, pas liste noire de celles qui ne sortent pas.

### ③ Corriger
`make hint M=m1-overfetch` si besoin.

**Solution** :
```ts
const rows = await db.select({
  id: schema.users.id, email: schema.users.email,
  name: schema.users.name, role: schema.users.role,
}).from(schema.users)
```

### ④ Vérifier
```bash
ADMIN=$(login admin@example.com)
curl -s $B/api/users -H "Authorization: Bearer $ADMIN" | jq -c '.[0]'
```
✅ Attendu : `{"id":1,"email":"alice@example.com","name":"Alice","role":"CUSTOMER"}` : plus de `passwordHash`.

### ⑤ Prouver
```bash
make test T=m1-overfetch
```

> ➕ **Bonus** : la route `PATCH /api/users/me` (faille 2) renvoie elle aussi `passwordHash` dans sa réponse, même corrigée. Corrige-la avec la même idée.

---

## Faille 4 — Rôle non revérifié

**Le contexte.** L'admin est rétrogradé. Ses droits disparaissent-ils vraiment ?

### ① Exploiter
Le rôle voyage **dans le token** (`jwt.io` → champ `role`). Le serveur le croit sans jamais vérifier en base.

**Scénario A — le token périmé** (aucun piratage nécessaire) :
```bash
make seed
ADMIN=$(login admin@example.com)                                   # token qui dit "ADMIN"
curl -s -w " [HTTP %{http_code}]" $B/api/admin/summary -H "Authorization: Bearer $ADMIN"
# L'admin est rétrogradé en base (ici on simule via la faille 2) :
curl -s -X PATCH $B/api/users/me -H "Authorization: Bearer $ADMIN" \
  -H 'content-type: application/json' -d '{"role":"CUSTOMER"}' | jq -c '{email,role}'
# Son ANCIEN token marche-t-il encore ?
curl -s -w " [HTTP %{http_code}]" $B/api/admin/summary -H "Authorization: Bearer $ADMIN"
```
Réponses :
```
{"secret":"chiffre-affaires-interne",...} [HTTP 200]
{"email":"admin@example.com","role":"CUSTOMER"}
{"secret":"chiffre-affaires-interne",...} [HTTP 200]      ← 🔴 il n'est plus admin, l'accès reste
```
🔴 En base il est `CUSTOMER`, mais son token dit toujours `ADMIN` (valable 2 h) : le serveur croit le token.

**Scénario B — le token forgé** (le secret de signature est celui du `.env.example`, public dans le dépôt) :
```bash
make seed
FORGED=$(cd app && node -e "console.log(require('jsonwebtoken').sign({sub:1,email:'alice@example.com',role:'ADMIN'},'dev-not-secret-change-me',{expiresIn:'2h'}))")
curl -s -w " [HTTP %{http_code}]" $B/api/admin/summary -H "Authorization: Bearer $FORGED"
```
→ `{"secret":"chiffre-affaires-interne",...} [HTTP 200]` 🔴 Alice (CUSTOMER) s'est fabriqué un badge admin.

> ℹ️ Le scénario B n'est possible que parce que le **secret est connu**. C'est un autre problème (gestion des secrets, module M5). Mais notre correction protège contre **les deux** : même avec un token parfaitement signé, on ne se fie plus à son contenu pour les droits.

### ② Comprendre
Dans `app/src/middleware/auth.ts` : `req.user = { …, role: claims.role }` : le rôle vient du token et **n'est jamais revérifié**. Un token est une photo du passé : il ne sait pas que les droits ont changé.
> Une décision d'autorisation sensible doit s'appuyer sur l'état **actuel**, pas sur ce que le token affirmait au login.

### ③ Corriger
`make hint M=m1-role-escalation` si besoin.

**Solution** (dans `app/src/modules/admin/admin.routes.ts`) : relire le rôle en base.
```ts
adminRouter.get('/summary', requireAuth, async (req, res, next) => {
  const rows = await db.select({ role: schema.users.role })
    .from(schema.users).where(eq(schema.users.id, req.user!.id))
  if (rows[0]?.role !== 'ADMIN') { res.status(403).json({ error: 'forbidden' }); return }
  next()
}, (_req, res) => res.json({ secret: 'chiffre-affaires-interne', totalCents: 1234567 }))
```
(N'oublie pas les imports `eq`, `db`, `schema`.)

### ④ Vérifier
Rejoue les scénarios A et B (avec `make seed` avant chacun).
✅ Attendu :
```
{"secret":...} [HTTP 200]     ← le vrai admin passe
{"error":"forbidden"} [HTTP 403]   ← token forgé refusé
{"error":"forbidden"} [HTTP 403]   ← ancien token d'un admin rétrogradé refusé
```

### ⑤ Prouver
```bash
make test T=m1-role-escalation
```

---

## Faille 5 — SSRF (Server-Side Request Forgery)

**Le contexte.** Un vendeur importe l'image d'un produit en donnant une URL. Le **serveur** va la chercher.

### ① Exploiter
```bash
make seed
CAROL=$(login carol@example.com)
ssrf() { curl -s -m 10 -w " [HTTP %{http_code}]" -X POST $B/api/products/import-image \
  -H "Authorization: Bearer $CAROL" -H 'content-type: application/json' -d "{\"url\":\"$1\"}"; echo; }

ssrf "http://localhost:3000/api/health"
ssrf "http://localhost:3000/api/admin/summary"
ssrf "http://redis:6379/"
```
Réponses :
```
{"imported":true,"upstreamStatus":200,"contentType":"application/json; charset=utf-8"} [HTTP 200]
{"imported":true,"upstreamStatus":401,"contentType":"application/json; charset=utf-8"} [HTTP 200]
{"error":"fetch failed","stack":"TypeError: fetch failed\n    at ..."} [HTTP 500]
```
🔴 Ce n'est pas une image : le serveur a appelé **ses propres routes internes** (`localhost`) et tenté de joindre **Redis** (`redis`, un service interne que ton navigateur ne voit même pas). On apprend même si un service répond (200/401) ou pas (`fetch failed`).

> 🌍 En vrai (cloud), la cible classique est `http://169.254.169.254/` : le service de métadonnées qui distribue des identifiants. Ne l'essaie pas ici (pas de cloud), mais retiens-le.

### ② Comprendre
Dans `app/src/lib/http-client.ts` : `fetch(url)` avec l'URL du client, sans aucun contrôle. Le serveur est *à l'intérieur* du réseau : il joint ce que l'attaquant ne peut pas joindre. On lui fait faire le sale boulot.
> Toute URL fournie par un utilisateur et **appelée par le serveur** est une porte d'entrée vers le réseau interne.

### ③ Corriger
`make hint M=m1-ssrf` si besoin.

**Solution** (`app/src/lib/http-client.ts`) :
```ts
import { lookup } from 'node:dns/promises'
import net from 'node:net'

const ALLOWED_HOSTS = new Set(['images.example.com'])

function isPrivate(ip: string): boolean {
  return /^(10\.|127\.|169\.254\.|192\.168\.|::1|fc|fd)/.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
}

export async function fetchImage(url: string) {
  const u = new URL(url)
  // 1. https uniquement + hôte autorisé
  if (u.protocol !== 'https:' || !ALLOWED_HOSTS.has(u.hostname))
    throw Object.assign(new Error('blocked'), { status: 400 })
  // 2. l'hôte ne doit pas résoudre vers une adresse privée
  const { address } = await lookup(u.hostname)
  if (net.isIP(address) && isPrivate(address))
    throw Object.assign(new Error('blocked'), { status: 400 })
  // 3. ne pas suivre les redirections (elles pourraient pointer vers l'interne)
  const res = await fetch(url, { redirect: 'error' })
  return { status: res.status, contentType: res.headers.get('content-type') }
}
```

### ④ Vérifier
```bash
ssrf "http://localhost:3000/api/health"
ssrf "http://redis:6379/"
```
✅ Attendu : les deux → `{"error":"invalid request body"} [HTTP 400]` (le message est générique, l'important est le 400 : **refusé avant tout appel réseau**).

### ⑤ Prouver
```bash
make test T=m1-ssrf
```

> 🎯 **Pour les seniors** : cette correction a une limite. On résout le nom (`lookup`), puis `fetch` le résout **une seconde fois**. Un attaquant qui contrôle un DNS peut répondre une IP publique la 1ʳᵉ fois et `127.0.0.1` la 2ᵉ (*DNS rebinding*). Comment fermer cette fenêtre ? *(piste : se connecter directement à l'IP déjà validée.)*

---

## Bilan (10 min)

```bash
make test
```
Au départ : **10 tests de sécurité rouges, 7 verts**. Une fois tout corrigé : **17 verts**.

| Faille | Le réflexe à retenir |
|---|---|
| IDOR | Vérifier l'**appartenance** de l'objet, pas seulement la connexion. 404 > 403. |
| Mass assignment | **Liste blanche** des champs acceptés. |
| Over-fetching | **Liste blanche** des colonnes renvoyées. |
| Rôle non revérifié | Un token est une photo du passé : relire l'état **actuel** pour les droits. |
| SSRF | Ne jamais appeler une URL fournie par l'utilisateur sans liste blanche. |

**Le fil rouge** : dans les 5 cas, le code « marche » et *a l'air correct*. La faille n'est pas un bug visible, c'est une **hypothèse jamais vérifiée** (« le client enverra son id… / seulement le nom… / ce token dit vrai… »).

**Pour repartir de zéro** : `make reset` (⚠️ efface ton code). **Pour finir** : `make down`.

---

# Notes pour l'animateur

**Déroulé conseillé (3 h)** : préparation 10 min · IDOR 30 min (démo commune, c'est le modèle) · mass assignment 25 · over-fetching 20 · rôle 35 · SSRF 35 · bilan 10 · marge 15.

**Avant la salle** (la veille) : `make check` sur une machine « comme les leurs » ; `make down && make up M=m1` doit finir en ~10 s ; vérifier que les ports 3000/5432/6379 sont libres.

**Pièges fréquents**
- Un port occupé (3000/5432) : `make check` le dit en rouge. C'est le problème n°1 en salle.
- « Ma correction ne change rien » : vérifier que le fichier est bien dans `app/src/` et attendre ~2 s (rechargement automatique). `docker compose -f docker-compose.base.yml logs app` montre une éventuelle erreur de syntaxe.
- Un token reste valable après `make seed` (les ids sont stables). C'est voulu, et c'est exactement ce qu'exploite la faille 4.
- `make reset` détruit le travail : à ne dire qu'en connaissance de cause.
- Après `make test`, la base contient des données de test : faire `make seed` avant de rejouer une attaque à la main.

**Questions pour lancer la discussion**
1. IDOR : « UUID au lieu d'entiers séquentiels : ça règle le problème ? » *(Non, ça le masque : sans contrôle d'appartenance, un UUID fuité donne accès.)*
2. Mass assignment : « Une liste noire (`delete body.role`) suffit ? » *(Non : on oublie le prochain champ sensible.)*
3. Rôle : « Pourquoi ne pas simplement raccourcir la durée du token ? » *(Réduit la fenêtre, ne la ferme pas ; et coûte en UX.)*
4. SSRF : « Et si on interdit seulement `localhost` ? » *(`127.1`, `0x7f000001`, un DNS qui pointe vers 127.0.0.1, une redirection…)*

**Honnêteté sur les limites du lab** : la faille 4 (scénario B) ne fonctionne que parce que le secret JWT est public ; un senior le remarquera. C'est voulu : dites-le, et faites le pont vers le module Secrets (M5).
