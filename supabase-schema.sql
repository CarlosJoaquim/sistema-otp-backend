-- SQL para criar as tabelas no Supabase SQL Editor
-- Execute este script no SQL Editor do seu projeto Supabase

-- Habilitar extensão uuid se ainda não estiver ativa
create extension if not exists "uuid-ossp";

-- Tabela de usuários (usando o mesmo nome do app React Native)
create table if not exists public.usuarios (
  id uuid default uuid_generate_v4() primary key,
  phone text unique not null,
  password_hash text not null,
  created_at timestamp with time zone default now()
);

-- Tabela de OTPs (códigos de verificação)
create table if not exists public.otps (
  id uuid default uuid_generate_v4() primary key,
  phone text not null,
  code text not null,
  message_id text,
  expires_at timestamp with time zone not null,
  verified boolean default false,
  attempts integer default 0,
  created_at timestamp with time zone default now()
);

-- Índices para melhor performance
create index if not exists idx_usuarios_phone on public.usuarios(phone);
create index if not exists idx_otps_phone on public.otps(phone);
create index if not exists idx_otps_expires_at on public.otps(expires_at);

-- Row Level Security (RLS) - desativado para o backend usar a service key
alter table public.usuarios disable row level security;
alter table public.otps disable row level security;

-- Adicionar coluna message_id se não existir (para tabelas já criadas)
alter table public.otps add column if not exists message_id text;

-- Função para limpar OTPs expirados (opcional, pode ser chamada periodicamente)
create or replace function public.cleanup_expired_otps()
returns void as $$
begin
  delete from public.otps where expires_at < now();
end;
$$ language plpgsql security definer;
