import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { HardHat, Lock, User as UserIcon, Loader2 } from "lucide-react";

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
    <div className="min-h-screen grid lg:grid-cols-5">
      {/* Left visual */}
      <div className="hidden lg:flex lg:col-span-3 blueprint-bg relative grain-overlay p-12 flex-col justify-between text-white">
        <div className="flex items-center gap-3 relative z-10">
          <div className="h-10 w-10 bg-orange-500 rounded-md flex items-center justify-center">
            <HardHat className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="font-display font-extrabold text-xl leading-tight">RENOVASI KAS</div>
            <div className="text-xs text-blue-200 tracking-widest">SISTEM AKUNTANSI LAPANGAN</div>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <div className="text-xs tracking-[0.3em] text-orange-300 mb-4">EST. 2026 — BUKU KAS DIGITAL</div>
          <h1 className="font-display font-extrabold text-5xl xl:text-6xl leading-[1.05]">
            Setiap rupiah<br/>tercatat rapi.<br/>
            <span className="text-orange-400">Setiap nota</span><br/>terekam jelas.
          </h1>
          <p className="mt-6 text-blue-100 text-lg max-w-md">
            Kelola tagihan klien, buku kas tim lapangan, dan pembayaran per lokasi — dalam satu platform terpusat.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-8 border-t border-white/10 pt-6 text-sm">
          <div>
            <div className="text-2xl font-display font-bold text-orange-300">4</div>
            <div className="text-blue-200">Peran Terpisah</div>
          </div>
          <div>
            <div className="text-2xl font-display font-bold text-orange-300">100%</div>
            <div className="text-blue-200">Bukti Nota</div>
          </div>
          <div>
            <div className="text-2xl font-display font-bold text-orange-300">Rp</div>
            <div className="text-blue-200">Rupiah Native</div>
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="lg:col-span-2 flex items-center justify-center p-6 lg:p-12 bg-white">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="h-10 w-10 bg-blue-700 rounded-md flex items-center justify-center">
              <HardHat className="h-6 w-6 text-white" />
            </div>
            <div className="font-display font-extrabold text-lg">RENOVASI KAS</div>
          </div>

          <div className="mb-8">
            <div className="text-xs tracking-[0.25em] text-slate-500 mb-2">LOGIN</div>
            <h2 className="font-display font-extrabold text-3xl text-slate-900">Masuk ke akun</h2>
            <p className="text-slate-500 mt-2 text-sm">Gunakan username dan kata sandi dari admin.</p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <Label htmlFor="username" className="text-slate-700 font-medium">Username</Label>
              <div className="relative mt-1.5">
                <UserIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="username"
                  data-testid="login-username-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="mis. andi.tim"
                  className="pl-9 h-11"
                  autoComplete="username"
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="password" className="text-slate-700 font-medium">Kata Sandi</Label>
              <div className="relative mt-1.5">
                <Lock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  data-testid="login-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 h-11"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              data-testid="login-submit-btn"
              disabled={loading}
              className="w-full h-11 rounded-full bg-blue-700 hover:bg-blue-800 text-white font-semibold text-base shadow-sm"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Masuk →"}
            </Button>
          </form>

          <div className="mt-8 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
            <div className="font-semibold text-slate-800 mb-1">Belum punya akun?</div>
            Akun dibuat oleh Owner. Hubungi Owner untuk mendapatkan kredensial login.
          </div>
        </div>
      </div>
    </div>
  );
}
