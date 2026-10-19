import { verifyPin } from "./auth";

/**
 * Mock NPCI Common Library (CL) Challenge Validator.
 * Real UPI architecture me UPI PIN app ke backend server par verify nahi hota —
 * NPCI CL encrypted credential block seedha Issuer Bank HSM ko bhejta hai.
 * Is simulator me humne ise ek isolated adapter ke peeche rakha hai taaki
 * production PSP/NPCI SDK aane par sirf ye file swap karni pade.
 */
export async function verifyNpciClCredential(userId: number, rawPinChallenge: unknown): Promise<void> {
  await verifyPin(userId, rawPinChallenge);
}
