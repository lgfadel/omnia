ALTER TABLE public.omnia_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.omnia_notifications;
CREATE POLICY "Users can view own notifications"
ON public.omnia_notifications
FOR SELECT
USING (
  auth.role() = 'authenticated'::text
  AND user_id = (
    SELECT id FROM public.omnia_users WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.omnia_notifications;
CREATE POLICY "Users can update own notifications"
ON public.omnia_notifications
FOR UPDATE
USING (
  auth.role() = 'authenticated'::text
  AND user_id = (
    SELECT id FROM public.omnia_users WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  auth.role() = 'authenticated'::text
  AND user_id = (
    SELECT id FROM public.omnia_users WHERE auth_user_id = auth.uid()
  )
);
