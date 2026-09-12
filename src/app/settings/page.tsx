"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Save, Building2, Lock, Sun, Moon, User, Mail,
  Key, CheckCircle2, ShieldCheck, Sliders, Bell, RefreshCw, Edit3, ArrowRight,
  Palette, Check, Sparkles
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
  getSettings, updateSettings, resyncAllNotifications,
  listWorkspaces, getActiveWorkspace, renameWorkspace, setWorkspaceTheme, type Workspace
} from "@/lib/localdb";
import { THEMES, type ThemeId, applyTheme, getCurrentAppliedTheme } from "@/lib/theme";
import {
  requestNotificationPermission,
  testMedicationNotification,
} from "@/lib/notifications";

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const [hospitalName, setHospitalName] = useState("");
  const [defaultWhatsapp, setDefaultWhatsapp] = useState("");
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dark, setDark] = useState(false);

  // Profile
  const [profileName, setProfileName] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Notifications
  const [testingNotification, setTestingNotification] = useState(false);
  const [syncingNotifications, setSyncingNotifications] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState("");

  // Workspaces (Hospitais)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null);
  const [workspaceNames, setWorkspaceNames] = useState<Record<string, string>>({});
  const [savingWorkspaceId, setSavingWorkspaceId] = useState<string | null>(null);
  const [workspaceSavedMsg, setWorkspaceSavedMsg] = useState("");
  const [selectedHospitalForTheme, setSelectedHospitalForTheme] = useState<string>("workspace_1");
  const [themeFeedbackMsg, setThemeFeedbackMsg] = useState<string>("");

  const loadWorkspacesData = async () => {
    try {
      const [list, active] = await Promise.all([
        listWorkspaces(),
        getActiveWorkspace(),
      ]);
      setWorkspaces(list);
      setActiveWorkspaceState(active);
      setSelectedHospitalForTheme((prev) => prev || active.id);
      const namesMap: Record<string, string> = {};
      list.forEach((w) => {
        namesMap[w.id] = w.name;
      });
      setWorkspaceNames(namesMap);
    } catch {}
  };

  const handleSaveWorkspaceName = async (id: string) => {
    const newName = workspaceNames[id]?.trim();
    if (!newName) return;
    setSavingWorkspaceId(id);
    try {
      await renameWorkspace(id, newName);
      setWorkspaceSavedMsg(`Nome da área atualizado para "${newName}"`);
      setTimeout(() => setWorkspaceSavedMsg(""), 3500);
    } catch {
      setWorkspaceSavedMsg("Erro ao atualizar nome da área");
      setTimeout(() => setWorkspaceSavedMsg(""), 3500);
    } finally {
      setSavingWorkspaceId(null);
    }
  };

  const handleSelectTheme = async (hospitalId: string, themeId: ThemeId) => {
    try {
      const updated = await setWorkspaceTheme(hospitalId, themeId);
      setWorkspaces(updated);
      const ws = updated.find((w) => w.id === hospitalId);
      const themeObj = THEMES.find((t) => t.id === themeId);
      const isCurrentActive = activeWorkspace?.id === hospitalId;

      if (isCurrentActive) {
        setDark(themeId === "dark");
        setThemeFeedbackMsg(`Tema do ${ws?.name || "Hospital"} alterado para ${themeObj?.name || themeId}! A tela já foi atualizada.`);
      } else {
        setThemeFeedbackMsg(`Tema do ${ws?.name || "Hospital"} salvo como ${themeObj?.name || themeId}. Ao alternar para ele, a cor mudará automaticamente!`);
      }
      setTimeout(() => setThemeFeedbackMsg(""), 4000);
    } catch (err) {
      console.error("Erro ao alterar tema:", err);
    }
  };

  // Suggestion
  const [suggestionText, setSuggestionText] = useState("");
  const [suggestionMsg, setSuggestionMsg] = useState("");

  const handleSendSuggestion = () => {
    const text = suggestionText.trim();
    if (!text) return;

    const email = "davidguimaraesfreitas@gmail.com";
    const subject = encodeURIComponent("Sugestão - Prontuário Enfermagem");
    const body = encodeURIComponent(
      `${text}\n\n---\nEnviado do app Prontuário Enfermagem`
    );

    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;

    setSuggestionText("");
    setSuggestionMsg("Abrindo seu app de e-mail...");
    setTimeout(() => {
      setSuggestionMsg("");
    }, 4000);
  };

  const handleTestNotification = async () => {
    setTestingNotification(true);
    const ok = await testMedicationNotification();
    setNotificationMsg(ok ? "Notificação de teste agendada para 3s!" : "Permissão de notificação negada.");
    setTimeout(() => {
      setTestingNotification(false);
      setNotificationMsg("");
    }, 4000);
  };

  const handleSyncNotifications = async () => {
    setSyncingNotifications(true);
    await resyncAllNotifications();
    setNotificationMsg("Todos os lembretes ativos foram sincronizados!");
    setTimeout(() => {
      setSyncingNotifications(false);
      setNotificationMsg("");
    }, 3000);
  };

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDark(isDark);

    getSettings()
      .then((data) => {
        setHospitalName(data.hospitalName || "");
        setDefaultWhatsapp(data.defaultWhatsapp || "");
        setPin(data.pin || "");
      })
      .catch(() => {});

    loadWorkspacesData();
    window.addEventListener("workspaces_updated", loadWorkspacesData);
    return () => window.removeEventListener("workspaces_updated", loadWorkspacesData);
  }, []);

  useEffect(() => {
    if (user) setProfileName(user.name);
  }, [user]);

  const toggleTheme = () => {
    const newDark = !dark;
    setDark(newDark);
    document.documentElement.classList.toggle("dark", newDark);
    localStorage.setItem("theme", newDark ? "dark" : "light");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const pinValue = pin.trim();
    if (pinValue && (pinValue.length < 4 || pinValue.length > 6)) {
      alert("O PIN de segurança deve conter entre 4 e 6 dígitos");
      setSaving(false);
      return;
    }
    await updateSettings({
      hospitalName,
      defaultWhatsapp: defaultWhatsapp.replace(/\D/g, ""),
      pin: pinValue,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    const data: { name?: string; password?: string } = {};
    if (profileName.trim()) data.name = profileName.trim();
    if (profilePassword.trim()) data.password = profilePassword.trim();
    const result = await updateUser(data);
    if (result.error) {
      alert(result.error);
    } else {
      setProfilePassword("");
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    }
    setProfileSaving(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in pb-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Configurações do Sistema
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
          Gerencie a personalização hospitalar, conta do profissional e preferências de segurança
        </p>
      </div>

      {/* User Profile Form */}
      <form
        onSubmit={handleProfileSave}
        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-5 shadow-xs"
      >
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 flex items-center justify-center">
            <User size={18} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white text-sm">Meu Perfil de Enfermagem</h2>
            <p className="text-xs text-slate-500">Altere seu nome de exibição e senha de acesso</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nome Completo
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/30 text-slate-900 dark:text-white font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              E-mail de Login
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={user?.email ?? ""}
                disabled
                className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nova Senha (opcional)
            </label>
            <div className="relative">
              <Key size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={profilePassword}
                onChange={(e) => setProfilePassword(e.target.value)}
                placeholder="Deixe em branco para manter a senha atual"
                minLength={6}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/30 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={profileSaving}
            className="inline-flex items-center gap-2 bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition-colors shadow-xs active:scale-[0.98] disabled:opacity-50"
          >
            {profileSaved ? <CheckCircle2 size={16} /> : <Save size={16} />}
            {profileSaving ? "Salvando..." : profileSaved ? "Perfil Atualizado!" : "Atualizar Perfil"}
          </button>
        </div>
      </form>

      {/* Workspaces / Hospitals Customization */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 flex items-center justify-center">
              <Building2 size={18} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-sm">Áreas de Trabalho (Hospitais)</h2>
              <p className="text-xs text-slate-500">Personalize os nomes de exibição dos seus 2 ambientes hospitalares</p>
            </div>
          </div>
          <Link
            href="/workspace"
            className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline"
          >
            Gerenciar áreas <ArrowRight size={13} />
          </Link>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Cada área possui seu próprio banco de dados SQLite local isolado. Você pode personalizar os nomes de exibição (ex: &ldquo;Hospital Municipal&rdquo;, &ldquo;UPA Central&rdquo;) para identificá-los com facilidade.
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {workspaces.map((ws, idx) => {
            const isActive = activeWorkspace?.id === ws.id;
            const isSaving = savingWorkspaceId === ws.id;
            const hasChanged = (workspaceNames[ws.id] || "").trim() !== ws.name;

            return (
              <div
                key={ws.id}
                className={`p-4 rounded-xl border transition-all ${
                  isActive
                    ? "bg-teal-50/40 dark:bg-teal-950/20 border-teal-500/60"
                    : "bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700"
                } space-y-2`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-teal-700 text-white flex items-center justify-center text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Área {idx + 1}
                    </span>
                  </div>
                  {isActive ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold">
                      Ativo agora
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Inativo</span>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={workspaceNames[ws.id] || ""}
                    onChange={(e) =>
                      setWorkspaceNames({ ...workspaceNames, [ws.id]: e.target.value })
                    }
                    placeholder={`Ex: Hospital ${idx === 0 ? "A" : "B"}`}
                    className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-600/30"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveWorkspaceName(ws.id)}
                    disabled={isSaving || !hasChanged}
                    className="px-3 py-2 bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40 shrink-0 cursor-pointer"
                  >
                    {isSaving ? "..." : "Salvar"}
                  </button>
                </div>

                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  Banco SQLite: {ws.dbName}
                </p>
              </div>
            );
          })}
        </div>

        {workspaceSavedMsg && (
          <div className="text-xs font-semibold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 p-2.5 rounded-lg border border-teal-200 dark:border-teal-800 flex items-center gap-2">
            <CheckCircle2 size={15} />
            <span>{workspaceSavedMsg}</span>
          </div>
        )}

        <div className="sm:hidden pt-2 border-t border-slate-100 dark:border-slate-800">
          <Link
            href="/workspace"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline"
          >
            Gerenciar e alternar áreas de trabalho <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* System Settings Form */}
      <form onSubmit={handleSave} className="space-y-5">
        {/* Hospital Institution */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 flex items-center justify-center">
              <Building2 size={18} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-sm">Unidade Hospitalar / Clínica</h2>
              <p className="text-xs text-slate-500">Nome impresso nos cabeçalhos e relatórios clínicos</p>
            </div>
          </div>
          <input
            type="text"
            value={hospitalName}
            onChange={(e) => setHospitalName(e.target.value)}
            placeholder="Ex: Hospital Central de Clínicas - Ala Geral"
            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/30 text-slate-900 dark:text-white"
          />
        </div>

        {/* Screen Lock PIN */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 flex items-center justify-center">
              <Lock size={18} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-sm">Trava Rápida de Tela (PIN)</h2>
              <p className="text-xs text-slate-500">Protege a tela ao afastar-se do posto de enfermagem (4 a 6 dígitos)</p>
            </div>
          </div>
          <div>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Deixe em branco para desativar a trava"
              maxLength={6}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-600/30 text-slate-900 dark:text-white"
            />
            <p className="text-[11px] text-slate-400 mt-1.5 font-mono">
              {pin ? `PIN configurado (${pin.length} dígitos ativado)` : "Trava por PIN desativada"}
            </p>
          </div>
        </div>


        {/* Medication Notifications */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 flex items-center justify-center">
              <Bell size={18} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-sm">Lembretes de Medicação (Push Local)</h2>
              <p className="text-xs text-slate-500">Notificações automáticas no aparelho nos horários exatos das doses</p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              As notificações funcionam 100% offline direto no Android, mesmo com o aplicativo fechado ou em segundo plano.
            </p>
            {notificationMsg && (
              <div className="text-xs font-semibold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 p-2.5 rounded-lg border border-teal-200 dark:border-teal-800">
                {notificationMsg}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleTestNotification}
                disabled={testingNotification}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-teal-700 hover:bg-teal-600 text-white transition-all shadow-xs active:scale-95 disabled:opacity-50"
              >
                <Bell size={14} className={testingNotification ? "animate-bounce" : ""} />
                {testingNotification ? "Testando..." : "Testar Alerta Agora (3s)"}
              </button>
              <button
                type="button"
                onClick={handleSyncNotifications}
                disabled={syncingNotifications}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCw size={14} className={syncingNotifications ? "animate-spin" : ""} />
                {syncingNotifications ? "Sincronizando..." : "Sincronizar Lembretes"}
              </button>
            </div>
          </div>
        </div>

        {/* Appearance & Themes Per Hospital */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 flex items-center justify-center">
              <Palette size={18} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-sm">Tema & Conforto Visual por Hospital</h2>
              <p className="text-xs text-slate-500">Defina cores visuais diferentes para o Hospital A e Hospital B</p>
            </div>
          </div>

          {/* Hospital Selector Pills */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Escolha qual hospital deseja personalizar o visual:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {workspaces.map((ws, idx) => {
                const isTabSelected = selectedHospitalForTheme === ws.id;
                const isCurrentActive = activeWorkspace?.id === ws.id;
                const currentThemeObj = THEMES.find((t) => t.id === ws.theme) || THEMES[0];

                return (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => setSelectedHospitalForTheme(ws.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isTabSelected
                        ? "bg-teal-50/70 dark:bg-teal-950/40 border-teal-600 dark:border-teal-500 ring-2 ring-teal-600/20"
                        : "bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Área {idx + 1} {isCurrentActive && "(Ativo agora)"}
                      </span>
                      <span className="text-xs">{currentThemeObj.emoji}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {ws.name}
                    </p>
                    <span className="text-[11px] text-teal-700 dark:text-teal-400 font-medium mt-0.5">
                      {currentThemeObj.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theme Options for Selected Hospital */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Selecione o tema para{" "}
                <span className="text-teal-700 dark:text-teal-400">
                  {workspaces.find((w) => w.id === selectedHospitalForTheme)?.name || "este hospital"}
                </span>:
              </span>
              {activeWorkspace?.id === selectedHospitalForTheme && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold">
                  Muda na hora
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {THEMES.map((themeOption) => {
                const targetWs = workspaces.find((w) => w.id === selectedHospitalForTheme);
                const isSelected = targetWs?.theme === themeOption.id;

                return (
                  <button
                    key={themeOption.id}
                    type="button"
                    onClick={() => handleSelectTheme(selectedHospitalForTheme, themeOption.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-white dark:bg-slate-800 border-teal-600 dark:border-teal-400 shadow-xs ring-2 ring-teal-500/25"
                        : "bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Color swatch circle preview */}
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border shadow-2xs text-sm"
                        style={{
                          backgroundColor: themeOption.bgPreview,
                          borderColor: themeOption.cardBorder,
                        }}
                      >
                        {themeOption.emoji}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                          {themeOption.name}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {themeOption.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-2xs"
                        style={{ backgroundColor: themeOption.accentColor }}
                      />
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-teal-700 text-white flex items-center justify-center">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feedback message */}
          {themeFeedbackMsg && (
            <div className="p-3 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/80 rounded-xl text-xs font-semibold text-teal-800 dark:text-teal-200 flex items-center gap-2 animate-fade-in">
              <Sparkles size={16} className="text-teal-600 dark:text-teal-400 shrink-0" />
              <span>{themeFeedbackMsg}</span>
            </div>
          )}

          {/* Resumo Visual por Hospital */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
              🎨 Resumo dos Visuais por Hospital:
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {workspaces.map((w) => {
                const tObj = THEMES.find((t) => t.id === w.theme) || THEMES[0];
                const isActive = activeWorkspace?.id === w.id;
                return (
                  <div
                    key={w.id}
                    className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] flex items-center gap-2"
                  >
                    <span className="text-sm">{tObj.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <span className="font-bold block truncate text-slate-800 dark:text-slate-200">
                        {w.name}
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        {tObj.name} {isActive && "• Ativo"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 pt-1">
              Ao alternar de hospital no topo do app, a cor da tela muda automaticamente para o tema configurado!
            </p>
          </div>
        </div>

        {/* Send Suggestion */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 flex items-center justify-center">
              <Mail size={18} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-sm">Enviar Sugestão</h2>
              <p className="text-xs text-slate-500">Encontrou um problema ou tem uma ideia de melhoria? Me conte.</p>
            </div>
          </div>

          <div className="space-y-3">
            <textarea
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              rows={4}
              placeholder="Descreva sua sugestão ou problema encontrado..."
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/30 text-slate-900 dark:text-white resize-y placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleSendSuggestion}
                disabled={!suggestionText.trim()}
                className="inline-flex items-center gap-2 bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-xs active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Mail size={16} />
                Enviar por E-mail
              </button>
              {suggestionMsg && (
                <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-3 py-1.5 rounded-lg border border-teal-200 dark:border-teal-800">
                  {suggestionMsg}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
              Isso abrirá seu app de e-mail padrão. Se não tiver nenhum configurado, você pode nos contatar em{" "}
              <a
                href="mailto:davidguimaraesfreitas@gmail.com"
                className="text-teal-600 dark:text-teal-400 underline font-medium hover:text-teal-700"
              >
                davidguimaraesfreitas@gmail.com
              </a>{" "}
              diretamente.
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white px-7 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-xs active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {saved ? <CheckCircle2 size={18} /> : <Save size={18} />}
            {saving ? "Salvando alterações..." : saved ? "Configurações Salvas!" : "Salvar Configurações"}
          </button>
        </div>
      </form>
    </div>
  );
}
