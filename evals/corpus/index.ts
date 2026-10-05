import type { EvalDocument } from "../types";
import { bollette } from "./bollette";
import { contratti } from "./contratti";
import { fatture } from "./fatture";
import { generici } from "./generici";
import { polizze } from "./polizze";
import { referti } from "./referti";
import { speciali } from "./speciali";
import { tipiNuovi } from "./tipi-nuovi";

export const CORPUS: EvalDocument[] = [...polizze, ...contratti, ...referti, ...fatture, ...bollette, ...generici, ...tipiNuovi, ...speciali];
