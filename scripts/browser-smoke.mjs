const endpoint = process.env.CDP_ENDPOINT || "http://localhost:9222";
const appUrl = process.env.APP_URL || "http://localhost:3000";
const targets = await fetch(`${endpoint}/json/list`).then((response) => response.json());
const target = targets.find((item) => item.type === "page");
if (!target) throw new Error("No Chrome page target found");

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const problems = [];
let id = 0;

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    return message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  }
  if (message.method === "Runtime.exceptionThrown") problems.push(`Exception: ${message.params.exceptionDetails.text}`);
  if (message.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(message.params.type)) {
    const text = message.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" ");
    problems.push(`Console ${message.params.type}: ${text}`);
  }
  if (message.method === "Network.responseReceived" && message.params.response.status >= 400) {
    problems.push(`HTTP ${message.params.response.status}: ${message.params.response.url}`);
  }
});

function send(method, params = {}) {
  const requestId = ++id;
  socket.send(JSON.stringify({ id: requestId, method, params }));
  return new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }));
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(expression, timeout = 4000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true });
    if (result.result.value) return true;
    await wait(150);
  }
  return false;
}
async function navigate(path) {
  await send("Page.navigate", { url: `${appUrl}${path}` });
  await wait(1200);
  const result = await send("Runtime.evaluate", { expression: "({url: location.pathname, text: document.body.innerText.slice(0, 120)})", returnByValue: true });
  if (result.result.value.url !== path) problems.push(`Navigation mismatch: ${path} -> ${result.result.value.url}`);
  console.log(`${path}: ${result.result.value.text.replaceAll("\n", " ")}`);
}

async function testProductionEditor() {
  const selection = await send("Runtime.evaluate", {
    expression: `(() => {
      const customer = document.querySelector('#production-customer');
      const customerValue = [...customer.options].find((option) => option.value)?.value;
      customer.value = customerValue;
      customer.dispatchEvent(new Event('change', { bubbles: true }));
      return customerValue;
    })()`,
    returnByValue: true,
  });
  if (!selection.result.value) throw new Error("Production customer selector has no active customers");
  await wait(300);

  await send("Runtime.evaluate", {
    expression: `(() => {
      const order = document.querySelector('#production-order');
      const orderValue = [...order.options].find((option) => option.value)?.value;
      order.value = orderValue;
      order.dispatchEvent(new Event('change', { bubbles: true }));
    })()`,
  });
  await wait(400);

  const statusValues = await send("Runtime.evaluate", {
    expression: `(() => {
      const status = document.querySelector('select[name="status"]');
      return { values: [...status.options].map((option) => option.value), original: status.value };
    })()`,
    returnByValue: true,
  });
  const expected = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETED"];
  if (JSON.stringify(statusValues.result.value.values) !== JSON.stringify(expected)) {
    throw new Error(`Invalid production status values: ${JSON.stringify(statusValues.result.value.values)}`);
  }

  await send("Runtime.evaluate", {
    expression: `(() => {
      const status = document.querySelector('select[name="status"]');
      status.value = 'IN_PROGRESS';
      status.dispatchEvent(new Event('change', { bubbles: true }));
      status.closest('form').requestSubmit();
    })()`,
  });
  await wait(1200);
  const result = await send("Runtime.evaluate", { expression: "document.body.innerText.includes('was updated.')", returnByValue: true });
  if (!result.result.value) throw new Error("Production stage save did not report success");
  await send("Runtime.evaluate", {
    expression: `(() => {
      const status = document.querySelector('select[name="status"]');
      status.value = '${statusValues.result.value.original}';
      status.dispatchEvent(new Event('change', { bubbles: true }));
      status.closest('form').requestSubmit();
    })()`,
  });
  await wait(900);
  console.log("Production selector and stage save passed.");
}

async function testShell() {
  await navigate("/settings");
  if (!await waitFor("document.body.innerText.toLowerCase().includes('coming in phase 2')")) throw new Error("Settings Phase 2 placeholder is missing");

  await send("Runtime.evaluate", {
    expression: `(() => {
      const button = document.querySelector('button[aria-haspopup="menu"]');
      button.click();
      return button.getAttribute('aria-expanded');
    })()`, returnByValue: true,
  });
  await wait(200);
  if (!await waitFor("Boolean(document.querySelector('[role=menu]'))")) throw new Error("Profile menu did not open");

  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate("/");
  const mobile = await send("Runtime.evaluate", {
    expression: `(() => {
      const open = document.querySelector('button[aria-label="Open navigation"]');
      if (!open) return false;
      open.click();
      return true;
    })()`, returnByValue: true,
  });
  if (!mobile.result.value) throw new Error("Mobile navigation button is missing");
  await wait(200);
  if (!await waitFor("document.querySelector('aside').className.includes('translate-x-0')")) throw new Error("Mobile sidebar did not open");
  await send("Emulation.clearDeviceMetricsOverride");
  console.log("App shell desktop and mobile interactions passed.");
}

await send("Runtime.enable");
await send("Page.enable");
await send("Network.enable");
await navigate("/login");
await send("Runtime.evaluate", {
  expression: `(() => {
    document.querySelector('input[name="email"]').value = 'owner@cbos.local';
    document.querySelector('input[name="password"]').value = 'Password@123';
    document.querySelector('form').requestSubmit();
  })()`,
});
await wait(1500);

for (const path of ["/", "/leads", "/customers", "/orders", "/production", "/audit-logs", "/inventory", "/purchases", "/pricing", "/reports", "/incentives", "/whatsapp", "/settings"]) {
  await navigate(path);
  if (path === "/production") await testProductionEditor();
}
await testShell();

socket.close();
const uniqueProblems = [...new Set(problems)].filter((problem) => !problem.includes("favicon.ico"));
if (uniqueProblems.length) {
  console.error(uniqueProblems.join("\n"));
  process.exit(1);
}
console.log("Browser smoke test passed with no console errors or failed requests.");
