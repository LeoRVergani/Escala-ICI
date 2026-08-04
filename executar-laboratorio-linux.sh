#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

RUNTIME_DIR="$ROOT_DIR/.firebase-runtime"
mkdir -p "$RUNTIME_DIR"

declare -a STARTED_PIDS=()

log() { printf '\n[%s] %s\n' "$1" "$2"; }

need_sudo() {
  if [[ "$(id -u)" -eq 0 ]]; then
    printf ''
  else
    printf 'sudo'
  fi
}

install_node() {
  local sudo_cmd tmp_file
  sudo_cmd="$(need_sudo)"
  tmp_file="$(mktemp)"
  if command -v apt-get >/dev/null 2>&1; then
    if ! command -v curl >/dev/null 2>&1; then
      $sudo_cmd apt-get update
      $sudo_cmd apt-get install -y curl
    fi
    curl -fsSL https://deb.nodesource.com/setup_22.x -o "$tmp_file"
    $sudo_cmd bash "$tmp_file"
    $sudo_cmd apt-get install -y nodejs
  elif command -v dnf >/dev/null 2>&1; then
    $sudo_cmd dnf module reset -y nodejs
    $sudo_cmd dnf module install -y nodejs:22
  elif command -v pacman >/dev/null 2>&1; then
    $sudo_cmd pacman -Sy --noconfirm --needed nodejs npm
  else
    rm -f "$tmp_file"
    echo "Gerenciador nao suportado. Instale Node.js 22+ e execute novamente." >&2
    exit 1
  fi
  rm -f "$tmp_file"
}

install_java() {
  local sudo_cmd
  sudo_cmd="$(need_sudo)"
  if command -v apt-get >/dev/null 2>&1; then
    $sudo_cmd apt-get update
    $sudo_cmd apt-get install -y openjdk-21-jdk
  elif command -v dnf >/dev/null 2>&1; then
    $sudo_cmd dnf install -y java-21-openjdk-headless
  elif command -v pacman >/dev/null 2>&1; then
    $sudo_cmd pacman -Sy --noconfirm --needed jdk21-openjdk
  else
    echo "Gerenciador nao suportado. Instale Java 21+ e execute novamente." >&2
    exit 1
  fi
}

port_open() {
  (echo >"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1
}

wait_port() {
  local port="$1" timeout="$2"
  while (( timeout > 0 )); do
    port_open "$port" && return 0
    sleep 1
    ((timeout -= 1))
  done
  echo "O servico na porta $port nao iniciou no tempo esperado." >&2
  return 1
}

start_process() {
  local name="$1" logfile="$2"
  shift 2
  "$@" >"$logfile" 2>&1 &
  local pid=$!
  STARTED_PIDS+=("$pid")
  echo "$pid" >"$RUNTIME_DIR/${name}.pid"
}

cleanup() {
  if ((${#STARTED_PIDS[@]} > 0)); then
    log INFO "Encerrando os processos iniciados por este script..."
    kill "${STARTED_PIDS[@]}" 2>/dev/null || true
    wait "${STARTED_PIDS[@]}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

log INFO "ESCALA ICI - LABORATORIO FIREBASE LOCAL - LINUX"

if ! command -v node >/dev/null 2>&1 || (( $(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || echo 0) < 22 )); then
  log DOWNLOAD "Instalando Node.js 22..."
  install_node
fi
log OK "Node.js $(node --version)"

java_major="$(java -version 2>&1 | head -n1 | sed -nE 's/.*version "([0-9]+).*/\1/p' || true)"
if [[ -z "$java_major" || "$java_major" -lt 21 ]]; then
  log DOWNLOAD "Instalando Java 21..."
  install_java
fi
log OK "Java 21 ou superior disponivel"

if [[ ! -x node_modules/.bin/firebase ]]; then
  log DOWNLOAD "Instalando dependencias exatas do projeto..."
  npm ci
else
  log OK "Dependencias do projeto ja instaladas"
fi

firestore_running=1
auth_running=1
port_open 8080 && firestore_running=0
port_open 9099 && auth_running=0

if [[ "$firestore_running" -ne "$auth_running" ]]; then
  echo "Apenas um dos emuladores esta ativo nas portas 8080/9099." >&2
  echo "Encerre processos antigos do Firebase e execute novamente." >&2
  exit 1
fi

if [[ "$firestore_running" -eq 0 ]]; then
  log INFO "Emuladores existentes serao reutilizados; teste integrado ignorado"
else
  log TESTE "Executando a validacao completa da Fase 3K-C..."
  npm run check:phase3kc

  log INFO "Iniciando Firebase Authentication e Firestore locais..."
  start_process firebase "$RUNTIME_DIR/firebase.log" npm run firebase:lab
  wait_port 8080 90
  wait_port 9099 90
fi

log INFO "Carregando contas e escalas ficticias..."
npm run firebase:lab:seed

if port_open 4173; then
  log INFO "Porta 4173 ja em uso; Dashboard existente sera reutilizado"
else
  start_process dashboard "$RUNTIME_DIR/dashboard.log" npm run dev:dashboard:emulator
  wait_port 4173 60
fi

if port_open 4174; then
  log INFO "Porta 4174 ja em uso; App existente sera reutilizado"
else
  start_process app "$RUNTIME_DIR/app.log" npm run dev:app:emulator
  wait_port 4174 60
fi

log TESTE "Confirmando conexao local do Dashboard e App..."
node scripts/verify-running-lab.mjs

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open http://127.0.0.1:4000 >/dev/null 2>&1 || true
  xdg-open http://127.0.0.1:4173 >/dev/null 2>&1 || true
  xdg-open http://127.0.0.1:4174 >/dev/null 2>&1 || true
fi

cat <<'EOF'

============================================================
  LABORATORIO PRONTO
============================================================
Dashboard:   http://127.0.0.1:4173
App:         http://127.0.0.1:4174
Emuladores:  http://127.0.0.1:4000

Gestora:     marina.azevedo@teste.local
Colaborador: caio.monteiro@teste.local
Senha:       EscalaLocal#2026

Fluxo:       importar -> validar -> rascunho -> publicar -> App -> rollback

Pressione Ctrl+C para encerrar os processos iniciados por este script.
EOF

while true; do sleep 3600; done
