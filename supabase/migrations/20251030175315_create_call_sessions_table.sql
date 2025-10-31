-- Create Call Sessions Table
--
-- 1. New Tables
--   - call_sessions: Stores voice call session data
--     - id (uuid, primary key)
--     - call_sid (text, unique) - Twilio call identifier
--     - phone (text) - Caller phone number (hashed)
--     - started_at (timestamptz) - Call start time
--     - ended_at (timestamptz, nullable) - Call end time
--     - idempotency_token (text, unique) - Prevents duplicate orders
--     - order_type (int, nullable) - 5=DELIVERY, 10=TAKEAWAY, 20=DINING_TABLE
--     - branch_id (int, nullable) - Selected branch
--     - customer_id (int, nullable) - Laravel customer ID
--     - address_id (int, nullable) - Delivery address ID
--     - order_id (int, nullable) - Created order ID from Laravel
--     - order_serial_no (text, nullable) - Order confirmation number
--     - session_data (jsonb) - Full session state
--     - conversation_history (jsonb) - Conversation messages
--     - status (text) - active, completed, failed, abandoned
--     - error_message (text, nullable) - Error details
--     - created_at (timestamptz)
--     - updated_at (timestamptz)
--
-- 2. Indexes
--   - Index on call_sid for fast lookups
--   - Index on idempotency_token for duplicate prevention
--   - Index on phone for customer history
--   - Index on created_at for time-based queries
--
-- 3. Security
--   - Enable RLS on call_sessions table
--   - Add policy for service role access only

CREATE TABLE IF NOT EXISTS call_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid text UNIQUE NOT NULL,
  phone text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  idempotency_token text UNIQUE NOT NULL,
  order_type int,
  branch_id int,
  customer_id int,
  address_id int,
  order_id int,
  order_serial_no text,
  session_data jsonb DEFAULT '{}'::jsonb,
  conversation_history jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'abandoned')),
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_call_sid ON call_sessions(call_sid);
CREATE INDEX IF NOT EXISTS idx_call_sessions_idempotency_token ON call_sessions(idempotency_token);
CREATE INDEX IF NOT EXISTS idx_call_sessions_phone ON call_sessions(phone);
CREATE INDEX IF NOT EXISTS idx_call_sessions_created_at ON call_sessions(created_at DESC);

ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage all sessions"
  ON call_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
