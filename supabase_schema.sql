-- =======================================================
-- BANCO DE DADOS SUPABASE - PROJETO ASSOMOBEC ENCOMENDAS
-- Copie e cole este código no SQL Editor do seu Supabase
-- (https://supabase.com/dashboard/project/gzwraiiqxzerrrwsbmxg/sql)
-- e clique em RUN
-- =======================================================

-- 1. Tabela de Moradores (residents)
CREATE TABLE IF NOT EXISTS public.residents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cpf TEXT,
    "createdAt" BIGINT NOT NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para tabela residents
DROP POLICY IF EXISTS "Permitir leitura para todos em residents" ON public.residents;
CREATE POLICY "Permitir leitura para todos em residents" ON public.residents
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercao para todos em residents" ON public.residents;
CREATE POLICY "Permitir insercao para todos em residents" ON public.residents
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualizacao para todos em residents" ON public.residents;
CREATE POLICY "Permitir atualizacao para todos em residents" ON public.residents
FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir exclusao para todos em residents" ON public.residents;
CREATE POLICY "Permitir exclusao para todos em residents" ON public.residents
FOR DELETE USING (true);


-- 2. Tabela de Encomendas (packages)
CREATE TABLE IF NOT EXISTS public.packages (
    id TEXT PRIMARY KEY,
    "residentId" TEXT NOT NULL,
    "photoDataUrl" TEXT,
    description TEXT,
    carrier TEXT,
    observations TEXT,
    "recipientCpf" TEXT,
    "registeredAt" BIGINT NOT NULL,
    "registeredBy" TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    "deliveredAt" BIGINT,
    "deliveredBy" TEXT
);

-- Habilitar RLS
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para tabela packages
DROP POLICY IF EXISTS "Permitir leitura para todos em packages" ON public.packages;
CREATE POLICY "Permitir leitura para todos em packages" ON public.packages
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercao para todos em packages" ON public.packages;
CREATE POLICY "Permitir insercao para todos em packages" ON public.packages
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualizacao para todos em packages" ON public.packages;
CREATE POLICY "Permitir atualizacao para todos em packages" ON public.packages
FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir exclusao para todos em packages" ON public.packages;
CREATE POLICY "Permitir exclusao para todos em packages" ON public.packages
FOR DELETE USING (true);
