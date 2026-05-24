import type { User } from "@/context/AuthContext";

export function isAdminUser(user: Pick<User, "email"> | null | undefined): boolean {
  if (!user?.email) return false;
  return user.email.trim().toLowerCase() === "besnekfahri@gmail.com";
}
