import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation, Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  EyeOff,
  Clock,
  AlertTriangle,
  AlertCircle,
  Check,
  Printer,
  TrendingUp,
  Lock,
  Mail,
  Zap,
  ArrowRight
} from "lucide-react";

export default function Login() {
  const { loginWithCredentials } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // Track field interactions for real-time validation display
  const [touched, setTouched] = useState({
    email: false,
    password: false
  });

  const markTouched = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  // Real-time validation computation
  const errors = useMemo(() => {
    const errs = {};

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      errs.email = "Email address is required";
    } else if (!emailRegex.test(email.trim())) {
      errs.email = "Please enter a valid business email address";
    }

    // Password validation
    if (!password) {
      errs.password = "Password is required";
    } else if (password.length < 6) {
      errs.password = "Password must be at least 6 characters";
    }

    return errs;
  }, [email, password]);

  const isFormValid = Object.keys(errors).length === 0;

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setServerError(null);

    setTouched({
      email: true,
      password: true
    });

    if (!isFormValid) {
      return;
    }

    setLoading(true);
    try {
      const res = await loginWithCredentials(email.trim(), password);
      const role = res?.user?.role;
      if (role === "portal_admin") {
        window.location.replace("/portal/dashboard");
      } else if (role === "print_provider" || role === "admin") {
        window.location.replace("/admin/dashboard");
      } else if (role === "designer" || role === "supplier") {
        window.location.replace("/supplier/dashboard");
      } else if (role === "customer") {
        window.location.replace("/customer/dashboard");
      } else {
        window.location.replace("/");
      }
    } catch (err) {
      setServerError(err?.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = (demoEmail) => {
    setEmail(demoEmail);
    setPassword("123456");
    setTouched({ email: true, password: true });
    setServerError(null);
  };

  return (
    <div className="min-h-screen lg:h-screen w-full flex flex-col lg:flex-row bg-slate-50 text-slate-800 font-sans selection:bg-indigo-600 selection:text-white lg:overflow-hidden">
      {/* LEFT COLUMN: Clean Light SaaS Showcase */}
      <div className="relative hidden lg:flex lg:w-7/12 xl:w-7/12 flex-col justify-between p-6 xl:p-10 overflow-hidden border-r border-slate-200/80 bg-gradient-to-br from-indigo-50/50 via-slate-50 to-indigo-100/30">
        {/* Subtle Ambient Decorative Accents */}
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 right-0 w-96 h-96 bg-purple-200/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#6366f112_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        {/* Top Brand Identity */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 ring-4 ring-indigo-500/10">
            <Printer className="w-4.5 h-4.5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-slate-900">
                PRINT<span className="text-indigo-600">PORTAL</span>
              </span>
              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200/80 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 shadow-2xs">
                Enterprise
              </Badge>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">
              Unified Apparel Merchandising & Production Network
            </span>
          </div>
        </div>

        {/* Center Hero Copy & Capabilities */}
        <div className="relative z-10 max-w-xl my-auto py-4 space-y-4">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/90 border border-slate-200/90 text-slate-700 text-[11px] font-semibold shadow-2xs backdrop-blur-md">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Direct-to-Garment & DTF Production Cloud</span>
          </div>

          <h1 className="text-3xl xl:text-4xl font-black tracking-tight text-slate-900 leading-tight">
            Next-gen apparel fulfillment & creator commerce.
          </h1>

          <p className="text-xs xl:text-sm text-slate-600 leading-relaxed font-normal">
            A synchronized ecosystem connecting print manufacturing hubs, apparel designers, and global retail storefronts with automated financial settlements and high-DPI precision.
          </p>

          {/* Core Feature Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
            <div className="p-3 rounded-xl bg-white/80 border border-slate-200/90 backdrop-blur-md hover:border-indigo-200 hover:shadow-xs transition-all">
              <div className="size-7 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-2 shadow-2xs">
                <Printer className="size-3.5" />
              </div>
              <h4 className="text-xs font-bold text-slate-900">DTF & Vector Specs</h4>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                Automated 300 DPI transparent mockups & techpacks.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/80 border border-slate-200/90 backdrop-blur-md hover:border-purple-200 hover:shadow-xs transition-all">
              <div className="size-7 rounded-lg bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center mb-2 shadow-2xs">
                <Zap className="size-3.5" />
              </div>
              <h4 className="text-xs font-bold text-slate-900">Automated Splits</h4>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                100% balanced splits across Provider, Platform & Creator.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/80 border border-slate-200/90 backdrop-blur-md hover:border-emerald-200 hover:shadow-xs transition-all">
              <div className="size-7 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mb-2 shadow-2xs">
                <TrendingUp className="size-3.5" />
              </div>
              <h4 className="text-xs font-bold text-slate-900">Real-Time Sync</h4>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                Live courier tracking with payment gateway reconciliation.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Platform Guarantee */}
        <div className="relative z-10 pt-3 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
          <span className="font-medium">Protected by Enterprise 256-bit SSL</span>
          <span>© 2026 PrintPortal</span>
        </div>
      </div>

      {/* RIGHT COLUMN: Modern Light Auth Console */}
      <div className="flex-1 w-full flex items-center justify-center p-4 sm:p-6 lg:p-6 overflow-y-auto lg:overflow-hidden bg-slate-50/60 lg:bg-slate-50/40">
        <div className="w-full max-w-md bg-white p-5 sm:p-7 rounded-2xl border border-slate-200/90 shadow-lg shadow-slate-200/40 space-y-4 animate-in fade-in duration-300">
          {/* Mobile Top Brand (Visible only when left hero is hidden) */}
          <div className="flex lg:hidden items-center gap-2.5 justify-center mb-1">
            <div className="size-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Printer className="size-4" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-slate-900">
              PRINT<span className="text-indigo-600">PORTAL</span>
            </span>
          </div>

          {/* Form Header */}
          <div className="space-y-0.5 text-center lg:text-left">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Welcome back
            </h2>
            <p className="text-xs text-slate-500">
              Sign in to manage your orders, printing queues, and apparel storefronts.
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={submit} className="space-y-3" noValidate>
            {/* Email Field */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Email Address
                </label>
                {touched.email && !errors.email && (
                  <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                    <Check className="size-3" /> Valid
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="size-3.5" />
                </div>
                <Input
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    markTouched("email");
                    if (serverError) setServerError(null);
                  }}
                  onBlur={() => markTouched("email")}
                  placeholder="name@business.com"
                  type="email"
                  className={`h-9.5 pl-9 pr-3 rounded-lg bg-slate-50/60 border text-slate-900 text-xs sm:text-sm transition-all shadow-2xs focus-visible:ring-2 placeholder:text-slate-400 ${
                    touched.email
                      ? errors.email
                        ? "border-rose-400 focus-visible:ring-rose-400/20 bg-rose-50/20"
                        : "border-emerald-400/80 focus-visible:ring-emerald-500/20 bg-emerald-50/15"
                      : "border-slate-200 hover:border-slate-300 focus-visible:ring-indigo-500/20 focus-visible:border-indigo-600 focus-visible:bg-white"
                  }`}
                />
              </div>
              {touched.email && errors.email && (
                <p className="text-[11px] text-rose-600 flex items-center gap-1 mt-0.5 font-medium animate-in fade-in duration-200">
                  <AlertCircle className="size-3 shrink-0" />
                  <span>{errors.email}</span>
                </p>
              )}
            </div>

            {/* Password Field with Working Eye Toggle */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                {touched.password && !errors.password && (
                  <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                    <Check className="size-3" /> Valid
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="size-3.5" />
                </div>
                <Input
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    markTouched("password");
                    if (serverError) setServerError(null);
                  }}
                  onBlur={() => markTouched("password")}
                  placeholder="Enter your password"
                  type={showPassword ? "text" : "password"}
                  className={`h-9.5 pl-9 pr-9 rounded-lg bg-slate-50/60 border text-slate-900 text-xs sm:text-sm transition-all shadow-2xs focus-visible:ring-2 placeholder:text-slate-400 ${
                    touched.password
                      ? errors.password
                        ? "border-rose-400 focus-visible:ring-rose-400/20 bg-rose-50/20"
                        : "border-emerald-400/80 focus-visible:ring-emerald-500/20 bg-emerald-50/15"
                      : "border-slate-200 hover:border-slate-300 focus-visible:ring-indigo-500/20 focus-visible:border-indigo-600 focus-visible:bg-white"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
              {touched.password && errors.password && (
                <p className="text-[11px] text-rose-600 flex items-center gap-1 mt-0.5 font-medium animate-in fade-in duration-200">
                  <AlertCircle className="size-3 shrink-0" />
                  <span>{errors.password}</span>
                </p>
              )}
            </div>

            {/* Server Error / Status Feedback Banner */}
            {serverError && (
              <div
                className={`p-2.5 rounded-lg border flex items-start gap-2 text-xs animate-in fade-in duration-300 ${
                  serverError.toLowerCase().includes("pending") || serverError.toLowerCase().includes("review")
                    ? "bg-amber-50 border-amber-200 text-amber-800"
                    : serverError.toLowerCase().includes("rejected") || serverError.toLowerCase().includes("suspended")
                    ? "bg-rose-50 border-rose-200 text-rose-800"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}
              >
                {serverError.toLowerCase().includes("pending") || serverError.toLowerCase().includes("review") ? (
                  <Clock className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="size-3.5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-bold tracking-wide uppercase text-[10px]">
                    {serverError.toLowerCase().includes("pending")
                      ? "Account Under Review"
                      : serverError.toLowerCase().includes("rejected")
                      ? "Registration Rejected"
                      : serverError.toLowerCase().includes("suspended")
                      ? "Account Suspended"
                      : "Authentication Error"}
                  </p>
                  <p className="mt-0.5 text-[11px] opacity-90 leading-relaxed">{serverError}</p>
                </div>
              </div>
            )}

            {/* Submit Action */}
            <div className="pt-1">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-sm shadow-md shadow-indigo-500/25 transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="size-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign in to Console</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Quick Demo Access Bar */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-semibold">Quick Demo:</span>
            <button
              type="button"
              onClick={() => handleFillDemo("portaladmin@gmail.com")}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 border border-slate-200/80 hover:border-indigo-200 text-[11px] font-semibold text-slate-700 hover:text-indigo-700 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span className="size-1.5 rounded-full bg-purple-600" />
              Portal Superadmin
            </button>
          </div>

          {/* Switch to Register */}
          <div className="text-center pt-0.5 text-xs text-slate-500">
            Don&apos;t have an account yet?{" "}
            <Link
              href="/register"
              className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer"
            >
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
