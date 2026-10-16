/**
 * Outcome vocabularies shared by the corpus and benchmark scripts.
 *
 * Each script used to declare its own copy of these unions. One definition
 * keeps the JSON they write comparable across scripts.
 */

/** How one store's benchmark or coverage scan ended. */
export const StoreStatus = {
  Success: "success",
  Error: "error",
  BotBlocked: "bot_blocked",
} as const;

export type StoreStatus = (typeof StoreStatus)[keyof typeof StoreStatus];
