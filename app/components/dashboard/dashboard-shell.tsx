"use client";

import { useState } from "react";
import { ClusterSelect } from "../cluster-select";
import { WalletButton } from "../wallet-button";
import { DealershipWorkspace } from "./dealership-workspace";

const navigation = [
  { id: "overview", label: "Resumen", icon: "◫", group: "GESTIÓN" },
  { id: "motorcycles", label: "Motocicletas", icon: "⌁" },
  { id: "customers", label: "Clientes", icon: "♙" },
  { id: "sales", label: "Ventas", icon: "↗" },
  { id: "services", label: "Servicios", icon: "⚙" },
  { id: "warranties", label: "Garantías", icon: "◇", group: "POSVENTA" },
  { id: "claims", label: "Reclamaciones", icon: "▤" },
  { id: "settings", label: "Configuración", icon: "☷", group: "SISTEMA" },
] as const;

const pageCopy: Record<string, { title: string; description: string }> = {
  overview: {
    title: "Resumen general",
    description: "Una vista de la operación de tu concesionario.",
  },
  motorcycles: {
    title: "Motocicletas",
    description: "Inventario, datos técnicos y estado de cada unidad.",
  },
  customers: {
    title: "Clientes",
    description: "Directorio de clientes registrados en tu concesionario.",
  },
  sales: {
    title: "Ventas",
    description: "Registro y seguimiento de las ventas de motocicletas.",
  },
  services: {
    title: "Servicios",
    description: "Mantenimientos, reparaciones y trabajos realizados.",
  },
  warranties: {
    title: "Garantías",
    description: "Cobertura, vigencia y condiciones de garantía.",
  },
  claims: {
    title: "Reclamaciones",
    description: "Solicitudes de garantía y su estado de atención.",
  },
  settings: {
    title: "Configuración",
    description: "Datos del concesionario y parámetros de garantía.",
  },
};

function BrandMark() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e60012] text-white shadow-sm shadow-red-200">
      <svg viewBox="0 0 32 32" className="h-6 w-6" fill="none" aria-hidden="true">
        <path d="M5 21.5 10.5 11h5L21 21.5h6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.5 11 16 21.5 21 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="7" cy="22" r="3" stroke="currentColor" strokeWidth="2" />
        <circle cx="25" cy="22" r="3" stroke="currentColor" strokeWidth="2" />
      </svg>
    </div>
  );
}

function Sidebar({
  active,
  onNavigate,
}: {
  active: string;
  onNavigate: (id: string) => void;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col border-r border-[#e9ebee] bg-white lg:flex">
      <div className="flex h-[76px] items-center gap-3 border-b border-[#f0f1f3] px-6">
        <BrandMark />
        <div>
          <p className="text-[15px] font-extrabold tracking-[-0.04em] text-[#20252b]">MOTO<span className="text-[#e60012]">LEDGER</span></p>
          <p className="mt-0.5 text-[9px] font-semibold tracking-[0.19em] text-[#9aa1a9]">DEALERSHIP MANAGEMENT</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-4 py-7" aria-label="Navegación principal">
        {["GESTIÓN", "POSVENTA", "SISTEMA"].map((group) => (
          <div key={group}>
            <p className="mb-2 px-3 text-[9px] font-bold tracking-[0.18em] text-[#a0a6ad]">{group}</p>
            <div className="space-y-1">
              {navigation.filter((item) => item.group === group || (!item.group && group === "GESTIÓN" && ["customers", "sales", "services"].includes(item.id))).map((item) => {
                const selected = active === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[12px] font-semibold transition ${selected ? "bg-[#fff0f1] text-[#d90011]" : "text-[#69717a] hover:bg-[#f6f7f8] hover:text-[#252a30]"}`}
                  >
                    <span className={`flex h-5 w-5 items-center justify-center text-[17px] ${selected ? "text-[#e60012]" : "text-[#9aa1a9] group-hover:text-[#555e68]"}`}>{item.icon}</span>
                    {item.label}
                    {selected && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#e60012]" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-[#f0f1f3] p-4">
        <div className="rounded-xl bg-[#f7f8fa] p-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#e60012]" />
            <span className="text-[10px] font-bold tracking-wide text-[#555e68]">POWERED BY SOLANA</span>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-[#9299a1]">Registros verificables y trazabilidad para el ciclo de vida de cada motocicleta.</p>
        </div>
        <p className="mt-4 px-1 text-[10px] text-[#a5abb2]">MotoLedger · Versión 1.0</p>
      </div>
    </aside>
  );
}

function MetricCard({
  label,
  icon,
  note,
}: {
  label: string;
  icon: string;
  note: string;
}) {
  return (
    <div className="rounded-xl border border-[#e9ebee] bg-white p-5 shadow-[0_2px_8px_rgba(24,32,40,0.025)]">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-[#7b838c]">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f6f7f8] text-[17px] text-[#69717a]">{icon}</span>
      </div>
      <p className="mt-4 text-[27px] font-bold tracking-[-0.05em] text-[#252a30]">—</p>
      <p className="mt-1 text-[10px] text-[#a0a6ad]">{note}</p>
    </div>
  );
}

function EmptySection({ title }: { title: string }) {
  return (
    <section className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-[#e9ebee] bg-white px-6 text-center shadow-[0_2px_8px_rgba(24,32,40,0.025)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0f1] text-2xl text-[#e60012]">⌁</div>
      <h2 className="mt-4 text-[14px] font-bold text-[#343a40]">{title}</h2>
      <p className="mt-2 max-w-sm text-[11px] leading-relaxed text-[#9299a1]">Estamos preparando este módulo para conectarlo con las instrucciones y cuentas del programa MotoLedger en Solana.</p>
      <span className="mt-5 rounded-full border border-[#f1d4d7] bg-[#fff7f7] px-3 py-1.5 text-[9px] font-bold tracking-wide text-[#d90011]">MÓDULO EN DESARROLLO</span>
    </section>
  );
}

export function DashboardShell() {
  const [active, setActive] = useState("overview");
  const page = pageCopy[active];

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-[#20252b]">
      <Sidebar active={active} onNavigate={setActive} />
      <div className="min-h-screen lg:pl-[252px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-[#e9ebee] bg-white/95 px-5 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <BrandMark />
            <span className="text-[14px] font-extrabold tracking-[-0.04em]">MOTO<span className="text-[#e60012]">LEDGER</span></span>
          </div>
          <div className="hidden lg:block">
            <p className="text-[9px] font-semibold tracking-[0.16em] text-[#a0a6ad]">PANEL DE CONTROL</p>
            <p className="mt-1 text-[12px] font-bold text-[#424950]">{page.title}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ClusterSelect />
            <WalletButton />
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-[#e9ebee] bg-white px-4 py-2 lg:hidden" aria-label="Navegación móvil">
          {navigation.map((item) => (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={`shrink-0 rounded-lg px-3 py-2 text-[10px] font-semibold transition ${active === item.id ? "bg-[#fff0f1] text-[#d90011]" : "text-[#737b84] hover:bg-[#f6f7f8]"}`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <main className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 sm:py-9">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold tracking-[0.16em] text-[#e60012]">MOTOLEDGER / {active.toUpperCase()}</p>
              <h1 className="mt-2 text-[25px] font-bold tracking-[-0.045em] text-[#20252b] sm:text-[29px]">{page.title}</h1>
              <p className="mt-1.5 text-[11px] text-[#858d96]">{page.description}</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#e9ebee] bg-white px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-[#e6a23c]" />
              <span className="text-[9px] font-semibold text-[#7b838c]">ESPERANDO CONEXIÓN</span>
            </div>
          </div>

          {active === "overview" ? <DealershipWorkspace /> : <EmptySection title={page.title} />}

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-[#e9ebee] pt-4 text-[9px] text-[#a0a6ad]">
            <span>MOTOLEDGER · GESTIÓN DE CONCESIONARIOS</span>
            <span>Construido sobre Solana</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
