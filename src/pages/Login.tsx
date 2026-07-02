import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApiMutation } from "@/providers/trpc";
import { useToast } from "@/hooks/useToast";
import { Sparkles, Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";

function getOAuthUrl() {
  const kimiAuthUrl = import.meta.env.VITE_KIMI_AUTH_URL;
  const appID = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);
  const url = new URL(`${kimiAuthUrl}/api/oauth/authorize`);
  url.searchParams.set("client_id", appID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "profile");
  url.searchParams.set("state", state);
  return url.toString();
}

export default function Login() {
  const { addToast } = useToast();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loginMutation = useApiMutation<{ email: string; password: string }, { success: boolean; error?: string; user?: { id: number; email: string; name?: string; role: string } }>("localAuth.login");

  const registerMutation = useApiMutation<{ email: string; password: string; name?: string }, { success: boolean; error?: string; message?: string }>("localAuth.register");

  const forgotMutation = useApiMutation<{ email: string }, { success: boolean; message?: string; error?: string }>("localAuth.requestPasswordReset");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (mode === "login") {
        const data = await loginMutation.mutateAsync({ email, password });
        if (data.success) {
          addToast("Login successful!", "success");
          window.location.href = "/dashboard";
        } else {
          addToast(data.error || "Login failed", "error");
        }
      } else if (mode === "signup") {
        if (password.length < 6) {
          addToast("Password must be at least 6 characters", "error");
          setIsSubmitting(false);
          return;
        }
        const data = await registerMutation.mutateAsync({ email, password, name: name || undefined });
        if (data.success) {
          addToast(data.message || "Account created!", "success");
          setMode("login");
        } else {
          addToast(data.error || "Signup failed", "error");
        }
      } else if (mode === "forgot") {
        const data = await forgotMutation.mutateAsync({ email });
        addToast(data.message || "Reset link sent!", "success");
        setMode("login");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      addToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-violet-500/10 border border-violet-500/20 mb-4">
            <Sparkles className="w-7 h-7 text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-[#f4f4f5]">Website Scout</h1>
          <p className="text-sm text-[#6c6c74] mt-1">AI-powered business discovery</p>
        </div>

        <div className="glass-panel rounded-xl p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              <h2 className="text-lg font-semibold text-[#f4f4f5] mb-4">
                {mode === "login" ? "Welcome back" : mode === "signup" ? "Create account" : "Reset password"}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6c6c74]" />
                    <Input
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 bg-[#1c1c20] border-[#2a2a2e] text-[#f4f4f5] placeholder:text-[#6c6c74]"
                    />
                  </div>
                )}

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6c6c74]" />
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 bg-[#1c1c20] border-[#2a2a2e] text-[#f4f4f5] placeholder:text-[#6c6c74]"
                  />
                </div>

                {mode !== "forgot" && (
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6c6c74]" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={mode === "signup" ? "Password (min 6 chars)" : "Password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pl-10 pr-10 bg-[#1c1c20] border-[#2a2a2e] text-[#f4f4f5] placeholder:text-[#6c6c74]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6c6c74] hover:text-[#8c8c96]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                >
                  {isSubmitting ? "Please wait..." : mode === "login" ? (
                    <span className="flex items-center gap-2">Sign in <ArrowRight className="w-4 h-4" /></span>
                  ) : mode === "signup" ? (
                    <span className="flex items-center gap-2">Create account <ArrowRight className="w-4 h-4" /></span>
                  ) : "Send reset link"}
                </Button>
              </form>

              <div className="mt-4 text-center text-sm text-[#6c6c74]">
                {mode === "login" ? (
                  <>
                    <button onClick={() => setMode("forgot")} className="text-violet-400 hover:text-violet-300 block mb-2">
                      Forgot password?
                    </button>
                    <span>Don't have an account? </span>
                    <button onClick={() => setMode("signup")} className="text-violet-400 hover:text-violet-300 font-medium">
                      Sign up
                    </button>
                  </>
                ) : (
                  <>
                    <span>Already have an account? </span>
                    <button onClick={() => setMode("login")} className="text-violet-400 hover:text-violet-300 font-medium">
                      Sign in
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#2a2a2e]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-[#141418] text-[#6c6c74]">or</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full border-[#2a2a2e] text-[#8c8c96] hover:bg-[#1c1c20] hover:text-[#f4f4f5]"
            onClick={() => { window.location.href = getOAuthUrl(); }}
          >
            Sign in with Kimi
          </Button>
        </div>

        <p className="text-center text-xs text-[#4a4a52] mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
}
