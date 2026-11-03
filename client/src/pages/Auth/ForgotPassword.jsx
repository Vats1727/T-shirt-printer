import { useState, useMemo, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { forgotPassword, verifyOtp, resetPassword } from "@/services/auth";
import {
  Mail,
  KeyRound,
  Lock,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Printer,
  ShieldCheck,
  RefreshCw,
  Sparkles
} from "lucide-react";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();

  // Wizard step: 1 = email, 2 = otp, 3 = new password, 4 = success
  const [step, setStep] = useState(1);

  // Form states
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [serverSuccess, setServerSuccess] = useState(null);

  // Resend cooldown timer (60s)
  const [cooldown, setCooldown] = useState(0);

  // OTP input refs
  const otpInputRefs = useRef([]);

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Email validation
  const isEmailValid = useMemo(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }, [email]);

  // Full OTP string
  const fullOtp = useMemo(() => otp.join(""), [otp]);
  const isOtpComplete = fullOtp.length === 6 && /^\d{6}$/.test(fullOtp);

  // Password validation & strength
  const passwordStrength = useMemo(() => {
    if (!newPassword) return { score: 0, label: "", color: "bg-slate-200" };
    let score = 0;
    if (newPassword.length >= 6) score += 1;
    if (newPassword.length >= 8) score += 1;
    if (/[0-9]/.test(newPassword)) score += 1;
    if (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1;

    if (score <= 1) return { score: 1, label: "Weak", color: "bg-rose-500", text: "text-rose-600" };
    if (score <= 3) return { score: 2, label: "Fair", color: "bg-amber-500", text: "text-amber-600" };
    if (score === 4) return { score: 3, label: "Good", color: "bg-sky-500", text: "text-sky-600" };
    return { score: 4, label: "Strong", color: "bg-emerald-500", text: "text-emerald-600" };
  }, [newPassword]);

  const isPasswordValid = newPassword.length >= 6 && newPassword === confirmPassword;

  // Handle OTP digit typing & navigation
  const handleOtpChange = (index, value) => {
    // Only accept numeric digits
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) {
      const newOtp = [...otp];
      newOtp[index] = "";
      setOtp(newOtp);
      return;
    }

    // If pasted multiple digits
    if (cleaned.length > 1) {
      const chars = cleaned.slice(0, 6).split("");
      const newOtp = [...otp];
      chars.forEach((c, i) => {
        if (index + i < 6) newOtp[index + i] = c;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + chars.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = cleaned[0];
    setOtp(newOtp);

    // Auto-advance
    if (index < 5 && cleaned[0]) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // STEP 1: Request 6-digit OTP
  const handleRequestOtp = async (e) => {
    e?.preventDefault();
    if (loading || !isEmailValid) return;

    setLoading(true);
    setServerError(null);
    setServerSuccess(null);

    try {
      const res = await forgotPassword(email.trim());
      setServerSuccess(res.message || "Verification code sent to your email.");
      setStep(2);
      setCooldown(60);
      setTimeout(() => otpInputRefs.current[0]?.focus(), 150);
    } catch (err) {
      setServerError(err?.message || "Failed to send reset code. Please check your email.");
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (loading || cooldown > 0) return;
    setLoading(true);
    setServerError(null);
    setServerSuccess(null);

    try {
      const res = await forgotPassword(email.trim());
      setServerSuccess(res.message || "A fresh 6-digit code has been sent to your email.");
      setCooldown(60);
      setOtp(["", "", "", "", "", ""]);
      otpInputRefs.current[0]?.focus();
    } catch (err) {
      setServerError(err?.message || "Failed to resend code.");
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    if (loading || !isOtpComplete) return;

    setLoading(true);
    setServerError(null);
    setServerSuccess(null);

    try {
      await verifyOtp(email.trim(), fullOtp);
      setStep(3);
    } catch (err) {
      setServerError(err?.message || "Invalid or expired code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: Reset Password
  const handleResetPassword = async (e) => {
    e?.preventDefault();
    if (loading || !isPasswordValid) return;

    setLoading(true);
    setServerError(null);
    setServerSuccess(null);

    try {
      await resetPassword(email.trim(), fullOtp, newPassword);
      setStep(4);
    } catch (err) {
      setServerError(err?.message || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50 text-slate-800 font-sans selection:bg-indigo-600 selection:text-white lg:h-screen lg:overflow-hidden">
      {/* Left Column: Clean Light SaaS Showcase (Matches Login Screen Background) */}
      <div className="relative hidden lg:flex lg:w-1/2 flex-col p-6 xl:p-10 overflow-hidden border-r border-slate-200/80 bg-gradient-to-br from-indigo-50/50 via-slate-50 to-indigo-100/30">
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

        {/* Hero Narrative */}
        <div className="relative z-10 max-w-xl my-auto py-4 space-y-4">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/90 border border-slate-200/90 text-slate-700 text-[11px] font-semibold shadow-2xs backdrop-blur-md">
            <ShieldCheck className="size-3.5 text-indigo-600" />
            <span>High-Security Account Recovery</span>
          </div>

          <h1 className="text-3xl xl:text-4xl font-black tracking-tight text-slate-900 leading-tight">
            Secure, verified access for your apparel workspace.
          </h1>

          <p className="text-xs xl:text-sm text-slate-600 leading-relaxed font-normal">
            Reset your password securely with 6-digit multi-channel verification delivered straight to your authorized business email.
          </p>

          <div className="pt-2 max-w-sm">
            <div className="p-3.5 rounded-xl bg-white/80 border border-slate-200/90 backdrop-blur-md space-y-1 hover:border-indigo-200 hover:shadow-xs transition-all shadow-2xs">
              <div className="size-7 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-1">
                <KeyRound className="size-3.5" />
              </div>
              <h4 className="text-xs font-bold text-slate-900">6-Digit Instant OTP</h4>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Expiring in 10 minutes for optimal security.</p>
            </div>
          </div>
        </div>

        {/* Bottom Security Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500 border-t border-slate-200/80 pt-4">
          <span>&copy; {new Date().getFullYear()} PrintPortal Network</span>
        </div>
      </div>

      {/* Right Column: Interactive Reset Wizard Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-y-auto lg:overflow-hidden bg-slate-50/60 lg:bg-slate-50/40">
        <div className="w-full max-w-md bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/90 shadow-lg shadow-slate-200/40 space-y-5 animate-in fade-in duration-300">
          {/* Mobile Top Brand */}
          <div className="flex lg:hidden items-center gap-2.5 justify-center mb-1">
            <div className="size-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Printer className="size-4" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-slate-900">
              PRINT<span className="text-indigo-600">PORTAL</span>
            </span>
          </div>

          {/* Stepper Progress Indicator */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`size-6 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
                    step > s
                      ? "bg-emerald-600 text-white"
                      : step === s
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {step > s ? <Check className="size-3" /> : s}
                </div>
                <span
                  className={`text-[11px] font-semibold hidden sm:inline ${
                    step >= s ? "text-slate-800" : "text-slate-400"
                  }`}
                >
                  {s === 1 ? "Email" : s === 2 ? "Verify Code" : "New Password"}
                </span>
                {s < 3 && <div className="w-6 h-0.5 bg-slate-100 mx-1" />}
              </div>
            ))}
          </div>

          {/* Feedback Banners */}
          {serverError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2 text-xs animate-in fade-in duration-200">
              <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{serverError}</div>
            </div>
          )}

          {serverSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2 text-xs animate-in fade-in duration-200">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{serverSuccess}</div>
            </div>
          )}

          {/* ---------------- STEP 1: ENTER EMAIL ---------------- */}
          {step === 1 && (
            <form onSubmit={handleRequestOtp} className="space-y-4" noValidate>
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                  Reset password
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Enter your registered business email and we&apos;ll send a 6-digit verification code to reset your password.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Email Address
                  </label>
                  {isEmailValid && (
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                      <Check className="size-3" /> Valid
                    </span>
                  )}
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="size-4" />
                  </div>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (serverError) setServerError(null);
                    }}
                    placeholder="name@business.com"
                    autoFocus
                    className="h-10 pl-9 pr-3 rounded-lg bg-slate-50/60 border border-slate-200 focus-visible:ring-indigo-500/20 focus-visible:border-indigo-600 text-sm"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !isEmailValid}
                className="w-full h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-sm shadow-md shadow-indigo-500/25 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="size-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>

              <div className="pt-2 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
                >
                  <ArrowLeft className="size-3.5" />
                  <span>Back to login</span>
                </Link>
              </div>
            </form>
          )}

          {/* ---------------- STEP 2: ENTER 6-DIGIT OTP ---------------- */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-5" noValidate>
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                  Enter 6-digit code
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  We sent a 6-digit verification code to{" "}
                  <strong className="text-slate-800 font-semibold">{email}</strong>.
                </p>
              </div>

              {/* 6 Digit Input Boxes */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block text-center">
                  Verification Code
                </label>
                <div className="flex items-center justify-center gap-2">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpInputRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className={`size-11 sm:size-12 rounded-xl text-center font-mono text-xl sm:text-2xl font-black bg-slate-50 border transition-all outline-none ${
                        digit
                          ? "border-indigo-600 bg-indigo-50/20 text-indigo-600 shadow-sm shadow-indigo-500/10"
                          : "border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Resend Action */}
              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setServerError(null);
                  }}
                  className="text-slate-500 hover:text-indigo-600 font-medium transition-colors cursor-pointer"
                >
                  Change email
                </button>

                {cooldown > 0 ? (
                  <span className="text-slate-400 font-medium">
                    Resend code in <strong className="text-slate-600 font-semibold">{cooldown}s</strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading}
                    className="text-indigo-600 hover:text-indigo-700 font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className="size-3" />
                    <span>Resend Code</span>
                  </button>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading || !isOtpComplete}
                className="w-full h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-sm shadow-md shadow-indigo-500/25 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="size-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Verify Code</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* ---------------- STEP 3: NEW PASSWORD ---------------- */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                  Set new password
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Create a new secure password for <strong className="text-slate-800 font-semibold">{email}</strong>.
                </p>
              </div>

              {/* New Password */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="size-4" />
                  </div>
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (serverError) setServerError(null);
                    }}
                    placeholder="At least 6 characters"
                    autoFocus
                    className="h-10 pl-9 pr-9 rounded-lg bg-slate-50/60 border border-slate-200 focus-visible:ring-indigo-500/20 focus-visible:border-indigo-600 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {newPassword && (
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Strength:</span>
                      <span className={`font-bold ${passwordStrength.text}`}>
                        {passwordStrength.label}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden flex gap-1">
                      {[1, 2, 3, 4].map((bar) => (
                        <div
                          key={bar}
                          className={`flex-1 h-full rounded-full transition-all ${
                            passwordStrength.score >= bar ? passwordStrength.color : "bg-slate-200"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Confirm Password
                  </label>
                  {confirmPassword && newPassword === confirmPassword && (
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                      <Check className="size-3" /> Matches
                    </span>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="size-4" />
                  </div>
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (serverError) setServerError(null);
                    }}
                    placeholder="Re-enter new password"
                    className="h-10 pl-9 pr-9 rounded-lg bg-slate-50/60 border border-slate-200 focus-visible:ring-indigo-500/20 focus-visible:border-indigo-600 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !isPasswordValid}
                className="w-full h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-sm shadow-md shadow-indigo-500/25 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="size-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Reset Password</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* ---------------- STEP 4: SUCCESS SCREEN ---------------- */}
          {step === 4 && (
            <div className="text-center py-4 space-y-5 animate-in zoom-in-95 duration-300">
              <div className="size-16 rounded-2xl bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="size-9" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-2xl font-black tracking-tight text-slate-900">
                  Password Updated!
                </h2>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                  Your password has been successfully reset. You can now use your new password to sign into your account.
                </p>
              </div>

              <Button
                onClick={() => setLocation("/login")}
                className="w-full h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-sm shadow-md shadow-indigo-500/25 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Proceed to Sign In</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

