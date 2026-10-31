import { useState, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { register } from "@/services/auth";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  EyeOff,
  Clock,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Check,
  ShieldCheck,
  Printer,
  Palette,
  ShoppingBag,
  Sparkles,
  Lock,
  Mail,
  User,
  Building2
} from "lucide-react";

export default function Register() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("designer"); // 'designer' | 'print_provider' | 'customer'
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registeredEntity, setRegisteredEntity] = useState(null);

  // Track user interactions for field errors
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    password: false,
    confirmPassword: false
  });

  const markTouched = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  // Real-time validation computation
  const errors = useMemo(() => {
    const errs = {};

    // Name validation
    if (!name.trim()) {
      errs.name = "Full name or company name is required";
    } else if (name.trim().length < 2) {
      errs.name = "Name must be at least 2 characters";
    }

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

    // Confirm password validation
    if (!confirmPassword) {
      errs.confirmPassword = "Confirm password is required";
    } else if (confirmPassword !== password) {
      errs.confirmPassword = "Passwords do not match";
    }

    // Role validation
    if (role !== "print_provider" && role !== "designer" && role !== "customer") {
      errs.role = "Please select a valid role";
    }

    return errs;
  }, [name, email, password, confirmPassword, role]);

  // Password strength calculation
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: "", color: "bg-slate-200", percent: 0, text: "" };
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 8) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 1) {
      return { score: 1, label: "Weak", color: "bg-rose-500", percent: 25, text: "text-rose-600" };
    } else if (score <= 3) {
      return { score: 2, label: "Fair", color: "bg-amber-500", percent: 55, text: "text-amber-600" };
    } else if (score === 4) {
      return { score: 3, label: "Good", color: "bg-sky-500", percent: 80, text: "text-sky-600" };
    }
    return { score: 4, label: "Strong", color: "bg-emerald-500", percent: 100, text: "text-emerald-600" };
  }, [password]);

  const isFormValid = Object.keys(errors).length === 0;

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setServerError(null);

    setTouched({
      name: true,
      email: true,
      password: true,
      confirmPassword: true
    });

    if (!isFormValid) {
      return;
    }

    setLoading(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        associated_provider_id: null
      });

      if (role === "print_provider" || role === "designer") {
        setRegisteredEntity({ name: name.trim(), email: email.trim(), role });
      } else {
        setLocation("/login");
      }
    } catch (err) {
      setServerError(err?.message || "Registration failed. Email may already be in use.");
    } finally {
      setLoading(false);
    }
  };

  // SUCCESS POPUP SCREEN: When a Designer or Print Provider registers and awaits Portal Admin review
  if (registeredEntity) {
    const isDesigner = registeredEntity.role === "designer";
    return (
      <div className="min-h-screen lg:h-screen w-full flex items-center justify-center bg-slate-50 px-4 py-8 text-slate-800 font-sans selection:bg-indigo-600 selection:text-white lg:overflow-hidden">
        <div className="w-full max-w-lg animate-in zoom-in-95 duration-300">
          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xl shadow-slate-200/50 p-6 sm:p-8 text-center space-y-5 relative overflow-hidden">
            {/* Top Gradient Accent */}
            <div
              className={`absolute top-0 left-0 right-0 h-1.5 ${
                isDesigner
                  ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                  : "bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600"
              }`}
            />
            
            {/* Icon Box */}
            <div
              className={`mx-auto size-16 rounded-2xl flex items-center justify-center shadow-2xs ${
                isDesigner
                  ? "bg-indigo-50 border border-indigo-200 text-indigo-600"
                  : "bg-amber-50 border border-amber-200 text-amber-600"
              }`}
            >
              {isDesigner ? (
                <Palette className="size-8" />
              ) : (
                <Clock className="size-8" />
              )}
            </div>

            {/* Heading & Badge */}
            <div className="space-y-1.5">
              <Badge
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  isDesigner
                    ? "bg-indigo-50 text-indigo-700 border-indigo-200/80"
                    : "bg-amber-50 text-amber-700 border-amber-200/80"
                }`}
              >
                {isDesigner ? "Designer Application Submitted" : "Registration Submitted"}
              </Badge>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Application Under Review
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
                Thank you, <span className="text-slate-900 font-bold">{registeredEntity.name}</span>.{" "}
                {isDesigner
                  ? "Your designer & creator studio account has been submitted and is currently queued for portal admin verification."
                  : "Your print manufacturing facility account is queued for verification."}
              </p>
            </div>

            {/* Status Checklist Box */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-left text-xs space-y-2">
              <div className="flex items-center gap-2 text-slate-800 font-semibold">
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                <span>
                  Account created for{" "}
                  <code className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 font-mono text-[11px]">
                    {registeredEntity.email}
                  </code>
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <CheckCircle2
                  className={`size-4 shrink-0 ${
                    isDesigner ? "text-indigo-500" : "text-amber-500"
                  }`}
                />
                <span>
                  {isDesigner
                    ? "Portal Superadmin reviews creator profile & storefront privileges"
                    : "Portal Superadmin verifies manufacturing capacity & tax compliance"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <CheckCircle2 className="size-4 text-slate-400 shrink-0" />
                <span>Instant access and email notification upon approval</span>
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-1">
              <Button
                onClick={() => setLocation("/login")}
                className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/20 cursor-pointer gap-2 transition-all"
              >
                <span>Return to Sign in</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:h-screen w-full flex flex-col lg:flex-row bg-slate-50 text-slate-800 font-sans selection:bg-indigo-600 selection:text-white lg:overflow-hidden">
      {/* LEFT COLUMN: Clean Light SaaS Showcase */}
      <div className="relative hidden lg:flex lg:w-5/12 xl:w-5/12 flex-col justify-between p-6 xl:p-8 overflow-hidden border-r border-slate-200/80 bg-gradient-to-br from-indigo-50/50 via-slate-50 to-indigo-100/30">
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
                Join Network
              </Badge>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">
              Enterprise Custom Apparel Ecosystem
            </span>
          </div>
        </div>

        {/* Center Copy */}
        <div className="relative z-10 my-auto py-4 space-y-4">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/90 border border-slate-200/90 text-slate-700 text-[11px] font-semibold shadow-2xs backdrop-blur-md">
            <Sparkles className="size-3.5 text-indigo-600" />
            <span>Multi-Tenant Apparel Platform</span>
          </div>

          <h1 className="text-2xl xl:text-3xl font-black tracking-tight text-slate-900 leading-snug">
            Build, sell, and fulfill custom apparel with zero upfront risk.
          </h1>

          <p className="text-xs xl:text-sm text-slate-600 leading-relaxed font-normal">
            Join thousands of creators and print facility hubs collaborating on high-fidelity apparel merchandising with instant digital mockups, transparent payouts, and real-time order tracking.
          </p>

          <div className="space-y-2 pt-3 border-t border-slate-200/80 text-xs text-slate-700">
            <div className="flex items-center gap-2.5">
              <div className="size-4.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                <Check className="size-3" />
              </div>
              <span className="font-medium">No subscription fees or inventory commitments required</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="size-4.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                <Check className="size-3" />
              </div>
              <span className="font-medium">Automated legal GST invoices & split settlement</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="size-4.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                <Check className="size-3" />
              </div>
              <span className="font-medium">Print-ready 300 DPI transparent PNG techpack generator</span>
            </div>
          </div>
        </div>

        {/* Bottom Guarantee */}
        <div className="relative z-10 pt-3 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="size-3.5 text-emerald-600" />
            <span>Strict data privacy & partner protection</span>
          </div>
          <span>© 2026 PrintPortal</span>
        </div>
      </div>

      {/* RIGHT COLUMN: Modern Light Register Form Console */}
      <div className="flex-1 w-full flex items-center justify-center p-4 sm:p-6 lg:p-6 overflow-y-auto lg:overflow-hidden bg-slate-50/60 lg:bg-slate-50/40">
        <div className="w-full max-w-lg bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-lg shadow-slate-200/40 space-y-3.5 animate-in fade-in duration-300">
          {/* Mobile Brand (Visible only when left hero is hidden) */}
          <div className="flex lg:hidden items-center gap-2.5 justify-center mb-1">
            <div className="size-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Printer className="size-4" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-slate-900">
              PRINT<span className="text-indigo-600">PORTAL</span>
            </span>
          </div>

          <div className="space-y-0.5 text-center lg:text-left">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Create your account
            </h2>
            <p className="text-xs text-slate-500">
              Select your platform role and enter your details to get started.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-3" noValidate>
            {/* Step 1: Interactive Role Selection Cards */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Select Your Role
              </label>
              <div className="grid grid-cols-3 gap-2">
                {/* 1. Designer Card */}
                <button
                  type="button"
                  onClick={() => setRole("designer")}
                  className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                    role === "designer"
                      ? "bg-indigo-50/80 border-indigo-600 text-slate-900 shadow-xs ring-2 ring-indigo-500/20"
                      : "bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100/70 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div
                      className={`p-1.5 rounded-lg transition-colors ${
                        role === "designer"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <Palette className="size-3.5" />
                    </div>
                    {role === "designer" && (
                      <span className="size-1.5 rounded-full bg-indigo-600" />
                    )}
                  </div>
                  <div className="text-xs font-bold text-slate-900">Designer</div>
                  <div className="text-[10px] text-slate-500 leading-tight truncate">
                    Sell apparel & earn
                  </div>
                </button>

                {/* 2. Print Provider Card */}
                <button
                  type="button"
                  onClick={() => setRole("print_provider")}
                  className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                    role === "print_provider"
                      ? "bg-purple-50/80 border-purple-600 text-slate-900 shadow-xs ring-2 ring-purple-500/20"
                      : "bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100/70 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div
                      className={`p-1.5 rounded-lg transition-colors ${
                        role === "print_provider"
                          ? "bg-purple-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <Building2 className="size-3.5" />
                    </div>
                    {role === "print_provider" && (
                      <span className="size-1.5 rounded-full bg-purple-600" />
                    )}
                  </div>
                  <div className="text-xs font-bold text-slate-900">Print Provider</div>
                  <div className="text-[10px] text-slate-500 leading-tight truncate">
                    Fulfill DTF & blanks
                  </div>
                </button>

                {/* 3. Retail Customer Card */}
                <button
                  type="button"
                  onClick={() => setRole("customer")}
                  className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                    role === "customer"
                      ? "bg-emerald-50/80 border-emerald-600 text-slate-900 shadow-xs ring-2 ring-emerald-500/20"
                      : "bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100/70 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div
                      className={`p-1.5 rounded-lg transition-colors ${
                        role === "customer"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <ShoppingBag className="size-3.5" />
                    </div>
                    {role === "customer" && (
                      <span className="size-1.5 rounded-full bg-emerald-600" />
                    )}
                  </div>
                  <div className="text-xs font-bold text-slate-900">Customer</div>
                  <div className="text-[10px] text-slate-500 leading-tight truncate">
                    Shop custom creator drops
                  </div>
                </button>
              </div>
            </div>

            {/* Name Field */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                {role === "print_provider" ? "Facility / Company Name" : "Full Name"}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="size-3.5" />
                </div>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    markTouched("name");
                    if (serverError) setServerError(null);
                  }}
                  onBlur={() => markTouched("name")}
                  placeholder={role === "print_provider" ? "e.g. Apex Apparel Printing Hub" : "e.g. Alex Morgan"}
                  type="text"
                  className={`h-9.5 pl-9 pr-3 rounded-lg bg-slate-50/60 border text-slate-900 text-xs sm:text-sm transition-all shadow-2xs focus-visible:ring-2 placeholder:text-slate-400 ${
                    touched.name
                      ? errors.name
                        ? "border-rose-400 focus-visible:ring-rose-400/20 bg-rose-50/20"
                        : "border-emerald-400/80 focus-visible:ring-emerald-500/20 bg-emerald-50/15"
                      : "border-slate-200 hover:border-slate-300 focus-visible:ring-indigo-500/20 focus-visible:border-indigo-600 focus-visible:bg-white"
                  }`}
                />
              </div>
              {touched.name && errors.name && (
                <p className="text-[11px] text-rose-600 flex items-center gap-1 mt-0.5 font-medium">
                  <AlertCircle className="size-3 shrink-0" />
                  <span>{errors.name}</span>
                </p>
              )}
            </div>

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
                <p className="text-[11px] text-rose-600 flex items-center gap-1 mt-0.5 font-medium">
                  <AlertCircle className="size-3 shrink-0" />
                  <span>{errors.email}</span>
                </p>
              )}
            </div>

            {/* Password & Confirm Password (Grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Password */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                  {password && (
                    <span className={`text-[10px] font-bold ${passwordStrength.text}`}>
                      {passwordStrength.label}
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
                    placeholder="Min. 6 chars"
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
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                {/* Strength Meter Bar */}
                {password && (
                  <div className="h-1 w-full bg-slate-100 border border-slate-200/60 rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full ${passwordStrength.color} transition-all duration-300`}
                      style={{ width: `${passwordStrength.percent}%` }}
                    />
                  </div>
                )}
                {touched.password && errors.password && (
                  <p className="text-[11px] text-rose-600 flex items-center gap-1 mt-0.5 font-medium">
                    <AlertCircle className="size-3 shrink-0" />
                    <span>{errors.password}</span>
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Confirm
                  </label>
                  {touched.confirmPassword && !errors.confirmPassword && confirmPassword && (
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                      <Check className="size-3" /> Match
                    </span>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="size-3.5" />
                  </div>
                  <Input
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      markTouched("confirmPassword");
                      if (serverError) setServerError(null);
                    }}
                    onBlur={() => markTouched("confirmPassword")}
                    placeholder="Repeat password"
                    type={showConfirmPassword ? "text" : "password"}
                    className={`h-9.5 pl-9 pr-9 rounded-lg bg-slate-50/60 border text-slate-900 text-xs sm:text-sm transition-all shadow-2xs focus-visible:ring-2 placeholder:text-slate-400 ${
                      touched.confirmPassword
                        ? errors.confirmPassword
                          ? "border-rose-400 focus-visible:ring-rose-400/20 bg-rose-50/20"
                          : "border-emerald-400/80 focus-visible:ring-emerald-500/20 bg-emerald-50/15"
                        : "border-slate-200 hover:border-slate-300 focus-visible:ring-indigo-500/20 focus-visible:border-indigo-600 focus-visible:bg-white"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirmPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                {touched.confirmPassword && errors.confirmPassword && (
                  <p className="text-[11px] text-rose-600 flex items-center gap-1 mt-0.5 font-medium">
                    <AlertCircle className="size-3 shrink-0" />
                    <span>{errors.confirmPassword}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Error Banner */}
            {serverError && (
              <div className="p-2.5 rounded-lg border bg-rose-50 border-rose-200 text-rose-800 flex items-start gap-2 text-xs animate-in fade-in duration-300">
                <AlertCircle className="size-3.5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold uppercase tracking-wider text-[10px] text-rose-900">Registration Failed</p>
                  <p className="mt-0.5 text-rose-700 text-[11px]">{serverError}</p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-1">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-md shadow-indigo-600/25 transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="size-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Switch to Login */}
          <div className="text-center pt-0.5 text-xs text-slate-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-bold text-indigo-600 hover:text-indigo-700 underline underline-offset-4 cursor-pointer"
            >
              Sign in to your console
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
