"use client";

import { useState, useEffect } from "react";
import { Shield, Activity, Lock, HeartPulse } from "lucide-react";
import { Preferences } from "@capacitor/preferences";
import { getSettings, checkPin, getActiveWorkspace } from "@/lib/localdb";

const UNLOCK_DURATION_MS = 4 * 60 * 60 * 1000; // 4 horas

export default function PinLock() {
  const [locked, setLocked] = useState(true);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [workspaceId, setWorkspaceId] = useState("workspace_1");

  useEffect(() => {
    (async () => {
      try {
        const ws = await getActiveWorkspace();
        setWorkspaceId(ws.id);
        const unlockKey = `pin_unlocked_until_${ws.id}`;

        const settings = await getSettings();
        const configured = settings.pin && settings.pin.length >= 4;
        if (!configured) {
          setLocked(false);
        } else {
          const { value } = await Preferences.get({ key: unlockKey });
          const until = value ? parseInt(value, 10) : 0;
          if (until && Date.now() < until) {
            setLocked(false);
          }
        }
      } catch {
        setLocked(false);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const valid = await checkPin(pin);

    if (valid) {
      const unlockKey = `pin_unlocked_until_${workspaceId}`;
      await Preferences.set({ key: unlockKey, value: String(Date.now() + UNLOCK_DURATION_MS) });
      setLocked(false);
    } else {
      setError("PIN incorreto. Tente novamente.");
      setPin("");
    }
  };

  const handleKeyPress = (key: number | "⌫") => {
    if (key === "⌫") {
      setPin((p) => p.slice(0, -1));
      setError("");
    } else if (pin.length < 6) {
      setPin((p) => p + key);
      setError("");
    }
  };

  if (checking || !locked) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-800 shadow-xs mb-4 text-white">
            <Lock size={26} />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center justify-center gap-1.5">
            <HeartPulse size={18} className="text-teal-400" />
            Pront<span className="text-teal-400">Enf</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">Estação de Enfermagem Bloqueada</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-rose-950/50 text-rose-300 text-xs px-4 py-2.5 rounded-xl border border-rose-800/50 text-center animate-shake">
              {error}
            </div>
          )}

          {/* PIN Indicator Dots */}
          <div className="flex justify-center gap-3 py-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                  pin.length > i
                    ? "bg-teal-500 ring-4 ring-teal-500/25 scale-110"
                    : "bg-slate-800 border border-slate-700"
                }`}
              />
            ))}
          </div>

          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            autoFocus
            className="sr-only"
            id="pin-input"
          />

          {/* Keypad Grid */}
          <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((key, idx) => (
              <button
                key={idx}
                type="button"
                disabled={key === ""}
                onClick={() => key !== "" && handleKeyPress(key === "⌫" ? "⌫" : Number(key))}
                className={`h-13 rounded-2xl text-lg font-bold transition-all active:scale-95 cursor-pointer ${
                  key === ""
                    ? "invisible"
                    : key === "⌫"
                    ? "bg-slate-800/60 text-slate-300 hover:bg-slate-800 border border-slate-700/50"
                    : "bg-slate-900/90 text-white border border-slate-700/60 hover:bg-slate-800 hover:border-slate-600 shadow-sm"
                }`}
              >
                {key === "⌫" ? "⌫" : key}
              </button>
            ))}
          </div>

          <div className="text-center pt-2">
            <button
              type="submit"
              disabled={pin.length < 4}
              className="w-full bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-xs active:scale-[0.99] cursor-pointer text-sm"
            >
              Desbloquear Estação
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
