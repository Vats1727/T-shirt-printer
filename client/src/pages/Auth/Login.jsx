import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation, Link } from "wouter";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Clock, AlertTriangle, AlertCircle, Check } from "lucide-react";

export default function Login() {
  const { loginWithCredentials } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // Track field interactions for real-time error display
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
      errs.email = "Please enter a valid email address (e.g. name@example.com)";
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

    // Reveal errors across all fields on submit attempt
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
      setServerError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/80 px-4 py-8">
      <div className="w-full max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          <div className="hidden md:flex flex-col justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-sky-600 to-blue-700 text-white p-10 shadow-lg">
            <h2 className="text-3xl font-extrabold tracking-tight mb-3">Welcome back</h2>
            <p className="text-indigo-100 text-sm leading-relaxed mb-6">
              Sign in to access your print and merchandise management console, configure custom apparel, and track production.
            </p>
            <div className="space-y-3 pt-4 border-t border-white/20 text-xs text-indigo-100">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Print Providers & Designers unified ecosystem</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Real-time order synchronization & catalog review</span>
              </div>
            </div>
          </div>

          <Card className="border border-slate-200 shadow-md">
            <CardHeader className="pb-4">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h1>
              <p className="text-sm text-muted-foreground">Enter your credentials to access your account.</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4" noValidate>
                {/* Email Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-700">Email Address</label>
                    {touched.email && !errors.email && (
                      <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Valid
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        markTouched("email");
                        if (serverError) setServerError(null);
                      }}
                      onBlur={() => markTouched("email")}
                      placeholder="you@example.com"
                      type="email"
                      className={`transition-colors pr-9 ${
                        touched.email
                          ? errors.email
                            ? "border-red-500 focus-visible:ring-red-400 bg-red-50/20"
                            : "border-emerald-500 focus-visible:ring-emerald-400 bg-emerald-50/10"
                          : ""
                      }`}
                    />
                    {touched.email && (
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        {errors.email ? (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <Check className="w-4 h-4 text-emerald-600" />
                        )}
                      </div>
                    )}
                  </div>
                  {touched.email && errors.email && (
                    <p className="text-xs text-red-600 flex items-center gap-1.5 mt-1 animate-in fade-in duration-200">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.email}</span>
                    </p>
                  )}
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-700">Password</label>
                    {touched.password && !errors.password && (
                      <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Valid
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        markTouched("password");
                        if (serverError) setServerError(null);
                      }}
                      onBlur={() => markTouched("password")}
                      placeholder="Enter password"
                      type={showPassword ? "text" : "password"}
                      className={`transition-colors pr-10 ${
                        touched.password
                          ? errors.password
                            ? "border-red-500 focus-visible:ring-red-400 bg-red-50/20"
                            : "border-emerald-500 focus-visible:ring-emerald-400 bg-emerald-50/10"
                          : ""
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {touched.password && errors.password && (
                    <p className="text-xs text-red-600 flex items-center gap-1.5 mt-1 animate-in fade-in duration-200">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.password}</span>
                    </p>
                  )}
                </div>

                {/* Server Error / Approval Notice Feedback */}
                {serverError && (
                  <div
                    className={`p-3.5 rounded-xl border flex items-start gap-3 text-sm animate-in fade-in duration-300 ${
                      serverError.toLowerCase().includes("pending") || serverError.toLowerCase().includes("review")
                        ? "bg-amber-50 border-amber-200 text-amber-900"
                        : serverError.toLowerCase().includes("rejected") || serverError.toLowerCase().includes("suspended")
                        ? "bg-red-50 border-red-200 text-red-900"
                        : "bg-red-50 border-red-200 text-red-700"
                    }`}
                  >
                    {serverError.toLowerCase().includes("pending") || serverError.toLowerCase().includes("review") ? (
                      <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-xs tracking-wide uppercase">
                        {serverError.toLowerCase().includes("pending")
                          ? "Approval Pending"
                          : serverError.toLowerCase().includes("rejected")
                          ? "Registration Rejected"
                          : serverError.toLowerCase().includes("suspended")
                          ? "Account Suspended"
                          : "Authentication Notice"}
                      </p>
                      <p className="mt-1 text-xs opacity-90 leading-relaxed">{serverError}</p>
                    </div>
                  </div>
                )}

                {/* Submit & Links */}
                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="submit"
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm transition-colors"
                    disabled={loading}
                  >
                    {loading ? "Signing in..." : "Sign in"}
                  </Button>
                  <Link href="/register" className="text-sm font-medium text-sky-600 hover:text-sky-700 hover:underline cursor-pointer">
                    Create an account
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
