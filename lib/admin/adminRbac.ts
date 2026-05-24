export function isAdmin(user: any): boolean {
  const role =
    user?.role ??
    user?.user_metadata?.role ??
    user?.raw_user_meta_data?.role;
  return role === "admin";
}
