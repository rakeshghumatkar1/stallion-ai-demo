/*
 * Stallion AI Assistant — embed script.
 *
 * Award sites include:  <script src="https://<assistant-host>/embed.js" async></script>
 * Optional attributes:  data-color="#4f46e5"  data-label="Chat with us"
 *
 * It injects a launcher bubble and an <iframe> pointing at <host>/widget. The
 * host is read from this script's own src, so the same file works for every
 * deployment. The event is pinned server-side; nothing here selects it.
 */
(function () {
  if (window.__stallionWidgetLoaded) return;
  window.__stallionWidgetLoaded = true;

  var script =
    document.currentScript ||
    (function () {
      var all = document.getElementsByTagName("script");
      return all[all.length - 1];
    })();

  var host;
  try {
    host = new URL(script.src, window.location.href).origin;
  } catch (e) {
    host = window.location.origin;
  }
  var color = (script && script.getAttribute("data-color")) || "#4f46e5";
  var label = (script && script.getAttribute("data-label")) || "Chat with us";

  var style = document.createElement("style");
  style.textContent =
    ".stallion-launcher{position:fixed;right:20px;bottom:20px;z-index:2147483000;display:flex;align-items:center;gap:8px;padding:12px 16px;border:0;border-radius:999px;background:" +
    color +
    ";color:#fff;font:600 14px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 8px 24px rgba(15,23,42,.25);cursor:pointer}" +
    ".stallion-launcher:hover{filter:brightness(1.05)}" +
    ".stallion-frame{position:fixed;right:20px;bottom:84px;z-index:2147483000;width:380px;height:600px;max-height:calc(100vh - 104px);border:1px solid #e2e8f0;border-radius:12px;background:#fff;box-shadow:0 16px 48px rgba(15,23,42,.25);display:none}" +
    ".stallion-frame.is-open{display:block}" +
    "@media (max-width:480px){.stallion-frame{right:0;bottom:0;width:100vw;height:100vh;max-height:none;border-radius:0}}";
  document.head.appendChild(style);

  var frame = document.createElement("iframe");
  frame.className = "stallion-frame";
  frame.title = "Stallion AI Assistant";
  frame.setAttribute("allow", "clipboard-write");
  // Load lazily on first open so the host page pays nothing until then.
  var loaded = false;

  var button = document.createElement("button");
  button.type = "button";
  button.className = "stallion-launcher";
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", "false");
  button.textContent = label;

  function setOpen(open) {
    if (open && !loaded) {
      frame.src = host + "/widget";
      loaded = true;
    }
    frame.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", open ? "true" : "false");
    button.textContent = open ? "Close" : label;
  }

  button.addEventListener("click", function () {
    setOpen(!frame.classList.contains("is-open"));
  });

  document.body.appendChild(frame);
  document.body.appendChild(button);
})();
