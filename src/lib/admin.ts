/**
 * Admin auth helpers — single hardcoded admin email gate.
 *
 * The /admin section is just for the product owner; we don't need
 * roles/RBAC yet. This file is the single source of truth — change
 * ADMIN_EMAIL here and the app + the SQL policies in 0009_admin.sql
 * (which hard-code the same string) need to stay in sync.
 */

export const ADMIN_EMAIL = "anytime.sync@gmail.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === ADMIN_EMAIL;
}
