/*
  # Hide all app tables from the GraphQL schema

  ## Summary
  Tables are visible in the GraphQL schema whenever anon or authenticated roles
  have SELECT privilege on them. The previous migration intentionally kept those
  grants so the PostgREST REST API continues to work (RLS still enforces row-level
  access). However, this causes Supabase to flag the tables as discoverable via
  GraphQL.

  The correct fix is to comment the tables out of the GraphQL schema using the
  `pg_catalog` `COMMENT ON TABLE ... IS '@graphql({"totalCount": {"enabled": false}})'`
  mechanism, or more precisely by setting the `omit` directive so pg_graphql skips them.

  We use `COMMENT ON TABLE ... IS '@graphql({"omit": true})'` to exclude every
  app table from the GraphQL schema entirely. This does not affect REST API access.

  ## Tables hidden from GraphQL
  - business_details
  - clients
  - employee_notifications
  - employees
  - guest_sessions
  - job_assignments
  - job_employee_notes
  - jobs
  - parts
  - time_entries
  - user_roles
*/

COMMENT ON TABLE public.business_details IS '@graphql({"omit": true})';
COMMENT ON TABLE public.clients IS '@graphql({"omit": true})';
COMMENT ON TABLE public.employee_notifications IS '@graphql({"omit": true})';
COMMENT ON TABLE public.employees IS '@graphql({"omit": true})';
COMMENT ON TABLE public.guest_sessions IS '@graphql({"omit": true})';
COMMENT ON TABLE public.job_assignments IS '@graphql({"omit": true})';
COMMENT ON TABLE public.job_employee_notes IS '@graphql({"omit": true})';
COMMENT ON TABLE public.jobs IS '@graphql({"omit": true})';
COMMENT ON TABLE public.parts IS '@graphql({"omit": true})';
COMMENT ON TABLE public.time_entries IS '@graphql({"omit": true})';
COMMENT ON TABLE public.user_roles IS '@graphql({"omit": true})';
