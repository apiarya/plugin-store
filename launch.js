const open = new URLSearchParams(location.search).get("open") ?? "";
const title = document.getElementById("launch-title");
const message = document.getElementById("launch-message");
const fallback = document.getElementById("launch-fallback");
let left = false;

document.getElementById("launch-close").addEventListener("click", () => window.close());

if (!open.startsWith("ghapp://")) {
  title.textContent = "Nothing to open";
  message.textContent = "This link is missing a GitHub Copilot app link.";
} else {
  fallback.href = `https://github.com/copilot/app/launch?open=${encodeURIComponent(open)}`;
  const leave = () => { left = true; };
  const comeBack = () => { if (left && document.visibilityState === "visible" && document.hasFocus()) window.close(); };
  window.addEventListener("blur", leave);
  document.addEventListener("visibilitychange", () => (document.hidden ? leave() : comeBack()));
  window.addEventListener("focus", comeBack);
  setTimeout(() => { fallback.hidden = false; }, 2500);
  location.href = open;
}
