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
  // Digital Stallions Forum gold; host pages may override with data-color.
  var color = (script && script.getAttribute("data-color")) || "#D9B150";
  var label = (script && script.getAttribute("data-label")) || "Chat with us";

  var style = document.createElement("style");
  style.textContent =
    ".stallion-launcher{position:fixed;right:20px;bottom:20px;z-index:2147483000;display:inline-flex;align-items:center;gap:8px;padding:12px 18px;border:0;border-radius:999px;background:" +
    color +
    ";color:#111;font:600 14px/1 Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.28);cursor:pointer;transition:filter .16s ease,box-shadow .16s ease}" +
    ".stallion-launcher:hover{filter:brightness(1.06);box-shadow:0 6px 18px rgba(0,0,0,.34)}" +
    ".stallion-launcher:active{filter:brightness(.98)}" +
    ".stallion-launcher svg{width:18px;height:18px;flex:0 0 auto}" +
    ".stallion-frame{position:fixed;right:20px;bottom:88px;z-index:2147483000;width:384px;height:600px;max-height:calc(100vh - 112px);border:1px solid #e2e8f0;border-radius:16px;background:#fff;box-shadow:0 24px 60px rgba(15,23,42,.28);overflow:hidden;opacity:0;transform:translateY(12px) scale(.98);transform-origin:bottom right;pointer-events:none;transition:opacity .18s ease,transform .18s ease}" +
    ".stallion-frame.is-open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}" +
    "@media (max-width:480px){.stallion-frame{right:0;bottom:0;width:100vw;height:100vh;max-height:none;border-radius:0}}";
  document.head.appendChild(style);

  var CHAT_ICON =
    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7A2.5 2.5 0 0 1 17.5 15H9l-4 4v-4H6.5" ' +
    'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var frame = document.createElement("iframe");
  frame.className = "stallion-frame";
  frame.title = "Stallion AI Assistant";
  frame.setAttribute("allow", "clipboard-write");
  // Load lazily on first open so the host page pays nothing until then.
  var loaded = false;

  function renderButton(open) {
    button.innerHTML = open
      ? "<span>Close</span>"
      : CHAT_ICON + "<span>" + label + "</span>";
  }

  var button = document.createElement("button");
  button.type = "button";
  button.className = "stallion-launcher";
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", "false");
  renderButton(false);

  function setOpen(open) {
    if (open && !loaded) {
      frame.src = host + "/widget";
      loaded = true;
    }
    frame.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", open ? "true" : "false");
    renderButton(open);
  }

  button.addEventListener("click", function () {
    setOpen(!frame.classList.contains("is-open"));
  });

  document.body.appendChild(frame);
  document.body.appendChild(button);

  // Minimal public API so host pages (e.g. a hero CTA) can open the widget.
  window.StallionWidget = {
    open: function () {
      setOpen(true);
    },
    close: function () {
      setOpen(false);
    },
    toggle: function () {
      setOpen(!frame.classList.contains("is-open"));
    },
  };
})();
