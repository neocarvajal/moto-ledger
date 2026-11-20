"use client";

import { useState } from "react";
import { address } from "@solana/kit";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { toast } from "sonner";
import { useAppClient } from "../../lib/client-provider";
import {
  deriveConcesionarioPda,
  deriveRegistroGlobalPda,
} from "../../lib/moto-ledger/pdas";
import type { Concesionario } from "../../lib/moto-ledger/generated/src/generated/accounts";
import { MotorcycleRegistration } from "./motorcycle-registration";

function shortAddress(value: string) {
  return `${value.slice(0, 5)}…${value.slice(-5)}`;
}

export function DealershipWorkspace() {
  const client = useAppClient();
  const connected = useConnectedWallet(client);
  const [name, setName] = useState("");
  const [rif, setRif] = useState("");
  const [dealership, setDealership] = useState<{
    address: string;
    data: Concesionario;
  } | null>(null);
  const [busy, setBusy] = useState<"lookup" | "create" | null>(null);

  const findDealership = async (dealerName: string) => {
    if (!connected) throw new Error("Conecta tu wallet para consultar el concesionario.");
    const [dealerPda] = await deriveConcesionarioPda(
      dealerName.trim(),
      address(connected.account.address)
    );
    const account = await client.registro.accounts.concesionario.fetch(dealerPda);
    setDealership({ address: dealerPda, data: account.data });
    return { dealerPda, account };
  };

  const handleLookup = async () => {
    if (!name.trim()) {
      toast.error("Escribe el nombre exacto del concesionario.");
      return;
    }
    setBusy("lookup");
    try {
      await findDealership(name);
      toast.success("Concesionario encontrado en Solana.");
    } catch {
      setDealership(null);
      toast.info("No encontramos ese concesionario para esta wallet.");
    } finally {
      setBusy(null);
    }
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!connected?.signer) {
      toast.error("La wallet conectada no permite firmar transacciones.");
      return;
    }
    if (name.trim().length < 3 || rif.trim().length < 3) {
      toast.error("Completa el nombre y el RIF del concesionario.");
      return;
    }

    setBusy("create");
    try {
      const [registroGlobal] = await deriveRegistroGlobalPda();
      const [concesionario] = await deriveConcesionarioPda(
        name.trim(),
        address(connected.account.address)
      );
      const existing = await client.registro.accounts.concesionario
        .fetch(address(concesionario))
        .catch(() => null);

      if (existing) {
        setDealership({ address: concesionario, data: existing.data });
        toast.info("Este concesionario ya está registrado.");
        return;
      }

      const instruction = client.registro.instructions.registrarConcesionario({
        owner: connected.signer,
        registroGlobal,
        concesionario,
        nombreConcesionario: name.trim(),
        rifConcesionario: rif.trim(),
      });
      await instruction.sendTransaction();
      const created = await client.registro.accounts.concesionario.fetch(concesionario);
      setDealership({ address: concesionario, data: created.data });
      toast.success("Concesionario registrado correctamente.");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo registrar el concesionario."
      );
    } finally {
      setBusy(null);
    }
  };

  if (!connected) {
    return (
      <section className="rounded-xl border border-[#e9ebee] bg-white p-7 shadow-[0_2px_8px_rgba(24,32,40,0.025)]">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff0f1] text-xl text-[#e60012]">⌂</div>
        <h2 className="mt-4 text-[15px] font-bold text-[#252a30]">Conecta tu wallet para comenzar</h2>
        <p className="mt-2 max-w-lg text-[11px] leading-relaxed text-[#858d96]">
          Tu wallet identifica al propietario del concesionario y firma las operaciones que se registran en el programa MotoLedger.
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
      <section className="rounded-xl border border-[#e9ebee] bg-white p-6 shadow-[0_2px_8px_rgba(24,32,40,0.025)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold tracking-[0.16em] text-[#e60012]">PRIMER PASO</p>
            <h2 className="mt-2 text-[16px] font-bold text-[#252a30]">Tu concesionario</h2>
            <p className="mt-1 text-[11px] text-[#858d96]">Busca uno existente o registra uno nuevo en la blockchain.</p>
          </div>
          <span className="rounded-md bg-[#f4f5f6] px-2 py-1 text-[9px] font-bold text-[#737b84]">DEVNET / MAINNET</span>
        </div>

        <form onSubmit={handleCreate} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold text-[#555e68]">Nombre del concesionario</span>
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setDealership(null);
              }}
              maxLength={30}
              placeholder="Ej. Moto Center Sucre"
              className="w-full rounded-lg border border-[#e2e5e8] bg-white px-3 py-2.5 text-[12px] text-[#252a30] outline-none transition placeholder:text-[#b0b6bd] focus:border-[#e60012]"
              required
            />
            <span className="mt-1 block text-[9px] text-[#a0a6ad]">Usa exactamente el mismo nombre al volver a consultar.</span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold text-[#555e68]">RIF del concesionario</span>
            <input
              value={rif}
              onChange={(event) => setRif(event.target.value)}
              maxLength={10}
              placeholder="J-12345678-9"
              className="w-full rounded-lg border border-[#e2e5e8] bg-white px-3 py-2.5 text-[12px] text-[#252a30] outline-none transition placeholder:text-[#b0b6bd] focus:border-[#e60012]"
              required
            />
          </label>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleLookup}
              disabled={busy !== null || !name.trim()}
              className="rounded-lg border border-[#e2e5e8] bg-white px-4 py-2.5 text-[11px] font-semibold text-[#555e68] transition hover:bg-[#f7f8fa] disabled:opacity-50"
            >
              {busy === "lookup" ? "Buscando…" : "Buscar concesionario"}
            </button>
            <button
              type="submit"
              disabled={busy !== null}
              className="rounded-lg bg-[#e60012] px-4 py-2.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#c90010] disabled:opacity-50"
            >
              {busy === "create" ? "Enviando transacción…" : "Registrar concesionario"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-[#e9ebee] bg-white p-6 shadow-[0_2px_8px_rgba(24,32,40,0.025)]">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-bold text-[#252a30]">Estado on-chain</h2>
          <span className="flex items-center gap-1.5 text-[9px] font-semibold text-[#16a36a]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#16a36a]" /> WALLET CONECTADA
          </span>
        </div>
        {dealership ? (
          <>
            <div className="mt-5 rounded-lg bg-[#f7f8fa] p-4">
              <p className="text-[9px] font-bold tracking-[0.12em] text-[#9299a1]">CONCESIONARIO REGISTRADO</p>
              <p className="mt-2 text-[15px] font-bold text-[#252a30]">{dealership.data.nombreConcesionario}</p>
              <p className="mt-1 text-[10px] text-[#858d96]">{dealership.data.rifConcesionario}</p>
              <p className="mt-3 break-all font-mono text-[9px] text-[#9299a1]">{dealership.address}</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-[#eff0f2] p-3">
                <p className="text-[9px] text-[#9299a1]">Garantía (días)</p>
                <p className="mt-1 text-[18px] font-bold text-[#252a30]">{dealership.data.duracionGarantiaDias}</p>
              </div>
              <div className="rounded-lg border border-[#eff0f2] p-3">
                <p className="text-[9px] text-[#9299a1]">Km máximos</p>
                <p className="mt-1 text-[18px] font-bold text-[#252a30]">{dealership.data.kilometrajeMaximo.toLocaleString("es-VE")}</p>
              </div>
            </div>
            <p className="mt-4 text-[10px] leading-relaxed text-[#737b84]">
              {dealership.data.totalMotos.toString()} motos · {dealership.data.totalClientes} clientes · {dealership.data.totalVentas.toString()} ventas · {dealership.data.totalServicios.toString()} servicios.
            </p>
            <p className="mt-2 text-[9px] text-[#a0a6ad]">Cuenta: {shortAddress(dealership.address)}</p>
          </>
        ) : (
          <div className="flex min-h-[230px] flex-col items-center justify-center text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f7f8fa] text-lg text-[#9aa1a9]">⌂</div>
            <p className="mt-3 text-[11px] font-semibold text-[#515962]">Sin concesionario seleccionado</p>
            <p className="mt-1 max-w-[240px] text-[10px] leading-relaxed text-[#9aa1a9]">Introduce el nombre exacto para consultar la cuenta o registra tu concesionario.</p>
          </div>
        )}
      </section>
      {dealership && (
        <div className="xl:col-span-2">
          <MotorcycleRegistration
            concesionario={dealership.address}
            onRegistered={async () => {
              const refreshed = await client.registro.accounts.concesionario.fetch(
                address(dealership.address)
              );
              setDealership({ address: dealership.address, data: refreshed.data });
            }}
          />
        </div>
      )}
    </div>
  );
}
