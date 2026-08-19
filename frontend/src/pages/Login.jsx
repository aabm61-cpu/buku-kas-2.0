import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Lock, User as UserIcon, Loader2 } from "lucide-react";

const BG_URL =
  "https://customer-assets-7cd3h4nn.emergentagent.net/job_site-accounting-8/artifacts/jk6bkq98_3d%20Mockup%203%20%281%29.webp";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username.trim(), password);
      toast.success("Selamat datang kembali");
      nav("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen relative flex items-center justify-center lg:justify-end bg-cover bg-center"
      style={{ backgroundImage: `url(${BG_URL})`, backgroundColor: "#1c1c1c" }}
    >
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/30 to-black/70" />

      {/* Glass form panel */}
      <div className="relative z-10 w-full max-w-md m-6 lg:mr-20 xl:mr-28">
        <div
          data-testid="login-glass-card"
          className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur-xl shadow-2xl p-8 lg:p-10"
        >
          <div className="mb-8">
            <div className="text-xs tracking-[0.3em] text-amber-400 mb-2">PT GODEL RAYA INOVATIF</div>
            <h2 className="font-display font-extrabold text-3xl text-white">Masuk ke akun</h2>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <Label htmlFor="username" className="text-slate-200 font-medium">Username</Label>
              <div className="relative mt-1.5">
                <UserIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="username"
                  data-testid="login-username-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="mis. andi.tim"
                  className="pl-9 h-11 bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus-visible:ring-amber-400"
                  autoComplete="username"
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="password" className="text-slate-200 font-medium">Kata Sandi</Label>
              <div className="relative mt-1.5">
                <Lock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  data-testid="login-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 h-11 bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus-visible:ring-amber-400"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              data-testid="login-submit-btn"
              disabled={loading}
              className="w-full h-11 rounded-full bg-amber-500 hover:bg-amber-600 text-black font-semibold text-base shadow-lg"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Masuk →"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
