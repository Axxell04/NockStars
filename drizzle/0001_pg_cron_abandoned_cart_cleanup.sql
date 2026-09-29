-- Migration: Setup pg_cron for abandoned cart cleanup
-- This migration sets up a cron job to clean up abandoned carts older than 30 days

-- Enable pg_cron extension (requires superuser, may need to be run manually in Supabase dashboard)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create function to clean up abandoned carts
CREATE OR REPLACE FUNCTION cleanup_abandoned_carts()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Delete cart_items for carts older than 30 days with no recent activity
    DELETE FROM cart_item
    WHERE cart_id IN (
        SELECT id FROM cart
        WHERE updated_at < NOW() - INTERVAL '30 days'
    );

    -- Delete abandoned carts older than 30 days
    DELETE FROM cart
    WHERE updated_at < NOW() - INTERVAL '30 days';
    
    RAISE NOTICE 'Cleaned up abandoned carts older than 30 days at %', NOW();
END;
$$;

-- Schedule the cleanup job to run daily at 3 AM UTC
-- Note: This requires pg_cron extension and superuser privileges
-- In Supabase, run this in the SQL editor or via dashboard:
-- SELECT cron.schedule('cleanup-abandoned-carts', '0 3 * * *', 'SELECT cleanup_abandoned_carts();');

-- To unschedule: SELECT cron.unschedule('cleanup-abandoned-carts');