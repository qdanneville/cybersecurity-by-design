# Le JWT pour les nuls

<aside>
⏱️ **Lecture** : 5 minutes  ·  🎯 **Tu sauras** : ce qu'est un JWT, pourquoi on peut le lire, à quoi sert la signature, et ce qu'elle ne garantit pas.
</aside>

## 1. L'analogie : le ticket de concert tamponné

Tu te connectes (email + mot de passe). Le serveur te remet un **ticket** avec ton identité écrite dessus, **tamponné** avec son tampon officiel.

Ensuite, tu n'as plus qu'à montrer ce ticket à chaque requête : le serveur n'a pas besoin de te redemander ton mot de passe, ni de chercher qui tu es dans sa base.

Ce ticket, c'est le **JWT** (*JSON Web Token*).

```
Toi                                   Serveur
 │  ── email + mot de passe ─────────▶  │  vérifie
 │  ◀───────── ton ticket (JWT) ──────  │  écrit ton identité + tamponne
 │                                      │
 │  ── requête + ticket ─────────────▶  │  vérifie le tampon, te laisse passer
```

## 2. À quoi ressemble un JWT ?

**3 morceaux séparés par des points** :

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 . eyJzdWIiOjEsImVtYWls...ImV4cCI6MTc5MDc0NTE4OH0 . G_HIpCxTM6eUUHC9dcLxA9MI8SFxdAfN3JUW8GVyUp4
            ① EN-TÊTE                              ② CONTENU (payload)                                ③ SIGNATURE
```

| Morceau | Rôle | Une fois décodé |
|---|---|---|
| ① En-tête | Dit comment le ticket est tamponné | `{"alg":"HS256","typ":"JWT"}` |
| ② Contenu | **Les infos écrites sur le ticket** | `{"sub":1,"email":"alice@example.com","role":"CUSTOMER","iat":...,"exp":...}` |
| ③ Signature | **Le tampon** | une suite de caractères, illisible |

Les champs du contenu (les « *claims* ») :

| Champ | Signification |
|---|---|
| `sub` | *subject* : à qui appartient le ticket (ici l'utilisateur n°1) |
| `email`, `role` | des infos que l'application choisit d'ajouter |
| `iat` | *issued at* : date de création |
| `exp` | *expires* : date d'expiration (après, le ticket est refusé) |

## 3. Pourquoi peut-on le lire en clair ?

Parce que **les morceaux ① et ② ne sont pas chiffrés**. Ils sont seulement *encodés en base64* : une écriture qui se décode en une seconde, **sans mot de passe ni clé**.

<aside>
💡 **Encoder ≠ chiffrer.** Encoder, c'est changer l'écriture (comme passer du français à l'anglais : tout le monde peut traduire). Chiffrer, c'est rendre illisible sans clé.
</aside>

Un ticket de concert est lisible par tout le monde. Ce qui compte, c'est qu'on ne puisse pas le **falsifier**.

<aside>
⚠️ **Conséquence** : ne mets **jamais de secret** dans un JWT (mot de passe, numéro de carte, données médicales…). Quiconque tient le token peut lire son contenu.
</aside>

## 4. À quoi sert la signature ?

Elle ne cache rien. Elle **prouve que personne n'a modifié le contenu**.

Elle est calculée à partir du contenu **et d'un secret que seul le serveur connaît** :

```
signature = calcul( en-tête + contenu + SECRET_DU_SERVEUR )
```

Quand tu présentes ton ticket, le serveur refait le même calcul avec son secret, puis compare :

| Résultat | Signification |
|---|---|
| Identique à la signature du ticket | ✅ Authentique et intact |
| Différent | ❌ Quelqu'un a modifié le ticket (ou l'a fabriqué sans connaître le secret) |

### Exemple : Alice essaie de tricher

Alice est `CUSTOMER`. Elle décode son ticket, remplace `"role":"CUSTOMER"` par `"role":"ADMIN"`, et garde l'ancienne signature :

```
contenu modifié : {"sub":1,"email":"alice@example.com","role":"ADMIN",...}

→ le serveur recalcule la signature du contenu modifié : elle ne correspond plus
→ {"error":"invalid token"}   HTTP 401
```

Alice peut réécrire le contenu, mais **sans le secret elle ne peut pas recalculer une signature valide**.

## 5. Ce que la signature garantit… et ne garantit pas

| ✅ Elle garantit | ❌ Elle ne garantit pas |
|---|---|
| « Ce contenu a été écrit par le serveur » | « Ce contenu est **encore vrai** aujourd'hui » |
| « Personne ne l'a modifié depuis » | « Le rôle n'a pas changé depuis la connexion » |
| | « Le ticket n'a pas été **volé** » |

<aside>
🎯 **Exemple concret** : Bob est admin, il se connecte : son ticket dit `"role":"ADMIN"` pour 2 heures. Une heure plus tard, on le rétrograde en base de données. Son ticket, lui, ne change pas : il dit toujours « ADMIN », avec une signature parfaitement valide. Si le serveur croit le ticket sans revérifier en base, Bob garde ses droits d'admin.
</aside>

## 6. Le point faible n°1 : le secret

Toute la sécurité repose sur **un seul secret**. Deux règles :

- 🔑 **S'il fuit, tout s'écroule.** Qui connaît le secret peut fabriquer un ticket avec n'importe quel contenu, et sa signature sera **valide** : le tampon officiel traîne sur la table.
- 🔑 **Il ne doit jamais être dans le dépôt Git**, ni faible (`secret`, `password`, `dev-not-secret-change-me`…).

## 7. À toi de jouer (5 min)

Voici un vrai token d'exemple :

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiYWxpY2VAZXhhbXBsZS5jb20iLCJyb2xlIjoiQ1VTVE9NRVIiLCJpYXQiOjE3OTA3Mzc5ODgsImV4cCI6MTc5MDc0NTE4OH0.G_HIpCxTM6eUUHC9dcLxA9MI8SFxdAfN3JUW8GVyUp4
```

1. Va sur **https://jwt.io** et colle-le dans la zone « Encoded ». Tu lis le contenu sans aucun secret.
2. Dans la zone de vérification de la signature, saisis le secret `dev-not-secret-change-me` → **« Signature Verified »** ✅
3. Remplace le secret par `autre-chose`. Que se passe-t-il ?
4. Colle maintenant ce **token trafiqué** (Alice est devenue `ADMIN`, mais la signature est l'ancienne), avec le bon secret `dev-not-secret-change-me`. Que se passe-t-il ?

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiYWxpY2VAZXhhbXBsZS5jb20iLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3OTA3Mzc5ODgsImV4cCI6MTc5MDc0NTE4OH0.G_HIpCxTM6eUUHC9dcLxA9MI8SFxdAfN3JUW8GVyUp4
```

<details>
<summary>✅ Réponses</summary>

3. Avec un mauvais secret, le calcul donne un autre résultat → **« Invalid Signature »**. Seul le bon secret valide ce ticket.
4. Le contenu dit `"role":"ADMIN"`, mais la signature a été calculée pour `"role":"CUSTOMER"` → **« Invalid Signature »**. Le contenu est lisible et modifiable, mais la modification se voit.

</details>

<aside>
ℹ️ Piège de jwt.io : si tu **modifies le contenu décodé** (colonne de droite) alors que le bon secret est saisi, le site **re-signe** le token pour toi et affiche « Signature Verified ». C'est normal : *tu* lui as donné le secret. Un attaquant, lui, ne l'a pas. C'est pour ça que l'étape 4 utilise un token déjà trafiqué.
</aside>

## 8. Ce qu'il faut retenir

| Question | Réponse |
|---|---|
| Un JWT est-il lisible par tous ? | **Oui.** Il est encodé, pas chiffré. |
| Peut-on y mettre un secret ? | **Jamais.** |
| Peut-on le modifier ? | **Non**, sans le secret : la signature casse. |
| Que garantit la signature ? | Ce contenu vient du serveur et n'a pas été touché. |
| Que ne garantit-elle pas ? | Que le contenu est **encore vrai** maintenant, ni que le ticket n'a pas été volé. |
| Quel est le point faible n°1 ? | Le **secret** de signature. |

<aside>
🧵 **La phrase à retenir** : un JWT est une **photo du passé, signée**. La signature prouve que la photo est authentique, pas que la réalité n'a pas changé depuis.
</aside>
