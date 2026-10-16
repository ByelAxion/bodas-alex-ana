# Bodas de Prata — Alex & Ana

Convite digital responsivo em React + TypeScript e API Node.js/Express + TypeScript. Inclui abertura animada, galeria, informações da festa, Pix copiável, convites individuais, confirmação de presença, login administrativo e painel de acompanhamento. O banco de dados usado é PostgreSQL.

## Antes de começar

- Node.js 20 ou superior e npm.
- Uma instância PostgreSQL (local ou gerenciada, como Neon, Supabase ou outro provedor compatível).
- Para WhatsApp automático, credenciais válidas da WhatsApp Business Platform. Sem elas, a confirmação continua funcionando e o envio fica desativado.

## 1. Preparar o banco e o backend

1. Crie um banco PostgreSQL chamado `bodas_alex_ana`.
2. Entre na pasta `backend` e copie `.env.example` da raiz para `backend/.env` (ou crie o arquivo manualmente com as variáveis abaixo).
3. Preencha `DATABASE_URL`, `JWT_SECRET`, `ADMIN_NAME`, `ADMIN_PASSWORD`, `FRONTEND_URL` e `PUBLIC_URL`.
4. No terminal:

```bash
cd backend
npm install
npm run db:init
npm run dev
```

O primeiro administrador é criado automaticamente ao iniciar a API, desde que `ADMIN_PASSWORD` esteja definido e a tabela `admins` esteja vazia. O nome inicial é `Ana` e a senha inicial solicitada no projeto é `Analex2026`; altere-a em `backend/.env` antes de publicar.

## 2. Preparar o frontend

Em outro terminal:

```bash
cd frontend
npm install
```

Crie `frontend/.env` com:

```env
VITE_API_URL=http://localhost:3001
```

Depois rode:

```bash
npm run dev
```

Abra `http://localhost:5173`.

## 3. Rodar os dois juntos (opcional)

Na pasta raiz:

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
npm run dev
```

## 4. Área da noiva e convites

- Login: `/area-da-noiva`.
- Painel: `/area-da-noiva/painel`.
- Cadastre o nome do grupo, nomes (um por linha) e quantidade autorizada.
- Copie o link criado e envie ao grupo.
- O link abre `/convite/TOKEN`. Os nomes são carregados do banco; o servidor valida a seleção e impede confirmação duplicada.
- O painel atualiza a cada 15 segundos.

## 5. Fotos

Substitua os arquivos em `frontend/public/images/fotos-casal/` por `foto-01.jpg` até `foto-10.jpg`. O carrossel usa imagens de reserva remotas enquanto os arquivos locais ainda não existirem. Para publicação sem dependência externa, coloque as fotos reais nessa pasta.

## 6. WhatsApp

Para enviar a notificação automaticamente à noiva, configure no `backend/.env`:

```env
WHATSAPP_TOKEN=token_de_acesso_da_meta
WHATSAPP_PHONE_NUMBER_ID=id_do_numero_de_whatsapp_business
WHATSAPP_TO=5511945644162
```

O envio usa a WhatsApp Business Platform. Não use o token no frontend. É necessário configurar a conta, permissões e número na Meta. Se não houver credenciais, a confirmação de presença é salva normalmente e nenhuma mensagem é enviada.

## 7. Publicação

### Backend

Publique a pasta `backend` em um host Node.js que permita configurar variáveis de ambiente. Configure `DATABASE_URL`, `JWT_SECRET` (um segredo aleatório forte), `ADMIN_NAME`, `ADMIN_PASSWORD`, `FRONTEND_URL` (domínio do site), `PUBLIC_URL` e `NODE_ENV=production`. Comando de build: `npm run build`; comando de inicialização: `npm start`. Execute `npm run db:init` uma vez contra o banco de produção.

### Frontend

Publique a pasta `frontend` em um host estático (por exemplo, Vercel). Configure `VITE_API_URL` com a URL pública da API, sem barra no final, antes do build. Comando de build: `npm run build`; diretório de saída: `dist`. Configure o host para redirecionar as rotas SPA para `index.html` (o arquivo `vercel.json` já está incluído).

**Importante:** não use `localhost` no `VITE_API_URL` da versão publicada. O PostgreSQL deve ser gerenciado/persistente; não use disco temporário do servidor para guardar confirmações. Ajuste `FRONTEND_URL` no backend para o domínio real do frontend.

## Endpoints principais

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/admin/me`
- `GET /api/admin/stats` (autenticado)
- `GET /api/admin/invitations` (autenticado)
- `POST /api/admin/invitations` (autenticado)
- `PATCH /api/admin/invitations/:id/toggle` (autenticado)
- `GET /api/public/invitations/:token`
- `POST /api/public/invitations/:token/confirm`

## Observações importantes

- O número de convidados autorizados e os nomes são validados pelo backend.
- A confirmação é persistida antes de tentar notificar o WhatsApp; falhas na notificação não apagam a confirmação.
- A senha administrativa não fica no frontend. O backend armazena hash bcrypt.
- Antes de usar em produção, configure HTTPS, segredo JWT forte, senha exclusiva, backup do banco e teste o fluxo completo com convites reais.
- As informações do evento e a chave Pix foram mantidas conforme o briefing fornecido.
