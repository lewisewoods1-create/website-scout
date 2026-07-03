import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { useQuery, useMutation } from "@/hooks/useApi";
import {
  Users,
  Building2,
  Mail,
  Search,
  Shield,
  UserCheck,
  Trash2,
  Crown,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router";

type UserItem = {
  id: number;
  name: string | null;
  email: string | null;
  role: string;
  type: string;
  createdAt: string | null;
  lastSignInAt: string | null;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user } = useAuth();
  const [userFilter, setUserFilter] = useState<"all" | "oauth" | "local">("all");
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: stats, isLoading: statsLoading } = useQuery<{
    businesses: number;
    leads: number;
    oauthUsers: number;
    localUsers: number;
    scoutJobs: number;
    emailDrafts: number;
  }>("admin.stats");

  const { data: usersData, isLoading: usersLoading } = useQuery<{
    oauth: UserItem[];
    local: UserItem[];
  }>("admin.users", { type: userFilter });

  const updateRoleMutation = useMutation<
    { userId: number; type: string; role: string },
    void
  >("admin.updateUserRole");

  const deleteUserMutation = useMutation<
    { userId: number; type: string },
    void
  >("admin.deleteUser");

  const handleUpdateRole = async (userId: number, type: string, currentRole: string) => {
    try {
      await updateRoleMutation.mutate({
        userId,
        type,
        role: currentRole === "admin" ? "user" : "admin",
      });
      addToast("Role updated", "success");
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : "Update failed", "error");
    }
  };

  const handleDeleteUser = async (userId: number, type: string) => {
    if (!confirm("Delete this user?")) return;
    try {
      await deleteUserMutation.mutate({ userId, type });
      addToast("User deleted", "success");
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  };

  const allUsers = [
    ...(usersData?.oauth || []),
    ...(usersData?.local || []),
  ].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-[#6c6c74] hover:text-[#f4f4f5]">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-[#f4f4f5] flex items-center gap-2">
            <Shield className="w-6 h-6 text-violet-400" />
            Admin Dashboard
          </h1>
          <p className="text-sm text-[#6c6c74]">Manage users and platform settings</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Businesses", value: stats?.businesses ?? 0, icon: Building2, color: "text-blue-400" },
          { label: "Leads", value: stats?.leads ?? 0, icon: UserCheck, color: "text-violet-400" },
          { label: "OAuth Users", value: stats?.oauthUsers ?? 0, icon: Users, color: "text-emerald-400" },
          { label: "Local Users", value: stats?.localUsers ?? 0, icon: Users, color: "text-amber-400" },
          { label: "Scout Jobs", value: stats?.scoutJobs ?? 0, icon: Search, color: "text-cyan-400" },
          { label: "Email Drafts", value: stats?.emailDrafts ?? 0, icon: Mail, color: "text-pink-400" },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-xl p-4"
          >
            <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
            <div className="data-mono text-xl font-bold text-[#f4f4f5]">{statsLoading ? "..." : stat.value}</div>
            <div className="text-[10px] text-[#6c6c74] uppercase tracking-wider">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Users Table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#2a2a2e] flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-[#f4f4f5] flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-400" />
            Users ({allUsers.length})
          </h2>
          <div className="flex gap-1">
            {(["all", "oauth", "local"] as const).map((f) => (
              <Button
                key={f}
                variant="ghost"
                size="sm"
                onClick={() => setUserFilter(f)}
                className={`text-xs capitalize ${
                  userFilter === f
                    ? "bg-violet-500/10 text-violet-400"
                    : "text-[#6c6c74] hover:text-[#f4f4f5]"
                }`}
              >
                {f}
              </Button>
            ))}
          </div>
        </div>

        {usersLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
          </div>
        ) : allUsers.length === 0 ? (
          <div className="p-8 text-center text-[#6c6c74]">No users found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2e] text-[#6c6c74] text-xs uppercase tracking-wider">
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Role</th>
                  <th className="text-left p-3">Joined</th>
                  <th className="text-left p-3">Last Sign In</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((u, i) => (
                  <motion.tr
                    key={`${u.type}-${u.id}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-[#1e1e22] hover:bg-[#1c1c20]"
                  >
                    <td className="p-3 text-[#f4f4f5] font-medium">{u.name || "—"}</td>
                    <td className="p-3 text-[#8c8c96]">{u.email || "—"}</td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          u.type === "oauth"
                            ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                            : "border-amber-500/30 text-amber-400 bg-amber-500/10"
                        }`}
                      >
                        {u.type}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          u.role === "admin"
                            ? "border-violet-500/30 text-violet-400 bg-violet-500/10"
                            : "border-[#2a2a2e] text-[#6c6c74]"
                        }`}
                      >
                        {u.role === "admin" && <Crown className="w-3 h-3 mr-1 inline" />}
                        {u.role}
                      </Badge>
                    </td>
                    <td className="p-3 text-[#6c6c74]">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-3 text-[#6c6c74]">
                      {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUpdateRole(u.id, u.type, u.role)}
                          className="text-[10px] h-7 px-2 text-[#6c6c74] hover:text-violet-400"
                        >
                          <Shield className="w-3 h-3 mr-1" />
                          {u.role === "admin" ? "Demote" : "Promote"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUser(u.id, u.type)}
                          className="text-[10px] h-7 px-2 text-[#6c6c74] hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Current User */}
      {user && (
        <div className="glass-panel rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Crown className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#f4f4f5]">{user.name || user.email}</p>
            <p className="text-xs text-[#6c6c74]">
              {user.authType} &bull; {user.role}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
