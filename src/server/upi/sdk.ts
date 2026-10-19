import { config } from "../config";
import { ApiError } from "../errors";
import type { SessionUser } from "../auth";
import { listBanks, type Bank } from "../banks";
import { mockBalance, mockDiscover, mockLink, type DiscoveredAccount } from "../linking";
import { findTxnById, mapTxn } from "../ledger";
import { settlePending } from "../settle";

/**
 * NPCI Common Library / PSP ke saath jo bhi cheezein bahar se aati hain, sab is ek interface ke peeche.
 * Abhi `MockUpiSdkService` chalta hai. PSP sandbox + NPCI CL milne par sirf `RealUpiSdkService` bharna hai
 * aur env me EK_UPI_SDK=real karna hai, baaki app (routes, UI) ko haath nahi lagana padega.
 *
 * Dhyan: real UPI me UPI PIN kabhi hamare server/app tak nahi aata, wo sirf NPCI CL ke secure UI me jaata hai.
 * Mock me PIN hamare server par verify hota hai, ye sirf simulator ke liye hai.
 */
export interface UpiSdkService {
  /** ListAccountProvider */
  getBankList(q?: string): Promise<Bank[]>;
  /** ListAccount: user ke mobile number se bank me kaun-kaun se accounts linked hain */
  discoverAccounts(user: SessionUser, bankId: string): Promise<DiscoveredAccount[]>;
  linkAccount(user: SessionUser, bankId: string, last4: string): Promise<{ id: number; label: string; isPrimary: boolean }>;
  /** Real me PIN CL ke UI me enter hota hai; `pin` sirf mock me use hota hai. */
  checkBalance(userId: number, accountId: number | undefined, pin: unknown): Promise<{ label: string; balance: number }>;
  getTransactionStatus(userId: number, txnId: number): Promise<ReturnType<typeof mapTxn>>;
}

export class MockUpiSdkService implements UpiSdkService {
  async getBankList(q?: string) { return listBanks(q); }
  async discoverAccounts(user: SessionUser, bankId: string) { return mockDiscover(user.phone, bankId); }
  async linkAccount(user: SessionUser, bankId: string, last4: string) { return mockLink(user, bankId, last4); }
  async checkBalance(userId: number, accountId: number | undefined, pin: unknown) { return mockBalance(userId, accountId, pin); }
  async getTransactionStatus(userId: number, txnId: number) {
    settlePending(userId);
    const t = findTxnById(userId, txnId);
    if (!t) throw new ApiError(404, "TXN_NOT_FOUND", "Transaction nahi mili");
    return mapTxn(t);
  }
}

const notReady = (what: string) =>
  new ApiError(501, "SDK_NOT_CONFIGURED", `Real UPI SDK abhi connected nahi hai (${what}). PSP bank + NPCI CL integration baaki hai.`);

/** TODO: PSP bank se NPCI CL / sandbox credentials milne par yahan real calls likhna. */
export class RealUpiSdkService implements UpiSdkService {
  async getBankList(): Promise<Bank[]> { throw notReady("ListAccountProvider"); }
  async discoverAccounts(): Promise<DiscoveredAccount[]> { throw notReady("ListAccount"); }
  async linkAccount(): Promise<never> { throw notReady("link account"); }
  async checkBalance(): Promise<never> { throw notReady("balance enquiry via CL"); }
  async getTransactionStatus(): Promise<never> { throw notReady("transaction status / check txn API"); }
}

export const getUpiSdk = (): UpiSdkService => (config.upiSdk === "real" ? new RealUpiSdkService() : new MockUpiSdkService());
