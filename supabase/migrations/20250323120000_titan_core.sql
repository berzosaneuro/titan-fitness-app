-- TITAN SaaS — núcleo telemetría + perfiles (Supabase Postgres)
-- Ejecutar en SQL Editor o supabase db push.
-- Si el trigger falla: en Postgres 14+ sustituye la última línea por
--   EXECUTE FUNCTION public.handle_new_user();

-- Perfil público ligado a auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    email text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Sesiones de entrenamiento / monitorización
CREATE TABLE IF NOT EXISTS public.sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    status text NOT NULL CHECK (status IN ('active', 'completed', 'aborted')),
    started_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz
);

CREATE INDEX IF NOT EXISTS sessions_user_id_started_at_idx ON public.sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS sessions_user_status_idx ON public.sessions (user_id, status);

-- Telemetría (lotes desde cliente; user_id denormalizado para RLS eficiente)
CREATE TABLE IF NOT EXISTS public.telemetry (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    cnsr numeric,
    ico numeric,
    injury_risk numeric,
    heart_rate numeric,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telemetry_session_created_idx ON public.telemetry (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS telemetry_user_created_idx ON public.telemetry (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.injuries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    description text NOT NULL,
    severity numeric NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS injuries_user_created_idx ON public.injuries (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    session_id uuid REFERENCES public.sessions (id) ON DELETE SET NULL,
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notes_user_created_idx ON public.notes (user_id, created_at DESC);

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.injuries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- profiles: solo la fila del usuario
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- sessions
CREATE POLICY sessions_select_own ON public.sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY sessions_insert_own ON public.sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY sessions_update_own ON public.sessions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY sessions_delete_own ON public.sessions FOR DELETE USING (auth.uid() = user_id);

-- telemetry: mismo usuario y sesión propia
CREATE POLICY telemetry_select_own ON public.telemetry FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY telemetry_insert_own ON public.telemetry FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
        SELECT 1 FROM public.sessions s
        WHERE s.id = session_id AND s.user_id = auth.uid()
    )
);

-- injuries
CREATE POLICY injuries_select_own ON public.injuries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY injuries_insert_own ON public.injuries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY injuries_update_own ON public.injuries FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY injuries_delete_own ON public.injuries FOR DELETE USING (auth.uid() = user_id);

-- notes
CREATE POLICY notes_select_own ON public.notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY notes_insert_own ON public.notes FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
        session_id IS NULL
        OR EXISTS (
            SELECT 1 FROM public.sessions s
            WHERE s.id = session_id AND s.user_id = auth.uid()
        )
    )
);
CREATE POLICY notes_update_own ON public.notes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY notes_delete_own ON public.notes FOR DELETE USING (auth.uid() = user_id);

-- Perfil automático al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, created_at)
    VALUES (NEW.id, NEW.email, now())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_new_user();
