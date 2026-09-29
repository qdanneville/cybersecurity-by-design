COMPOSE := docker compose -f docker-compose.base.yml

.PHONY: check up down reset test solution hint

check:
	@bash tools/check.sh

up:
	@test -n "$(M)" || (echo "usage: make up M=m1"; exit 1)
	@overlay=$$(ls labs/$(M)-*/overlay.yml 2>/dev/null | head -1); \
	 args="-f docker-compose.base.yml"; \
	 if [ -n "$$overlay" ]; then args="$$args -f $$overlay"; echo "overlay: $$overlay"; fi; \
	 docker compose $$args up -d --build

down:
	$(COMPOSE) down -v

reset:
	$(COMPOSE) exec -T app npm run db:migrate
	$(COMPOSE) exec -T app npm run db:seed
	git checkout -- app/src

test:
	$(COMPOSE) exec -T app npm test

solution:
	@test -n "$(M)" || (echo "usage: make solution M=m1-idor"; exit 1)
	@test -f solutions/$(M).patch || (echo "no patch solutions/$(M).patch"; exit 1)
	@git apply --check solutions/$(M).patch \
	  || (echo "patch n'applique pas (déjà appliqué ? code modifié ?)"; exit 1)
	@git apply solutions/$(M).patch && echo "patch $(M) appliqué"

hint:
	@test -n "$(M)" || (echo "usage: make hint M=m1-idor"; exit 1)
	@bash tools/hint.sh $(M)
