"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  address,
  getBase58Decoder,
  getBase64Encoder,
  type Base58EncodedBytes,
} from "@solana/kit";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { toast } from "sonner";
import { useAppClient } from "../../lib/client-provider";
import { notifyTransactionSuccess } from "../../lib/transaction-toast";
import { deriveClientePda } from "../../lib/moto-ledger/pdas";
import {
  getMotoDecoder,
  getMotoDiscriminatorBytes,
  type Moto,
} from "../../lib/moto-ledger/generated/src/generated/accounts/moto";
import {
  getVentaDecoder,
  getVentaDiscriminatorBytes,
  type Venta,
} from "../../lib/moto-ledger/generated/src/generated/accounts/venta";

type MotorcycleRecord = { address: string; data: Moto };
type SaleRecord = { address: string; data: Venta };

function parseCedula(value: string) {
  const parsed = Number(value.trim());
  if (!/^[0-9]+$/.test(value.trim()) || !Number.isSafeInteger(parsed) || parsed <= 0 || parsed > 4294967295) {
    throw new Error("Introduce una cédula válida.");
  }
  return parsed;
}

function formatAmount(value: bigint) {
  return value.toLocaleString("es-VE");
}

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-5)}`;
}

export function SalesManagement({
  concesionario,
  nombreConcesionario,
  onRegistered,
}: {
  concesionario: string;
  nombreConcesionario: string;
  onRegistered: () => Promise<void>;
}) {
  const client = useAppClient();
  const connected = useConnectedWallet(client);
  const [motorcycles, setMotorcycles] = useState<MotorcycleRecord[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [serial, setSerial] = useState("");
  const [cedula, setCedula] = useState("");
  const [price, setPrice] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const availableMotorcycles = useMemo(
    () => motorcycles.filter((item) => !item.data.vendida),
    [motorcycles]
  );

  const loadData = useCallback(async () => {
    if (!concesionario) return;
    setLoading(true);
    try {
      const dealerAddress = address(concesionario);
      const motoDiscriminator = getBase58Decoder().decode(
        getMotoDiscriminatorBytes()
      ) as Base58EncodedBytes;
      const ventaDiscriminator = getBase58Decoder().decode(
        getVentaDiscriminatorBytes()
      ) as Base58EncodedBytes;

      const [motoResults, ventaResults] = await Promise.all([
        client.rpc.getProgramAccounts(
          (await import("../../lib/moto-ledger/generated/src/generated/programs")).REGISTRO_PROGRAM_ADDRESS,
          {
            encoding: "base64",
            filters: [
              { memcmp: { offset: 0n, bytes: motoDiscriminator, encoding: "base58" } },
            ],
          }
        ).send(),
        client.rpc.getProgramAccounts(
          (await import("../../lib/moto-ledger/generated/src/generated/programs")).REGISTRO_PROGRAM_ADDRESS,
          {
            encoding: "base64",
            filters: [
              { memcmp: { offset: 0n, bytes: ventaDiscriminator, encoding: "base58" } },
              { memcmp: { offset: 8n, bytes: dealerAddress as Base58EncodedBytes, encoding: "base58" } },
            ],
          }
        ).send(),
      ]);

      const motoRecords: MotorcycleRecord[] = motoResults
        .map((item) => ({
          address: item.pubkey,
          data: getMotoDecoder().decode(getBase64Encoder().encode(item.account.data[0])),
        }))
        .filter((item) => item.data.concesionario === concesionario)
        .sort((a, b) => a.data.serial.localeCompare(b.data.serial));

      const saleRecords: SaleRecord[] = ventaResults
        .map((item) => ({
          address: item.pubkey,
          data: getVentaDecoder().decode(getBase64Encoder().encode(item.account.data[0])),
        }))
        .sort((a, b) => Number(b.data.fechaVenta - a.data.fechaVenta));

      setMotorcycles(motoRecords);
      setSales(saleRecords);
      setSerial((current) =>
        motoRecords.some((item) => item.data.serial === current && !item.data.vendida)
          ? current
          : motoRecords.find((item) => !item.data.vendida)?.data.serial ?? ""
      );
    } catch (error) {
      console.error("No se pudieron cargar las ventas:", error);
      toast.error("No se pudo consultar el inventario y las ventas en Solana.");
    } finally {
      setLoading(false);
    }
  }, [client, concesionario]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const lookupCustomer = async (value: string) => {
    if (!connected) throw new Error("Conecta tu wallet para consultar clientes.");
    const id = parseCedula(value);
    const [pda] = await deriveClientePda(address(connected.account.address), id);
    const account = await client.registro.accounts.cliente.fetch(pda);
    if (account.data.owner !== connected.account.address) {
      throw new Error("El cliente no pertenece a la wallet conectada.");
    }
    setCustomerName(account.data.nombreCliente);
    setCustomerAddress(pda);
    return { id, pda };
  };

  const handleCustomerLookup = async () => {
    try {
      await lookupCustomer(cedula);
    } catch (error) {
      setCustomerName("");
      setCustomerAddress("");
      toast.error(error instanceof Error ? error.message : "No se encontró el cliente.");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!connected?.signer) {
      toast.error("Conecta una wallet con capacidad de firma.");
      return;
    }
    if (!serial) {
      toast.error("Selecciona una motocicleta disponible.");
      return;
    }

    let customerId: number;
    let amount: bigint;
    try {
      customerId = parseCedula(cedula);
      if (!/^[0-9]+$/.test(price.trim())) throw new Error("Introduce un precio entero válido.");
      amount = BigInt(price.trim());
      if (amount <= 0n) throw new Error("El precio de venta debe ser mayor que cero.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Revisa los datos de la venta.");
      return;
    }

    setBusy(true);
    try {
      const owner = address(connected.account.address);
      const dealerAddress = address(concesionario);
      const [cliente] = await deriveClientePda(owner, customerId);
      const customer = await client.registro.accounts.cliente.fetch(cliente);
      if (customer.data.owner !== owner) throw new Error("El cliente no pertenece a la wallet conectada.");

      const motorcycle = motorcycles.find((item) => item.data.serial === serial);
      if (!motorcycle) throw new Error("La motocicleta seleccionada ya no está disponible.");
      if (motorcycle.data.vendida) throw new Error("Esta motocicleta ya fue vendida.");

      const [venta] = await (await import("../../lib/moto-ledger/pdas")).deriveVentaPda(
        address(motorcycle.address)
      );
      const instruction = client.registro.instructions.registrarVenta({
        owner: connected.signer,
        concesionario: dealerAddress,
        cliente,
        moto: address(motorcycle.address),
        venta,
        nombreConcesionario,
        serial: motorcycle.data.serial,
        cedulaCliente: customerId,
        precioVenta: amount,
      });
      const result = await instruction.sendTransaction();
      notifyTransactionSuccess("Venta registrada correctamente en Solana.", result.context.signature);
      setCedula("");
      setPrice("");
      setCustomerName("");
      setCustomerAddress("");
      await Promise.all([loadData(), onRegistered()]);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "No se pudo registrar la venta.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#e9ebee] bg-white p-6 shadow-[0_2px_8px_rgba(24,32,40,0.025)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold tracking-[0.16em] text-[#e60012]">COMERCIALIZACIÓN</p>
            <h2 className="mt-2 text-[15px] font-bold text-[#252a30]">Registrar venta</h2>
            <p className="mt-1 text-[10px] text-[#858d96]">Asocia una motocicleta disponible con un cliente registrado.</p>
          </div>
          <button type="button" onClick={() => void loadData()} disabled={loading} className="rounded-lg border border-[#e2e5e8] px-3 py-2 text-[10px] font-semibold text-[#555e68] hover:bg-[#f7f8fa] disabled:opacity-50">
            {loading ? "Actualizando…" : "Actualizar datos"}
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-[#f7f8fa] p-4">
            <p className="text-[9px] text-[#9299a1]">Unidades disponibles</p>
            <p className="mt-1 text-[22px] font-bold text-[#252a30]">{availableMotorcycles.length}</p>
          </div>
          <div className="rounded-lg bg-[#f7f8fa] p-4">
            <p className="text-[9px] text-[#9299a1]">Ventas registradas</p>
            <p className="mt-1 text-[22px] font-bold text-[#252a30]">{sales.length}</p>
          </div>
          <div className="rounded-lg bg-[#f7f8fa] p-4">
            <p className="text-[9px] text-[#9299a1]">Concesionario</p>
            <p className="mt-1 truncate text-[13px] font-bold text-[#252a30]">{nombreConcesionario}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 border-t border-[#eff0f2] pt-5 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-[10px] font-semibold text-[#555e68]">Motocicleta disponible</span>
            <select value={serial} onChange={(event) => setSerial(event.target.value)} required className="w-full rounded-lg border border-[#e2e5e8] bg-white px-3 py-2.5 text-[11px] outline-none focus:border-[#e60012]">
              {availableMotorcycles.length === 0 ? <option value="">No hay unidades disponibles</option> : availableMotorcycles.map((item) => (
                <option key={item.address} value={item.data.serial}>
                  {item.data.marca} {item.data.modelo} · {item.data.serial} · {item.data.placa}
                </option>
              ))}
            </select>
            {availableMotorcycles.length === 0 && <span className="mt-1 block text-[9px] text-[#a0a6ad]">Registra una motocicleta antes de crear una venta.</span>}
          </label>

          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-[10px] font-semibold text-[#555e68]">Cliente registrado</span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={cedula} onChange={(event) => { setCedula(event.target.value.replace(/[^0-9]/g, "")); setCustomerName(""); setCustomerAddress(""); }} inputMode="numeric" maxLength={10} required placeholder="Cédula de identidad" className="min-w-0 flex-1 rounded-lg border border-[#e2e5e8] px-3 py-2.5 font-mono text-[11px] outline-none focus:border-[#e60012]" />
              <button type="button" onClick={() => void handleCustomerLookup()} disabled={!cedula} className="rounded-lg border border-[#e2e5e8] px-4 py-2.5 text-[10px] font-semibold text-[#555e68] hover:bg-[#f7f8fa] disabled:opacity-50">Verificar cliente</button>
            </div>
            {customerName && <p className="mt-2 text-[10px] font-semibold text-[#16845a]">✓ {customerName} · Cliente verificado en Solana</p>}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold text-[#555e68]">Precio de venta</span>
            <input value={price} onChange={(event) => setPrice(event.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" required placeholder="Ej. 2500" className="w-full rounded-lg border border-[#e2e5e8] px-3 py-2.5 font-mono text-[11px] outline-none focus:border-[#e60012]" />
            <span className="mt-1 block text-[9px] text-[#9aa1a9]">Monto entero registrado en la cuenta on-chain, sin decimales.</span>
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={busy || loading || availableMotorcycles.length === 0} className="w-full rounded-lg bg-[#e60012] px-4 py-2.5 text-[11px] font-semibold text-white transition hover:bg-[#c90010] disabled:opacity-50">
              {busy ? "Registrando venta…" : "Confirmar venta"}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#e9ebee] bg-white shadow-[0_2px_8px_rgba(24,32,40,0.025)]">
        <div className="flex items-center justify-between border-b border-[#eff0f2] px-6 py-4">
          <div>
            <p className="text-[9px] font-bold tracking-[0.16em] text-[#e60012]">HISTORIAL ON-CHAIN</p>
            <h2 className="mt-1 text-[14px] font-bold text-[#252a30]">Ventas del concesionario</h2>
          </div>
          <span className="rounded-md bg-[#f4f5f6] px-2 py-1 text-[9px] font-bold text-[#737b84]">{sales.length} registros</span>
        </div>
        {sales.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left">
              <thead className="bg-[#fafbfc] text-[9px] font-bold uppercase tracking-wide text-[#9299a1]">
                <tr><th className="px-6 py-3">Fecha</th><th className="px-4 py-3">Cliente PDA</th><th className="px-4 py-3">Motocicleta PDA</th><th className="px-4 py-3 text-right">Precio</th><th className="px-6 py-3 text-right">Venta PDA</th></tr>
              </thead>
              <tbody className="divide-y divide-[#f0f1f3]">
                {sales.map((sale) => (
                  <tr key={sale.address} className="text-[10px] text-[#555e68]">
                    <td className="whitespace-nowrap px-6 py-3">{new Date(Number(sale.data.fechaVenta) * 1000).toLocaleString("es-VE")}</td>
                    <td className="px-4 py-3 font-mono">{shortAddress(sale.data.cliente)}</td>
                    <td className="px-4 py-3 font-mono">{shortAddress(sale.data.moto)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-[#252a30]">{formatAmount(sale.data.precioVenta)}</td>
                    <td className="px-6 py-3 text-right"><a href={`https://explorer.solana.com/address/${sale.address}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="font-mono text-[#68717b] underline decoration-dotted underline-offset-2 hover:text-[#e60012]">{shortAddress(sale.address)} ↗</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex min-h-[150px] flex-col items-center justify-center px-6 text-center">
            <p className="text-[11px] font-semibold text-[#515962]">{loading ? "Consultando ventas…" : "Todavía no hay ventas registradas"}</p>
            <p className="mt-1 text-[10px] text-[#9aa1a9]">Las ventas confirmadas en la blockchain aparecerán aquí.</p>
          </div>
        )}
      </section>
    </div>
  );
}
