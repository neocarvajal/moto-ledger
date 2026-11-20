import { address } from "@solana/kit";
import { describe, expect, it } from "vitest";
import {
  deriveClientePda,
  deriveConcesionarioPda,
  deriveGarantiaPda,
  deriveMotoPda,
  deriveRegistroGlobalPda,
  deriveServicioPda,
  deriveVentaPda,
} from "../../app/lib/moto-ledger/pdas";

const owner = address("CCF4CnM99mXSxz2sFffxT4A4CZxpWNsKNPbwueJThGMo");
const anotherOwner = address("11111111111111111111111111111111");
const dealership = address("7n7tA4N999UpXc6vfV7odSVek4JydyMEfUZNdGsbsc7o");
const anotherDealership = address("8WQjh7p1vmnPRVicWVvS5gXxZmibd5YfTfmkGRwufYKS");
const motorcycle = address("247Qs9cEC8Lyn9z76sHC9EBPCWNtiQULvDkYt2p58mer");

describe("MotoLedger PDA derivation", () => {
  it("derives the same global registry PDA every time", async () => {
    const first = await deriveRegistroGlobalPda();
    const second = await deriveRegistroGlobalPda();

    expect(first).toEqual(second);
    expect(first[0]).toBeTruthy();
    expect(first[1]).toBeGreaterThanOrEqual(0);
    expect(first[1]).toBeLessThanOrEqual(255);
  });

  describe("dealership", () => {
    it("derives a deterministic PDA from the dealership name and owner", async () => {
      const first = await deriveConcesionarioPda("BERA MOTORS", owner);
      const second = await deriveConcesionarioPda("BERA MOTORS", owner);

      expect(first).toEqual(second);
    });

    it("derives different PDAs when the name or owner changes", async () => {
      const original = await deriveConcesionarioPda("BERA MOTORS", owner);
      const differentName = await deriveConcesionarioPda("MOTOS TORO", owner);
      const differentOwner = await deriveConcesionarioPda(
        "BERA MOTORS",
        anotherOwner
      );

      expect(differentName[0]).not.toBe(original[0]);
      expect(differentOwner[0]).not.toBe(original[0]);
    });
  });

  it("derives a motorcycle PDA from its serial and dealership", async () => {
    const first = await deriveMotoPda("BER0DT1500BM00003", dealership);
    const repeated = await deriveMotoPda("BER0DT1500BM00003", dealership);
    const anotherDealer = await deriveMotoPda(
      "BER0DT1500BM00003",
      anotherDealership
    );

    expect(first).toEqual(repeated);
    expect(anotherDealer[0]).not.toBe(first[0]);
  });

  it("derives a customer PDA from the owner and numeric identity", async () => {
    const first = await deriveClientePda(owner, 12345678);
    const repeated = await deriveClientePda(owner, 12345678);
    const anotherCustomer = await deriveClientePda(owner, 87654321);

    expect(first).toEqual(repeated);
    expect(anotherCustomer[0]).not.toBe(first[0]);
  });

  it("derives a sale PDA from the motorcycle account", async () => {
    const first = await deriveVentaPda(motorcycle);
    const repeated = await deriveVentaPda(motorcycle);

    expect(first).toEqual(repeated);
    expect(first[0]).toBeTruthy();
  });

  it("derives a warranty PDA from the motorcycle serial", async () => {
    const first = await deriveGarantiaPda("BER0DT1500BM00003");
    const repeated = await deriveGarantiaPda("BER0DT1500BM00003");
    const anotherSerial = await deriveGarantiaPda("BER0SBR200BM00002");

    expect(first).toEqual(repeated);
    expect(anotherSerial[0]).not.toBe(first[0]);
  });

  it("derives a service PDA from the motorcycle and current service counter", async () => {
    const first = await deriveServicioPda(motorcycle, 0n);
    const repeated = await deriveServicioPda(motorcycle, 0n);
    const nextService = await deriveServicioPda(motorcycle, 1n);

    expect(first).toEqual(repeated);
    expect(nextService[0]).not.toBe(first[0]);
  });
});
