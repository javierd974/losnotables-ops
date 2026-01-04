// src/pages/Login.tsx
import { useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import { setAuth } from "../auth/auth";
import SmartDomIntro from "../ui/SmartDomIntro";

type LoginResponse = {
  access_token: string;
  user: {
    id: string;
    email: string;
    full_name?: string | null;
    role: string;
  };
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function Login() {
  const nav = useNavigate();
  const location = useLocation() as any;

  // ✅ Intro / Splash
  const [introDone, setIntroDone] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = useMemo(() => {
    // si venías de una ruta protegida
    return location?.state?.from || "/select-local";
  }, [location]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const body = JSON.stringify({ email: email.trim(), password });
      const data = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body,
        auth: false,
      });

      setAuth(data.access_token, data.user);

      // Siempre pasamos por select-local (tu flujo), aunque “from” exista
      nav(from, { replace: true });
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.status === 401) setError("Credenciales incorrectas.");
        else setError(err.message || "No se pudo iniciar sesión.");
      } else {
        setError("No se pudo conectar con el servidor.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* ✅ Intro SmartDom (overlay) */}
      {!introDone && <SmartDomIntro onFinish={() => setIntroDone(true)} />}

      <div
        className="sd-login"
        style={{
          opacity: introDone ? 1 : 0,
          pointerEvents: introDone ? "auto" : "none",
          transition: "opacity .45s ease",
        }}
      >
        <div className="sd-bg">
          <div className="sd-blob sd-blob-a" />
          <div className="sd-blob sd-blob-b" />
          <div className="sd-grid" />
        </div>

        <div className="sd-wrap">
          <div className="sd-card" role="dialog" aria-label="Login">
            <div className="sd-brand">
              <div className="sd-mark" aria-hidden="true">
                <span className="sd-mark-dot" />
              </div>
              <div>
                <div className="sd-title">Los Notables</div>
                <div className="sd-sub">Personal · OPS</div>
              </div>
            </div>

            <form onSubmit={onSubmit} className="sd-form">
              <label className="sd-label">
                Email
                <input
                  className="sd-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@losnotables.cloud"
                  autoComplete="username"
                  required
                />
              </label>

              <label className="sd-label">
                Contraseña
                <div className="sd-pass">
                  <input
                    className="sd-input"
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="sd-eye"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPass ? "Oculto" : "Ver"}
                  </button>
                </div>
              </label>

              {error && <div className="sd-error">{error}</div>}

              <button
                className={cn("sd-btn", loading && "is-loading")}
                type="submit"
                disabled={loading}
              >
                {loading ? "Ingresando…" : "Ingresar"}
              </button>

              <div className="sd-hint">
                <span className="sd-dot" /> Acceso seguro · Token 12h
              </div>
            </form>
          </div>

          <footer className="sd-footer">Design by SmartDom</footer>
        </div>

        {/* SmartDom Kit CSS (scoped a esta pantalla) */}
        <style>{`
          :root {
            --sd-bg: #0b1320;
            --sd-card: rgba(16, 26, 51, 0.72);
            --sd-line: rgba(255,255,255,.10);
            --sd-txt: #eaeef7;
            --sd-muted: #9fb3d1;
            --sd-accent: #6E54F8; /* SmartDom signature */
            --sd-accent2: #57b285;
            --sd-warn: #f9f871;
            --sd-radius: 18px;
          }

          .sd-login {
            min-height: 100vh;
            color: var(--sd-txt);
            background: var(--sd-bg);
            display: grid;
            place-items: center;
            position: relative;
            overflow: hidden;
          }

          .sd-bg { position:absolute; inset:0; pointer-events:none; }
          .sd-grid {
            position:absolute; inset:-2px;
            background:
              radial-gradient(circle at 20% 10%, rgba(110,84,248,.10), transparent 40%),
              radial-gradient(circle at 80% 50%, rgba(87,178,133,.08), transparent 45%),
              radial-gradient(circle at 40% 90%, rgba(249,248,113,.06), transparent 40%),
              linear-gradient(180deg, rgba(255,255,255,.06), transparent 40%);
            filter: saturate(1.1);
          }

          .sd-blob {
            position:absolute;
            width: 520px; height: 520px;
            border-radius: 999px;
            filter: blur(48px);
            opacity: .55;
            transform: translate3d(0,0,0);
            animation: sdFloat 10s ease-in-out infinite;
            background: radial-gradient(circle at 30% 30%, rgba(110,84,248,.65), transparent 60%);
          }
          .sd-blob-a { left: -180px; top: -160px; }
          .sd-blob-b {
            right: -220px; bottom: -220px;
            animation-delay: -3s;
            background: radial-gradient(circle at 30% 30%, rgba(87,178,133,.55), transparent 60%);
          }

          @keyframes sdFloat {
            0%,100% { transform: translate3d(0,0,0) scale(1); }
            50% { transform: translate3d(24px, -18px, 0) scale(1.04); }
          }

          .sd-wrap { width: min(440px, 92vw); position:relative; z-index:2; }
          .sd-card {
            background: var(--sd-card);
            border: 1px solid var(--sd-line);
            border-radius: var(--sd-radius);
            padding: 22px 20px;
            box-shadow: 0 24px 80px rgba(0,0,0,.45);
            backdrop-filter: blur(10px);
            transform: translateY(0);
            animation: sdEnter .55s ease-out both;
          }
          @keyframes sdEnter {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
          }

          .sd-brand {
            display:flex; gap:12px; align-items:center;
            margin-bottom: 14px;
          }
          .sd-mark {
            width: 40px; height: 40px;
            border-radius: 14px;
            background: linear-gradient(135deg, rgba(110,84,248,.95), rgba(87,178,133,.65));
            box-shadow: 0 10px 24px rgba(110,84,248,.18);
            position:relative;
            overflow:hidden;
          }
          .sd-mark::after{
            content:"";
            position:absolute; inset:-40%;
            background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.40), transparent 55%);
            transform: rotate(18deg);
          }
          .sd-mark-dot{
            position:absolute; right:10px; bottom:10px;
            width:8px; height:8px; border-radius:999px;
            background: var(--sd-warn);
            box-shadow: 0 0 0 6px rgba(249,248,113,.12);
          }
          .sd-title { font-size: 18px; font-weight: 700; letter-spacing: .2px; }
          .sd-sub { font-size: 12px; color: var(--sd-muted); margin-top: 1px; }

          .sd-form { display:grid; gap: 12px; margin-top: 10px; }
          .sd-label { font-size: 12px; color: var(--sd-muted); display:grid; gap: 6px; }

          .sd-input {
            width: 100%;
            padding: 12px 12px;
            border-radius: 14px;
            border: 1px solid rgba(255,255,255,.10);
            background: rgba(15, 23, 48, 0.65);
            color: var(--sd-txt);
            outline: none;
            transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
          }
          .sd-input:focus {
            border-color: rgba(110,84,248,.65);
            box-shadow: 0 0 0 4px rgba(110,84,248,.15);
            transform: translateY(-1px);
          }

          .sd-pass { position:relative; display:flex; align-items:center; }
          .sd-eye{
            position:absolute;
            right: 10px;
            height: 28px;
            padding: 0 10px;
            border-radius: 999px;
            border: 1px solid rgba(255,255,255,.10);
            background: rgba(255,255,255,.05);
            color: var(--sd-muted);
            cursor:pointer;
            font-size: 12px;
            transition: transform .15s ease, border-color .2s ease;
          }
          .sd-eye:hover { transform: translateY(-1px); border-color: rgba(255,255,255,.18); }

          .sd-error {
            border: 1px solid rgba(255, 80, 80, .28);
            background: rgba(255, 80, 80, .10);
            color: #ffd6d6;
            padding: 10px 12px;
            border-radius: 14px;
            font-size: 13px;
            animation: sdShake .25s ease-in-out;
          }
          @keyframes sdShake {
            0%,100% { transform: translateX(0); }
            25% { transform: translateX(-2px); }
            75% { transform: translateX(2px); }
          }

          .sd-btn {
            margin-top: 2px;
            padding: 12px 14px;
            border-radius: 14px;
            border: 1px solid rgba(110,84,248,.35);
            background: linear-gradient(135deg, rgba(110,84,248,.95), rgba(110,84,248,.60));
            color: white;
            font-weight: 700;
            letter-spacing: .2px;
            cursor:pointer;
            transition: transform .15s ease, box-shadow .2s ease, filter .2s ease;
            box-shadow: 0 14px 32px rgba(110,84,248,.18);
          }
          .sd-btn:hover { transform: translateY(-1px); filter: brightness(1.02); }
          .sd-btn:disabled { opacity: .7; cursor:not-allowed; }
          .sd-btn.is-loading { position:relative; }
          .sd-btn.is-loading::after{
            content:"";
            position:absolute;
            right: 14px; top: 50%;
            width: 14px; height: 14px;
            border-radius: 999px;
            border: 2px solid rgba(255,255,255,.35);
            border-top-color: rgba(255,255,255,.95);
            transform: translateY(-50%);
            animation: sdSpin .8s linear infinite;
          }
          @keyframes sdSpin { to { transform: translateY(-50%) rotate(360deg); } }

          .sd-hint{
            display:flex; align-items:center; gap:8px;
            color: rgba(234,238,247,.75);
            font-size: 12px;
            margin-top: 2px;
          }
          .sd-dot{
            width: 7px; height: 7px; border-radius: 999px;
            background: var(--sd-accent2);
            box-shadow: 0 0 0 6px rgba(87,178,133,.14);
          }

          .sd-footer{
            text-align:center;
            margin-top: 12px;
            font-size: 11px;
            color: rgba(159,179,209,.75);
            letter-spacing: .2px;
            opacity: .95;
            animation: sdEnter .7s ease-out both;
            animation-delay: .12s;
          }
        `}</style>
      </div>
    </>
  );
}
