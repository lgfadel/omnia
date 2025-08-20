-- Add comment_id column to omnia_ticket_attachments to support attachments in comments
ALTER TABLE public.omnia_ticket_attachments 
ADD COLUMN comment_id UUID REFERENCES public.omnia_ticket_comments(id) ON DELETE CASCADE;

-- Create index for better performance when querying attachments by comment
CREATE INDEX idx_ticket_attachments_comment_id ON public.omnia_ticket_attachments(comment_id);

-- Update RLS policies to handle comment-based attachments
-- Users can view attachments if they can view the associated comment
DROP POLICY IF EXISTS "Anyone can view ticket attachments" ON public.omnia_ticket_attachments;
CREATE POLICY "Users can view ticket attachments" 
ON public.omnia_ticket_attachments 
FOR SELECT 
USING (
  auth.role() = 'authenticated'::text AND (
    -- Direct ticket attachments (comment_id is null)
    comment_id IS NULL OR
    -- Comment attachments (check if user can see the comment)
    EXISTS (
      SELECT 1 FROM public.omnia_ticket_comments 
      WHERE id = comment_id
    )
  )
);

-- Users can delete their own attachments or admins can delete any
DROP POLICY IF EXISTS "Users can delete their own ticket attachments or admins can delete any" ON public.omnia_ticket_attachments;
CREATE POLICY "Users can delete their own ticket attachments or admins can delete any" 
ON public.omnia_ticket_attachments 
FOR DELETE 
USING (
  (uploaded_by = auth.uid()) OR 
  (EXISTS ( 
    SELECT 1 FROM omnia_users
    WHERE ((omnia_users.auth_user_id = auth.uid()) AND ('ADMIN'::text = ANY (omnia_users.roles)))
  ))
);