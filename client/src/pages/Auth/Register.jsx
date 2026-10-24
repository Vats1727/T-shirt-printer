import { useState, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { register } from "@/services/auth";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Eye, EyeOff, Clock, CheckCircle, ArrowRight, AlertCircle, Check, Info } from "lucide-react";

export default function Register() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("designer");
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registeredProvider, setRegisteredProvider] = useState(null);

  // Track which fields have been touched by user interaction
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
      errs.name = "Full name is required";
    } else if (name.trim().length < 2) {
      errs.name = "Name must be at least 2 characters";
    }

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

    // Confirm password validation
    if (!confirmPassword) {
      errs.confirmPassword = "Confirm password is required";
    } else if (confirmPassword !== password) {
      errs.confirmPassword = "Passwords do not match";
    }

    // Role validation
    if (role !== "print_provider" && role !== "designer") {
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
      return { score: 1, label: "Weak", color: "bg-red-500", percent: 25, text: "text-red-500" };
    } else if (score <= 3) {
      return { score: 2, label: "Fair", color: "bg-amber-500", percent: 60, text: "text-amber-600" };
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

    // Mark all fields touched on submit attempt
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
      if (role === "print_provider") {
        setRegisteredProvider({ name: name.trim(), email: email.trim() });
      } else {
        setLocation("/login");
      }
    } catch (err) {
      setServerError(err?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (registeredProvider) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg">
          <Card className="border-2 border-amber-200/60 shadow-xl overflow-hidden rounded-2xl bg-white animate-in zoom-in-95 duration-300">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-8 text-white text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3 shadow-inner">
                <Clock className="w-9 h-9 text-white" />
              </div>
              <h1 className="text-2xl font-black tracking-tight">Application Submitted</h1>
              <p className="text-amber-100 text-sm mt-1">Pending Portal Administrator Review</p>
            </div>
            <CardContent className="p-8 space-y-6 text-center">
              <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-4 text-left space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                  <CheckCircle className="w-4 h-4 text-amber-600" />
                  <span>Request Sent to Portal Administrator</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Welcome <strong>{registeredProvider.name || registeredProvider.email}</strong>! All new Print Provider applications require review and acceptance by the Portal Admin before login access is granted.
                </p>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                Once the administrator accepts your registration, you can log in to your Print Provider console.
              </p>

              <Button
                onClick={() => setLocation("/login")}
                className="w-full py-5 text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
              >
                Go to Sign In <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/80 px-4 py-8">
      <div className="w-full max-w-3xl">
        <Card className="border border-slate-200 shadow-md">
          <CardHeader className="space-y-1 pb-4">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create an account</h1>
            <p className="text-sm text-muted-foreground">Create a designer or print provider account.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4" noValidate>
              {/* Full Name */}
              <div className="md:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700">Name</label>
                  {touched.name && !errors.name && (
                    <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Valid
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      markTouched("name");
                      if (serverError) setServerError(null);
                    }}
                    onBlur={() => markTouched("name")}
                    placeholder="Full name"
                    className={`transition-colors pr-9 ${
                      touched.name
                        ? errors.name
                          ? "border-red-500 focus-visible:ring-red-400 bg-red-50/20"
                          : "border-emerald-500 focus-visible:ring-emerald-400 bg-emerald-50/10"
                        : ""
                    }`}
                  />
                  {touched.name && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      {errors.name ? (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      ) : (
                        <Check className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                  )}
                </div>
                {touched.name && errors.name && (
                  <p className="text-xs text-red-600 flex items-center gap-1.5 mt-1 animate-in fade-in duration-200">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errors.name}</span>
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700">Email</label>
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

              {/* Role Selection */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="designer">Designer</option>
                  <option value="print_provider">Print Provider</option>
                </select>
                {role === "print_provider" && (
                  <p className="text-xs text-amber-700 flex items-center gap-1 mt-1 bg-amber-50 p-1.5 rounded border border-amber-200/60">
                    <Info className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    <span>Requires Portal Admin review before login access is granted.</span>
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700">Password</label>
                  {password && (
                    <span className={`text-xs font-semibold ${passwordStrength.text}`}>
                      {passwordStrength.label}
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

                {/* Password strength progress bar */}
                {password.length > 0 && (
                  <div className="space-y-1 pt-0.5">
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                        style={{ width: `${passwordStrength.percent}%` }}
                      />
                    </div>
                  </div>
                )}

                {touched.password && errors.password ? (
                  <p className="text-xs text-red-600 flex items-center gap-1.5 mt-1 animate-in fade-in duration-200">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errors.password}</span>
                  </p>
                ) : (
                  touched.password && !errors.password && (
                    <p className="text-xs text-emerald-600 flex items-center gap-1.5 mt-1">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span>Password meets length requirement</span>
                    </p>
                  )
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700">Confirm Password</label>
                  {touched.confirmPassword && !errors.confirmPassword && confirmPassword.length > 0 && (
                    <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Match
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      markTouched("confirmPassword");
                      if (serverError) setServerError(null);
                    }}
                    onBlur={() => markTouched("confirmPassword")}
                    placeholder="Confirm password"
                    type={showConfirmPassword ? "text" : "password"}
                    className={`transition-colors pr-10 ${
                      touched.confirmPassword
                        ? errors.confirmPassword
                          ? "border-red-500 focus-visible:ring-red-400 bg-red-50/20"
                          : "border-emerald-500 focus-visible:ring-emerald-400 bg-emerald-50/10"
                        : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {touched.confirmPassword && errors.confirmPassword ? (
                  <p className="text-xs text-red-600 flex items-center gap-1.5 mt-1 animate-in fade-in duration-200">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errors.confirmPassword}</span>
                  </p>
                ) : (
                  touched.confirmPassword && !errors.confirmPassword && confirmPassword.length > 0 && (
                    <p className="text-xs text-emerald-600 flex items-center gap-1.5 mt-1">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span>Passwords match</span>
                    </p>
                  )
                )}
              </div>

              {/* Server error feedback */}
              {serverError && (
                <div className="md:col-span-2 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{serverError}</span>
                </div>
              )}

              {/* Submit & Links */}
              <div className="md:col-span-2 flex items-center justify-between mt-4">
                <Button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm transition-colors"
                  disabled={loading}
                >
                  {loading ? "Registering..." : "Register"}
                </Button>
                <Link href="/login" className="text-sm text-sky-600 hover:underline">
                  Already have an account?
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
