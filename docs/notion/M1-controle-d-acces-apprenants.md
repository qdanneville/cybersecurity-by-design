# M1 — Contrôle d'accès

<aside>
⏱️ **Durée** : ~3 h  ·  👥 **Format** : binôme (1 junior + 1 senior)  ·  🎯 **Objectif** : attaquer une boutique vulnérable, comprendre, **corriger toi-même**, puis **prouver** que c'est corrigé.
</aside>

<aside>
⚠️ **Cadre légal** : tu attaques **uniquement ce lab**, sur ta machine. Jamais un système réel sans autorisation écrite.
</aside>

## Au programme

| # | Faille | Ce que tu vas faire |
|---|---|---|
| 1 | **IDOR** | Lire la commande d'un autre client |
| 2 | **Mass assignment** | Te donner toi-même le rôle ADMIN |
| 3 | **Sur-exposition de données** | Voir les hash de mots de passe de tous les utilisateurs |
| 4 | **Rôle non revérifié** | Garder des droits admin qu'on t'a retirés |
| 5 | **SSRF** | Faire faire des requêtes internes au serveur |

---

# Partie A — Comprendre le JWT (à lire avant de commencer)

Toutes les failles de ce module tournent autour d'un **token JWT**. Prends 5 minutes pour comprendre ce que c'est.

## L'analogie : le ticket de concert tamponné

Tu te connectes (email + mot de passe). Le serveur te remet un **ticket** avec ton identité écrite dessus, **tamponné** avec son tampon officiel. Ensuite tu n'as plus qu'à montrer ce ticket : le serveur n'a pas besoin de te redemander ton mot de passe.

Un JWT (*JSON Web Token*) est ce ticket. Il a **3 morceaux séparés par des points** :

```
eyJhbGciOiJIUzI1NiIs...  .  eyJzdWIiOjEsImVtYWls...  .  G_HIpCxTM6eUUHC9...
      ① EN-TÊTE                    ② CONTENU                  ③ SIGNATURE
```

| Morceau | Ce que c'est | Dans notre lab |
|---|---|---|
| ① En-tête | Comment le ticket est tamponné | `{"alg":"HS256","typ":"JWT"}` |
| ② Contenu (*payload*) | **Les infos écrites sur le ticket** | `{"sub":1,"email":"alice@example.com","role":"CUSTOMER","exp":...}` |
| ③ Signature | **Le tampon** | `G_HIpCxTM6...` |

## Pourquoi peut-on le lire en clair ?

Parce que **les morceaux ① et ② ne sont pas chiffrés**. Ils sont seulement *encodés en base64* : une écriture qui se décode en une seconde, **sans aucun mot de passe**. C'est de la mise en forme, pas du secret.

<aside>
💡 Un ticket de concert est lisible par tout le monde. Ce qui compte, c'est qu'on ne puisse pas le **falsifier**. Conséquence : **ne jamais mettre de secret dans un JWT** (mot de passe, numéro de carte…).
</aside>

## À quoi sert la signature ?

Elle ne cache rien. Elle **prouve que personne n'a touché au contenu**. Elle est calculée à partir du contenu **et d'un secret que seul le serveur connaît** (chez nous `JWT_SECRET`) :

```
signature = calcul( en-tête + contenu + SECRET_DU_SERVEUR )
```

Quand tu présentes ton ticket, le serveur refait le calcul avec son secret :

- même résultat que la signature du ticket → **authentique et intact** ✅
- résultat différent → **quelqu'un a modifié quelque chose** ❌

## La preuve sur le vrai serveur

Alice modifie son contenu (`"role":"CUSTOMER"` → `"role":"ADMIN"`) mais garde l'ancienne signature :

```
contenu modifié -> {"sub":1,"email":"alice@example.com","role":"ADMIN",...}
{"error":"invalid token"} [HTTP 401]     ← ticket modifié : refusé
{"error":"forbidden"} [HTTP 403]         ← son vrai token : simple client
```

Elle peut réécrire le contenu, mais sans le secret elle **ne peut pas recalculer une signature valide**.

## Ce que la signature garantit… et ne garantit pas

| Garantit | Ne garantit **pas** |
|---|---|
| « Ce contenu vient bien du serveur » | « Ce contenu est **encore vrai** aujourd'hui » |
| « Personne ne l'a modifié depuis » | « Le rôle n'a pas changé depuis le login » |

<aside>
🎯 **C'est exactement la faille 4** : le ticket dit « ADMIN », signé, valable 2 h. Si l'admin est rétrogradé en base, le ticket, lui, ne change pas.
</aside>

---

# Partie B — Préparation (10 min)

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

<aside>
🛠️ **Sous zsh (macOS)** ce bloc évite déjà deux pièges : le `!` du mot de passe est entre *quotes simples* (sinon `zsh: event not found`), et la 1ʳᵉ ligne autorise les commentaires `#` collés (sinon `zsh: bad pattern`). **Si tu ouvres un nouveau terminal, recolle le bloc.**
</aside>

## Les comptes (mot de passe pour tous : `Password123!`)

| Email | Rôle | id |
|---|---|---|
| alice@example.com | CUSTOMER | 1 |
| bob@example.com | CUSTOMER | 2 |
| carol@example.com | SELLER | 3 |
| admin@example.com | ADMIN | 4 |

## Vérifie que ça marche

```bash
ALICE=$(login alice@example.com); echo ${ALICE:0:30}...
```

→ tu dois voir `eyJhbGciOiJIUzI1NiIsInR5cCI6...`

<aside>
ℹ️ `${ALICE:0:30}` n'affiche que les **30 premiers caractères** (aperçu). La variable `$ALICE` contient bien le token **complet**, c'est elle que les commandes suivantes utilisent. Ne copie pas l'aperçu tronqué.
</aside>

## À toi de jouer : lire ton propre token

```bash
node -e 'console.log(Buffer.from(process.argv[1].split(".")[1],"base64url").toString())' "$ALICE"
```

Tu lis le contenu du token : `sub`, `email`, **`role`**. Garde `role` en tête pour la faille 4. (Tu peux aussi coller le token complet sur https://jwt.io.)

**Essaie de tricher** : change le rôle sans toucher à la signature.

```bash
H=$(echo $ALICE | cut -d. -f1); S=$(echo $ALICE | cut -d. -f3)
P2=$(node -e 'const p=JSON.parse(Buffer.from(process.argv[1],"base64url").toString()); p.role="ADMIN"; console.log(Buffer.from(JSON.stringify(p)).toString("base64url"))' "$(echo $ALICE | cut -d. -f2)")
curl -s -w " [HTTP %{http_code}]" $B/api/admin/summary -H "Authorization: Bearer $H.$P2.$S"
```

→ `{"error":"invalid token"} [HTTP 401]` : la signature ne correspond plus.

## Les commandes utiles pendant tout le module

| Commande | Effet |
|---|---|
| `make test` | Lance tous les tests (au départ, les tests de sécurité sont **rouges** : c'est normal) |
| `make test T=m1-idor` | Lance un seul test |
| `make hint M=m1-idor` | Indice suivant (3 niveaux, du plus vague au plus précis) |
| `make solution M=m1-idor` | Applique la correction de référence (filet de sécurité) |
| `make seed` | Remet les données à zéro (**sans** toucher à ton code) |
| `make reset` | Remet **données ET code** à l'état vulnérable (⚠️ efface tes corrections) |

## La boucle, pour chaque faille

**① Exploiter → ② Comprendre → ③ Corriger → ④ Vérifier → ⑤ Prouver**

Ton code est dans `app/src/`. Quand tu le sauvegardes, le serveur redémarre tout seul (2 s).

---

# Faille 1 — IDOR (accès direct à un objet)

<aside>
📰 **Le contexte** : un client se plaint : « je vois la commande d'un autre ! »
</aside>

## ① Exploiter

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

## ② Comprendre

Ouvre `app/src/modules/orders/orders.routes.ts`. Le code vérifie que tu es **connecté** (`requireAuth`) mais jamais que la commande est **à toi**.

<aside>
💡 **Authentifié ≠ autorisé.** « Qui es-tu ? » et « As-tu le droit de voir ça ? » sont deux questions différentes.
</aside>

## ③ Corriger

Essaie seul d'abord.

<details>
<summary>💬 Indices (3 niveaux)</summary>

1. Que compare le handler avant de renvoyer la commande ? Regarde s'il vérifie à *qui* elle appartient.
2. L'utilisateur connecté est dans `req.user`. La commande a un champ `userId`. Que se passe-t-il s'ils sont différents ?
3. Renvoie **404** (pas 403) quand la commande n'existe pas OU n'est pas à toi. Condition : `!order || order.userId !== req.user!.id`.

</details>

<details>
<summary>✅ Solution</summary>

```ts
const order = rows[0]
// 404 si elle n'existe pas OU si elle n'est pas à toi
if (!order || order.userId !== req.user!.id) { res.status(404).json({ error: 'not found' }); return }
res.json(order)
```

</details>

## ④ Vérifier

```bash
curl -s -w " [HTTP %{http_code}]" $B/api/orders/2 -H "Authorization: Bearer $ALICE"
curl -s -w " [HTTP %{http_code}]" $B/api/orders/1 -H "Authorization: Bearer $ALICE"
```

✅ Attendu :

```
{"error":"not found"} [HTTP 404]                       ← la commande de Bob est refusée
{"id":1,"userId":1,"totalCents":8900,...} [HTTP 200]   ← la sienne marche toujours
```

## ⑤ Prouver

```bash
make test T=m1-idor
```

Avant ta correction : ❌ 1 test échoue. Après : ✅ 2 passent. Ouvre `app/tests/security/m1-idor.spec.ts` et lis-le : c'est **le modèle** pour écrire tes propres tests de non-régression.

<aside>
🎯 **Pourquoi 404 et pas 403 ?** Avec 403, on répond « cette commande existe mais n'est pas à toi » : l'attaquant sait quels ids existent. Avec 404, une commande inexistante et une commande interdite sont **indiscernables**.
</aside>

---

# Faille 2 — Mass assignment

<aside>
📰 **Le contexte** : le profil permet de changer son nom. Que se passe-t-il si on envoie *plus* que le nom ?
</aside>

## ① Exploiter

```bash
make seed
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

## ② Comprendre

Dans `app/src/modules/users/users.routes.ts` :

```ts
.set({ ...req.body })     // ← copie TOUT ce que le client envoie
```

Le développeur pense « le client enverra `name` ». Mais **le client envoie ce qu'il veut**.

<aside>
💡 Ne jamais faire confiance à la *forme* de ce qui arrive : c'est toi qui choisis les champs, pas le client.
</aside>

## ③ Corriger

<details>
<summary>💬 Indices (3 niveaux)</summary>

1. Regarde ce qui est passé à `.set(...)`. D'où vient cet objet ? Qui contrôle son contenu ?
2. `{ ...req.body }` copie TOUS les champs envoyés par le client, y compris `role`. Quels champs un utilisateur a-t-il le droit de modifier sur son profil ?
3. Liste blanche : extrais seulement ce qui est autorisé (`const { name } = req.body`) et ne passe que ça à `.set({ name })`.

</details>

<details>
<summary>✅ Solution</summary>

```ts
const { name } = req.body ?? {}
const updated = await db.update(schema.users)
  .set({ name })                       // seulement ce qu'on autorise
  .where(eq(schema.users.id, req.user!.id))
  .returning()
```

</details>

## ④ Vérifier

```bash
make seed
ALICE=$(login alice@example.com)
curl -s -X PATCH $B/api/users/me -H "Authorization: Bearer $ALICE" \
  -H 'content-type: application/json' -d '{"name":"Alice2","role":"ADMIN"}'
```

✅ Attendu : `"name":"Alice2"` (accepté) mais `"role":"CUSTOMER"` (ignoré).

## ⑤ Prouver

```bash
make test T=m1-mass-assignment
```

<aside>
🔎 **Question pour les seniors** : regarde bien la réponse de ta version corrigée. Vois-tu encore quelque chose qui ne devrait pas y être ? *(indice : c'est l'objet de la faille 3.)*
</aside>

---

# Faille 3 — Sur-exposition de données (over-fetching)

<aside>
📰 **Le contexte** : le back-office liste les utilisateurs. Que voit vraiment le front ?
</aside>

## ① Exploiter

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

Un simple client, lui, est bien bloqué :

```bash
ALICE=$(login alice@example.com)
curl -s -w " [HTTP %{http_code}]" $B/api/users -H "Authorization: Bearer $ALICE"
```

→ `{"error":"forbidden"} [HTTP 403]`. Le contrôle d'accès est correct ici : le problème est **ce que renvoie** la route, pas **qui** peut l'appeler.

## ② Comprendre

```ts
const rows = await db.select().from(schema.users)   // ← toutes les colonnes
res.json(rows)                                       // ← toutes envoyées
```

Avec Drizzle, `select()` sans argument ramène **toutes** les colonnes, `passwordHash` compris. Le jour où on ajoute une colonne sensible, elle fuit automatiquement.

<aside>
💡 Défaut sûr = **liste blanche** des colonnes qui sortent, pas liste noire de celles qui ne sortent pas.
</aside>

## ③ Corriger

<details>
<summary>💬 Indices (3 niveaux)</summary>

1. Que renvoie `db.select().from(schema.users)` ? Regarde la réponse JSON complète, champ par champ.
2. `select()` sans argument ramène TOUTES les colonnes, `passwordHash` compris. Drizzle accepte un objet pour choisir les colonnes.
3. `db.select({ id: schema.users.id, email: ..., name: ..., role: ... }).from(schema.users)` : tu nommes ce qui sort, le reste ne sort jamais.

</details>

<details>
<summary>✅ Solution</summary>

```ts
const rows = await db.select({
  id: schema.users.id, email: schema.users.email,
  name: schema.users.name, role: schema.users.role,
}).from(schema.users)
```

</details>

## ④ Vérifier

```bash
ADMIN=$(login admin@example.com)
curl -s $B/api/users -H "Authorization: Bearer $ADMIN" | jq -c '.[0]'
```

✅ Attendu : `{"id":1,"email":"alice@example.com","name":"Alice","role":"CUSTOMER"}` : plus de `passwordHash`.

## ⑤ Prouver

```bash
make test T=m1-overfetch
```

<aside>
➕ **Bonus** : la route `PATCH /api/users/me` (faille 2) renvoie elle aussi `passwordHash`, même corrigée. Corrige-la avec la même idée.
</aside>

---

# Faille 4 — Rôle non revérifié

<aside>
📰 **Le contexte** : l'admin est rétrogradé. Ses droits disparaissent-ils vraiment ?
</aside>

## ① Exploiter

Le rôle voyage **dans le token** (partie A). Le serveur le croit sans jamais vérifier en base.

### Scénario A — le token périmé (aucun piratage nécessaire)

```bash
make seed
ADMIN=$(login admin@example.com)
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
{"secret":"chiffre-affaires-interne",...} [HTTP 200]      ← 🔴 plus admin, l'accès reste
```

🔴 En base il est `CUSTOMER`, mais son token dit toujours `ADMIN` (valable 2 h) : le serveur croit le token.

### Scénario B — le token forgé

Le secret de signature est celui du `.env.example`, **public dans le dépôt**.

```bash
make seed
FORGED=$(cd app && node -e "console.log(require('jsonwebtoken').sign({sub:1,email:'alice@example.com',role:'ADMIN'},'dev-not-secret-change-me',{expiresIn:'2h'}))")
curl -s -w " [HTTP %{http_code}]" $B/api/admin/summary -H "Authorization: Bearer $FORGED"
```

→ `{"secret":"chiffre-affaires-interne",...} [HTTP 200]` 🔴 Alice (CUSTOMER) s'est fabriqué un badge admin.

<aside>
ℹ️ Le scénario B n'est possible que parce que le **secret est connu** : c'est un autre problème (gestion des secrets, module M5). Mais notre correction protège contre **les deux** : même avec un token parfaitement signé, on ne se fie plus à son contenu pour les droits.
</aside>

## ② Comprendre

Dans `app/src/middleware/auth.ts` : `req.user = { …, role: claims.role }`. Le rôle vient du token et **n'est jamais revérifié**. Un token est une photo du passé : il ne sait pas que les droits ont changé.

<aside>
💡 Une décision d'autorisation sensible doit s'appuyer sur l'état **actuel**, pas sur ce que le token affirmait au login.
</aside>

## ③ Corriger

<details>
<summary>💬 Indices (3 niveaux)</summary>

1. D'où `requireRole('ADMIN')` tire-t-il le rôle ? Va lire `middleware/auth.ts`. Est-ce une donnée fraîche ?
2. Le rôle vient du **claim du JWT**, figé au moment du login. Si le rôle change en base (ou si le token est forgé), le claim ment.
3. Sur la route sensible, relis le rôle **en base** avec `req.user.id` avant d'autoriser, et réponds 403 si ce n'est pas ADMIN.

</details>

<details>
<summary>✅ Solution (fichier app/src/modules/admin/admin.routes.ts)</summary>

```ts
import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { db, schema } from '../../db/index.js'
import { requireAuth } from '../../middleware/auth.js'

export const adminRouter = Router()

adminRouter.get('/summary', requireAuth, async (req, res, next) => {
  const rows = await db.select({ role: schema.users.role })
    .from(schema.users).where(eq(schema.users.id, req.user!.id))
  if (rows[0]?.role !== 'ADMIN') { res.status(403).json({ error: 'forbidden' }); return }
  next()
}, (_req, res) => res.json({ secret: 'chiffre-affaires-interne', totalCents: 1234567 }))
```

</details>

## ④ Vérifier

Rejoue les scénarios A et B (avec `make seed` avant chacun). ✅ Attendu :

```
{"secret":...} [HTTP 200]          ← le vrai admin passe
{"error":"forbidden"} [HTTP 403]   ← token forgé refusé
{"error":"forbidden"} [HTTP 403]   ← ancien token d'un admin rétrogradé refusé
```

## ⑤ Prouver

```bash
make test T=m1-role-escalation
```

---

# Faille 5 — SSRF (Server-Side Request Forgery)

<aside>
📰 **Le contexte** : un vendeur importe l'image d'un produit en donnant une URL. C'est le **serveur** qui va la chercher.
</aside>

## ① Exploiter

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

<aside>
🌍 En vrai (cloud), la cible classique est `http://169.254.169.254/` : le service de métadonnées qui distribue des identifiants. Ne l'essaie pas ici (pas de cloud), mais retiens-le.
</aside>

## ② Comprendre

Dans `app/src/lib/http-client.ts` : `fetch(url)` avec l'URL du client, sans aucun contrôle. Le serveur est *à l'intérieur* du réseau : il joint ce que l'attaquant ne peut pas joindre. On lui fait faire le sale boulot.

<aside>
💡 Toute URL fournie par un utilisateur et **appelée par le serveur** est une porte d'entrée vers le réseau interne.
</aside>

## ③ Corriger

<details>
<summary>💬 Indices (3 niveaux)</summary>

1. Que fait `fetchImage(url)` de l'URL reçue ? Qui choisit la destination : toi ou l'utilisateur ?
2. L'utilisateur peut viser `localhost`, `redis`, une IP privée… des choses que ton serveur atteint mais pas lui. Il faut décider **où** le serveur a le droit d'aller.
3. Liste blanche d'hôtes (https uniquement), résolution DNS + refus des plages privées (10/8, 127/8, 172.16/12, 192.168/16, 169.254/16), et `redirect: 'error'` pour ne pas suivre une redirection vers l'interne.

</details>

<details>
<summary>✅ Solution (fichier app/src/lib/http-client.ts)</summary>

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

</details>

## ④ Vérifier

```bash
ssrf "http://localhost:3000/api/health"
ssrf "http://redis:6379/"
```

✅ Attendu : les deux → `{"error":"invalid request body"} [HTTP 400]`. Le message est générique, l'important est le 400 : **refusé avant tout appel réseau**.

## ⑤ Prouver

```bash
make test T=m1-ssrf
```

<aside>
🎯 **Pour les seniors** : cette correction a une limite. On résout le nom (`lookup`), puis `fetch` le résout **une seconde fois**. Un attaquant qui contrôle un DNS peut répondre une IP publique la 1ʳᵉ fois et `127.0.0.1` la 2ᵉ (*DNS rebinding*). Comment fermer cette fenêtre ? *(piste : se connecter directement à l'IP déjà validée.)*
</aside>

---

# Bilan

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

<aside>
🧵 **Le fil rouge** : dans les 5 cas, le code « marche » et *a l'air correct*. La faille n'est pas un bug visible, c'est une **hypothèse jamais vérifiée** (« le client enverra son id… / seulement le nom… / ce token dit vrai… »).
</aside>

**Pour repartir de zéro** : `make reset` (⚠️ efface ton code). **Pour finir** : `make down`.
