import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  User,
  Mail,
  Shield,
  Key,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Building,
  Wallet,
  CreditCard,
  QrCode
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
  message: "Passwords don't match",
  path: ["confirmPassword"]
});
export default function SupplierProfile() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [userData, setUserData] = useState(null);
  const [providerData, setProviderData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Royalty Payout Settings state
  const [payoutMethod, setPayoutMethod] = useState("upi");
  const [upiId, setUpiId] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [savingPayout, setSavingPayout] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(passwordSchema)
  });

  useEffect(() => {
    async function fetchPayoutSettings() {
      if (!user?.id) return;
      try {
        let res = await fetch("/api/supplier/payout-profile", {
          headers: { Authorization: token ? `Bearer ${token}` : "" }
        });
        if (res.status === 404) {
          res = await fetch("/api/payouts/designer/profile", {
            headers: { Authorization: token ? `Bearer ${token}` : "" }
          });
        }
        if (res.ok) {
          const data = await res.json();
          if (data.payoutSettings) {
            setPayoutMethod(data.payoutSettings.method || "upi");
            setUpiId(data.payoutSettings.upi_id || "");
            setAccountNumber(data.payoutSettings.account_number || "");
            setIfsc(data.payoutSettings.ifsc || "");
            setAccountHolderName(data.payoutSettings.account_holder_name || "");
            setBankName(data.payoutSettings.bank_name || "");
          }
        }
      } catch (err) {
        console.warn("Could not load payout settings", err);
      }
    }
    fetchPayoutSettings();
  }, [user?.id, token]);

  async function handleSavePayoutSettings(e) {
    e.preventDefault();
    setSavingPayout(true);
    try {
      let res = await fetch("/api/supplier/payout-profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          method: payoutMethod,
          upi_id: upiId,
          account_number: accountNumber,
          ifsc,
          account_holder_name: accountHolderName,
          bank_name: bankName
        })
      });
      if (res.status === 404) {
        res = await fetch("/api/payouts/designer/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : ""
          },
          body: JSON.stringify({
            method: payoutMethod,
            upi_id: upiId,
            account_number: accountNumber,
            ifsc,
            account_holder_name: accountHolderName,
            bank_name: bankName
          })
        });
      }
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Payout Settings Saved",
          description: "Your royalty withdrawal details have been updated."
        });
      } else {
        toast({
          title: "Save Failed",
          description: data.message || "Failed to save payout settings",
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err.message || "Network error",
        variant: "destructive"
      });
    } finally {
      setSavingPayout(false);
    }
  }
  useEffect(() => {
    async function fetchProfile() {
      if (!user?.id) return;
      try {
        const res = await fetch(`/api/supplier/profile`, {
          headers: { Authorization: token ? `Bearer ${token}` : "" }
        });
        if (res.ok) {
          const data = await res.json();
          setUserData(data);
          if (data.associated_provider_id) {
            const pRes = await fetch(`/api/public/providers`, {
              headers: { Authorization: token ? `Bearer ${token}` : "" }
            });
            if (pRes.ok) {
              const providers = await pRes.json();
              const provider = providers.find((p) => p.id === data.associated_provider_id);
              if (provider) setProviderData(provider);
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch profile", e);
      }
    }
    fetchProfile();
  }, [user?.id, token]);
  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        toast({
          title: "Success",
          description: "Password updated successfully",
          variant: "default"
        });
        reset();
      } else {
        const errorData = await res.json();
        toast({
          title: "Error",
          description: errorData.message || "Failed to update password",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="w-full space-y-5 animate-in fade-in duration-300 pb-12">
      {/* Top Enterprise Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
            <User className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
              <span>Creator Studio</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500">Credentials & Security</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Designer Studio Profile
            </h1>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 border-primary/10 shadow-sm">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto size-20 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <User className="size-10 text-primary" />
            </div>
            <CardTitle>{userData?.name || user?.name}</CardTitle>
            <CardDescription className="capitalize">
              <Badge variant="secondary" className="mt-1 font-semibold">
                {userData?.role?.replace("_", " ") || user?.role?.replace("_", " ")}
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="size-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Email Address</span>
                <span className="font-medium">{userData?.email || user?.email}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Shield className="size-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Account Status</span>
                <span className={cn(
                  "font-medium capitalize",
                  userData?.status === "active" ? "text-green-600" : "text-yellow-600"
                )}>
                  {userData?.status || "Active"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Building className="size-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Print Network Access</span>
                <span className="font-medium text-indigo-600">All Print Providers (Open Catalog)</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="size-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Permissions</span>
                <span className="font-medium">Design Access Only</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-sm border-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Key className="size-5 text-primary" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your password to keep your account secure.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      placeholder="Enter your current password"
                      {...register("currentPassword")}
                      className={errors.currentPassword ? "border-red-500" : ""}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {errors.currentPassword && <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="size-3" />
                    {errors.currentPassword.message}
                  </p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        placeholder="At least 6 characters"
                        {...register("newPassword")}
                        className={errors.newPassword ? "border-red-500" : ""}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    {errors.newPassword && <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="size-3" />
                      {errors.newPassword.message}
                    </p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Repeat new password"
                      {...register("confirmPassword")}
                      className={errors.confirmPassword ? "border-red-500" : ""}
                    />
                    {errors.confirmPassword && <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="size-3" />
                      {errors.confirmPassword.message}
                    </p>}
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto min-w-[120px]"
                  >
                    {loading ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Royalty Payout Settings Card */}
          <Card className="shadow-sm border-emerald-500/20 bg-gradient-to-br from-emerald-50/20 to-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
                <Wallet className="size-5 text-emerald-600" />
                Royalty Payout Settings
              </CardTitle>
              <CardDescription>
                Configure your destination bank account or UPI ID to receive earned royalties from print sales.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSavePayoutSettings} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Payout Method</Label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPayoutMethod("upi")}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all",
                        payoutMethod === "upi"
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <QrCode className="size-4" />
                      Instant UPI
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayoutMethod("bank_transfer")}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all",
                        payoutMethod === "bank_transfer"
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <Building className="size-4" />
                      Bank Transfer (NEFT/IMPS)
                    </button>
                  </div>
                </div>

                {payoutMethod === "upi" ? (
                  <div className="space-y-2 animate-in fade-in">
                    <Label htmlFor="upiId" className="text-xs font-medium text-slate-700">
                      UPI ID (Virtual Payment Address) <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="upiId"
                      placeholder="e.g. artist@okhdfcbank or 9876543210@paytm"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="text-xs font-mono"
                      required
                    />
                    <p className="text-[11px] text-slate-500">
                      Earnings withdrawals will be credited directly to this UPI address by your print provider.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 animate-in fade-in">
                    <div className="space-y-1.5">
                      <Label htmlFor="accountHolder" className="text-xs font-medium text-slate-700">
                        Account Holder Name <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        id="accountHolder"
                        placeholder="Legal name on bank passbook"
                        value={accountHolderName}
                        onChange={(e) => setAccountHolderName(e.target.value)}
                        className="text-xs"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="accountNum" className="text-xs font-medium text-slate-700">
                          Account Number <span className="text-rose-500">*</span>
                        </Label>
                        <Input
                          id="accountNum"
                          placeholder="Bank account number"
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                          className="text-xs font-mono"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ifscCode" className="text-xs font-medium text-slate-700">
                          IFSC Code <span className="text-rose-500">*</span>
                        </Label>
                        <Input
                          id="ifscCode"
                          placeholder="e.g. HDFC0001234"
                          value={ifsc}
                          onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                          className="text-xs font-mono uppercase"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="bankName" className="text-xs font-medium text-slate-700">
                        Bank Name & Branch
                      </Label>
                      <Input
                        id="bankName"
                        placeholder="e.g. HDFC Bank, Indiranagar"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={savingPayout}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
                  >
                    {savingPayout ? "Saving..." : "Save Payout Details"}
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
