update public.previsions_clients
set marge_estimee_planning = null
where planning_synced_at is null
  and marge_estimee_planning = 0;
