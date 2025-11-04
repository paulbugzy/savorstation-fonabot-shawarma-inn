/*
  # Create update_call_session function
  
  Creates a PostgreSQL function to update call sessions, avoiding PostgREST schema cache issues.
  
  The function updates all session fields including:
  - session_data (jsonb)
  - conversation_history (jsonb)
  - order_type (integer)
  - branch_id (integer)
  - customer_id (integer)
  - address_id (integer)
  - updated_at (timestamp)
*/

CREATE OR REPLACE FUNCTION update_call_session(
  p_call_sid text,
  p_session_data jsonb,
  p_conversation_history jsonb,
  p_order_type int DEFAULT NULL,
  p_branch_id int DEFAULT NULL,
  p_customer_id int DEFAULT NULL,
  p_address_id int DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE call_sessions
  SET
    session_data = p_session_data,
    conversation_history = p_conversation_history,
    order_type = p_order_type,
    branch_id = p_branch_id,
    customer_id = p_customer_id,
    address_id = p_address_id,
    updated_at = now()
  WHERE call_sid = p_call_sid;
END;
$$;