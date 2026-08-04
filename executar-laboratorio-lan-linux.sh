#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

RUNTIME_DIR="$ROOT_DIR/.firebase-runtime/lan"
mkdir -p "$RUNTIME_DIR"
declare -a STARTED_PIDS=()

LAN_HOST="${ESCALA_ICI_LAN_HOST:-}"
OPEN_FIREWALL=false
for argument in "$@"; do
  case "$argument" in
    --host=*) LAN_HOST="${argument#--host=}" ;;
    --open-firewall) OPEN_FIREWALL=true ;;
    *)
      echo "Argumento desconhecido: $argument" >&2
      echo "Uso: ./executar-laboratorio-lan-linux.sh --host=172.31.6.111 [--open-firewall]" >&2
      exit 64
      ;;
  esac
done

log() { printf '\n[%s] %s\n' "$1" "$2"; }

need_sudo() {
  if [[ "$(id -u)" -eq 0 ]]; then printf ''; else printf 'sudo'; fi
}

install_node() {
  local sudo_cmd
  sudo_cmd="$(need_sudo)"
  if command -v dnf >/dev/null 2>&1; then
    $sudo_cmd dnf module reset -y nodejs
    $sudo_cmd dnf module install -y nodejs:22
  elif command -v apt-get >/dev/null 2>&1; then
    local installer
    installer="$(mktemp)"
    command -v curl >/dev/null 2>&1 || {
      $sudo_cmd apt-get update
      $sudo_cmd apt-get install -y curl
    }
    curl -fsSL https://deb.nodesource.com/setup_22.x -o "$installer"
    $sudo_cmd bash "$installer"
    rm -f "$installer"
    $sudo_cmd apt-get install -y nodejs
  else
    echo "Instale Node.js 22.13 ou superior e execute novamente." >&2
    exit 1
  fi
}

install_java() {
  local sudo_cmd
  sudo_cmd="$(need_sudo)"
  if command -v dnf >/dev/null 2>&1; then
    $sudo_cmd dnf install -y java-21-openjdk-headless
  elif command -v apt-get >/dev/null 2>&1; then
    $sudo_cmd apt-get update
    $sudo_cmd apt-get install -y openjdk-21-jre-headless
  else
    echo "Instale Java 21 ou superior e execute novamente." >&2
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
  echo "O serviço na porta $port não iniciou no tempo esperado." >&2
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
    log INFO "Encerrando os processos do laboratório LAN..."
    kill "${STARTED_PIDS[@]}" 2>/dev/null || true
    wait "${STARTED_PIDS[@]}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

log INFO "ESCALA ICI - LABORATÓRIO FIREBASE LAN - LINUX"

if ! command -v node >/dev/null 2>&1 || (( $(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || echo 0) < 22 )); then
  log DOWNLOAD "Instalando Node.js 22 pelo gerenciador do sistema..."
  install_node
fi
log OK "Node.js $(node --version)"

java_major="$(java -version 2>&1 | head -n1 | sed -nE 's/.*version "([0-9]+).*/\1/p' || true)"
if [[ -z "$java_major" || "$java_major" -lt 21 ]]; then
  log DOWNLOAD "Instalando Java 21 headless..."
  install_java
fi
log OK "Java 21 ou superior disponível"

if [[ -z "$LAN_HOST" ]]; then
  LAN_HOST="$(hostname -I 2>/dev/null | awk '{print $1}')"
fi
node scripts/validate-lan-host.mjs "$LAN_HOST"

if [[ ! -x node_modules/.bin/firebase ]]; then
  log DOWNLOAD "Instalando dependências exatas do projeto..."
  npm ci
fi

for port in 4000 4173 4174 8080 9099; do
  if port_open "$port"; then
    echo "[ERRO] A porta $port já está ocupada. Encerre o laboratório anterior e tente novamente." >&2
    exit 1
  fi
done

if [[ "$OPEN_FIREWALL" == true ]]; then
  if ! command -v firewall-cmd >/dev/null 2>&1; then
    echo "[ERRO] firewall-cmd não está disponível; abra as portas manualmente." >&2
    exit 1
  fi
  sudo_cmd="$(need_sudo)"
  if $sudo_cmd firewall-cmd --state >/dev/null 2>&1; then
    for port in 4000 4173 4174 8080 9099 9150; do
      $sudo_cmd firewall-cmd --permanent --add-port="${port}/tcp"
    done
    $sudo_cmd firewall-cmd --reload
    log OK "Portas do laboratório liberadas no firewalld"
  else
    log INFO "firewalld está inativo; nenhuma regra precisou ser adicionada"
  fi
fi

export ESCALA_ICI_LAN_HOST="$LAN_HOST"
export VITE_FIREBASE_ENVIRONMENT=local
export VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE=false
export VITE_FIREBASE_USE_EMULATORS=true
export VITE_FIREBASE_LAN_MODE=true
export VITE_FIREBASE_LAN_HOST="$LAN_HOST"
export VITE_FIREBASE_AUTH_EMULATOR_URL="http://${LAN_HOST}:9099"
export VITE_FIREBASE_FIRESTORE_EMULATOR_HOST="$LAN_HOST"
export VITE_FIREBASE_FIRESTORE_EMULATOR_PORT=8080
export VITE_DASHBOARD_URL="http://${LAN_HOST}:4173"
export VITE_EMPLOYEE_APP_URL="http://${LAN_HOST}:4174"

log TESTE "Executando a validação completa da Fase 3K-C.1..."
npm run check:phase3kc1

log INFO "Iniciando Authentication, Firestore e Emulator UI em 0.0.0.0..."
start_process firebase "$RUNTIME_DIR/firebase.log" npm run firebase:lab:lan
wait_port 8080 90
wait_port 9099 90
wait_port 4000 90

log INFO "Carregando contas e escalas totalmente fictícias..."
npm run firebase:lab:seed

log INFO "Iniciando Dashboard e App nas interfaces da VM..."
start_process dashboard "$RUNTIME_DIR/dashboard.log" npm run dev:dashboard:emulator:lan
start_process app "$RUNTIME_DIR/app.log" npm run dev:app:emulator:lan
wait_port 4173 60
wait_port 4174 60

log TESTE "Confirmando acesso pelo IPv4 privado da VM..."
node scripts/verify-running-lan.mjs

cat <<EOF

============================================================
  LABORATÓRIO LAN PRONTO — FASE 3K-C.1
============================================================
Dashboard:   http://${LAN_HOST}:4173
App:         http://${LAN_HOST}:4174
Emuladores:  http://${LAN_HOST}:4000

Gestora:     marina.azevedo@teste.local
Colaborador: caio.monteiro@teste.local
Senha:       EscalaLocal#2026

Fluxo:       importar -> validar -> rascunho -> publicar -> App -> rollback

Pressione Ctrl+C para encerrar os processos iniciados por este script.
EOF

while true; do sleep 3600; done
