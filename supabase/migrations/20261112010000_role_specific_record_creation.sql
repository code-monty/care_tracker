-- Creation permissions differ from editing permissions for appointments and tasks.
drop policy appointments_insert_managers on public.appointments;
create policy appointments_insert_secretary on public.appointments for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and status = 'active' and role = 'secretary'
    )
  );

drop policy tasks_insert_managers on public.tasks;
create policy tasks_insert_admin on public.tasks for insert to authenticated
  with check (public.is_admin(auth.uid()) and created_by = auth.uid());
