"use client";

import { useCallback, useEffect, useState } from "react";
import {
  address,
  getBase64Encoder,
  getBase58Decoder,
  type Address,
  type Base58EncodedBytes,
} from "@solana/kit";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { toast } from "sonner";
import { useAppClient } from "../../lib/client-provider";
import { notifyTransactionSuccess } from "../../lib/transaction-toast";
import { deriveGarantiaPda } from "../../lib/moto-ledger/pdas";
import {
  getMotoDecoder,
  getMotoDiscriminatorBytes,
  type Moto,
} from "../../lib/moto-ledger/generated/src/generated/accounts/moto";

type MotorcycleRecord = { address: Address; data: Moto };

export function MotorcycleCatalog({
  concesionario,
  nombreConcesionario,
  onDeleted,
}: {
  concesionario: string;
  nombreConcesionario: string;
  onDeleted: () => Promise<void>;
}) {
  const client = useAppClient();
  const connected = useConnectedWallet(client);
  const [motorcycles, setMotorcycles] = useState<MotorcycleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadMotorcycles = useCallback(async () => {
    setLoading(true);
    try {
      const discriminator = getBase58Decoder().decode(
        getMotoDiscriminatorBytes()
      ) as Base58EncodedBytes;
      const results = await client.rpc
        .getProgramAccounts(
          "64dHKqRTBciEidqLJqCvTWEGWkR1QqyYDZgomMt9AWCj",
          {
            encoding: "base64",
            filters: [
              {
                memcmp: {
                  offset: 0n,
                  bytes: discriminator,
                  encoding: "base58",
                },
              },
            ],
          }
        )
        .send();

      const records = results
        .map((item) => ({
          address: address(item.pubkey),
          data: getMotoDecoder().decode(
            getBase64Encoder().encode(item.account.data[0])
          ),
        }))
        .filter((item) => item.data.concesionario === concesionario)
        .sort((a, b) => a.data.serial.localeCompare(b.data.serial));

      setMotorcycles(records);
    } catch (error) {
      console.error("No se pudo cargar el catálogo:", error);
      toast.error("No se pudo consultar el catálogo de motocicletas.");
    } finally {
      setLoading(false);
    }
  }, [client, concesionario]);

  useEffect(() => {
    void loadMotorcycles();
  }, [loadMotorcycles]);

  const handleDelete = async (motorcycle: MotorcycleRecord) => {
    if (!connected?.signer) {
      toast.error("Conecta una wallet con capacidad de firma.");
      return;
    }

    if (
      motorcycle.data.vendida ||
      motorcycle.data.servicios > 0n ||
      motorcycle.data.totalReclamaciones > 0n
    ) {
      toast.error("Esta motocicleta tiene un historial que debe conservarse.");
      return;
    }

    const confirmed = window.confirm(
      `¿Eliminar esta motocicleta del catálogo?\n\n${motorcycle.data.marca} ${motorcycle.data.modelo}\nSerial: ${motorcycle.data.serial}\nPlaca: ${motorcycle.data.placa}\n\nSe cerrarán las cuentas de la moto y su garantía. Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    setDeleting(motorcycle.address);
    try {
      const [garantia] = await deriveGarantiaPda(motorcycle.data.serial);
      const latestMoto = await client.registro.accounts.moto.fetch(
        motorcycle.address
      );

      if (
        latestMoto.data.concesionario !== concesionario ||
        latestMoto.data.vendida ||
        latestMoto.data.servicios > 0n ||
        latestMoto.data.totalReclamaciones > 0n
      ) {
        throw new Error(
          "La motocicleta cambió de estado y ya no cumple las condiciones para eliminarse."
        );
      }

      const instruction = client.registro.instructions.eliminarMoto({
        owner: connected.signer,
        concesionario: address(concesionario),
        moto: motorcycle.address,
        garantia,
        nombreConcesionario,
        serial: latestMoto.data.serial,
      });
      const result = await instruction.sendTransaction();

      notifyTransactionSuccess(
        "Motocicleta y garantía eliminadas del catálogo.",
        result.context.signature
      );
      await loadMotorcycles();
      await onDeleted();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar la motocicleta."
      );
    } finally {
      setDeleting(null);
    }
  };

  const eligibleCount = motorcycles.filter(
    ({ data }) =>
      !data.vendida &&
      data.servicios === 0n &&
      data.totalReclamaciones === 0n
  ).length;

  return (
    <section className="rounded-xl border border-[#e9ebee] bg-white p-6 shadow-[0_2px_8px_rgba(24,32,40,0.025)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold tracking-[0.16em] text-[#e60012]">
            CATÁLOGO DEL CONCESIONARIO
          </p>
          <h2 className="mt-2 text-[15px] font-bold text-[#252a30]">
            Inventario de motocicletas
          </h2>
          <p className="mt-1 text-[10px] text-[#858d96]">
            Consulta las unidades registradas y elimina únicamente las que no tengan historial.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadMotorcycles()}
          disabled={loading || deleting !== null}
          className="rounded-lg border border-[#e2e5e8] px-3 py-2 text-[10px] font-semibold text-[#555e68] hover:bg-[#f7f8fa] disabled:opacity-50"
        >
          {loading ? "Actualizando…" : "Actualizar catálogo"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[9px]">
        <span className="rounded-md bg-[#f4f5f6] px-2.5 py-1.5 font-semibold text-[#68717b]">
          {motorcycles.length} unidad(es)
        </span>
        <span className="rounded-md bg-[#edf8f2] px-2.5 py-1.5 font-semibold text-[#168451]">
          {eligibleCount} elegible(s) para eliminar
        </span>
      </div>

      {loading && motorcycles.length === 0 ? (
        <p className="mt-5 rounded-lg bg-[#f7f8fa] p-5 text-center text-[11px] text-[#858d96]">
          Consultando inventario en Solana…
        </p>
      ) : motorcycles.length === 0 ? (
        <p className="mt-5 rounded-lg bg-[#f7f8fa] p-5 text-center text-[11px] text-[#858d96]">
          Este concesionario todavía no tiene motocicletas registradas.
        </p>
      ) : (
        <div className="mt-4 divide-y divide-[#eff0f2]">
          {motorcycles.map((motorcycle) => {
            const { data } = motorcycle;
            const canDelete =
              !data.vendida &&
              data.servicios === 0n &&
              data.totalReclamaciones === 0n;
            const reason = data.vendida
              ? "Vendida · registro protegido"
              : data.servicios > 0n || data.totalReclamaciones > 0n
                ? "Tiene historial de posventa"
                : "Disponible para eliminación";

            return (
              <div
                key={motorcycle.address}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-bold text-[#30363d]">
                      {data.marca} {data.modelo}
                    </p>
                    <span
                      className={`rounded px-2 py-0.5 text-[8px] font-bold ${canDelete ? "bg-[#edf8f2] text-[#168451]" : "bg-[#f4f5f6] text-[#737b84]"}`}
                    >
                      {reason}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[9px] text-[#858d96]">
                    {data.serial} · {data.placa} · {data.color}
                  </p>
                  <p className="mt-1 text-[9px] text-[#a0a6ad]">
                    {data.servicios.toString()} servicio(s) · {data.totalReclamaciones.toString()} reclamación(es)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(motorcycle)}
                  disabled={!canDelete || deleting !== null}
                  className="shrink-0 rounded-lg border border-[#f0c8cc] px-3 py-2 text-[10px] font-semibold text-[#d90011] transition hover:bg-[#fff0f1] disabled:cursor-not-allowed disabled:border-[#e9ebee] disabled:text-[#b0b5bb] disabled:hover:bg-white"
                >
                  {deleting === motorcycle.address
                    ? "Eliminando…"
                    : "Eliminar moto"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 border-t border-[#eff0f2] pt-3 text-[9px] leading-relaxed text-[#9aa1a9]">
        Las motos vendidas o con servicios/reclamaciones no se pueden eliminar. El programa también valida estas condiciones on-chain y devuelve al owner los fondos de renta de las cuentas cerradas.
      </p>
    </section>
  );
}
