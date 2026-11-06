# Escala ICI — backup e instalação numa VM

Dois scripts no repositório cuidam de tudo. **Nenhum segredo fica no Git**: os
segredos vivem só no backup criptografado (AES-256), protegido por uma senha
que fica num gerenciador de senhas.

| O que | Onde mora | Entra no backup? |
|---|---|---|
| Código | GitHub | Não (vem do `git clone`) |
| Dados (escalas, usuários, plantões) | Firestore (Google) | Não (não dependem da VM) |
| App (PWA) | Cloudflare Pages | Não (publica a cada push na `main`) |
| `.env.staging.*`, conta de serviço do push, nginx + certificado, login do Firebase, credenciais do Git | VM | **Sim** |

## Fazer um backup

```bash
cd /root/projetos/Escala-ICI && git pull
sudo ./scripts/vm/backup.sh
```

Pede a senha no terminal e gera, em `/root/backups/`, um
`escala-ici-backup-AAAAMMDD-HHMMSS.tar.gz.gpg` (alguns KB) e o `.sha256`.
Mantém os 8 mais recentes (`--manter N` muda). **Leve os dois arquivos para fora
da VM** (drive corporativo/cofre) — nunca para o GitHub.

Para baixar pelo MobaXterm (SFTP como `lvergani`):

```bash
cp /root/backups/escala-ici-backup-*.gpg* /home/lvergani/ && chown lvergani /home/lvergani/escala-ici-backup-*
# depois do download: rm /home/lvergani/escala-ici-backup-*
```

## Instalar numa VM nova

1. Copie o `.gpg` **e** o `.sha256` para a VM nova (mesma pasta).
2. Pegue o instalador (só ele — o resto vem do GitHub):
   ```bash
   curl -fsSLO https://raw.githubusercontent.com/LeoRVergani/Escala-ICI/main/scripts/vm/instalar.sh
   chmod +x instalar.sh
   ```
   (repositório privado: copie o `scripts/vm/instalar.sh` junto com o backup.)
3. Rode:
   ```bash
   sudo ./instalar.sh ./escala-ici-backup-AAAAMMDD-HHMMSS.tar.gz.gpg
   ```

Ele mostra 7 passos e um resumo final com ✔ / ! / ✘:

1. confere o SHA-256 do arquivo;
2. instala o que faltar: Git, gpg, nginx, Docker + Compose, Node 22 (RHEL/Rocky/Alma via `dnf`, Debian/Ubuntu via `apt`);
3. abre o backup num diretório temporário (apagado no fim) e confere o MANIFESTO item a item;
4. clona o repositório em `/root/projetos/Escala-ICI` (ou atualiza, se já existir);
5. devolve os `.env`, os segredos em `/opt/escala-ici` (recria o grupo `escala-ici-push-secret` com o **mesmo GID**), o site do nginx + certificado, o login do Firebase; libera SELinux/firewall quando ativos;
6. constrói e sobe o Dashboard e o push-worker;
7. testa: `/health` do Dashboard, push-worker *healthy*, nginx ativo.

Nada existente é sobrescrito sem uma cópia `*.antes-restauracao-DATA`.
Opções: `--sem-pacotes`, `--sem-subir`, `--repo URL`, `--senha-arquivo F`.

## Depois de instalar

- **DNS**: aponte o domínio do Dashboard para o IP da VM nova.
- **Certificado**: se o domínio mudou, o certificado restaurado não vale — gere/instale um novo em `/etc/nginx/ssl/escala-ici/`.
- O **nginx.conf** original vem só como referência (`nginx.conf.referencia` dentro do backup); o instalador aplica apenas o site do Escala ICI.
- Regras do Firestore e App não dependem da VM.

## Abrir um backup no Windows (consulta)

Com o Git para Windows instalado (traz o `gpg`), no PowerShell:

```powershell
& "C:\Program Files\Git\usr\bin\gpg.exe" --pinentry-mode loopback `
  --output backup.tar.gz --decrypt escala-ici-backup-AAAAMMDD-HHMMSS.tar.gz.gpg
tar -xzf backup.tar.gz
```

O conteúdo aberto são **todas as chaves sem proteção**: abra numa pasta que não
sincroniza com nuvem e apague a pasta e o `.tar.gz` ao terminar.
