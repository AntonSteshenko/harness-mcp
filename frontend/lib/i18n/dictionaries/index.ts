import { SupportedLanguage } from "../languages";
import type { Dictionary } from "./types";
import { en } from "./en";
import { it } from "./it";
import { ru } from "./ru";
import { fr } from "./fr";
import { de } from "./de";
import { es } from "./es";

const DICTIONARIES: Record<SupportedLanguage, Dictionary> = { en, it, ru, fr, de, es };

export function getDictionary(language: SupportedLanguage): Dictionary {
  return DICTIONARIES[language];
}

export type { Dictionary };
