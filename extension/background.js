const API = "https://synapse.butterbase.dev";
const ALARM_MORNING = "synapse-morning";
const ALARM_EVENING = "synapse-evening";
const ALARM_SNOOZE = "synapse-snooze";

const DEFAULTS = {
  morningHour: 9,
  eveningHour: 18,
  quietStart: 22,
  quietEnd: 7,
  enabled: true,
};

/** Tiny coral PNG as data URL — never depends on packaged file path. */
const ICON_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAACvElEQVR4nO2dwVEDQQwEbRdZXA6EQBo8iY1UiIWNAz7wgyobH6eRuvsLj9WoJZd9azi/Pz9+nATLpfoAUosCwFEAOAoARwHgKAAcBYCjAHAUAI4CwFEAOAoARwHgKAAcBYCjAHAUAI4CwFEAOAoARwHgKAAcBYCjAHAUAI4CwFEAOA8nCNvr202/v16eTgTOU78cemvDqUKMEmDvphNkGCHAUY2fKEJrAaoaP0mElgKkNH6CCO3eBqY2P/1s7TdAt3BXk23QYgN0a36nM8cL0CXIrmePFqBDgN1riBUgPbgptUQKkBzYtJriBEgNamptUQIkBjS9xigBBCxA2mRQao0QICkQWs0RAghYgJRJoNZeLoCABUiYgGqqM3ADwLlQzU9iK8zCDQBHAeCUXAmrXv+/XdfaQs/1n2C+GnZNwOvr59UiHAnmJeCW6VpNLnTuAUKAvzR0QSQ4XICj1+s9jVwHS1Dx0jN6A+zRwDV8E4wWQMAC7Dm5a/AWGCuAXIcCwFEAOAoARwHgjBVgzw9VtsHPBsYKINcxWoA9JncbPP0lAnT6fH1r9Nzir4zeAPc0chs++SgBbm3oBmk+7kbQd2NTr4Sh/kwcMezEB06YlwD5GQWAUybA5GfsnbJwA8ApFcAtcCrPwA0A50KfAHrt5QJILRECJEwCteYIAZICodUaI4DUECVA0mRQaowSIDGg6bXFCZAa1NSaIgVIDmxaLbECpAc3pYZoAToE2P3s8QJ0CbLrmdv859AuV8lWk8a32gBdAl7BZxuzARK3wWrY+BECVIuwGjd+lABHi7AGNH6kAP8pwxrUdIQA9wqxhjYcK4AMeRso+6IAcBQAjgLAUQA4CgBHAeAoABwFgKMAcBQAjgLAUQA4CgBHAeAoABwFgKMAcBQAjgLAUQA4CgBHAeAoABwFgKMAcBQAzieIKdJ3pTkwxgAAAABJRU5ErkJggg==";

async function getSettings() {
  const stored = await chrome.storage.local.get([
    "morningHour",
    "eveningHour",
    "quietStart",
    "quietEnd",
    "enabled",
    "snoozedUntil",
  ]);
  return { ...DEFAULTS, ...stored };
}

function inQuietHours(settings, date = new Date()) {
  const h = date.getHours();
  const { quietStart, quietEnd } = settings;
  if (quietStart === quietEnd) return false;
  if (quietStart > quietEnd) return h >= quietStart || h < quietEnd;
  return h >= quietStart && h < quietEnd;
}

function nextTrigger(hour) {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(0);
  d.setHours(hour);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

async function scheduleAlarms() {
  const settings = await getSettings();
  await chrome.alarms.clear(ALARM_MORNING);
  await chrome.alarms.clear(ALARM_EVENING);
  if (!settings.enabled) return;
  await chrome.alarms.create(ALARM_MORNING, {
    when: nextTrigger(settings.morningHour),
    periodInMinutes: 24 * 60,
  });
  await chrome.alarms.create(ALARM_EVENING, {
    when: nextTrigger(settings.eveningHour),
    periodInMinutes: 24 * 60,
  });
}

async function fetchNudge(timeoutMs = 2000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API}/api/nudge`, {
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error("nudge failed");
    return await res.json();
  } catch {
    return {
      title: "Cortex maintenance window",
      message:
        "Hey — your second brain is calling. Review a fading concept before it slips.",
      dueCount: 3,
      weakestTitle: "a fading concept",
      todayUrl: `${API}/today`,
    };
  } finally {
    clearTimeout(timer);
  }
}

function iconCandidates() {
  return [
    chrome.runtime.getURL("icons/icon128.png"),
    chrome.runtime.getURL("icons/icon48.png"),
    ICON_DATA_URL,
  ];
}

function createChromeNotification(nudge) {
  const icons = iconCandidates();
  let i = 0;

  function attempt() {
    return new Promise((resolve) => {
      const iconUrl = icons[i];
      chrome.notifications.create(
        {
          type: "basic",
          iconUrl,
          title: String(nudge.title || "Synapse").slice(0, 120),
          message: String(nudge.message || "Time to revisit.").slice(0, 250),
          priority: 2,
        },
        (id) => {
          const err = chrome.runtime.lastError;
          if (err) {
            i += 1;
            if (i < icons.length) {
              attempt().then(resolve);
              return;
            }
            resolve({ ok: false, reason: err.message || "create-failed" });
            return;
          }
          resolve({ ok: true, id, channel: "chrome.notifications" });
        }
      );
    });
  }

  return attempt();
}

async function setBadge(dueCount) {
  const text = dueCount > 0 ? String(Math.min(dueCount, 99)) : "!";
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color: "#e4572e" });
}

async function fireNudge(force = false) {
  const settings = await getSettings();
  if (!force) {
    if (!settings.enabled) return { ok: false, reason: "disabled" };
    if (settings.snoozedUntil && Date.now() < settings.snoozedUntil) {
      return { ok: false, reason: "snoozed" };
    }
    if (inQuietHours(settings)) {
      return { ok: false, reason: "quiet" };
    }
  }

  const nudge = await fetchNudge();
  if (!force && nudge.dueCount === 0) {
    return { ok: false, reason: "nothing-due" };
  }

  // Always use witty cortex-maintenance framing even if API is down
  const title = "Cortex maintenance window";
  const message =
    nudge.message && /review|revisit|reinforce|path/i.test(nudge.message)
      ? nudge.message
      : `Hey — ${(nudge.weakestTitle || "a fading concept")} needs you. Review now before it slips.`;

  const payload = { ...nudge, title, message };

  await setBadge(nudge.dueCount || 1);
  const notifResult = await createChromeNotification(payload);

  return {
    ok: Boolean(notifResult?.ok),
    nudge: payload,
    notification: notifResult,
  };
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleAlarms();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleAlarms();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (
    alarm.name === ALARM_MORNING ||
    alarm.name === ALARM_EVENING ||
    alarm.name === ALARM_SNOOZE
  ) {
    if (alarm.name === ALARM_SNOOZE) {
      await chrome.storage.local.remove("snoozedUntil");
    }
    await fireNudge(false);
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "SIMULATE_DAILY_PING" || msg?.type === "PING_NOW") {
        sendResponse(await fireNudge(true));
        return;
      }
      if (msg?.type === "SAVE_SCHEDULE") {
        await chrome.storage.local.set(msg.settings || {});
        await scheduleAlarms();
        sendResponse({ ok: true });
        return;
      }
      if (msg?.type === "GET_SCHEDULE") {
        sendResponse(await getSettings());
        return;
      }
      if (msg?.type === "SNOOZE") {
        const minutes = Number(msg.minutes) || 60;
        const until = Date.now() + minutes * 60 * 1000;
        await chrome.storage.local.set({ snoozedUntil: until });
        await chrome.alarms.clear(ALARM_SNOOZE);
        await chrome.alarms.create(ALARM_SNOOZE, { when: until });
        sendResponse({ ok: true, until });
        return;
      }
      if (msg?.type === "PERMISSION_LEVEL") {
        chrome.notifications.getPermissionLevel((level) => {
          sendResponse({ level });
        });
        return;
      }
      sendResponse({ ok: false, reason: "unknown-message" });
    } catch (e) {
      sendResponse({ ok: false, reason: String(e?.message || e) });
    }
  })();
  return true;
});

chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.notifications.clear(notificationId);
  chrome.tabs.create({ url: `${API}/today` });
});
