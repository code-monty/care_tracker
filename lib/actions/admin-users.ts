"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveUser } from "@/lib/auth/session";
import { accountIdSchema, createAccountSchema, statusActionSchema, updateAccountSchema } from "@/lib/validation/admin-user";

export type AccountRow = { id: string; full_name: string | null; email: string | null; role: "admin" | "staff"; status: "pending" | "active" | "disabled"; created_at: string; must_change_password: boolean };
type ActionResult = { error?: string; password?: string };

const TEMPORARY_PASSWORD = "123456";

async function adminSession() {
  const { user, profile } = await requireActiveUser();
  if (profile.role !== "admin") throw new Error("Admin access required");
  return user.id;
}

export async function listUserAccounts(): Promise<AccountRow[]> {
  await adminSession();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles")
    .select("id, full_name, email, role, status, created_at, must_change_password")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load users");
  return (data ?? []) as AccountRow[];
}

export async function createUserAccount(input: unknown): Promise<ActionResult> {
  const actor = await adminSession();
  const parsed = createAccountSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the account details" };
  const admin = createAdminClient();
  const password = TEMPORARY_PASSWORD;
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email, password, email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (error || !data.user) return { error: "Unable to create account. Check whether the email is already in use." };
  const { error: profileError } = await admin.rpc("admin_set_profile", {
    p_actor: actor, p_target: data.user.id, p_full_name: parsed.data.fullName,
    p_role: parsed.data.role, p_status: "active", p_force_password_change: true,
    p_action: "create",
  });
  if (profileError) return { error: "Account was created pending. Please review it before allowing access." };
  revalidatePath("/admin/users");
  return { password };
}

export async function updateUserAccount(input: unknown): Promise<ActionResult> {
  const actor = await adminSession();
  const parsed = updateAccountSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the account details" };
  if (actor === parsed.data.id) return { error: "Manage your own account separately." };
  const supabase = await createClient();
  const { data: previous } = await supabase.from("profiles")
    .select("full_name, email, role, status").eq("id", parsed.data.id).maybeSingle();
  if (!previous) return { error: "Account not found" };
  const admin = createAdminClient();
  if (previous.email !== parsed.data.email) {
    const { error } = await admin.auth.admin.updateUserById(parsed.data.id, {
      email: parsed.data.email, email_confirm: true,
    });
    if (error) return { error: "Unable to change email. Check whether it is already in use." };
  }
  const { error } = await admin.rpc("admin_set_profile", {
    p_actor: actor, p_target: parsed.data.id, p_full_name: parsed.data.fullName,
    p_role: parsed.data.role, p_status: previous.status, p_force_password_change: null,
    p_action: previous.role !== parsed.data.role ? "role_change" : previous.email !== parsed.data.email ? "email_change" : "update",
  });
  if (error) return { error: "Unable to save account. Reload to review its current details." };
  revalidatePath("/admin/users");
  return {};
}

export async function setUserStatus(input: unknown): Promise<ActionResult> {
  const actor = await adminSession();
  const parsed = statusActionSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid account action" };
  if (actor === parsed.data.id) return { error: "Manage your own account separately." };
  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles")
    .select("full_name, role, status").eq("id", parsed.data.id).maybeSingle();
  if (!target) return { error: "Account not found" };
  if (target.status === parsed.data.status || (target.status === "pending" && parsed.data.status !== "active")) {
    return { error: "Invalid status change" };
  }
  const action = target.status === "pending" ? "approve" : parsed.data.status === "disabled" ? "deactivate" : "reactivate";
  const { error } = await createAdminClient().rpc("admin_set_profile", {
    p_actor: actor, p_target: parsed.data.id, p_full_name: target.full_name,
    p_role: target.role, p_status: parsed.data.status, p_force_password_change: null,
    p_action: action,
  });
  if (error) return { error: error.message.includes("last active Admin") ? "The last active Admin cannot be deactivated." : "Unable to change account status." };
  revalidatePath("/admin/users");
  return {};
}

export async function resetUserPassword(input: unknown): Promise<ActionResult> {
  const actor = await adminSession();
  const parsed = accountIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid account" };
  if (actor === parsed.data) return { error: "Manage your own account separately." };
  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles")
    .select("full_name, role, status").eq("id", parsed.data).maybeSingle();
  if (!target) return { error: "Account not found" };
  const admin = createAdminClient();
  const password = TEMPORARY_PASSWORD;
  const { error: profileError } = await admin.rpc("admin_set_profile", {
    p_actor: actor, p_target: parsed.data, p_full_name: target.full_name,
    p_role: target.role, p_status: target.status, p_force_password_change: true,
    p_action: "password_reset",
  });
  if (profileError) return { error: "Unable to prepare account for a temporary password." };
  const { error: authError } = await admin.auth.admin.updateUserById(parsed.data, { password });
  if (authError) return { error: "Password reset failed. The account now requires a password change; retry the reset." };
  revalidatePath("/admin/users");
  return { password };
}
