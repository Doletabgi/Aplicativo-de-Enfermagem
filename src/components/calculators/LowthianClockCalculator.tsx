"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Clock, RotateCw, Copy, Check, Printer, Bell, CheckCircle2,
  AlertTriangle, Info, ShieldCheck, ChevronRight, User, Bed,
  Sparkles, ListPlus, ExternalLink, Calendar,
} from "lucide-react";
import { PanelHeader, SubTabs, useCopy } from "./ui";
import {
  generateLowthianSchedule,
  getCurrentLowthianSlot,
  formatLowthianPrescription,
  LOWTHIAN_PROTOCOLS,
  LOWTHIAN_POSITIONS,
  type LowthianScheduleItem,
  type LowthianPositionCode,
} from "@/lib/lowthian";
import { listPatients } from "@/lib/localdb/patients";
import { createTask, requestNotificationPermission } from "@/lib/localdb/tasks";

const TABS = [
  { key: "clock", label: "Relógio & Posicionamento" },
  { key: "schedule", label: "Cronograma 24h & Checagem" },
  { key: "guide", label: "Guia de Prevenção de LPP" },
];

export default function LowthianClockCalculator() {
  const [activeTab, setActiveTab] = useState("clock");

  // Parâmetros do protocolo
  const [intervalHours, setIntervalHours] = useState(2);
  const [startHour, setStartHour] = useState(8);
  const [startMinute, setStartMinute] = useState(0);
  const [protocolId, setProtocolId] = useState("classic");

  // Identificação do Paciente
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [customPatientName, setCustomPatientName] = useState("");
  const [customBed, setCustomBed] = useState("");
  const [notes, setNotes] = useState("");

  // Estado de execução / checagens no plantão (persistido no localStorage por data)
  const [executedSlotIds, setExecutedSlotIds] = useState<Record<string, boolean>>({});

  // Slot inspecionado no relógio
  const [inspectedSlotIndex, setInspectedSlotIndex] = useState<number | null>(null);

  // Status de agendamento de tarefas no app
  const [scheduleTaskSuccess, setScheduleTaskSuccess] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);

  // Modal de impressão de cabeceira
  const [showBedsideModal, setShowBedsideModal] = useState(false);

  // Hora do relógio em tempo real
  const [now, setNow] = useState(new Date());

  const { copied, copy } = useCopy();

  useEffect(() => {
    // Atualiza a cada 30 segundos
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Carrega pacientes internados
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const list = await listPatients();
        if (isMounted) {
          setPatients(list || []);
        }
      } catch (e) {
        console.warn("Erro ao listar pacientes no Relógio de Lowthian:", e);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Sincroniza dados do paciente selecionado
  const activePatient = useMemo(() => {
    return patients.find((p) => p.id === selectedPatientId) || null;
  }, [patients, selectedPatientId]);

  const patientDisplayName = activePatient ? activePatient.name : (customPatientName || "Paciente");
  const bedDisplayName = activePatient ? (activePatient.bed || "—") : (customBed || "—");

  // Carrega checagens salvas do dia
  const todayKey = useMemo(() => {
    const d = new Date();
    return `lowthian_checks_${d.toISOString().slice(0, 10)}_${selectedPatientId || "general"}`;
  }, [selectedPatientId]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(todayKey);
      if (saved) {
        setExecutedSlotIds(JSON.parse(saved));
      } else {
        setExecutedSlotIds({});
      }
    } catch (e) {}
  }, [todayKey]);

  const toggleSlotExecuted = (slotId: string) => {
    setExecutedSlotIds((prev) => {
      const next = { ...prev, [slotId]: !prev[slotId] };
      try {
        localStorage.setItem(todayKey, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  // Gera cronograma com base nas opções
  const schedule = useMemo(() => {
    return generateLowthianSchedule({
      startHour,
      startMinute,
      intervalHours,
      protocolId,
      totalHours: 24,
    });
  }, [startHour, startMinute, intervalHours, protocolId]);

  // Calcula slot ativo em tempo real
  const liveStatus = useMemo(() => {
    return getCurrentLowthianSlot(schedule, now);
  }, [schedule, now]);

  // Slot em foco para exibição detalhada (inspecionado ou ativo)
  const focusedSlot = useMemo(() => {
    if (inspectedSlotIndex !== null && schedule[inspectedSlotIndex]) {
      return schedule[inspectedSlotIndex];
    }
    return liveStatus?.currentSlot || schedule[0];
  }, [inspectedSlotIndex, schedule, liveStatus]);

  const selectedProtocol = useMemo(() => {
    return LOWTHIAN_PROTOCOLS.find((p) => p.id === protocolId) || LOWTHIAN_PROTOCOLS[0];
  }, [protocolId]);

  // Ajusta hora de início para a hora atual
  const setStartToCurrentTime = () => {
    const currentH = now.getHours();
    setStartHour(currentH);
    setStartMinute(0);
  };

  // Copia prescrição para prontuário
  const handleCopyPrescription = () => {
    const text = formatLowthianPrescription({
      patientName: patientDisplayName,
      bed: bedDisplayName,
      intervalHours,
      protocolName: selectedProtocol.name,
      schedule,
      notes,
    });
    copy(text);
  };

  // Agendar tarefas no App
  const handleScheduleAppTasks = async () => {
    setIsScheduling(true);
    setScheduleTaskSuccess(null);
    try {
      await requestNotificationPermission();

      const todayStr = new Date().toISOString().slice(0, 10);
      let count = 0;

      for (const slot of schedule) {
        // Monta data do slot
        const [sh, sm] = slot.startTime.split(":").map(Number);
        const scheduledDate = new Date();
        scheduledDate.setHours(sh, sm, 0, 0);

        // Se o horário for anterior ao início e já passou hoje, agenda para as próximas 24h
        if (slot.startMinutesOfDay < schedule[0].startMinutesOfDay) {
          scheduledDate.setDate(scheduledDate.getDate() + 1);
        }

        const scheduledIso = scheduledDate.toISOString();
        const desc = `Mudança de Decúbito (${slot.startTime}): Colocar em ${slot.position.name} (${slot.position.angle}). ${slot.position.cushions}`;

        await createTask({
          patientId: activePatient?.id || null,
          patientName: `${patientDisplayName} (Leito ${bedDisplayName})`,
          description: desc,
          scheduledAt: scheduledIso,
        });
        count++;
      }

      setScheduleTaskSuccess(`${count} tarefas de mudança de decúbito programadas na lista com notificações!`);
      setTimeout(() => setScheduleTaskSuccess(null), 5000);
    } catch (err) {
      console.error("Erro ao agendar tarefas do Relógio de Lowthian:", err);
      setScheduleTaskSuccess("Não foi possível criar as tarefas automáticas.");
    } finally {
      setIsScheduling(false);
    }
  };

  // Impressão simples do cartão de cabeceira
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <PanelHeader
        icon={Clock}
        title="Relógio de Lowthian"
        subtitle="Protocolo Sistemático de Mudança de Decúbito • Peter Lowthian (1979) • Prevenção de LPP"
      />

      {/* Abas Secundárias */}
      <SubTabs
        items={TABS}
        active={activeTab}
        onChange={setActiveTab}
        activeClasses="bg-teal-700"
      />

      {/* Painel de Configurações Clínicas */}
      <div className="bg-white dark:bg-[#111927] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-teal-700 dark:text-teal-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Configuração do Paciente & Protocolo
            </h3>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Agora: {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>

        {/* Seleção do Paciente */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Vincular a Paciente Internado
            </label>
            <select
              value={selectedPatientId}
              onChange={(e) => {
                setSelectedPatientId(e.target.value);
                if (e.target.value === "") {
                  setCustomPatientName("");
                  setCustomBed("");
                }
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
            >
              <option value="">Paciente avulso / Digitar manualmente</option>
              {patients.filter((p) => p.active).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.bed ? `(Leito ${p.bed})` : ""}
                </option>
              ))}
            </select>
          </div>

          {!selectedPatientId ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Paciente
                </label>
                <input
                  type="text"
                  placeholder="Ex: Maria das Dores"
                  value={customPatientName}
                  onChange={(e) => setCustomPatientName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Leito / Quarto
                </label>
                <input
                  type="text"
                  placeholder="Ex: 204-B"
                  value={customBed}
                  onChange={(e) => setCustomBed(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </>
          ) : (
            <div className="sm:col-span-2 flex items-center gap-3 bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/50 rounded-xl p-2.5 px-3.5">
              <User size={16} className="text-teal-700 dark:text-teal-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-teal-900 dark:text-teal-200 truncate">
                  {activePatient?.name}
                </p>
                <p className="text-[11px] text-teal-700 dark:text-teal-400">
                  Leito: {activePatient?.bed || "Não informado"} • Diagnóstico: {activePatient?.diagnosis || "Estável"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Parâmetros do Ciclo: Intervalo, Início e Protocolo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Intervalo */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Intervalo de Reposicionamento
            </label>
            <select
              value={intervalHours}
              onChange={(e) => setIntervalHours(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
            >
              <option value={2}>2 em 2 horas (Padrão Ouro / UTI)</option>
              <option value={3}>3 em 3 horas (Colchão Dinâmico)</option>
              <option value={4}>4 em 4 horas (Baixo Risco)</option>
              <option value={1.5}>1h e 30 min (Alto Risco Extremo)</option>
            </select>
          </div>

          {/* Horário de Início */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Início do Ciclo
              </label>
              <button
                type="button"
                onClick={setStartToCurrentTime}
                className="text-[10px] text-teal-700 dark:text-teal-400 font-bold hover:underline"
              >
                Hora atual
              </button>
            </div>
            <select
              value={`${startHour}:${startMinute.toString().padStart(2, "0")}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":").map(Number);
                setStartHour(h);
                setStartMinute(m);
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
            >
              {Array.from({ length: 24 }).map((_, i) => {
                const time = `${i.toString().padStart(2, "0")}:00`;
                return (
                  <option key={time} value={time}>
                    {time} {i === 7 ? "(Plantão Diurno 07h)" : i === 8 ? "(Plantão 08h)" : i === 19 ? "(Plantão Noturno 19h)" : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Protocolo */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Protocolo de Rotação
            </label>
            <select
              value={protocolId}
              onChange={(e) => setProtocolId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
            >
              {LOWTHIAN_PROTOCOLS.map((proto) => (
                <option key={proto.id} value={proto.id}>
                  {proto.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
          <span className="font-semibold text-teal-700 dark:text-teal-400">Sequência:</span> {selectedProtocol.description}
        </p>
      </div>

      {/* ABA 1: Relógio Visual & Posicionamento */}
      {activeTab === "clock" && (
        <div className="space-y-6">
          {/* Card Principal: Banner de Posicionamento em Tempo Real */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Decúbito Ativo Agora */}
            <div className="md:col-span-2 bg-gradient-to-br from-teal-900 to-teal-800 text-white rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-16 translate-x-16 pointer-events-none" />
              
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-teal-500/20 text-teal-200 border border-teal-400/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Em Vigência Agora ({liveStatus?.currentSlot.startTime} às {liveStatus?.currentSlot.endTime})
                    </span>
                  </div>
                  <span className="text-[11px] text-teal-200 font-mono">
                    {patientDisplayName} • Leito {bedDisplayName}
                  </span>
                </div>

                <div className="mt-3">
                  <h3 className="text-2xl sm:text-3xl font-black tracking-tight">
                    {liveStatus?.currentSlot.position.name}
                  </h3>
                  <p className="text-sm font-semibold text-teal-200 mt-0.5">
                    {liveStatus?.currentSlot.position.angle}
                  </p>
                </div>

                <div className="mt-4 bg-teal-950/40 rounded-xl p-3 border border-teal-700/40 space-y-1.5 text-xs text-teal-100">
                  <p className="font-semibold flex items-center gap-1.5 text-teal-300">
                    <Info size={14} /> Posicionamento & Coxins:
                  </p>
                  <p className="leading-relaxed">
                    {liveStatus?.currentSlot.position.cushions}
                  </p>
                </div>
              </div>

              {/* Barra de Progresso do Horário */}
              <div className="mt-4 pt-3 border-t border-teal-700/50">
                <div className="flex items-center justify-between text-xs text-teal-200 mb-1.5">
                  <span>Próxima virada às <strong className="text-white font-mono">{liveStatus?.nextSlot.startTime}</strong></span>
                  <span className="font-bold text-amber-300">
                    {liveStatus?.minutesRemaining === 0 ? "Agora!" : `Faltam ${liveStatus?.minutesRemaining} minutos`}
                  </span>
                </div>
                <div className="w-full bg-teal-950/60 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-amber-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${liveStatus?.progressPercent || 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Próximo Decúbito & Ações Rápidas */}
            <div className="bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between shadow-xs">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Próxima Posição ({liveStatus?.nextSlot.startTime})
                </span>
                <div className="mt-2">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${liveStatus?.nextSlot.position.color.badge}`}>
                    {liveStatus?.nextSlot.position.abbreviation}
                  </span>
                  <p className="font-extrabold text-slate-900 dark:text-white text-base mt-1">
                    {liveStatus?.nextSlot.position.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {liveStatus?.nextSlot.position.angle}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                    Alívio de Pressão Garantido:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {liveStatus?.nextSlot.position.relievedAreas.slice(0, 3).map((area) => (
                      <span key={area} className="text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded">
                        ✓ {area}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <button
                  type="button"
                  onClick={() => liveStatus && toggleSlotExecuted(liveStatus.currentSlot.id)}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    liveStatus && executedSlotIds[liveStatus.currentSlot.id]
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-teal-700 hover:bg-teal-600 text-white"
                  }`}
                >
                  <CheckCircle2 size={15} />
                  {liveStatus && executedSlotIds[liveStatus.currentSlot.id]
                    ? "Mudança Atual Realizada ✓"
                    : "Checar Mudança Atual"}
                </button>
              </div>
            </div>
          </div>

          {/* Mostrador Visual SVG do Relógio de Lowthian */}
          <div className="bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <RotateCw size={17} className="text-teal-700 dark:text-teal-400" />
                  Mostrador Circular de Lowthian (24 Horas)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Toque em qualquer setor do relógio para inspecionar as instruções e áreas de alívio
                </p>
              </div>

              {/* Legenda de Posições */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0284c7]" /> DLD (30°)
                </span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#059669]" /> Dorsal (DD)
                </span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#7c3aed]" /> DLE (30°)
                </span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#d97706]" /> Fowler (30°)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Mostrador SVG */}
              <div className="lg:col-span-6 flex justify-center">
                <LowthianClockSvg
                  schedule={schedule}
                  currentSlotIndex={liveStatus?.currentSlot.index ?? 0}
                  inspectedSlotIndex={inspectedSlotIndex}
                  onSelectSlot={(idx) => setInspectedSlotIndex(idx === inspectedSlotIndex ? null : idx)}
                  currentTimeStr={now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                />
              </div>

              {/* Detalhes do Setor Inspecionado */}
              <div className="lg:col-span-6 space-y-4">
                <div className={`p-4 rounded-xl border ${focusedSlot.position.color.border} ${focusedSlot.position.color.bg}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${focusedSlot.position.color.badge}`}>
                      {focusedSlot.startTime} às {focusedSlot.endTime}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Slot {focusedSlot.index + 1} de {schedule.length}
                    </span>
                  </div>

                  <h4 className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                    {focusedSlot.position.name}
                  </h4>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                    {focusedSlot.position.angle}
                  </p>

                  <div className="mt-3 text-xs text-slate-700 dark:text-slate-300 space-y-2">
                    <p>
                      <strong className="text-slate-900 dark:text-white">Alinhamento & Coxins:</strong>{" "}
                      {focusedSlot.position.cushions}
                    </p>
                  </div>

                  {/* Áreas de Alívio e Risco */}
                  <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="font-bold text-emerald-700 dark:text-emerald-400 text-[11px] mb-1">
                        Áreas Aliviadas da Pressão:
                      </p>
                      <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-0.5 text-[11px]">
                        {focusedSlot.position.relievedAreas.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-bold text-rose-700 dark:text-rose-400 text-[11px] mb-1">
                        Áreas Sob Risco (Inspecionar):
                      </p>
                      <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-0.5 text-[11px]">
                        {focusedSlot.position.atRiskAreas.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Ações Rápidas */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCopyPrescription}
                    className="flex-1 min-w-[140px] py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    {copied ? "Copiado!" : "Copiar Prescrição"}
                  </button>

                  <button
                    type="button"
                    onClick={handleScheduleAppTasks}
                    disabled={isScheduling}
                    className="flex-1 min-w-[160px] py-2.5 px-3 rounded-xl bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Bell size={14} />
                    {isScheduling ? "Agendando..." : "Agendar Lembretes no App"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowBedsideModal(true)}
                    className="py-2.5 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    title="Imprimir Cartão de Cabeceira"
                  >
                    <Printer size={14} />
                    <span>Cartão de Cabeceira</span>
                  </button>
                </div>

                {scheduleTaskSuccess && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2 animate-fade-in">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>{scheduleTaskSuccess}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: Cronograma 24h & Checagem */}
      {activeTab === "schedule" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Cronograma de 24 Horas & Registro de Checagem
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Acompanhamento de plantão para {patientDisplayName} (Leito {bedDisplayName})
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyPrescription}
                  className="py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                >
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  <span>{copied ? "Copiado!" : "Copiar Texto"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowBedsideModal(true)}
                  className="py-2 px-3 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <Printer size={14} />
                  <span>Imprimir</span>
                </button>
              </div>
            </div>

            {/* Lista / Tabela de Slots */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 mt-2">
              {schedule.map((slot) => {
                const isCurrent = liveStatus?.currentSlot.id === slot.id;
                const isExecuted = executedSlotIds[slot.id];

                return (
                  <div
                    key={slot.id}
                    className={`py-3.5 px-3 rounded-xl transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isCurrent
                        ? "bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-16 sm:w-20 shrink-0">
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white block">
                          {slot.startTime}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          até {slot.endTime}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${slot.position.color.badge}`}>
                            {slot.position.abbreviation}
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {slot.position.name}
                          </span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 text-[10px] font-bold uppercase">
                              Agora
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {slot.position.cushions}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleSlotExecuted(slot.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                          isExecuted
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        <CheckCircle2 size={14} className={isExecuted ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"} />
                        <span>{isExecuted ? "Realizado" : "Checar"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: Guia de Prevenção de Lesões por Pressão (LPP) */}
      {activeTab === "guide" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <ShieldCheck size={18} className="text-teal-700 dark:text-teal-400" />
                Princípios Clínicos de Peter Lowthian & Prevenção de LPP
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Diretrizes baseadas nas evidências da NPUAP, EPUAP e Sociedade Brasileira de Enfermagem em Estomaterapia (SOBEST)
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Regra dos 30° */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 text-xs font-black flex items-center justify-center">
                    1
                  </span>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                    Regra dos 30° nos Decúbitos Laterais
                  </h4>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Nunca posicione o paciente em ângulo reto de 90° lateral direto sobre o trocânter maior. A inclinação correta deve ser de <strong>30°</strong>, apoiada com coxins dorsais e entre os joelhos, preservando a cabeça do fêmur de isquemia tecidual.
                </p>
              </div>

              {/* Flutuação de Calcanhares */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 text-xs font-black flex items-center justify-center">
                    2
                  </span>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                    Flutuação Completa dos Calcanhares
                  </h4>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  O calcanhar possui mínima camada subcutânea sobre o osso calcâneo. Mantenha os calcanhares completamente livres da superfície do leito (“calcanhares flutuantes”), posicionando um coxim transversal sob a extensão da panturrilha.
                </p>
              </div>

              {/* Forças de Cisalhamento */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 text-xs font-black flex items-center justify-center">
                    3
                  </span>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                    Prevenção de Cisalhamento Sacral
                  </h4>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Evite manter a cabeceira elevada acima de 30° por períodos prolongados (exceto durante dietas orais/enterais). Elevações excessivas fazem o corpo deslizar, gerando estiramento dos microvasos da região sacrococcígea.
                </p>
              </div>

              {/* Inspeção e Hidratação */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 text-xs font-black flex items-center justify-center">
                    4
                  </span>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                    Inspeção da Hiperemia Não Reativa
                  </h4>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  A cada mudança de decúbito, realize a inspeção visual e digitopressão das proeminências ósseas recém-aliviadas. Hiperemia que não empalidece indica Lesão por Pressão Estágio 1, exigindo barreira com ácidos graxos essenciais (AGE) e alívio imediato de carga.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cartão de Cabeceira para Impressão */}
      {showBedsideModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-teal-700 dark:text-teal-400" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Cartão de Cabeceira de Leito • Relógio de Lowthian
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBedsideModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Conteúdo Imprimível do Cartão de Cabeceira */}
            <div id="lowthian-printable-card" className="border-2 border-slate-800 dark:border-slate-300 rounded-xl p-5 space-y-4 bg-white text-slate-900">
              <div className="text-center pb-3 border-b border-slate-300">
                <h2 className="text-lg font-black uppercase tracking-wider">
                  PROTOCOLO DE MUDANÇA DE DECÚBITO
                </h2>
                <p className="text-xs font-bold text-slate-600 uppercase">
                  Relógio de Lowthian • Prevenção de Lesões por Pressão
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <p><strong className="uppercase">Paciente:</strong> {patientDisplayName}</p>
                  <p><strong className="uppercase">Leito:</strong> {bedDisplayName}</p>
                </div>
                <div>
                  <p><strong className="uppercase">Intervalo:</strong> A cada {intervalHours} horas</p>
                  <p><strong className="uppercase">Protocolo:</strong> {selectedProtocol.shortName}</p>
                </div>
              </div>

              {/* Tabela de Cabeceira */}
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300">
                      <th className="p-2 font-bold border-r border-slate-300">Horário</th>
                      <th className="p-2 font-bold border-r border-slate-300">Posição Prescrita</th>
                      <th className="p-2 font-bold border-r border-slate-300">Orientações de Coxins</th>
                      <th className="p-2 font-bold text-center">Visto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {schedule.map((s) => (
                      <tr key={s.id}>
                        <td className="p-2 font-bold border-r border-slate-200 whitespace-nowrap">
                          {s.startTime} - {s.endTime}
                        </td>
                        <td className="p-2 font-bold border-r border-slate-200">
                          {s.position.name}
                        </td>
                        <td className="p-2 text-[11px] font-sans border-r border-slate-200">
                          {s.position.cushions}
                        </td>
                        <td className="p-2 text-center border-slate-200 w-12">
                          [ &nbsp; ]
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-[10px] text-slate-600 pt-2 border-t border-slate-300 space-y-1 font-sans">
                <p><strong>Avisos:</strong> Manter inclinação lateral máxima de 30°. Calcanhares suspensos livres do colchão. Inspecionar hiperemia a cada troca.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBedsideModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <Printer size={14} />
                <span>Imprimir Cartão</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Mostrador Radial SVG Interativo do Relógio de Lowthian
 */
function LowthianClockSvg({
  schedule,
  currentSlotIndex,
  inspectedSlotIndex,
  onSelectSlot,
  currentTimeStr,
}: {
  schedule: LowthianScheduleItem[];
  currentSlotIndex: number;
  inspectedSlotIndex: number | null;
  onSelectSlot: (idx: number) => void;
  currentTimeStr: string;
}) {
  const size = 320;
  const center = size / 2;
  const outerR = 140;
  const innerR = 58;

  // Converte minutos do dia em coordenadas (x, y) no raio R
  // 00:00 (0 min) fica no topo (12h analógico, angulo -90°)
  const getCoords = (minutesOfDay: number, r: number) => {
    const angleRad = ((minutesOfDay / 1440) * 360 - 90) * (Math.PI / 180);
    return {
      x: center + r * Math.cos(angleRad),
      y: center + r * Math.sin(angleRad),
    };
  };

  return (
    <div className="relative flex items-center justify-center select-none">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
      >
        <defs>
          <filter id="glow-active" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Fundo do disco */}
        <circle cx={center} cy={center} r={outerR + 6} fill="#f1f5f9" className="dark:fill-slate-800/80" />

        {/* Setores de cada fatia do cronograma */}
        {schedule.map((slot) => {
          const isCurrent = slot.index === currentSlotIndex;
          const isInspected = slot.index === inspectedSlotIndex;

          const startP1 = getCoords(slot.startMinutesOfDay, innerR);
          const startP2 = getCoords(slot.startMinutesOfDay, outerR);
          const endP2 = getCoords(slot.endMinutesOfDay, outerR);
          const endP1 = getCoords(slot.endMinutesOfDay, innerR);

          const midMinutes = slot.startMinutesOfDay + slot.durationMinutes / 2;
          const labelCoords = getCoords(midMinutes, (innerR + outerR) / 2);
          const timeCoords = getCoords(midMinutes, outerR - 14);

          // Path SVG do setor anular
          const pathD = [
            `M ${startP1.x} ${startP1.y}`,
            `L ${startP2.x} ${startP2.y}`,
            `A ${outerR} ${outerR} 0 0 1 ${endP2.x} ${endP2.y}`,
            `L ${endP1.x} ${endP1.y}`,
            `A ${innerR} ${innerR} 0 0 0 ${startP1.x} ${startP1.y}`,
            "Z",
          ].join(" ");

          return (
            <g
              key={slot.id}
              onClick={() => onSelectSlot(slot.index)}
              className="cursor-pointer transition-all duration-200"
            >
              <path
                d={pathD}
                fill={slot.position.color.fillHex}
                fillOpacity={isCurrent ? 0.95 : isInspected ? 0.85 : 0.65}
                stroke={isCurrent ? "#ffffff" : isInspected ? "#ffffff" : "#ffffff"}
                strokeWidth={isCurrent || isInspected ? 2.5 : 1}
                filter={isCurrent ? "url(#glow-active)" : undefined}
                className="hover:opacity-100 transition-opacity"
              />

              {/* Rótulo da Posição */}
              <text
                x={labelCoords.x}
                y={labelCoords.y - 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#ffffff"
                fontSize={schedule.length > 8 ? "10" : "11"}
                fontWeight="bold"
                className="pointer-events-none drop-shadow-xs"
              >
                {slot.position.code}
              </text>

              {/* Rótulo do Horário de Início */}
              <text
                x={timeCoords.x}
                y={timeCoords.y + 4}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#ffffff"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace"
                className="pointer-events-none opacity-90"
              >
                {slot.startTime}
              </text>
            </g>
          );
        })}

        {/* Círculo Central do Relógio */}
        <circle
          cx={center}
          cy={center}
          r={innerR - 2}
          fill="#ffffff"
          className="dark:fill-slate-900"
          stroke="#0d9488"
          strokeWidth="3"
        />

        {/* Conteúdo Central */}
        <text
          x={center}
          y={center - 12}
          textAnchor="middle"
          fontSize="9"
          fontWeight="bold"
          fill="#64748b"
          className="uppercase tracking-wider"
        >
          Relógio Lowthian
        </text>
        <text
          x={center}
          y={center + 6}
          textAnchor="middle"
          fontSize="15"
          fontWeight="bold"
          fontFamily="monospace"
          fill="#0f172a"
          className="dark:fill-white"
        >
          {currentTimeStr}
        </text>
        <text
          x={center}
          y={center + 20}
          textAnchor="middle"
          fontSize="8"
          fontWeight="bold"
          fill="#0d9488"
        >
          ● 24 HORAS
        </text>

        {/* Marcadores de hora cardinais externos: 00h (topo), 06h (direita), 12h (baixo), 18h (esquerda) */}
        <text x={center} y={center - outerR - 10} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#64748b">00:00</text>
        <text x={center + outerR + 18} y={center + 3} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#64748b">06:00</text>
        <text x={center} y={center + outerR + 18} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#64748b">12:00</text>
        <text x={center - outerR - 18} y={center + 3} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#64748b">18:00</text>
      </svg>
    </div>
  );
}
