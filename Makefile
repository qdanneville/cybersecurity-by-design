COMPOSE := docker compose -f docker-compose.base.yml

.PHONY: check up down seed reset test solution hint

check:
	@bash tools/check.sh

up:
	@test -n "$(M)" || (echo "usage: make up M=m1"; exit 1)
	@overlay=$$(ls labs/$(M)-*/overlay.yml 2>/dev/null | head -1); \
	 args="-f docker-compose.base.yml"; \
	 if [ -n "$$overlay" ]; then args="$$args -f $$overlay"; echo "overlay: $$overlay"; fi; \
	 docker compose $$args up -d --build
	@echo "attente de l'app..."; \
	 for i in $$(seq 1 60); do \
	   $(COMPOSE) exec -T app wget -qO- http://localhost:3000/api/health >/dev/null 2>&1 && break; sleep 1; done
	@$(MAKE) --no-print-directory seed

# Re-seed the DB only (safe: does NOT touch your code, unlike `make reset`).
seed:
	$(COMPOSE) exec -T app npm run db:seed

down:
	$(COMPOSE) down -v

reset:
	$(COMPOSE) exec -T app npm run db:migrate
	$(COMPOSE) exec -T app npm run db:seed
	git checkout -- app/src

# make test            -> toute la suite
# make test T=m1-idor  -> un seul spec (tests/security/m1-idor.spec.ts)
test:
	$(COMPOSE) exec -T app npm test -- $(if $(T),tests/security/$(T).spec.ts,)

solution:
	@test -n "$(M)" || (echo "usage: make solution M=m1-idor"; exit 1)
	@test -f solutions/$(M).patch || (echo "no patch solutions/$(M).patch"; exit 1)
	@git apply --check solutions/$(M).patch \
	  || (echo "patch n'applique pas (déjà appliqué ? code modifié ?)"; exit 1)
	@git apply solutions/$(M).patch && echo "patch $(M) appliqué"

hint:
	@test -n "$(M)" || (echo "usage: make hint M=m1-idor"; exit 1)
	@bash tools/hint.sh $(M)
