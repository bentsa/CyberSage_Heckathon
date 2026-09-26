-- =========================================================
-- Remove chat/Copilot tables (feature removed from the app)
-- =========================================================
DROP INDEX IF EXISTS public.idx_chat_messages_thread;
DROP TABLE IF EXISTS public.chat_messages;
DROP TABLE IF EXISTS public.chat_threads;
