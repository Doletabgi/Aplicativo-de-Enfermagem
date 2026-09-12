"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity, Users, Settings, Sun, Moon, Menu, X, LogOut,
  Calendar, Calculator, Pill, HeartPulse, Share2, ClipboardList, ListTodo, UsersRound, Mic,
  Building2, ChevronDown, Check, Edit3
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { SafeArea, initialize } from "@capacitor-community/safe-area";
import { listWorkspaces, getActiveWorkspace, setActiveWorkspace, renameWorkspace, closeAllWorkspaceConnections, resyncAllNotifications, type Workspace } from "@/lib/localdb";
import { applyTheme, THEMES, type ThemeId } from "@/lib/theme";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Áreas de Trabalho (Workspaces)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [selectedWsId, setSelectedWsId] = useState<string>("");
  const [switching, setSwitching] = useState(false);
  const [isEditingNames, setIsEditingNames] = useState(false);
  const [editingNames, setEditingNames] = useState<Record<string, string>>({});
  const [savingWsId, setSavingWsId] = useState<string | null>(null);

  const handleSaveWorkspaceName = async (id: string) => {
    const newName = editingNames[id]?.trim();
    if (!newName) return;
    setSavingWsId(id);
    try {
      const updated = await renameWorkspace(id, newName);
      setWorkspaces(updated);
      if (activeWorkspace?.id === id) {
        setActiveWorkspaceState({ ...activeWorkspace, name: newName });
      }
    } catch (err) {
      console.error("Erro ao renomear área:", err);
    } finally {
      setSavingWsId(null);
    }
  };

  const handleConfirmWorkspaceSwitch = async () => {
    if (!selectedWsId || selectedWsId === activeWorkspace?.id) {
      setWorkspaceModalOpen(false);
      return;
    }
    setSwitching(true);
    try {
      await closeAllWorkspaceConnections();
      await setActiveWorkspace(selectedWsId);
      await resyncAllNotifications();
      await closeAllWorkspaceConnections();
      if (typeof window !== "undefined") {
        if (window.location.pathname === "/" || window.location.pathname === "") {
          window.location.reload();
        } else {
          window.location.href = "/";
        }
      }
    } catch (err) {
      console.error("Erro ao alternar workspace:", err);
      setSwitching(false);
      setWorkspaceModalOpen(false);
    }
  };

  const syncSystemBars = (isDark: boolean) => {
    try {
      SafeArea.enable({
        config: {
          customColorsForSystemBars: true,
          statusBarColor: "#00000000",
          statusBarContent: isDark ? "light" : "dark",
          navigationBarColor: "#00000000",
          navigationBarContent: isDark ? "light" : "dark",
        },
      }).catch(() => {});
    } catch {
      // Ignora se rodando fora do ambiente nativo
    }
  };

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDark(isDark);
    try {
      initialize();
      syncSystemBars(isDark);
    } catch {}

    const refreshWorkspaces = async () => {
      try {
        const [wsList, active] = await Promise.all([
          listWorkspaces(),
          getActiveWorkspace(),
        ]);
        setWorkspaces(wsList);
        setActiveWorkspaceState(active);
        setSelectedWsId(active.id);
        const map: Record<string, string> = {};
        wsList.forEach((w) => {
          map[w.id] = w.name;
        });
        setEditingNames(map);

        // Garante que o tema configurado do hospital ativo esteja aplicado se não estiver em modo escuro
        const isCurrentDark = document.documentElement.classList.contains("dark");
        if (!isCurrentDark && active.theme) {
          applyTheme(active.theme);
        }
      } catch {}
    };

    refreshWorkspaces();
    window.addEventListener("workspaces_updated", refreshWorkspaces);

    const onThemeChange = () => {
      setDark(document.documentElement.classList.contains("dark"));
    };
    window.addEventListener("theme_changed", onThemeChange);

    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("workspaces_updated", refreshWorkspaces);
      window.removeEventListener("theme_changed", onThemeChange);
    };
  }, []);

  const toggleTheme = () => {
    const isCurrentlyDark = document.documentElement.classList.contains("dark");
    if (isCurrentlyDark) {
      // Reativa o tema configurado do hospital ativo (azul, rosa, laranja ou padrão)
      const targetTheme = (activeWorkspace?.theme as ThemeId) || "blue";
      applyTheme(targetTheme === "dark" ? "default" : targetTheme);
      setDark(false);
    } else {
      applyTheme("dark");
      setDark(true);
    }
  };

  if (!user) return null;
  if (pathname.startsWith("/patient/") && pathname.includes("/print")) return null;

  const links = [
    { href: "/", label: "Dashboard", icon: Activity },
    { href: "/patients", label: "Pacientes", icon: Users },
    { href: "/medications", label: "Medicações", icon: Pill },
    { href: "/tasks", label: "Tarefas", icon: ListTodo },
    { href: "/vitals", label: "Sinais Vitais", icon: HeartPulse },
    { href: "/team", label: "Equipe & Escala", icon: Calendar },
    { href: "/reports", label: "Relatórios", icon: ClipboardList },
    { href: "/workspace", label: "Áreas de Trabalho", icon: Building2 },
    { href: "/import", label: "Importar", icon: Share2 },
    { href: "/settings", label: "Configurações", icon: Settings },
  ];

  const bottomLinks = [
    { href: "/", label: "Início", icon: Activity },
    { href: "/calculator", label: "Calculadora", icon: Calculator },
    { href: "/team", label: "Equipe no Plantão", icon: UsersRound },
    { href: "/tasks", label: "Tarefas por Voz", icon: Mic },
    { href: "/settings", label: "Ajustes", icon: Settings },
  ];

  const isLinkActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/patients") return pathname.startsWith("/patients") || pathname.startsWith("/patient");
    if (href === "/team") return pathname.startsWith("/team");
    if (href === "/reports") return pathname.startsWith("/reports");
    if (href === "/tasks") return pathname.startsWith("/tasks");
    if (href === "/medications") return pathname.startsWith("/medications");
    if (href === "/vitals") return pathname.startsWith("/vitals");
    if (href === "/workspace") return pathname.startsWith("/workspace");
    if (href === "/import") return pathname.startsWith("/import");
    if (href === "/calculator") return pathname.startsWith("/calculator");
    if (href === "/settings") return pathname.startsWith("/settings");
    return pathname === href;
  };

  return (
    <>
      {/* Top Navbar */}
      <nav
        className={`sticky top-0 z-30 transition-colors duration-200 no-print safe-area-top ${
          scrolled
            ? "bg-white/95 dark:bg-[#0c1322]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs"
            : "bg-white dark:bg-[#0c1322] border-b border-slate-200/80 dark:border-slate-800/80"
        }`}
        style={{
          paddingTop: "max(var(--safe-area-inset-top, 0px), env(safe-area-inset-top, 0px))",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo / Brand & Workspace Badge */}
            <div className="flex items-center gap-2.5 sm:gap-3.5">
              <Link href="/" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-700 dark:bg-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Activity size={20} strokeWidth={2.5} />
                </div>
                <div className="hidden xs:block">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white text-base tracking-tight">
                      Prontuário <span className="text-teal-700 dark:text-teal-400 font-semibold">Enfermagem</span>
                    </span>
                    <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      Plantão
                    </span>
                  </div>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                    Uso Clínico Hospitalar
                  </span>
                </div>
              </Link>

              {/* Workspace Selector Badge */}
              <button
                onClick={() => {
                  setSelectedWsId(activeWorkspace?.id || "workspace_1");
                  setIsEditingNames(false);
                  setWorkspaceModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/90 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs cursor-pointer"
                title="Alternar Área de Trabalho (Hospital)"
                type="button"
                aria-label="Alternar hospital"
              >
                <Building2 size={14} className="text-teal-700 dark:text-teal-400 shrink-0" />
                <span className="max-w-[85px] sm:max-w-[130px] truncate">
                  {activeWorkspace?.name || "Hospital A"}
                </span>
                <ChevronDown size={12} className="opacity-60 shrink-0" />
              </button>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60">
              {links.map((link) => {
                const active = isLinkActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      active
                        ? "bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-200 shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50"
                    }`}
                  >
                    <link.icon size={15} strokeWidth={active ? 2.5 : 2} className={active ? "text-teal-700 dark:text-teal-400" : ""} />
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {/* Top Right Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors min-w-[42px] min-h-[42px] flex items-center justify-center"
                title={dark ? "Alternar para Modo Claro" : "Alternar para Modo Noturno"}
                aria-label="Alternar tema"
              >
                {dark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-700" />}
              </button>

              {/* User Dropdown Desktop */}
              <div className="relative hidden sm:block">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2.5 p-1.5 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-teal-800 text-white flex items-center justify-center text-xs font-bold font-mono">
                    {user.name ? user.name.charAt(0).toUpperCase() : "E"}
                  </div>
                  <div className="text-left">
                    <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200 max-w-[120px] truncate leading-tight">
                      {user.name}
                    </span>
                    <span className="block text-[10px] text-teal-700 dark:text-teal-400 font-medium leading-tight">
                      Em serviço
                    </span>
                  </div>
                </button>
                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-[#111927] rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg py-1 z-20">
                      <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.name}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                      </div>
                      <Link
                        href="/workspace"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <Building2 size={14} /> Áreas de Trabalho
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <Settings size={14} /> Configurações
                      </Link>
                      <button
                        onClick={() => { setShowUserMenu(false); logout(); }}
                        className="flex items-center gap-2.5 w-full px-4 py-2 text-xs font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      >
                        <LogOut size={14} /> Encerrar Sessão
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Hamburger Button for Mobile Drawer */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 min-w-[42px] min-h-[42px] flex items-center justify-center"
                aria-label="Abrir menu"
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Slide-down Drawer */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1322] px-4 py-3 space-y-1 shadow-lg">
            <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700 mb-2">
              <div className="w-9 h-9 rounded-lg bg-teal-800 text-white flex items-center justify-center font-bold text-sm font-mono">
                {user.name ? user.name.charAt(0).toUpperCase() : "E"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.name}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
            {links.map((link) => {
              const active = isLinkActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors min-h-[44px] ${
                    active
                      ? "bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 border border-teal-200/60 dark:border-teal-800/40"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <link.icon size={17} className={active ? "text-teal-700 dark:text-teal-400" : ""} />
                  {link.label}
                </Link>
              );
            })}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 mt-2 space-y-1">
              <Link
                href="/calculator"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors min-h-[44px] ${
                  isLinkActive("/calculator")
                    ? "bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 border border-teal-200/60 dark:border-teal-800/40"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Calculator size={17} className={isLinkActive("/calculator") ? "text-teal-700 dark:text-teal-400" : ""} />
                Calculadora Clínica
              </Link>
              <button
                onClick={() => { setMobileOpen(false); logout(); }}
                className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 min-h-[44px]"
              >
                <LogOut size={17} /> Encerrar Sessão
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Mobile Bottom Navigation Bar (Thumb-accessible for nurses on Android) */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0c1322]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1 flex items-center justify-around shadow-lg safe-area-bottom no-print"
        style={{
          paddingBottom: "max(var(--safe-area-inset-bottom, 0px), env(safe-area-inset-bottom, 0px))",
        }}
      >
        {bottomLinks.map((item) => {
          const active = isLinkActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-colors min-w-[54px] min-h-[48px] ${
                active
                  ? "text-teal-700 dark:text-teal-400 font-bold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <item.icon size={19} strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] mt-0.5 tracking-tight text-center leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
      {/* Modal de Troca de Área de Trabalho */}
      {workspaceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Área de Trabalho
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Bancos de dados 100% isolados
                  </p>
                </div>
              </div>
              <button
                onClick={() => setWorkspaceModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                type="button"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              Pacientes, medicações, evoluções e escalas ficam guardados exclusivamente no hospital selecionado. Seu login de acesso permanece o mesmo.
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isEditingNames ? "Personalizar nomes dos hospitais:" : "Selecione o hospital ativo:"}
              </span>
              <button
                type="button"
                onClick={() => setIsEditingNames(!isEditingNames)}
                className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Edit3 size={13} />
                {isEditingNames ? "Concluir" : "Personalizar nomes"}
              </button>
            </div>

            <div className="space-y-2.5">
              {workspaces.map((ws, idx) => {
                const isSelected = selectedWsId === ws.id;
                const isCurrentActive = activeWorkspace?.id === ws.id;

                if (isEditingNames) {
                  return (
                    <div
                      key={ws.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/50 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Área {idx + 1} {isCurrentActive && "(Ativo)"}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{ws.dbName}</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editingNames[ws.id] ?? ws.name}
                          onChange={(e) =>
                            setEditingNames({ ...editingNames, [ws.id]: e.target.value })
                          }
                          placeholder={`Ex: Hospital ${idx === 0 ? "A" : "B"}`}
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-600"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveWorkspaceName(ws.id)}
                          disabled={savingWsId === ws.id || (editingNames[ws.id] ?? "") === ws.name}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-700 hover:bg-teal-600 text-white disabled:opacity-40 transition-colors shrink-0 cursor-pointer"
                        >
                          {savingWsId === ws.id ? "..." : "Salvar"}
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => setSelectedWsId(ws.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? "bg-teal-50 dark:bg-teal-950/40 border-teal-600 dark:border-teal-500 shadow-2xs"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        isSelected
                          ? "bg-teal-700 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {ws.name}
                          </span>
                          {isCurrentActive && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-semibold">
                              Ativo
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate">
                          {(() => {
                            const tObj = THEMES.find((t) => t.id === ws.theme) || THEMES[0];
                            return `${tObj.emoji} ${tObj.name} • Banco: ${ws.dbName}`;
                          })()}
                        </span>
                      </div>
                    </div>
                    {isSelected && <Check size={18} className="text-teal-700 dark:text-teal-400 shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setWorkspaceModalOpen(false);
                  setIsEditingNames(false);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={switching}
                onClick={handleConfirmWorkspaceSwitch}
                className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 active:scale-98 rounded-xl transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {switching ? "Alternando..." : "Confirmar Troca"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
