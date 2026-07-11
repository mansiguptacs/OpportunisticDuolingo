const API = "https://synapse.butterbase.dev";
const statusEl = document.getElementById("status");

function setStatus(msg) {
  statusEl.textContent = msg;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    ),
  ]);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function extractPage(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const title = document.title || "Untitled page";
      const url = location.href;
      const text = (document.body?.innerText || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 18000);
      return { title, url, text };
    },
  });
  return result;
}

async function loadSchedule() {
  try {
    const settings = await withTimeout(
      chrome.runtime.sendMessage({ type: "GET_SCHEDULE" }),
      2000,
      "schedule"
    );
    if (!settings) return;
    document.getElementById("enabled").checked = settings.enabled !== false;
    document.getElementById("morningHour").value = settings.morningHour ?? 9;
    document.getElementById("eveningHour").value = settings.eveningHour ?? 18;
    document.getElementById("quietStart").value = settings.quietStart ?? 22;
    document.getElementById("quietEnd").value = settings.quietEnd ?? 7;
  } catch (e) {
    setStatus(`Background sleepy — reload extension. (${e.message})`);
  }
}

loadSchedule();

document.getElementById("alchemize").addEventListener("click", async () => {
  try {
    setStatus("Reading page…");
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error("No active tab");
    if (
      tab.url?.startsWith("chrome://") ||
      tab.url?.startsWith("chrome-extension://")
    ) {
      throw new Error("Can't read Chrome system pages — open an article tab.");
    }
    const page = await extractPage(tab.id);
    if (!page?.text || page.text.length < 40) {
      throw new Error("Page text too short to alchemize.");
    }
    setStatus("Refining with Synapse…");
    const res = await fetch(`${API}/api/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: page.title,
        sourceUrl: page.url,
        rawText: page.text,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Ingest failed (${res.status})`);
    }
    const data = await res.json();
    setStatus(
      `Mapped ${data.concepts.length} concepts${
        data.usedFixture ? " (fixture refine)" : ""
      }. Opening atlas…`
    );
    const ids = (data.concepts || []).map((c) => c.id).filter(Boolean);
    const qs = new URLSearchParams();
    if (ids[0]) qs.set("select", ids[0]);
    if (ids.length) qs.set("spark", ids.join(","));
    qs.set("ingested", "1");
    await chrome.tabs.create({ url: `${API}/atlas?${qs.toString()}` });
  } catch (e) {
    setStatus(String(e.message || e));
  }
});

document.getElementById("ping").addEventListener("click", async () => {
  setStatus("Sending system notification…");
  try {
    const result = await withTimeout(
      chrome.runtime.sendMessage({ type: "PING_NOW" }),
      5000,
      "ping"
    );

    if (!result?.ok) {
      setStatus(
        `Ping failed: ${result?.reason || result?.notification?.reason || "unknown"}. Reload at chrome://extensions.`
      );
      return;
    }

    setStatus(
      `Notification sent.\n“${result.nudge?.title || "Cortex maintenance window"}”\n${result.nudge?.message || ""}`
    );
  } catch (e) {
    setStatus(
      `Ping error: ${e.message || e}. Go to chrome://extensions → Synapse → Reload, then try again.`
    );
  }
});

document.getElementById("snooze1h").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "SNOOZE", minutes: 60 });
  setStatus("Snoozed for 1 hour.");
});

document.getElementById("snoozeLunch").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "SNOOZE", minutes: 180 });
  setStatus("Snoozed for 3 hours.");
});

document.getElementById("saveSchedule").addEventListener("click", async () => {
  const settings = {
    enabled: document.getElementById("enabled").checked,
    morningHour: Number(document.getElementById("morningHour").value),
    eveningHour: Number(document.getElementById("eveningHour").value),
    quietStart: Number(document.getElementById("quietStart").value),
    quietEnd: Number(document.getElementById("quietEnd").value),
  };
  await chrome.runtime.sendMessage({ type: "SAVE_SCHEDULE", settings });
  setStatus(
    `Schedule saved — nudges at ${settings.morningHour}:00 & ${settings.eveningHour}:00.`
  );
});

document.getElementById("openAtlas").addEventListener("click", () => {
  chrome.tabs.create({ url: `${API}/` });
});

document.getElementById("openToday").addEventListener("click", () => {
  chrome.tabs.create({ url: `${API}/today` });
});
