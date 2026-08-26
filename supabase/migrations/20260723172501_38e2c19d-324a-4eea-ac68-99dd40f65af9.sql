
-- Revoke EXECUTE from PUBLIC/anon/authenticated on SECURITY DEFINER trigger-only functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- has_role is used inside RLS policies (runs as invoker role via policy eval);
-- keep authenticated able to execute but remove anon/public.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
