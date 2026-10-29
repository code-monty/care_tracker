import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAllFilteredLogs, parseLogFilters } from "@/lib/data/activity-logs";
import { activityDescription, formatLogDateTime, logActorName } from "@/lib/rules/activity-logs";
import { requireActiveUser } from "@/lib/auth/session";

function csvCell(value: string | number) {
  let text = String(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  const { user, profile } = await requireActiveUser();
  if (profile.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
  const rows = await getAllFilteredLogs(parseLogFilters(request.nextUrl.searchParams));
  const header = ["UpdateID", "Date", "Time", "User", "Activity"];
  const body = rows.map((row) => {
    const stamp = formatLogDateTime(row.created_at);
    return [row.id, stamp.date, stamp.time, logActorName(row), activityDescription(row)].map(csvCell).join(",");
  });
  const { error } = await createAdminClient().rpc("log_activity", {
    p_actor_id: user.id, p_action: "export", p_entity_type: "activity_log", p_entity_id: null,
  });
  if (error) throw new Error("Unable to audit activity export");
  return new NextResponse(`\uFEFF${[header.map(csvCell).join(","), ...body].join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="caretracker-activity-logs.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
