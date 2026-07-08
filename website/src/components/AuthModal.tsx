import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import { X, Mail, Lock, User, ArrowRight, Loader2, KeyRound, ArrowLeft } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: "signin" | "signup";
  initialStep?: "signin" | "signup" | "forgot";
}

type AuthView = "signin" | "signup" | "forgot";
type SignInStep = "email" | "password" | "otp";
type ForgotStep = "email" | "reset";

const inputClass =
  "w-full surface-input rounded-xl pl-11 pr-4 py-3 text-sm placeholder:text-neutral-500 transition-colors focus:outline-none";
const labelClass = "text-[10px] font-bold uppercase tracking-wider text-neutral-400";

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultMode = "signin",
  initialStep = "signin",
}) => {
  const {
    signIn,
    signUp,
    verifySignup,
    checkEmailForReset,
    requestPasswordReset,
    resetPassword,
    getLoginMethod,
    requestOtp,
    verifyOtp,
  } = useApp();

  const [authView, setAuthView] = useState<AuthView>("signin");
  const [signInStep, setSignInStep] = useState<SignInStep>("email");
  const [signupStep, setSignupStep] = useState<"form" | "verify">("form");
  const [forgotStep, setForgotStep] = useState<ForgotStep>("email");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const view: AuthView =
      initialStep === "forgot" ? "forgot" : defaultMode === "signup" ? "signup" : "signin";
    setAuthView(view);
    setSignInStep("email");
    setSignupStep("form");
    setForgotStep("email");
    setPassword("");
    setConfirmPassword("");
    setOtp("");
    setError("");
    setInfo("");
  }, [isOpen, defaultMode, initialStep]);

  useEffect(() => {
    if (signInStep === "otp") otpInputRef.current?.focus();
  }, [signInStep]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  if (!isOpen) return null;

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const isStrongPassword = (value: string) =>
    value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value);

  const goToSignIn = () => {
    setAuthView("signin");
    setSignInStep("email");
    setForgotStep("email");
    setError("");
    setInfo("");
    setPassword("");
    setConfirmPassword("");
    setOtp("");
  };

  const goToForgot = () => {
    setAuthView("forgot");
    setForgotStep("email");
    setError("");
    setInfo("");
    setPassword("");
    setConfirmPassword("");
    setOtp("");
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!email || !isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    const methodResult = await getLoginMethod(email);
    if (!methodResult.ok) {
      setSubmitting(false);
      setError(methodResult.error || "Something went wrong.");
      return;
    }
    if (methodResult.method === "otp") {
      const otpResult = await requestOtp(email);
      setSubmitting(false);
      if (!otpResult.ok) {
        setError(otpResult.error || "Couldn't send the code.");
        return;
      }
      setInfo(`We sent a 6-digit code to ${email}.`);
      setResendCooldown(60);
      setSignInStep("otp");
    } else {
      setSubmitting(false);
      setSignInStep("password");
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!password || password.length < 6) {
      setError("Please enter your password.");
      return;
    }
    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || "Invalid email or password.");
      return;
    }
    onClose();
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!otp || otp.length < 6) {
      setError("Please enter the 6-digit code.");
      return;
    }
    setSubmitting(true);
    const result = await verifyOtp(email, otp);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || "Incorrect code.");
      return;
    }
    onClose();
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password || !name) {
      setError("Please fill out all required fields.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!isStrongPassword(password)) {
      setError("Password must be 8+ characters with uppercase, lowercase, and a number.");
      return;
    }
    setSubmitting(true);
    const result = await signUp(email, password, name);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || "Sign up failed.");
      return;
    }
    setInfo(`We sent a verification code to ${email}.`);
    setSignupStep("verify");
  };

  const handleSignupVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!otp || otp.length < 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setSubmitting(true);
    const result = await verifySignup(email, otp);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || "Verification failed.");
      return;
    }
    onClose();
  };

  /** Step 1 of forgot flow — verify the email is registered */
  const handleForgotEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!email || !isValidEmail(email)) {
      setError("Please enter the email address you used to register.");
      return;
    }
    setSubmitting(true);
    const check = await checkEmailForReset(email);
    if (!check.ok) {
      setSubmitting(false);
      setError(check.error || "Something went wrong.");
      return;
    }
    if (!check.found) {
      setSubmitting(false);
      setError("No account found with this email address. Please check and try again.");
      return;
    }
    const reset = await requestPasswordReset(email);
    setSubmitting(false);
    if (!reset.ok) {
      setError(reset.error || "Couldn't send reset instructions.");
      return;
    }
    const fallbackHint = reset.resetToken ? ` Use reset code ${reset.resetToken}.` : "";
    setInfo(`Account found. We prepared your reset flow.${fallbackHint} Enter the code below with your new password.`);
    setForgotStep("reset");
    setPassword("");
    setConfirmPassword("");
    setOtp("");
  };

  /** Step 2 — token + new password */
  const handleForgotResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!otp.trim()) {
      setError("Enter the reset code from your email.");
      return;
    }
    if (!isStrongPassword(password)) {
      setError("Password must be 8+ characters with uppercase, lowercase, and a number.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    const result = await resetPassword(email, otp.trim(), password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || "Password reset failed.");
      return;
    }
    setInfo("Password updated successfully. You can sign in now.");
    setPassword("");
    setConfirmPassword("");
    setOtp("");
    setTimeout(() => {
      goToSignIn();
      setSignInStep("password");
      setInfo("");
    }, 1500);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError("");
    setSubmitting(true);
    const otpResult = await requestOtp(email);
    setSubmitting(false);
    if (!otpResult.ok) {
      setError(otpResult.error || "Couldn't resend code.");
      return;
    }
    setInfo(`A new code was sent to ${email}.`);
    setResendCooldown(60);
  };

  const title =
    authView === "forgot"
      ? forgotStep === "email"
        ? "Forgot Password"
        : "Create New Password"
      : authView === "signup"
      ? "Create Your Account"
      : signInStep === "otp"
      ? "Enter Login Code"
      : signInStep === "password"
      ? "Enter Password"
      : "Welcome Back";

  const subtitle =
    authView === "forgot"
      ? forgotStep === "email"
        ? "Enter the email address you used to register"
        : "Enter the code from your email and choose a new password"
      : authView === "signup"
      ? "Sign up to save your watchlist and preferences"
      : signInStep === "otp"
      ? "Check your inbox for a 6-digit code"
      : signInStep === "password"
      ? `Signing in as ${email}`
      : "Sign in with your Cinemax account";

  const onSubmit =
    authView === "forgot"
      ? forgotStep === "email"
        ? handleForgotEmailSubmit
        : handleForgotResetSubmit
      : authView === "signup"
      ? signupStep === "verify"
        ? handleSignupVerifySubmit
        : handleSignUpSubmit
      : signInStep === "email"
      ? handleContinue
      : signInStep === "password"
      ? handlePasswordSubmit
      : handleOtpSubmit;

  const submitLabel =
    authView === "forgot"
      ? forgotStep === "email"
        ? "Verify Email"
        : "Save New Password"
      : authView === "signup"
      ? signupStep === "verify"
        ? "Verify & Create Account"
        : "Create Account"
      : signInStep === "email"
      ? "Continue"
      : signInStep === "otp"
      ? "Verify & Sign In"
      : "Sign In";

  return (
    <div id="auth-modal-backdrop" className="fixed inset-0 z-60 flex items-center justify-center modal-backdrop p-4 animate-fade-in">
      <div id="auth-modal" className="relative w-full max-w-md rounded-2xl border surface-panel p-6 md:p-8">

        <button
          id="close-auth-btn"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {(authView === "forgot" || signInStep !== "email") && (
          <button
            id="auth-back-btn"
            onClick={authView === "forgot" ? (forgotStep === "reset" ? () => setForgotStep("email") : goToSignIn) : () => setSignInStep("email")}
            className="absolute left-4 top-4 flex items-center gap-1 rounded-lg p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}

        <div className="text-center mb-6 space-y-2 pt-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl logo-mark font-black text-2xl mx-auto">
            C
          </div>
          <h2 className="font-sans text-xl font-bold tracking-tight">{title}</h2>
          <p className="text-xs text-neutral-500">{subtitle}</p>
        </div>

        {error && <div className="alert-error rounded-xl p-3 text-xs font-semibold mb-4 text-center">{error}</div>}
        {!error && info && <div className="alert-success rounded-xl p-3 text-xs font-semibold mb-4 text-center">{info}</div>}

        <form onSubmit={onSubmit} className="space-y-4">
          {authView === "signup" && signupStep === "form" && (
            <div className="space-y-1">
              <label className={labelClass}>Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input type="text" placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
              </div>
            </div>
          )}

          {(authView === "signup" && signupStep === "form") ||
          (authView === "signin" && signInStep === "email") ||
          (authView === "forgot" && forgotStep === "email") ? (
            <div className="space-y-1">
              <label className={labelClass}>Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  required
                  autoFocus
                />
              </div>
            </div>
          ) : null}

          {authView === "signin" && signInStep !== "email" && (
            <div className="space-y-1">
              <label className={labelClass}>Email Address</label>
              <div className="relative flex items-center gap-2 rounded-xl surface-input px-4 py-3">
                <Mail className="h-4 w-4 text-neutral-500 shrink-0" />
                <span className="text-xs text-neutral-300 truncate">{email}</span>
              </div>
            </div>
          )}

          {authView === "forgot" && forgotStep === "reset" && (
            <div className="space-y-1">
              <label className={labelClass}>Registered Email</label>
              <div className="relative flex items-center gap-2 rounded-xl surface-input px-4 py-3">
                <Mail className="h-4 w-4 text-neutral-500 shrink-0" />
                <span className="text-xs text-neutral-300 truncate">{email}</span>
              </div>
            </div>
          )}

          {((authView === "signup" && signupStep === "form") ||
            (authView === "signin" && signInStep === "password") ||
            (authView === "forgot" && forgotStep === "reset")) && (
            <div className="space-y-1">
              <label className={labelClass}>{authView === "forgot" ? "New Password" : "Password"}</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  type="password"
                  placeholder="8+ chars, upper, lower, number"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  required
                  minLength={8}
                  autoFocus
                />
              </div>
            </div>
          )}

          {authView === "forgot" && forgotStep === "reset" && (
            <div className="space-y-1">
              <label className={labelClass}>Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  type="password"
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  required
                  minLength={8}
                />
              </div>
            </div>
          )}

          {((authView === "signup" && signupStep === "verify") ||
            (authView === "signin" && signInStep === "otp") ||
            (authView === "forgot" && forgotStep === "reset")) && (
            <div className="space-y-1">
              <label className={labelClass}>
                {authView === "forgot" ? "Reset Code" : "6-Digit Code"}
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  ref={otpInputRef}
                  type="text"
                  inputMode={authView === "forgot" ? "text" : "numeric"}
                  autoComplete="one-time-code"
                  placeholder={authView === "forgot" ? "Paste code from email" : "123456"}
                  value={otp}
                  onChange={(e) =>
                    setOtp(
                      authView === "forgot"
                        ? e.target.value.trim()
                        : e.target.value.replace(/\D/g, "").slice(0, 6)
                    )
                  }
                  className={`${inputClass} tracking-widest`}
                  required
                />
              </div>
              {authView === "signin" && signInStep === "otp" && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || submitting}
                    className="text-[10px] font-bold text-[#39FF14] hover:underline disabled:text-neutral-600 cursor-pointer disabled:cursor-default"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={submitting}
            className="w-full neon-btn flex items-center justify-center gap-2 font-extrabold py-2.5 sm:py-3.5 rounded-xl text-[11px] sm:text-xs cursor-pointer mt-2 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <>
                <span>{submitLabel}</span>
                <ArrowRight className="h-4 w-4 stroke-[3px]" />
              </>
            )}
          </button>
        </form>

        {authView === "signin" && signInStep === "email" && (
          <>
            <button
              id="auth-forgot-password-btn"
              type="button"
              onClick={goToForgot}
              className="w-full btn-forgot mt-3 py-2.5 sm:py-3 rounded-xl text-[11px] sm:text-xs uppercase tracking-wide cursor-pointer"
            >
              Forgot Password
            </button>
            <div className="text-center mt-5 border-t border-neutral-800 pt-4 text-xs">
              <span className="text-neutral-500">New to Cinemax?</span>
              <button
                id="auth-toggle-view"
                onClick={() => { setError(""); setInfo(""); setAuthView("signup"); setSignupStep("form"); }}
                className="ml-1.5 text-[#39FF14] hover:underline font-bold cursor-pointer"
              >
                Create Account
              </button>
            </div>
          </>
        )}

        {authView === "signup" && (
          <div className="text-center mt-5 border-t border-neutral-800 pt-4 text-xs">
            <span className="text-neutral-500">Already have an account?</span>
            <button
              type="button"
              onClick={goToSignIn}
              className="ml-1.5 text-[#39FF14] hover:underline font-bold cursor-pointer"
            >
              Sign In
            </button>
          </div>
        )}

        {authView === "forgot" && forgotStep === "email" && (
          <div className="text-center mt-5 border-t border-neutral-800 pt-4 text-xs">
            <span className="text-neutral-500">Remember your password?</span>
            <button type="button" onClick={goToSignIn} className="ml-1.5 text-[#39FF14] hover:underline font-bold cursor-pointer">
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
