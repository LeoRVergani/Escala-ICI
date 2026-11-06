#!/usr/bin/env bash
# =============================================================================
# Escala ICI — backup das configurações e segredos da VM (só o Escala ICI).
#
#   sudo ./scripts/vm/backup.sh                       # pede a senha no terminal
#   sudo ./scripts/vm/backup.sh --senha-arquivo F     # senha lida de um arquivo (cron)
#   sudo ./scripts/vm/backup.sh --destino /root/backups --manter 8
#
# Gera UM arquivo criptografado (AES-256, gpg simétrico) + .sha256. O código
# NÃO entra (está no GitHub); entram só os itens que o GitHub não tem:
#   - .env.staging.{dashboard,app,push-worker} do repositório
#   - /opt/escala-ici (conta de serviço do push-worker) + GID do grupo de acesso
#   - nginx do Escala ICI (site + certificado TLS) — nginx.conf só como referência
#   - login do Firebase CLI e credenciais do Git
#   - commit atual, versões instaladas e um MANIFESTO com sha256 de cada item
# Cópias sem criptografia são apagadas SEMPRE (até em caso de erro).
#
# Formato: escala-ici-backup-v1 (lido por scripts/vm/instalar.sh).
# =============================================================================
set -euo pipefail

FORMATO="escala-ici-backup-v1"
ESCALA_DIR="${ESCALA_DIR:-/root/projetos/Escala-ICI}"
OPT_DIR="${OPT_DIR:-/opt/escala-ici}"
NGINX_DIR="${NGINX_DIR:-/etc/nginx}"
NGINX_SITE="${NGINX_SITE:-escala-ici-dashboard.conf}"
NGINX_SSL_DIR="${NGINX_SSL_DIR:-/etc/nginx/ssl/escala-ici}"
FIREBASE_LOGIN="${FIREBASE_LOGIN:-/root/.config/configstore/firebase-tools.json}"
HOME_ROOT="${HOME_ROOT:-/root}"
GRUPO_SEGREDO="${GRUPO_SEGREDO:-escala-ici-push-secret}"
DESTINO="/root/backups"
MANTER=8
SENHA_ARQUIVO=""

uso() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --destino) DESTINO="$2"; shift 2 ;;
    --manter) MANTER="$2"; shift 2 ;;
    --senha-arquivo) SENHA_ARQUIVO="$2"; shift 2 ;;
    -h|--help) uso 0 ;;
    *) echo "Opção desconhecida: $1" >&2; uso 1 ;;
  esac
done

ok()    { printf '  \033[32m✔\033[0m %s\n' "$*"; }
aviso() { printf '  \033[33m!\033[0m %s\n' "$*"; }
erro()  { printf '  \033[31m✘\033[0m %s\n' "$*" >&2; }

command -v gpg >/dev/null || { erro "gpg não encontrado (instale: dnf install -y gnupg2 / apt install -y gnupg)"; exit 1; }
[ -d "$ESCALA_DIR" ] || { erro "Repositório não encontrado em $ESCALA_DIR"; exit 1; }
if [ -n "$SENHA_ARQUIVO" ] && [ ! -r "$SENHA_ARQUIVO" ]; then
  erro "Arquivo de senha não legível: $SENHA_ARQUIVO"; exit 1
fi

DATA="$(date +%Y%m%d-%H%M%S)"
NOME="escala-ici-backup-$DATA"
umask 077
mkdir -p "$DESTINO"
chmod 700 "$DESTINO"
TRABALHO="$(mktemp -d "${TMPDIR:-/tmp}/escala-ici-backup.XXXXXX")"
# Nada sem criptografia sobrevive ao script, com sucesso ou erro.
trap 'rm -rf "$TRABALHO"' EXIT

PASTA="$TRABALHO/$NOME"
mkdir -p "$PASTA"/{env,nginx,credenciais,info}
echo "Backup do Escala ICI → $DESTINO/$NOME.tar.gz.gpg"

# 1) .env reais do repositório (os .example estão no GitHub)
achou_env=0
for arquivo in .env.staging.dashboard .env.staging.app .env.staging.push-worker .env.production.dashboard; do
  if [ -f "$ESCALA_DIR/$arquivo" ]; then
    cp -p "$ESCALA_DIR/$arquivo" "$PASTA/env/"
    ok "env: $arquivo"
    achou_env=1
  fi
done
[ "$achou_env" = 1 ] || aviso "nenhum .env.staging.* encontrado em $ESCALA_DIR"
[ -f "$ESCALA_DIR/.env.staging.push-worker" ] || aviso "sem .env.staging.push-worker — o push-worker não poderá ser recriado a partir deste backup"

# 2) Segredos do push-worker (/opt/escala-ici) + GID do grupo de leitura
if [ -d "$OPT_DIR" ]; then
  tar -czpf "$PASTA/opt-escala-ici.tar.gz" -C "$(dirname "$OPT_DIR")" "$(basename "$OPT_DIR")"
  ok "segredos: $OPT_DIR"
else
  aviso "pasta de segredos não encontrada: $OPT_DIR"
fi
if getent group "$GRUPO_SEGREDO" >/dev/null 2>&1; then
  getent group "$GRUPO_SEGREDO" > "$PASTA/info/grupo-segredo.txt"
  ok "grupo $GRUPO_SEGREDO (GID $(getent group "$GRUPO_SEGREDO" | cut -d: -f3))"
fi

# 3) nginx do Escala ICI
if [ -f "$NGINX_DIR/conf.d/$NGINX_SITE" ]; then
  cp -p "$NGINX_DIR/conf.d/$NGINX_SITE" "$PASTA/nginx/"
  ok "nginx: conf.d/$NGINX_SITE"
else
  aviso "site do nginx não encontrado: $NGINX_DIR/conf.d/$NGINX_SITE"
fi
[ -f "$NGINX_DIR/nginx.conf" ] && cp -p "$NGINX_DIR/nginx.conf" "$PASTA/nginx/nginx.conf.referencia"
if [ -d "$NGINX_SSL_DIR" ]; then
  cp -a "$NGINX_SSL_DIR" "$PASTA/nginx/ssl"
  ok "certificado TLS: $NGINX_SSL_DIR"
else
  aviso "certificado TLS não encontrado: $NGINX_SSL_DIR"
fi

# 4) Logins de ferramentas
[ -f "$FIREBASE_LOGIN" ] && cp -p "$FIREBASE_LOGIN" "$PASTA/credenciais/firebase-tools.json" && ok "login do Firebase CLI"
for arquivo in .git-credentials .gitconfig; do
  [ -f "$HOME_ROOT/$arquivo" ] && cp -p "$HOME_ROOT/$arquivo" "$PASTA/credenciais/" && chmod 600 "$PASTA/credenciais/$arquivo" && ok "git: $arquivo"
done

# 5) Informações para reinstalar igual
{
  echo "formato: $FORMATO"
  echo "gerado-em: $(date -Iseconds)"
  echo "host: $(hostname)"
  echo "repositorio: $(git -C "$ESCALA_DIR" remote get-url origin 2>/dev/null || echo '?')"
  echo "commit: $(git -C "$ESCALA_DIR" log --oneline -1 2>/dev/null || echo '?')"
  echo "escala-dir: $ESCALA_DIR"
} > "$PASTA/info/origem.txt"
{
  (node -v || true); (npm -v || true); (docker --version || true); (docker compose version || true)
  (nginx -v 2>&1 || true); (head -3 /etc/os-release || true)
} > "$PASTA/info/versoes.txt" 2>&1

# 6) Manifesto (o instalador confere o formato e as somas)
(
  cd "$PASTA"
  echo "formato: $FORMATO"
  find . -type f ! -name MANIFESTO.txt | sort | while read -r f; do
    printf '%s  %s\n' "$(sha256sum "$f" | cut -c1-64)" "${f#./}"
  done
) > "$PASTA/MANIFESTO.txt"

# 7) Um arquivo, criptografado; nada aberto fica no disco de destino
tar -czf "$TRABALHO/$NOME.tar.gz" -C "$TRABALHO" "$NOME"
if [ -n "$SENHA_ARQUIVO" ]; then
  gpg --batch --yes --pinentry-mode loopback --passphrase-file "$SENHA_ARQUIVO" \
    --symmetric --cipher-algo AES256 --output "$DESTINO/$NOME.tar.gz.gpg" "$TRABALHO/$NOME.tar.gz"
else
  echo
  echo "Digite a senha do backup (guarde num gerenciador de senhas — sem ela o backup não abre):"
  gpg --yes --pinentry-mode loopback --symmetric --cipher-algo AES256 \
    --output "$DESTINO/$NOME.tar.gz.gpg" "$TRABALHO/$NOME.tar.gz"
fi
( cd "$DESTINO" && sha256sum "$NOME.tar.gz.gpg" > "$NOME.tar.gz.gpg.sha256" )
chmod 600 "$DESTINO/$NOME.tar.gz.gpg" "$DESTINO/$NOME.tar.gz.gpg.sha256"
gpgconf --kill gpg-agent >/dev/null 2>&1 || true

# 8) Rotação: mantém os N mais recentes
if [ "$MANTER" -gt 0 ] 2>/dev/null; then
  ls -1t "$DESTINO"/escala-ici-backup-*.tar.gz.gpg 2>/dev/null | tail -n +"$((MANTER + 1))" | while read -r antigo; do
    rm -f "$antigo" "$antigo.sha256"
    echo "  rotação: removido $(basename "$antigo")"
  done
fi

echo
ok "Backup pronto: $DESTINO/$NOME.tar.gz.gpg ($(du -h "$DESTINO/$NOME.tar.gz.gpg" | cut -f1))"
echo "  Leve o .gpg e o .sha256 para FORA desta VM (drive/cofre). Nunca para o GitHub."
