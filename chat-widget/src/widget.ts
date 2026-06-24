import styles from "./styles.css?inline";
import {
  ensureSession,
  loadHistory,
  sendMessage,
  type ChatMessage,
  type StreamEvent,
} from "./api.js";

export type WidgetConfig = {
  apiUrl: string;
  theme: "light" | "dark";
};

export function mountWidget(config: WidgetConfig): void {
  const root = document.createElement("div");
  root.className = "zuupee-chat-root";
  root.dataset["theme"] = config.theme;
  document.body.appendChild(root);

  const style = document.createElement("style");
  style.textContent = styles;
  document.head.appendChild(style);

  const widget = new ChatWidget(root, config);
  void widget.init();
}

class ChatWidget {
  private readonly root: HTMLElement;
  private readonly config: WidgetConfig;
  private sessionId: string | null = null;
  private messages: ChatMessage[] = [];
  private isStreaming = false;

  private panel!: HTMLElement;
  private messagesEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private inputEl!: HTMLTextAreaElement;
  private sendButton!: HTMLButtonElement;
  private toggleButton!: HTMLButtonElement;

  constructor(root: HTMLElement, config: WidgetConfig) {
    this.root = root;
    this.config = config;
    this.render();
  }

  async init(): Promise<void> {
    try {
      this.sessionId = await ensureSession(this.config.apiUrl);
      this.messages = await loadHistory(this.config.apiUrl, this.sessionId);
      this.renderMessages();
    } catch (err) {
      this.setStatus(err instanceof Error ? err.message : "Failed to connect");
    }
  }

  private render(): void {
    this.root.innerHTML = `
      <button type="button" class="zuupee-chat-toggle" aria-label="Open chat">Chat</button>
      <section class="zuupee-chat-panel" hidden>
        <header class="zuupee-chat-header">
          <h2>Chat</h2>
          <button type="button" class="zuupee-chat-close" aria-label="Close chat">×</button>
        </header>
        <div class="zuupee-chat-messages" role="log" aria-live="polite"></div>
        <div class="zuupee-chat-status" aria-live="polite"></div>
        <form class="zuupee-chat-form">
          <textarea rows="2" placeholder="Ask a question..." aria-label="Message"></textarea>
          <button type="submit">Send</button>
        </form>
      </section>
    `;

    this.toggleButton = this.root.querySelector(".zuupee-chat-toggle") as HTMLButtonElement;
    this.panel = this.root.querySelector(".zuupee-chat-panel") as HTMLElement;
    this.messagesEl = this.root.querySelector(".zuupee-chat-messages") as HTMLElement;
    this.statusEl = this.root.querySelector(".zuupee-chat-status") as HTMLElement;
    this.inputEl = this.root.querySelector("textarea") as HTMLTextAreaElement;
    this.sendButton = this.root.querySelector('button[type="submit"]') as HTMLButtonElement;

    const closeButton = this.root.querySelector(".zuupee-chat-close") as HTMLButtonElement;
    const form = this.root.querySelector(".zuupee-chat-form") as HTMLFormElement;

    this.toggleButton.addEventListener("click", () => this.setOpen(true));
    closeButton.addEventListener("click", () => this.setOpen(false));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.handleSubmit();
    });

    this.inputEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void this.handleSubmit();
      }
    });

    this.setOpen(false);
  }

  private setOpen(open: boolean): void {
    this.panel.hidden = !open;
    this.toggleButton.hidden = open;
    if (open) {
      this.inputEl.focus();
    }
  }

  private setStatus(text: string): void {
    this.statusEl.textContent = text;
    this.statusEl.hidden = !text;
  }

  private renderMessages(): void {
    this.messagesEl.innerHTML = "";
    for (const message of this.messages) {
      this.appendMessageBubble(message.role, message.content);
    }
    this.scrollToBottom();
  }

  private appendMessageBubble(role: "user" | "assistant", content: string): HTMLElement {
    const bubble = document.createElement("div");
    bubble.className = `zuupee-chat-message zuupee-chat-message--${role}`;
    bubble.textContent = content;
    this.messagesEl.appendChild(bubble);
    return bubble;
  }

  private scrollToBottom(): void {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private setStreaming(streaming: boolean): void {
    this.isStreaming = streaming;
    this.inputEl.disabled = streaming;
    this.sendButton.disabled = streaming;
  }

  private async handleSubmit(): Promise<void> {
    const content = this.inputEl.value.trim();
    if (!content || this.isStreaming || !this.sessionId) {
      return;
    }

    this.inputEl.value = "";
    this.messages.push({ role: "user", content });
    this.appendMessageBubble("user", content);
    this.scrollToBottom();
    this.setStreaming(true);
    this.setStatus("");

    const assistantBubble = this.appendMessageBubble("assistant", "");
    let assistantText = "";

    try {
      await sendMessage(this.config.apiUrl, this.sessionId, content, (event) => {
        this.handleStreamEvent(event, assistantBubble, (text) => {
          assistantText = text;
        });
      });

      if (assistantText) {
        const last = this.messages[this.messages.length - 1];
        if (last?.role === "assistant") {
          last.content = assistantText;
        } else {
          this.messages.push({ role: "assistant", content: assistantText });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send message";
      assistantBubble.textContent = message;
      assistantBubble.classList.add("zuupee-chat-message--error");
      this.setStatus(message);
    } finally {
      this.setStreaming(false);
      this.setStatus("");
      this.scrollToBottom();
    }
  }

  private handleStreamEvent(
    event: StreamEvent,
    assistantBubble: HTMLElement,
    setAssistantText: (text: string) => void,
  ): void {
    switch (event.type) {
      case "text_delta":
        assistantBubble.textContent += event.delta;
        setAssistantText(assistantBubble.textContent);
        this.scrollToBottom();
        break;
      case "tool_start":
        this.setStatus(`Using tool: ${formatToolName(event.name)}…`);
        break;
      case "tool_end":
        this.setStatus(
          event.isError
            ? `Tool failed: ${formatToolName(event.name)}`
            : `Finished: ${formatToolName(event.name)}`,
        );
        break;
      case "done":
        assistantBubble.textContent = event.message;
        setAssistantText(event.message);
        this.setStatus("");
        break;
      case "error":
        assistantBubble.textContent = event.message;
        assistantBubble.classList.add("zuupee-chat-message--error");
        this.setStatus(event.message);
        break;
    }
  }
}

function formatToolName(name: string): string {
  return name.replace(/__/g, " · ");
}
