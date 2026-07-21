import { createTranslator } from "../engine/translator";
import type {
  TranslatorWorkerRequest,
  TranslatorWorkerResponse,
} from "./protocol";

const translator = createTranslator();

self.addEventListener("message", (event: MessageEvent<TranslatorWorkerRequest>) => {
  const message = event.data;

  try {
    if (message.type === "INIT") {
      postMessage({
        type: "READY",
        dataVersion: translator.dataVersion,
      } satisfies TranslatorWorkerResponse);
      return;
    }

    if (message.type === "TRANSLATE") {
      postMessage({
        type: "RESULT",
        requestId: message.requestId,
        ...translator.translate(message.text, message.options),
      } satisfies TranslatorWorkerResponse);
    }
  } catch (error) {
    postMessage({
      type: "ERROR",
      requestId: message.type === "TRANSLATE" ? message.requestId : undefined,
      message: error instanceof Error ? error.message : "Translation failed",
    } satisfies TranslatorWorkerResponse);
  }
});
