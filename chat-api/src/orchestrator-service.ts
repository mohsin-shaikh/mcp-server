import type {
  ChatMessage,
  OrchestratorEvent,
  OrchestratorRunOptions,
} from "@zuupee/chat-orchestrator";
import type { ChatOrchestrator } from "@zuupee/chat-orchestrator";

export type OrchestratorRunner = {
  run(messages: ChatMessage[], options?: OrchestratorRunOptions): AsyncIterable<OrchestratorEvent>;
  close(): Promise<void>;
  getMcpHealth(): Promise<Record<string, "ok" | "error">>;
};

export class OrchestratorService implements OrchestratorRunner {
  private readonly orchestrator: ChatOrchestrator;
  private gate = Promise.resolve();

  constructor(orchestrator: ChatOrchestrator) {
    this.orchestrator = orchestrator;
  }

  async *run(
    messages: ChatMessage[],
    options?: OrchestratorRunOptions,
  ): AsyncIterable<OrchestratorEvent> {
    const release = await this.acquire();
    try {
      for await (const event of this.orchestrator.run(messages, options)) {
        yield event;
      }
    } finally {
      release();
    }
  }

  close(): Promise<void> {
    return this.orchestrator.close();
  }

  getMcpHealth(): Promise<Record<string, "ok" | "error">> {
    return this.orchestrator.getMcpHealth();
  }

  private async acquire(): Promise<() => void> {
    const previous = this.gate;
    let release!: () => void;
    this.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    return release;
  }
}
