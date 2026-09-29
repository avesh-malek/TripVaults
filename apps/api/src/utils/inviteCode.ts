import { randomInt } from 'node:crypto';
import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from '@tripvault/shared';
import { tripRepository } from '../db/repositories/tripRepository.js';

export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

/** Generate an invite code that is not currently used by any trip. */
export async function ensureUniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generateInviteCode();
    const existing = await tripRepository.findByInviteCode(code);
    if (!existing) return code;
  }
  throw new Error('Failed to generate a unique invite code');
}
