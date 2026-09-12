# Prontuário Enfermagem — Versão Mobile (100% Local)

Este projeto foi adaptado para rodar **inteiramente no celular**, sem servidor e sem
internet (exceto para a função opcional de sugestões de IA via Groq).

## O que mudou em relação ao projeto original
- **Banco de dados:** Prisma + PostgreSQL → **SQLite local** (`@capacitor-community/sqlite`), rodando dentro do próprio app.
- **Autenticação:** sessão via cookie de servidor → sessão local salva com `@capacitor/preferences`.
- **Upload de foto:** salvava arquivo em `/uploads` no servidor → agora converte a imagem para base64 e guarda direto no banco local.
- **Lembretes de Medicação (Push Local):** integrado com `@capacitor/local-notifications`, permitindo alarmes e avisos sonoros no horário exato das doses mesmo sem internet ou com o aplicativo fechado.
- **IA (sugestões de cuidados / relatório):** proxy pelo servidor → chamada direta à API da Groq a partir do app (você precisa configurar sua própria chave em **Configurações**, dentro do app).
- **Rotas dinâmicas** (`/patient/[id]`) → convertidas para `/patient?id=...`, formato necessário para exportação estática do Next.js.
- Toda a pasta `src/app/api` foi removida (não é mais necessária).
- `prisma/`, `Dockerfile*`, `docker-compose.yml`, `entrypoint*.sh` **não são mais usados** — foram mantidos apenas como referência histórica, podem ser apagados com segurança.

## Como gerar o APK

### 1. Instale as dependências
```bash
npm install
```

### 2. Gere o build mobile + sincronize com o Android
```bash
npm run cap:sync
```
Isso roda `next build` em modo de exportação estática (gera a pasta `out/`) e sincroniza com o projeto Android em `android/`.

### 3. Abra no Android Studio
```bash
npm run cap:open
```

### 4. Gerar o APK de teste
No Android Studio: **Build > Build Bundle(s) / APK(s) > Build APK(s)**
O arquivo `app-debug.apk` aparecerá em `android/app/build/outputs/apk/debug/`.

### 5. Gerar o AAB assinado (para publicar na Play Store)
No Android Studio: **Build > Generate Signed Bundle / APK** → escolha *Android App Bundle* → crie/selecione sua keystore.

## Configurando a IA (opcional)
1. Crie uma conta gratuita em [console.groq.com](https://console.groq.com)
2. Gere uma API Key
3. Abra o app → **Configurações** → cole a chave no campo "Chave de IA (Groq)"

Sem essa chave, todo o resto do app funciona normalmente — só as sugestões de
cuidados e o relatório de enfermagem por IA ficam indisponíveis.

## Observações importantes
- **Backup dos dados:** como tudo fica salvo *só* no celular, se o app for desinstalado ou o celular for trocado, os dados são perdidos. Não existe backup em nuvem nesta versão. Se isso for um problema, me avise — dá para adicionar exportação/importação manual do banco.
- **Primeira execução:** como não há mais usuários pré-cadastrados no banco, o app vai te mandar direto para a tela de **Cadastro** (`/register`) na primeira vez que abrir.
- Testado apenas via compilação (`next build` + `cap sync`) neste ambiente — a validação final de funcionamento em um dispositivo/emulador Android real precisa ser feita por você no Android Studio, já que não há como rodar um emulador Android aqui.
