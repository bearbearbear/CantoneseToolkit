import type { TranslationOptions, TranslationResult } from "../engine/schema";

export type TranslatorWorkerRequest =
  | {
      type: "INIT";
      dataVersion?: string;
      scene?: string;
    }
  | {
      type: "TRANSLATE";
      requestId: string;
      text: string;
      options: TranslationOptions;
    };

export type TranslatorWorkerResponse =
  | {
      type: "READY";
      dataVersion: string;
    }
  | ({
      type: "RESULT";
      requestId: string;
    } & TranslationResult)
  | {
      type: "ERROR";
      requestId?: string;
      message: string;
    };
