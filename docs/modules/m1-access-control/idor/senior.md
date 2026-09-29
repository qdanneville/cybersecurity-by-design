# Piste senior — IDOR

Une PR t'est soumise (faille non annoncée) : le handler renvoie 403 quand la
commande ne t'appartient pas. Pourquoi préférer 404 ? Écris le test qui
distingue les deux comportements et défends le choix en revue.

Bonus : l'`id` est un entier séquentiel. Discute UUID v7 vs. contrôle d'accès —
lequel résout réellement le problème, lequel ne fait que le masquer.
