-- Add custom_fields JSONB column to the users table
-- Run this in the Supabase SQL Editor

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}';
