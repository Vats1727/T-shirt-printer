import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import {
  User,
  Mail,
  Shield,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Crown,
  Lock,
  Save,
  DollarSign,
  FileText,
  UserCheck,
  Building2,
  Sparkles
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your new password")
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

export default function PortalAdminProfile() {
  const { user, token, updateUser } = useAuth();
  const { toast } = useToast();

  const [userData, setUserData] = useState(null);
  const [fetchingProfile, setFetchingProfile] = useState(true);

  // Profile Edit State
  const [adminName, setAdminName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Password Visibility States (Active working eye toggles)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(passwordSchema)
  });

  // Fetch full profile info from portal endpoint
  useEffect(() => {
    async function fetchProfile() {
      if (!token) return;
      try {
        setFetchingProfile(true);
        const res = await fetch("/api/portal/profile", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUserData(data);
          setAdminName(data?.name || user?.name || "");
        } else {
          setAdminName(user?.name || "");
        }
      } catch (e) {
        console.error("Failed to fetch portal admin profile:", e);
        setAdminName(user?.name || "");
      } finally {
        setFetchingProfile(false);
      }
    }
    fetchProfile();
  }, [token, user?.name]);

  // Handle Profile Name Update
  const handleUpdateName = async (e) => {
    e.preventDefault();
    if (!adminName.trim()) {
      toast({
        title: "Validation Error",
        description: "Name cannot be empty.",
        variant: "destructive"
      });
      return;
    }

    setSavingName(true);
    try {
      const res = await fetch("/api/portal/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: adminName.trim() })
      });

      if (res.ok) {
        toast({
          title: "Profile Updated",
          description: "Portal administrator name successfully updated."
        });
        updateUser({ name: adminName.trim() });
        setUserData((prev) => ({ ...prev, name: adminName.trim() }));
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Update Failed",
          description: err.message || "Failed to update profile name.",
          variant: "destructive"
        });
      }
    } catch (e) {
      toast({
        title: "Network Error",
        description: "Failed to connect to server. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSavingName(false);
    }
  };

  // Handle Change Password Form Submission
  const onPasswordSubmit = async (data) => {
    setUpdatingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword
        })
      });

      if (res.ok) {
        toast({
          title: "Password Updated Successfully",
          description: "Your portal administrator password has been updated."
        });
        reset();
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast({
          title: "Password Update Failed",
          description: errorData.message || "Incorrect current password or invalid request.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred while updating password.",
        variant: "destructive"
      });
    } finally {
      setUpdatingPassword(false);
    }
  };

  const displayName = userData?.name || user?.name || "Portal Superadmin";
  const displayEmail = userData?.email || user?.email || "admin@printportal.com";

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-br from-purple-600 to-indigo-700 text-white rounded-2xl shadow-md">
            <Crown className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Portal Admin Profile & Security
              </h1>
              <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] font-bold uppercase tracking-wider">
                Superadmin
              </Badge>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              Manage your administrator credentials, access permissions, and account password.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Admin Identity & System Access Badge */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="rounded-2xl border-slate-200/80 bg-white shadow-xs overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-purple-700 via-indigo-600 to-violet-700 relative">
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
                <div className="size-20 rounded-2xl bg-white p-1.5 shadow-md border border-slate-100 flex items-center justify-center">
                  <div className="size-full rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-white text-2xl font-black shadow-inner">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                </div>
              </div>
            </div>

            <CardContent className="pt-12 text-center pb-6">
              <h2 className="text-lg font-black text-slate-900">{displayName}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{displayEmail}</p>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold mt-3">
                <ShieldCheck className="size-3.5 text-purple-600" />
                <span>Portal Superadmin</span>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-100 space-y-3.5 text-left text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Account Role:</span>
                  <Badge variant="outline" className="font-bold text-[11px] bg-slate-50 text-slate-800">
                    portal_admin
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Account Status:</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-600 text-xs">
                    <CheckCircle2 className="size-3.5" />
                    Active (Global Access)
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Governance Level:</span>
                  <span className="font-bold text-slate-800 text-[11px]">
                    Unrestricted Superadmin
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Platform Shortcuts */}
          <Card className="rounded-2xl border-slate-200/80 bg-white shadow-xs p-4 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">
              Superadmin Hub
            </span>
            <div className="space-y-1">
              <Link
                href="/portal/financials"
                className="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <DollarSign className="size-4 text-indigo-600" />
                  Financial Governance
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Margins & Tax</span>
              </Link>
              <Link
                href="/portal/ledger"
                className="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <FileText className="size-4 text-purple-600" />
                  Partner Financial Ledger
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Payouts</span>
              </Link>
              <Link
                href="/portal/requests"
                className="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <UserCheck className="size-4 text-emerald-600" />
                  Provider Verification
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Approvals</span>
              </Link>
            </div>
          </Card>
        </div>

        {/* Right Column: Profile Edit & Change Password Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Account Information */}
          <Card className="rounded-2xl border-slate-200/80 bg-white shadow-xs">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <User className="size-4" />
                </div>
                <span>Administrative Information</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Update your display name and view primary system credentials.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2">
              <form onSubmit={handleUpdateName} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="adminName" className="text-xs font-bold text-slate-700">
                      Administrator Name
                    </Label>
                    <Input
                      id="adminName"
                      type="text"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="e.g. Platform Administrator"
                      className="rounded-xl border-slate-200 text-sm focus-visible:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="adminEmail" className="text-xs font-bold text-slate-700">
                      Email Address (System Login)
                    </Label>
                    <Input
                      id="adminEmail"
                      type="email"
                      value={displayEmail}
                      disabled
                      className="rounded-xl border-slate-200 bg-slate-50 text-slate-500 text-sm cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    type="submit"
                    disabled={savingName || !adminName.trim() || adminName.trim() === (userData?.name || user?.name)}
                    className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {savingName ? (
                      <div className="size-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    <span>Save Name</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Card 2: Security & Change Password (with active working eye toggles) */}
          <Card className="rounded-2xl border-slate-200/80 bg-white shadow-xs">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
                  <Lock className="size-4" />
                </div>
                <span>Change Administrator Password</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Update your security password. Click the eye icon in any field to show or hide the entered characters.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2">
              <form onSubmit={handleSubmit(onPasswordSubmit)} className="space-y-4">
                {/* 1. Current Password Field with Eye Toggle */}
                <div className="space-y-1.5">
                  <Label htmlFor="currentPassword" className="text-xs font-bold text-slate-700">
                    Current Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      placeholder="Enter your existing portal password"
                      {...register("currentPassword")}
                      className={cn(
                        "rounded-xl pr-10 border-slate-200 text-sm focus-visible:ring-purple-500",
                        errors.currentPassword ? "border-red-500 focus-visible:ring-red-400" : ""
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer rounded-md focus:outline-hidden"
                      aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                      title={showCurrentPassword ? "Hide current password" : "Show current password"}
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="size-4 text-purple-600" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                  {errors.currentPassword && (
                    <p className="text-xs text-red-500 flex items-center gap-1 mt-1 font-medium">
                      <AlertCircle className="size-3 shrink-0" />
                      {errors.currentPassword.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 2. New Password Field with Eye Toggle */}
                  <div className="space-y-1.5">
                    <Label htmlFor="newPassword" className="text-xs font-bold text-slate-700">
                      New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        placeholder="At least 6 characters"
                        {...register("newPassword")}
                        className={cn(
                          "rounded-xl pr-10 border-slate-200 text-sm focus-visible:ring-purple-500",
                          errors.newPassword ? "border-red-500 focus-visible:ring-red-400" : ""
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer rounded-md focus:outline-hidden"
                        aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                        title={showNewPassword ? "Hide new password" : "Show new password"}
                      >
                        {showNewPassword ? (
                          <EyeOff className="size-4 text-purple-600" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                    {errors.newPassword && (
                      <p className="text-xs text-red-500 flex items-center gap-1 mt-1 font-medium">
                        <AlertCircle className="size-3 shrink-0" />
                        {errors.newPassword.message}
                      </p>
                    )}
                  </div>

                  {/* 3. Confirm New Password Field with Eye Toggle */}
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-xs font-bold text-slate-700">
                      Confirm New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Repeat your new password"
                        {...register("confirmPassword")}
                        className={cn(
                          "rounded-xl pr-10 border-slate-200 text-sm focus-visible:ring-purple-500",
                          errors.confirmPassword ? "border-red-500 focus-visible:ring-red-400" : ""
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer rounded-md focus:outline-hidden"
                        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                        title={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="size-4 text-purple-600" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-xs text-red-500 flex items-center gap-1 mt-1 font-medium">
                        <AlertCircle className="size-3 shrink-0" />
                        {errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
                  <p className="text-[11px] text-slate-400">
                    Must be at least 6 characters. Use letters, numbers & symbols for security.
                  </p>
                  <Button
                    type="submit"
                    disabled={updatingPassword}
                    className="h-10 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {updatingPassword ? (
                      <div className="size-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Key className="size-4" />
                    )}
                    <span>Update Password</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

