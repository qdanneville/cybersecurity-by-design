# Piste senior — SQLi par identifiant

Le développeur *a* utilisé le template tag et *a* paramétré `q`. Il est quand
même vulnérable via `?sort=`. Explique pourquoi un identifiant de colonne ne
peut pas être un paramètre lié, et pourquoi l'allow-list est la seule réponse
correcte (pas l'échappement). Étends l'allow-list au tri multi-colonnes sans
rouvrir la faille.
