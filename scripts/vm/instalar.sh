#!/usr/bin/env bash
# =============================================================================
# Escala ICI — instala/restaura o Escala ICI numa VM a partir de um backup
# gerado por scripts/vm/backup.sh (formato escala-ici-backup-v1).
#
#   sudo ./instalar.sh /caminho/escala-ici-backup-AAAAMMDD-HHMMSS.tar.gz.gpg
#
# Opções:
#   --sem-pacotes     não instala nada no sistema (Git, gpg, nginx, Docker, Node)
#   --sem-subir       restaura tudo, mas não constrói/sobe os containers
#   --repo URL        URL do repositório (padrão: a gravada no backup)
#   --senha-arquivo F lê a senha do backup de um arquivo (senão pergunta)
#
# O que faz, em ordem: confere o arquivo → instala pré-requisitos → abre o
# backup num diretório temporário (apagado no fim) e confere o MANIFESTO →
# clona/atualiza o código → devolve .env, segredos (com o GID certo), nginx +
# certificado e login do Firebase → sobe Dashboard e push-worker → testa.
# Nada existente é sobrescrito sem guardar uma cópia *.antes-restauracao-DATA.
# =============================================================================
set -euo pipefail

ESCALA_DIR="${ESCALA_DIR:-/root/projetos/Escala-ICI}"
OPT_DIR="${OPT_DIR:-/opt/escala-ici}"
NGINX_DIR="${NGINX_DIR:-/etc/nginx}"
NGINX_SSL_DIR="${NGINX_SSL_DIR:-/etc/nginx/ssl/escala-ici}"
FIREBASE_LOGIN="${FIREBASE_LOGIN:-/root/.config/configstore/firebase-tools.json}"
HOME_ROOT="${HOME_ROOT:-/root}"
# INSTALAR_TESTE=1 (só em testes): não exige root e só DESCREVE as ações de sistema.
INSTALAR_TESTE="${INSTALAR_TESTE:-0}"

ARQUIVO=""
SEM_PACOTES=0
SEM_SUBIR=0
REPO_URL=""
SENHA_ARQUIVO=""
CARIMBO="$(date +%Y%m%d-%H%M%S)"
RESUMO=()

uso() { sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --sem-pacotes) SEM_PACOTES=1; shift ;;
    --sem-subir) SEM_SUBIR=1; shift ;;
    --repo) REPO_URL="$2"; shift 2 ;;
    --senha-arquivo) SENHA_ARQUIVO="$2"; shift 2 ;;
    -h|--help) uso 0 ;;
    -*) echo "Opção desconhecida: $1" >&2; uso 1 ;;
    *) ARQUIVO="$1"; shift ;;
  esac
done

passo() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
ok()    { printf '  \033[32m✔\033[0m %s\n' "$*"; RESUMO+=("✔ $*"); }
aviso() { printf '  \033[33m!\033[0m %s\n' "$*"; RESUMO+=("! $*"); }
falha() { printf '  \033[31m✘\033[0m %s\n' "$*" >&2; RESUMO+=("✘ $*"); }
sistema() {
  # Ações que mexem no sistema (pacotes, grupos, serviços).
  if [ "$INSTALAR_TESTE" = 1 ]; then printf '  [teste] %s\n' "$*"; else "$@"; fi
}
guardar_existente() {
  # Antes de sobrescrever, guarda uma cópia do que já existe.
  if [ -e "$1" ]; then
    cp -a "$1" "$1.antes-restauracao-$CARIMBO"
    aviso "já existia $1 — cópia em $1.antes-restauracao-$CARIMBO"
  fi
}

[ -n "$ARQUIVO" ] || { echo "Informe o arquivo do backup (.tar.gz.gpg)." >&2; uso 1; }
[ -r "$ARQUIVO" ] || { echo "Arquivo não encontrado: $ARQUIVO" >&2; exit 1; }
if [ "$INSTALAR_TESTE" != 1 ] && [ "$(id -u)" -ne 0 ]; then
  echo "Rode como root (sudo $0 ...)." >&2; exit 1
fi

# ---------------------------------------------------------------------------
passo "1/7 Conferindo o arquivo do backup"
if [ -f "$ARQUIVO.sha256" ]; then
  ( cd "$(dirname "$ARQUIVO")" && sha256sum -c "$(basename "$ARQUIVO").sha256" >/dev/null ) \
    && ok "soma SHA-256 confere" || { falha "soma SHA-256 NÃO confere — arquivo corrompido"; exit 1; }
else
  aviso "sem o .sha256 ao lado do arquivo — integridade não verificada"
fi

# ---------------------------------------------------------------------------
passo "2/7 Pré-requisitos do sistema"
GERENCIADOR=""
command -v dnf >/dev/null 2>&1 && GERENCIADOR=dnf
[ -z "$GERENCIADOR" ] && command -v apt-get >/dev/null 2>&1 && GERENCIADOR=apt
if [ "$SEM_PACOTES" = 1 ]; then
  aviso "instalação de pacotes pulada (--sem-pacotes)"
else
  case "$GERENCIADOR" in
    dnf) sistema dnf -y install git gnupg2 nginx curl tar ;;
    apt) sistema apt-get update -y; sistema apt-get install -y git gnupg nginx curl tar ;;
    *) falha "gerenciador de pacotes não reconhecido — instale Git, gpg, nginx e curl à mão"; exit 1 ;;
  esac
  ok "Git, gpg, nginx e curl"
  if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
    if [ "$GERENCIADOR" = dnf ]; then
      sistema dnf -y install dnf-plugins-core
      sistema dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
      sistema dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    else
      sistema sh -c 'curl -fsSL https://get.docker.com | sh'
    fi
  fi
  sistema systemctl enable --now docker
  ok "Docker + Compose"
  if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -lt 22 ]; then
    if [ "$GERENCIADOR" = dnf ]; then
      sistema sh -c 'curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - && dnf -y install nodejs'
    else
      sistema sh -c 'curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs'
    fi
  fi
  ok "Node 22"
fi
command -v gpg >/dev/null 2>&1 || { falha "gpg não encontrado"; exit 1; }

# ---------------------------------------------------------------------------
passo "3/7 Abrindo o backup (num diretório temporário, apagado no final)"
UMASK_ORIGINAL="$(umask)"
umask 077   # só enquanto o backup está aberto
TRABALHO="$(mktemp -d "${TMPDIR:-/tmp}/escala-ici-restauracao.XXXXXX")"
trap 'rm -rf "$TRABALHO"; gpgconf --kill gpg-agent >/dev/null 2>&1 || true' EXIT
if [ -n "$SENHA_ARQUIVO" ]; then
  gpg --batch --pinentry-mode loopback --passphrase-file "$SENHA_ARQUIVO" --decrypt "$ARQUIVO" 2>/dev/null \
    | tar -xzf - -C "$TRABALHO" || { falha "não foi possível abrir o backup (senha errada?)"; exit 1; }
else
  echo "  Digite a senha do backup:"
  gpg --pinentry-mode loopback --decrypt "$ARQUIVO" 2>/dev/null \
    | tar -xzf - -C "$TRABALHO" || { falha "não foi possível abrir o backup (senha errada?)"; exit 1; }
fi
PASTA="$(find "$TRABALHO" -mindepth 1 -maxdepth 1 -type d | head -1)"
[ -f "$PASTA/MANIFESTO.txt" ] && grep -q '^formato: escala-ici-backup-v1' "$PASTA/MANIFESTO.txt" \
  || { falha "backup em formato desconhecido (gere um novo com scripts/vm/backup.sh)"; exit 1; }
( cd "$PASTA" && grep -E '^[0-9a-f]{64}  ' MANIFESTO.txt | sha256sum -c --quiet - ) \
  && ok "manifesto conferido: $(grep -cE '^[0-9a-f]{64}  ' "$PASTA/MANIFESTO.txt") itens íntegros" \
  || { falha "itens do backup não conferem com o manifesto"; exit 1; }
grep -E '^(gerado-em|host|commit):' "$PASTA/info/origem.txt" | sed 's/^/  · /'
umask "$UMASK_ORIGINAL"   # código e configurações com permissões normais (o segredo recebe chmod explícito)

# ---------------------------------------------------------------------------
passo "4/7 Código do GitHub"
if [ -f "$PASTA/credenciais/.git-credentials" ] && [ ! -f "$HOME_ROOT/.git-credentials" ]; then
  cp -p "$PASTA/credenciais/.git-credentials" "$HOME_ROOT/.git-credentials"
  chmod 600 "$HOME_ROOT/.git-credentials"; ok "credenciais do Git"
fi
if [ -f "$PASTA/credenciais/.gitconfig" ] && [ ! -f "$HOME_ROOT/.gitconfig" ]; then
  cp -p "$PASTA/credenciais/.gitconfig" "$HOME_ROOT/.gitconfig"; ok ".gitconfig"
fi
[ -n "$REPO_URL" ] || REPO_URL="$(sed -n 's/^repositorio: //p' "$PASTA/info/origem.txt")"
if [ -d "$ESCALA_DIR/.git" ]; then
  git -C "$ESCALA_DIR" pull --ff-only && ok "repositório atualizado em $ESCALA_DIR"
elif [ -n "$REPO_URL" ] && [ "$REPO_URL" != "?" ]; then
  mkdir -p "$(dirname "$ESCALA_DIR")"
  git clone "$REPO_URL" "$ESCALA_DIR" && ok "repositório clonado em $ESCALA_DIR"
else
  falha "sem URL do repositório (use --repo URL)"; exit 1
fi

# ---------------------------------------------------------------------------
passo "5/7 Devolvendo configurações e segredos"
for arquivo in "$PASTA"/env/.env*; do
  [ -e "$arquivo" ] || continue
  destino="$ESCALA_DIR/$(basename "$arquivo")"
  guardar_existente "$destino"
  cp -p "$arquivo" "$destino"; chmod 600 "$destino"
  ok "$(basename "$arquivo")"
done

GRUPO_LINHA="$(cat "$PASTA/info/grupo-segredo.txt" 2>/dev/null || true)"
if [ -n "$GRUPO_LINHA" ]; then
  GRUPO_NOME="$(echo "$GRUPO_LINHA" | cut -d: -f1)"
  GRUPO_GID="$(echo "$GRUPO_LINHA" | cut -d: -f3)"
  if getent group "$GRUPO_NOME" >/dev/null 2>&1; then
    gid_atual="$(getent group "$GRUPO_NOME" | cut -d: -f3)"
    [ "$gid_atual" = "$GRUPO_GID" ] && ok "grupo $GRUPO_NOME já existe (GID $GRUPO_GID)" \
      || aviso "grupo $GRUPO_NOME existe com GID $gid_atual (o backup usa $GRUPO_GID): ajuste PUSH_SECRET_GID no .env.staging.push-worker"
  elif getent group "$GRUPO_GID" >/dev/null 2>&1; then
    aviso "GID $GRUPO_GID já é usado por outro grupo — crie $GRUPO_NOME com outro GID e ajuste PUSH_SECRET_GID"
  else
    sistema groupadd -g "$GRUPO_GID" "$GRUPO_NOME"; ok "grupo $GRUPO_NOME criado (GID $GRUPO_GID)"
  fi
fi

if [ -f "$PASTA/opt-escala-ici.tar.gz" ]; then
  guardar_existente "$OPT_DIR"
  mkdir -p "$(dirname "$OPT_DIR")"
  tar -xzpf "$PASTA/opt-escala-ici.tar.gz" -C "$(dirname "$OPT_DIR")"
  if [ -n "${GRUPO_NOME:-}" ] && [ -d "$OPT_DIR/secrets" ]; then
    sistema chown -R root:"$GRUPO_NOME" "$OPT_DIR/secrets"
    sistema chmod 0700 "$OPT_DIR/secrets"
    for segredo in "$OPT_DIR"/secrets/*; do [ -f "$segredo" ] && sistema chmod 0440 "$segredo"; done
  fi
  ok "segredos em $OPT_DIR"
fi

if [ -d "$PASTA/nginx" ]; then
  for site in "$PASTA"/nginx/*.conf; do
    [ -e "$site" ] || continue
    destino="$NGINX_DIR/conf.d/$(basename "$site")"
    mkdir -p "$NGINX_DIR/conf.d"
    guardar_existente "$destino"
    cp -p "$site" "$destino"; ok "nginx: conf.d/$(basename "$site")"
  done
  if [ -d "$PASTA/nginx/ssl" ]; then
    guardar_existente "$NGINX_SSL_DIR"
    mkdir -p "$NGINX_SSL_DIR"
    cp -a "$PASTA/nginx/ssl/." "$NGINX_SSL_DIR/"
    find "$NGINX_SSL_DIR" -name '*.key' -exec chmod 600 {} +
    ok "certificado TLS em $NGINX_SSL_DIR"
  fi
  [ -f "$PASTA/nginx/nginx.conf.referencia" ] && \
    aviso "nginx.conf original guardado só como referência (não foi aplicado): compare se o site não abrir"
fi
if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce 2>/dev/null)" = "Enforcing" ]; then
  sistema setsebool -P httpd_can_network_connect 1 && ok "SELinux: nginx autorizado a encaminhar para o Dashboard"
fi
if systemctl is-active --quiet firewalld 2>/dev/null; then
  sistema firewall-cmd --permanent --add-service=http --add-service=https
  sistema firewall-cmd --reload
  ok "firewall: HTTP/HTTPS liberados"
fi
if [ "$INSTALAR_TESTE" != 1 ] && command -v nginx >/dev/null 2>&1; then
  if nginx -t >/dev/null 2>&1; then
    systemctl enable --now nginx >/dev/null 2>&1 || true
    systemctl reload nginx && ok "nginx validado e recarregado"
  else
    falha "nginx -t acusou erro: rode 'nginx -t' para ver o detalhe"
  fi
fi

if [ -f "$PASTA/credenciais/firebase-tools.json" ]; then
  mkdir -p "$(dirname "$FIREBASE_LOGIN")"
  guardar_existente "$FIREBASE_LOGIN"
  cp -p "$PASTA/credenciais/firebase-tools.json" "$FIREBASE_LOGIN"; chmod 600 "$FIREBASE_LOGIN"
  ok "login do Firebase CLI"
fi

# ---------------------------------------------------------------------------
passo "6/7 Subindo Dashboard e push-worker"
if [ "$SEM_SUBIR" = 1 ]; then
  aviso "containers não construídos (--sem-subir)"
else
  cd "$ESCALA_DIR"
  npm ci --no-audit --no-fund >/dev/null && ok "dependências do projeto (npm ci)"
  npm run docker:dashboard:staging:build && npm run docker:dashboard:staging:up && ok "Dashboard no ar"
  if [ -f .env.staging.push-worker ]; then
    npm run docker:push-worker:staging:build && npm run docker:push-worker:staging:up && ok "push-worker no ar"
  else
    aviso "sem .env.staging.push-worker — push-worker não foi subido"
  fi
fi

# ---------------------------------------------------------------------------
passo "7/7 Testes finais"
if [ "$SEM_SUBIR" = 1 ] || [ "$INSTALAR_TESTE" = 1 ]; then
  aviso "testes de saúde pulados"
else
  saude=""
  for _ in $(seq 1 24); do
    saude="$(curl -fsS http://127.0.0.1:4173/health 2>/dev/null || true)"
    [ "$saude" = "ok" ] && break; sleep 5
  done
  [ "$saude" = "ok" ] && ok "Dashboard responde em 127.0.0.1:4173/health" || falha "Dashboard não respondeu ao /health"
  estado=""
  for _ in $(seq 1 24); do
    estado="$(docker inspect -f '{{.State.Health.Status}}' push-worker-push-worker-1 2>/dev/null || true)"
    [ "$estado" = "healthy" ] && break; sleep 5
  done
  [ "$estado" = "healthy" ] && ok "push-worker saudável" || aviso "push-worker: estado '$estado' (veja: docker logs push-worker-push-worker-1)"
  systemctl is-active --quiet nginx && ok "nginx ativo" || falha "nginx parado"
fi

echo
echo "================ RESUMO ================"
printf '%s\n' "${RESUMO[@]}"
echo "========================================"
echo "Lembretes: o App (PWA) é publicado pelo Cloudflare Pages a cada push na main;"
echo "os dados ficam no Firestore (Google) — nada disso depende da VM."
