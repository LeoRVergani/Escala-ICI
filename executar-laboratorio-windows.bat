@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title Escala ICI - Preparacao do laboratorio

echo ============================================================
echo   ESCALA ICI - LABORATORIO FIREBASE LOCAL - WINDOWS
echo ============================================================
echo.

call :ensure_node || goto :failure
call :ensure_java || goto :failure
call :ensure_dependencies || goto :failure

call :port_open 8080
set "FIRESTORE_RUNNING=!errorlevel!"
call :port_open 9099
set "AUTH_RUNNING=!errorlevel!"

if "!FIRESTORE_RUNNING!"=="0" if not "!AUTH_RUNNING!"=="0" goto :partial_emulator
if "!AUTH_RUNNING!"=="0" if not "!FIRESTORE_RUNNING!"=="0" goto :partial_emulator

if "!FIRESTORE_RUNNING!"=="0" (
  echo [INFO] Os emuladores ja estao ativos. Os testes integrados serao ignorados.
) else (
  echo [1/6] Executando a validacao completa da Fase 3K-C...
  call npm run check:phase3kc || goto :failure

  echo [2/6] Iniciando Firebase Authentication e Firestore locais...
  start "Escala ICI - Firebase Local" cmd /k "cd /d ""%CD%"" && npm run firebase:lab"
  call :wait_port 8080 90 || goto :failure
  call :wait_port 9099 90 || goto :failure
  call :wait_port 4000 90 || goto :failure
)

echo [3/6] Carregando contas e escalas ficticias...
call npm run firebase:lab:seed || goto :failure

echo [4/6] Iniciando Dashboard e App...
call :start_web 4173 "Escala ICI - Dashboard" "npm run dev:dashboard:emulator"
call :start_web 4174 "Escala ICI - App" "npm run dev:app:emulator"

echo [5/6] Confirmando conexao local do Dashboard e App...
call node scripts/verify-running-lab.mjs || goto :failure

echo [6/6] Abrindo o laboratorio no navegador...
start "" "http://127.0.0.1:4000"
start "" "http://127.0.0.1:4173"
start "" "http://127.0.0.1:4174"

echo.
echo ============================================================
echo   LABORATORIO PRONTO
echo ============================================================
echo Dashboard:   http://127.0.0.1:4173
echo App:         http://127.0.0.1:4174
echo Emuladores:  http://127.0.0.1:4000
echo.
echo Gestora:     marina.azevedo@teste.local
echo Colaborador: caio.monteiro@teste.local
echo Senha:       EscalaLocal#2026
echo Fluxo:       importar ^> validar ^> rascunho ^> publicar ^> App ^> rollback
echo.
echo Feche as tres janelas de servico para encerrar o laboratorio.
pause
exit /b 0

:ensure_node
where node >nul 2>nul
if errorlevel 1 goto :install_node
for /f "delims=" %%V in ('node -p "Number(process.versions.node.split('.')[0])"') do set "NODE_MAJOR=%%V"
if !NODE_MAJOR! GEQ 22 (
  for /f "delims=" %%V in ('node --version') do set "NODE_VERSION=%%V"
  echo [OK] Node.js encontrado: !NODE_VERSION!
  exit /b 0
)
echo [AVISO] Node.js 22 ou superior e necessario.

:install_node
where winget >nul 2>nul || (
  echo [ERRO] Node.js nao foi encontrado e o winget nao esta disponivel.
  echo Instale Node.js LTS em https://nodejs.org e execute este BAT novamente.
  exit /b 1
)
echo [DOWNLOAD] Instalando Node.js LTS com winget...
winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements || exit /b 1
set "PATH=%ProgramFiles%\nodejs;%PATH%"
where node >nul 2>nul || (
  echo [ERRO] Node.js foi instalado. Feche e abra este BAT novamente.
  exit /b 1
)
exit /b 0

:ensure_java
call :java_21_available
if not errorlevel 1 (
  echo [OK] Java 21 ou superior encontrado.
  exit /b 0
)
where winget >nul 2>nul || (
  echo [ERRO] Java 21 nao foi encontrado e o winget nao esta disponivel.
  echo Instale Temurin JDK 21 e execute este BAT novamente.
  exit /b 1
)
echo [DOWNLOAD] Instalando Eclipse Temurin JDK 21 com winget...
winget install --id EclipseAdoptium.Temurin.21.JDK --exact --silent --accept-package-agreements --accept-source-agreements || exit /b 1
for /f "delims=" %%J in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "$dirs = [IO.Directory]::GetDirectories('C:\Program Files\Eclipse Adoptium', 'jdk-21*'); if ($dirs.Length -gt 0) { [Array]::Sort($dirs); $dirs[$dirs.Length - 1] }"') do set "JAVA_HOME=%%J"
if defined JAVA_HOME set "PATH=!JAVA_HOME!\bin;!PATH!"
call :java_21_available
if errorlevel 1 (
  echo [ERRO] O Temurin JDK 21 esta instalado, mas nao foi possivel ativa-lo.
  echo Feche esta janela, abra um novo terminal e execute este BAT novamente.
  exit /b 1
)
echo [OK] Eclipse Temurin JDK 21 configurado.
exit /b 0

:java_21_available
powershell -NoProfile -ExecutionPolicy Bypass -Command "$java = Get-Command java -ErrorAction SilentlyContinue; if (-not $java) { exit 1 }; try { $major = [Diagnostics.FileVersionInfo]::GetVersionInfo($java.Source).ProductMajorPart; if ($major -ge 21) { exit 0 } } catch {}; exit 1" >nul 2>nul
exit /b %errorlevel%

:ensure_dependencies
if exist "node_modules\.bin\firebase.cmd" (
  echo [OK] Dependencias do projeto ja instaladas.
  exit /b 0
)
echo [DOWNLOAD] Instalando dependencias exatas do projeto...
call npm ci || exit /b 1
exit /b 0

:port_open
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c = [Net.Sockets.TcpClient]::new(); try { $ok = $c.ConnectAsync('127.0.0.1', %~1).Wait(500); if ($ok -and $c.Connected) { exit 0 }; exit 1 } catch { exit 1 } finally { $c.Dispose() }" >nul 2>nul
exit /b %errorlevel%

:wait_port
set /a "WAIT_SECONDS=%~2"
:wait_loop
call :port_open %~1
if not errorlevel 1 exit /b 0
if !WAIT_SECONDS! LEQ 0 (
  echo [ERRO] O servico na porta %~1 nao iniciou no tempo esperado.
  exit /b 1
)
set /a "WAIT_SECONDS-=1"
>nul 2>nul ping 127.0.0.1 -n 2
goto :wait_loop

:start_web
call node scripts/prepare-local-web-port.mjs %~1 "%~2"
set "PORT_ACTION=!errorlevel!"
if "!PORT_ACTION!"=="0" (
  exit /b 0
)
if not "!PORT_ACTION!"=="10" exit /b 1
start "%~2" cmd /k "cd /d ""%CD%"" && %~3"
call :wait_port %~1 60
exit /b %errorlevel%

:partial_emulator
echo [ERRO] Apenas um dos emuladores esta ativo nas portas 8080/9099.
echo Feche processos antigos do Firebase e execute este BAT novamente.
goto :failure

:failure
echo.
echo [FALHA] O laboratorio nao foi iniciado. Revise a mensagem acima.
pause
exit /b 1
