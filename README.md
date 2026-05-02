# Sistema OTP Backend - CAOP-B

Sistema de gestão de verificação OTP via SMS e Email.

## Estrutura do Projeto

```
sistema-otp-backend/
├── backend/          # API Express (Node.js)
│   ├── index.js
│   ├── services/
│   ├── routes/
│   └── package.json
├── frontend/         # Frontend Next.js
│   ├── pages/
│   ├── public/
│   └── package.json
└── README.md
```

## Deploy no Vercel

### Backend (API)
1. Acesse https://vercel.com/new
2. Importe o repositório: `CarlosJoaquim/sistema-otp-backend`
3. **Root Directory:** `backend`
4. **Environment Variables:**
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `RESEND_API_KEY`
   - `EMAIL_FROM=team@caop-b.com`
   - `ADMIN_USER=admin`
   - `ADMIN_PASS=admin123`
   - `NODE_ENV=production`

### Frontend (Next.js)
1. Acesse https://vercel.com/new
2. Importe o repositório: `CarlosJoaquim/sistema-otp-backend`
3. **Root Directory:** `frontend`
4. **Environment Variables:**
   - `NEXT_PUBLIC_API_URL` = URL do backend (apos deploy)
   - `NEXT_PUBLIC_ADMIN_USER=admin`
   - `NEXT_PUBLIC_ADMIN_PASS=admin123`

## Desenvolvimento Local

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
