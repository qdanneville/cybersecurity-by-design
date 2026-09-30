# M1 — Notes animateur (ne pas partager)

<aside>
🔒 Page privée. La page apprenants contient les solutions dans des toggles fermés : à toi de décider quand les ouvrir.
</aside>

## Déroulé conseillé (3 h)

| Durée | Séquence | Mode |
|---|---|---|
| 5 min | Partie A : le JWT (à lire ou à dessiner au tableau) | Collectif |
| 10 min | Préparation : `make check`, `make up M=m1`, bloc zsh | Binômes |
| 30 min | Faille 1 IDOR | **Démo commune** : c'est le modèle de la boucle |
| 25 min | Faille 2 Mass assignment | Binômes |
| 20 min | Faille 3 Over-fetching | Binômes |
| 35 min | Faille 4 Rôle non revérifié | Binômes |
| 35 min | Faille 5 SSRF | Binômes |
| 10 min | Bilan : `make test` doit afficher 17 verts | Collectif |
| 10 min | Marge | |

## La veille

- [ ] `make check` sur une machine « comme les leurs » (vert : docker, curl, **jq**, node, RAM, ports).
- [ ] `make down && make up M=m1` doit finir en ~10 s (images déjà téléchargées). Sur un poste vierge, prévoir le téléchargement des images.
- [ ] Ports **3000 / 5432 / 6379** libres. C'est le premier problème en salle.
- [ ] Faire passer la consigne : installer `jq` (`brew install jq` / `apt install jq`).

## Pièges fréquents

- **Port occupé** (3000, 5432) : `make check` l'affiche en rouge.
- **« Ma correction ne change rien »** : le fichier est-il bien dans `app/src/` ? Attendre ~2 s (rechargement automatique). Une erreur de syntaxe se voit avec `docker compose -f docker-compose.base.yml logs app`.
- **Nouveau terminal** : les fonctions `login`, `$B`, `$PW` sont perdues. Recoller le bloc de préparation.
- **`make reset` détruit le travail** : ne le dire qu'en connaissance de cause. `make seed` remet seulement les données.
- **Un token reste valable après `make seed`** (les ids sont stables). C'est voulu : c'est exactement ce qu'exploite la faille 4.
- **Après `make test`**, la base contient des données de test : faire `make seed` avant de rejouer une attaque à la main.
- **Les fichiers de test sont visibles** dans `app/tests/security/`. Tu peux les traiter comme la « définition de fini », ou demander aux binômes de ne pas les ouvrir avant d'avoir corrigé.

## Questions pour lancer la discussion

<details>
<summary>1. IDOR : « UUID au lieu d'entiers séquentiels, ça règle le problème ? »</summary>

Non, ça le **masque**. Sans contrôle d'appartenance, un UUID qui fuite (log, URL partagée, email) donne l'accès. L'UUID réduit la devinabilité, il ne remplace pas l'autorisation.

</details>

<details>
<summary>2. Mass assignment : « Une liste noire (<code>delete body.role</code>) suffit ? »</summary>

Non : on oublie le prochain champ sensible (`isVerified`, `balance`…). La liste **blanche** est sûre par défaut, la liste noire ne l'est pas.

</details>

<details>
<summary>3. Rôle : « Pourquoi ne pas juste raccourcir la durée du token ? »</summary>

Ça **réduit** la fenêtre sans la fermer, et ça dégrade l'expérience (reconnexions). La vraie réponse est de relire l'état actuel pour les décisions sensibles. Compromis courant : tokens courts + refresh token révocable.

</details>

<details>
<summary>4. SSRF : « Et si on interdit seulement <code>localhost</code> ? »</summary>

Contournements : `127.1`, `0x7f000001`, `[::1]`, un nom DNS qui pointe vers 127.0.0.1, une redirection vers l'interne, et le *DNS rebinding*. D'où la liste blanche d'hôtes plutôt qu'une liste noire d'adresses.

</details>

## Honnêteté sur les limites du lab

<aside>
⚠️ **Faille 4, scénario B** : le token forgé ne fonctionne que parce que le secret JWT est public dans `.env.example`. Un senior le remarquera : dis-le toi-même. C'est le pont naturel vers le module **Secrets (M5)**.
</aside>

<aside>
⚠️ **Faille 5, correction** : la liste blanche `images.example.com` est un exemple. Et la correction reste vulnérable au DNS rebinding (piste senior dans la page apprenants).
</aside>

## Ce que ce lab ne couvre pas (encore)

- Pas de module authentification/session (M3), ni OIDC (M4), ni secrets (M5), ni Kubernetes (M7). Ils viendront dans les plans suivants.
- Le lab n'a été exécuté de bout en bout que sur une seule machine (celle de l'auteur, images en cache). Une répétition sur poste vierge reste à faire.
