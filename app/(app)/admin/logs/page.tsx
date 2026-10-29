import Link from "next/link";
import { getLogPage, listLogUsers, LOG_ACTIONS, LOG_PAGE_SIZE, parseLogFilters, parseLogPage } from "@/lib/data/activity-logs";
import { activityDescription, formatLogDateTime, logActorName } from "@/lib/rules/activity-logs";
import styles from "./logs.module.css";

export default async function AdminLogsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const key of ["from", "to", "user", "activity", "page"]) {
    const value = raw[key];
    if (typeof value === "string") params.set(key, value);
  }
  const filters = parseLogFilters(params);
  const page = parseLogPage(params.get("page"));
  const [{ rows, count }, users] = await Promise.all([getLogPage(filters, page), listLogUsers()]);
  const pages = Math.max(1, Math.ceil(count / LOG_PAGE_SIZE));
  const pageLink = (number: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
    query.set("page", String(number));
    return `/admin/logs?${query}`;
  };
  const exportQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) exportQuery.set(key, value);

  return <main className={styles.page}>
    <header className={styles.heading}><div><h1>Activity Logs</h1><p>Staff and Admin activity, newest first. Times are shown in Manila time.</p></div><a className={styles.export} href={`/api/export/logs?${exportQuery}`}>Export to CSV</a></header>
    <section className={styles.panel} aria-label="Activity history">
      <form className={styles.filters} method="get" action="/admin/logs">
        <label>From<input type="date" name="from" defaultValue={filters.from} /></label>
        <label>To<input type="date" name="to" defaultValue={filters.to} /></label>
        <label>User<select name="user" defaultValue={filters.user}><option value="">All users</option>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name?.trim() || `Unnamed user (${user.id.slice(0, 8)})`}</option>)}</select></label>
        <label>Activity<select name="activity" defaultValue={filters.activity}><option value="">All activity</option>{LOG_ACTIONS.map((action) => <option key={action} value={action}>{action.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())}</option>)}</select></label>
        <button type="submit">Apply filters</button><Link href="/admin/logs">Clear</Link>
      </form>
      <div className={styles.tableScroll}><table><thead><tr><th scope="col">UpdateID</th><th scope="col">Date</th><th scope="col">Time</th><th scope="col">User</th><th scope="col">Activity</th></tr></thead><tbody>
        {rows.map((row) => { const stamp = formatLogDateTime(row.created_at); return <tr key={row.id}><td>{row.id}</td><td>{stamp.date}</td><td>{stamp.time}</td><td>{logActorName(row)}</td><td>{activityDescription(row)}</td></tr>; })}
        {rows.length === 0 && <tr><td colSpan={5} className={styles.empty}>{count ? "No entries on this page." : "No activity matches these filters."}</td></tr>}
      </tbody></table></div>
      <footer className={styles.footer}><span>{count ? `Showing ${(page - 1) * LOG_PAGE_SIZE + 1}–${Math.min(page * LOG_PAGE_SIZE, count)} of ${count} events` : "Showing 0 events"}</span><nav aria-label="Activity pages">{page > 1 && <Link href={pageLink(page - 1)}>Previous</Link>}<span>Page {page} of {pages}</span>{page < pages && <Link href={pageLink(page + 1)}>Next</Link>}</nav></footer>
    </section>
  </main>;
}
