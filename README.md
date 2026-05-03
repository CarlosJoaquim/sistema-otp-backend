# Sistema OTP Backend - CAOP-B

Sistema completo de autenticação OTP com painel administrativo, verificação por email, gestão de usuários e métricas.

## Funcionalidades

- Registro de usuários com verificação OTP por email
- Redefinição de senha com código de verificação
- Painel administrativo com autenticação
- Visualização de usuários, OTPs e logs do sistema
- Métricas avançadas (P50/P95/P99, taxas de sucesso)
- Rate limiting (Redis + fallback em memória)
- Exportação de dados para CSV
- Emails com branding CAOP-B
- Limpeza automática de OTPs expirados

## Deploy no Vercel

### Pré-requisitos
- Conta no [Vercel](https://vercel.com)
- Projeto Supabase configurado
- Conta Resend para envio de emails

### Passos

1. Acesse https://vercel.com/new
2. Importe o repositório
3. Configure as variáveis de ambiente abaixo
4. Deploy!

### Environment Variables

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `SUPABASE_URL` | URL do projeto Supabase | `https://xxxxx.supabase.co` |
| `SUPABASE_KEY` | Service Role Key do Supabase | `eyJhbG...` |
| `RESEND_API_KEY` | API Key do Resend | `re_xxxxx` |
| `EMAIL_FROM` | Remetente dos emails | `CAOP-B <team@caop-b.com>` |
| `ADMIN_USER` | Usuário do painel admin | `admin` |
| `ADMIN_PASS` | **Senha forte para admin** | `mude_isto!` |
| `CRON_SECRET` | Secret para limpeza agendada | `random_secret` |
| `ALLOWED_ORIGINS` | Domínios permitidos (CORS) | `https://caop-b.com` |
| `REDIS_URL` | Redis (opcional) | `redis://xxxx` |
| `NODE_ENV` | Ambiente | `production` |

### Scripts

```bash
# Desenvolvimento
npm run dev

# Build para produção
npm run build

# Iniciar em produção
npm run start
```

## Endpoints da API

### Públicos
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/status` | Status do sistema |
| `POST` | `/api/auth/register` | Criar conta |
| `POST` | `/api/auth/verify-email` | Verificar email |
| `POST` | `/api/auth/verify-otp` | Verificar OTP |
| `POST` | `/api/auth/request-reset` | Solicitar reset de senha |
| `POST` | `/api/auth/reset-password` | Redefinir senha |

### Autenticados (Admin)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/users` | Listar usuários |
| `GET` | `/api/otps` | Listar OTPs |
| `GET` | `/api/logs` | Logs do sistema |
| `GET` | `/api/admin/metrics` | Métricas avançadas |
| `POST` | `/api/admin/cleanup` | Limpeza de dados |

## Segurança

- **Autenticação**: Painel admin protegido com login
- **Rate Limiting**: Proteção contra abuso por IP e usuário
- **CORS**: Configuração de origens permitidas
- **Security Headers**: X-Frame-Options, HSTS, XSS Protection
- **OTP Hash**: Códigos armazenados com bcrypt
- **Tentativas**: Máximo 3 tentativas por OTP
- **Expiração**: OTPs expiram automaticamente

## Monitoramento

- Health check: `/api/health`
- Status do sistema: `/api/status`
- Logs: Painel admin → Logs

## Stack

- **Next.js 14** - Framework React
- **Supabase** - Banco de dados PostgreSQL
- **Resend** - Envio de emails
- **Redis** (opcional) - Rate limiting distribuído
- **Tailwind CSS** - Estilização
- **bcryptjs** - Hash de senhas e OTPs
