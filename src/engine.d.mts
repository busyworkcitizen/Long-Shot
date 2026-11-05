// Types for src/engine.mjs, used by the server (worker/index.ts).
export const RACES: number, CLOCK: number, MAX_BUSTS: number, K_PRIOR: number, COVER: number;
export const UNLISTED_P: number, FIRST_CALL_LINE: number, LAUNCH: string;
export interface Bet { id: string; name: string; line: number; mult: number; terms: string; short: string; }
export const BETS: Bet[];
export const BET: Record<string, Bet>;
export const LADDER: Array<[number, string]>;
export interface PromptData { id: string; q: string; strip?: string; a: Array<[string, number, string[]?]>; }
export interface IndexEntry { i: number; k: string; l: string; w: number; p0: number; names: string[]; }
export function rng(seed: number): () => number;
export function shuffled<T>(arr: T[], seed: number): T[];
export function dayNum(s: string): number;
export function makeCard<T extends PromptData>(bank: T[], date: string): T[];
export function norm(s: string): string;
export function keyOf(p: PromptData, s: string): string;
export function forms(n: string): Set<string>;
export function dist(a: string, b: string): number;
export const labelOf: (s: string) => string;
export function weightSum(p: PromptData): number;
export function houseP0(p: PromptData, i: number): number;
export function indexOf(p: PromptData): { entries: IndexEntry[]; byKey: Map<string, IndexEntry> };
export function matchTail(p: PromptData, text: string): IndexEntry | null;
export function matchListed(p: PromptData, text: string): { e: IndexEntry; d: number } | null;
export function priceOf(p: number): { v: number; s: string };
export function priceStr(v: number): string;
export function basePts(v: number): number;
export function blend(count: number | undefined, N: number, p0: number): number;
export function probFrom(p: PromptData, k: string, counts: Record<string, number>, N: number): number;
export function verifyClaim(p: PromptData, text: string, i: number): "exact" | "fuzzy" | "tail" | null;
export function marketRows(p: PromptData, counts: Record<string, number>, labels: Record<string, string>, N: number, mineKey?: string | null, mineLabel?: string, top?: number): { rows: Array<{ k: string; l: string; p: number; rank: number }>; max: number; listed: number };
