/**
 * AmneziaWG Obfuscation Parameter Generator
 *
 * Generates random obfuscation parameters that conform to amneziawg-go constraints.
 * Based on: https://github.com/amnezia-vpn/amneziawg-go/blob/master/device/device.go
 */

export interface AwgObfuscationParams {
  jc: number; // Junk packet count
  jmin: number; // Junk packet minimum size
  jmax: number; // Junk packet maximum size
  s1: number; // Init header junk size
  s2: number; // Response header junk size
  h1: number; // Init magic header
  h2: number; // Response magic header
  h3: number; // Cookie magic header
  h4: number; // Transport magic header
}

/* eslint-disable @typescript-eslint/no-unused-vars */
// Constants from amneziawg-go
const MAX_SEGMENT_SIZE = 65535; // Default for Linux (1 << 16) - 1
const MESSAGE_INITIATION_SIZE = 148;
const MESSAGE_RESPONSE_SIZE = 92;
const MESSAGE_COOKIE_SIZE = 64;
const MESSAGE_TRANSPORT_SIZE = 32;

// Amnezia documentation constraints (assuming MTU = 1280)
const MTU = 1280;
const S1_MAX_MTU = MTU - MESSAGE_INITIATION_SIZE; // 1132
const S2_MAX_MTU = MTU - MESSAGE_RESPONSE_SIZE; // 1188
/* eslint-disable @typescript-eslint/no-unused-vars */

// Recommended ranges from Amnezia documentation for random generation
const JC_MIN = 4;
const JC_MAX = 12;
const JMIN_MIN = 8;
const JMIN_MAX = 80;
const JMAX_MIN = 80;
const JMAX_MAX = 1280;
const S_MIN = 15;
const S_MAX = 150;

/* eslint-disable @typescript-eslint/no-unused-vars */
// Magic header ranges (must be > 4 and non-overlapping)
const MAGIC_HEADER_MIN = 5;
const MAGIC_HEADER_MAX = 0xffffffff; // uint32 max
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Generate a random integer between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate non-overlapping magic header values
 * Each header must be > 4 and all must be distinct
 * Recommended range: 5 to 2147483647 (max signed 32-bit int)
 */
function generateMagicHeaders(): [number, number, number, number] {
  const headers = new Set<number>();

  while (headers.size < 4) {
    const value = randomInt(MAGIC_HEADER_MIN, 2147483647);
    headers.add(value);
  }

  return Array.from(headers) as [number, number, number, number];
}

/**
 * Generate random AmneziaWG obfuscation parameters
 */
export function generateAwgObfuscationParams(): AwgObfuscationParams {
  const jc = randomInt(JC_MIN, JC_MAX);
  const jmin = randomInt(JMIN_MIN, JMIN_MAX);
  const jmax = randomInt(Math.max(jmin + 1, JMAX_MIN), JMAX_MAX);
  const s1 = randomInt(S_MIN, Math.min(S_MAX, S1_MAX_MTU));
  const s2 = randomInt(S_MIN, Math.min(S_MAX, S2_MAX_MTU));
  const [h1, h2, h3, h4] = generateMagicHeaders();

  return { jc, jmin, jmax, s1, s2, h1, h2, h3, h4 };
}

/**
 * Validate AWG parameters against amneziawg-go constraints
 */
export function validateAwgParams(params: Partial<AwgObfuscationParams>): boolean {
  if (params.jc !== undefined && (params.jc < 1 || params.jc > 128)) {
    throw new Error('Jc (junk packet count) must be between 1 and 128');
  }

  if (params.jmin !== undefined && (params.jmin < 0 || params.jmin >= MTU)) {
    throw new Error(`Jmin (junk packet min size) must be between 0 and ${MTU - 1}`);
  }

  if (params.jmax !== undefined) {
    if (params.jmax < 1 || params.jmax > MTU) {
      throw new Error(`Jmax must be between 1 and ${MTU}`);
    }
    if (params.jmin !== undefined && params.jmax <= params.jmin) {
      throw new Error('Jmax must be > Jmin');
    }
  }

  if (params.s1 !== undefined) {
    if (params.s1 < 0 || params.s1 > S1_MAX_MTU) {
      throw new Error(`S1 must be between 0 and ${S1_MAX_MTU}`);
    }
  }

  if (params.s2 !== undefined) {
    if (params.s2 < 0 || params.s2 > S2_MAX_MTU) {
      throw new Error(`S2 must be between 0 and ${S2_MAX_MTU}`);
    }
  }

  if (params.s1 !== undefined && params.s2 !== undefined) {
    if (params.s1 + 56 === params.s2) {
      throw new Error('S1 + 56 must not equal S2');
    }
  }

  if (
    params.h1 !== undefined ||
    params.h2 !== undefined ||
    params.h3 !== undefined ||
    params.h4 !== undefined
  ) {
    const headers = [params.h1, params.h2, params.h3, params.h4].filter(
      (h) => h !== undefined
    ) as number[];

    for (const h of headers) {
      if (h <= 4) {
        throw new Error('Magic headers must be > 4 to enable obfuscation');
      }
    }

    if (headers.length === 4) {
      const uniqueHeaders = new Set(headers);
      if (uniqueHeaders.size !== 4) {
        throw new Error('All magic headers (H1-H4) must be distinct');
      }
    }
  }

  return true;
}
