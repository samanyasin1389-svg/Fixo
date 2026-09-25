const messagesEl = document.getElementById("messages");
const composer = document.getElementById("composer");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const statusEl = document.getElementById("status");
const welcome = document.getElementById("welcome");

/** @type {{role: string, content: string}[]} */
const history = [];

function setStatus(state, text) {
  statusEl.dataset.state = state;
  statusEl.querySelector(".status-text").textContent = text;
}

function addMessage(role, content) {
  const el = document.createElement("article");
  el.className = `msg ${role}`;
  const label =
    role === "user" ? "تو" : role === "assistant" ? "Fixo" : "";
  el.innerHTML = label
    ? `<span class="label">${label}</span><div class="body"></div>`
    : `<div class="body"></div>`;
  el.querySelector(".body").textContent = content;
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return el.querySelector(".body");
}

function autoResize() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
}

async function checkHealth() {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    if (!data.ollama) {
      setStatus("error", "Ollama خاموش است");
      sendBtn.disabled = true;
      addMessage(
        "system",
        "سرویس Ollama در دسترس نیست. در ترمینال اجرا کن: ollama serve"
      );
      return;
    }
    if (!data.model_ready) {
      setStatus("error", "مدل هنوز دانلود نشده");
      sendBtn.disabled = true;
      addMessage(
        "system",
        `مدل ${data.model} پیدا نشد. اجرا کن: ollama pull ${data.model}`
      );
      return;
    }
    setStatus("ready", `آماده · ${data.model}`);
    sendBtn.disabled = false;
  } catch {
    setStatus("error", "سرور چت در دسترس نیست");
    sendBtn.disabled = true;
  }
}

async function sendMessage(text) {
  welcome.classList.add("is-hidden");
  history.push({ role: "user", content: text });
  addMessage("user", text);

  const bodyEl = addMessage("assistant", "…");
  sendBtn.disabled = true;
  input.value = "";
  autoResize();

  let full = "";
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `خطا ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line);
          const piece = chunk?.message?.content || "";
          if (piece) {
            full += piece;
            bodyEl.textContent = full;
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
        } catch {
          // skip malformed chunk
        }
      }
    }

    if (!full) {
      bodyEl.textContent = "پاسخی دریافت نشد. دوباره امتحان کن.";
    } else {
      history.push({ role: "assistant", content: full });
    }
  } catch (err) {
    bodyEl.textContent = String(err.message || err);
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

composer.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || sendBtn.disabled) return;
  sendMessage(text);
});

input.addEventListener("input", autoResize);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    composer.requestSubmit();
  }
});

checkHealth();
input.focus();
