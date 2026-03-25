ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.session_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    client_side_id uuid NOT NULL,
    timestamp timestamptz NOT NULL,
    cnsr numeric,
    ico numeric,
    injury_risk numeric,
    telemetry_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT session_metrics_session_client_unique UNIQUE (session_id, client_side_id)
);

CREATE INDEX IF NOT EXISTS session_metrics_session_id_idx ON public.session_metrics (session_id);

ALTER TABLE public.session_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY session_metrics_select_own ON public.session_metrics
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY session_metrics_insert_own ON public.session_metrics
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.sessions s
            WHERE s.id = session_id AND s.user_id = auth.uid()
        )
    );

CREATE POLICY session_metrics_update_own ON public.session_metrics
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY session_metrics_delete_own ON public.session_metrics
    FOR DELETE USING (auth.uid() = user_id);
