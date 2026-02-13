(async () => {
  // --- config ---
  const REACT_VERSION = "18.3.1"; // used only if the page doesn't already have React
  const MOUNT_ID_PREFIX = "injected-react-mount";
  // ---------------

  const ensureScript = (src) =>
    new Promise((resolve, reject) => {
      // If a matching script is already present, resolve immediately
      if ([...document.scripts].some(s => s.src && s.src.includes(src))) return resolve();
      const el = document.createElement("script");
      el.src = src;
      el.async = false; // preserve order
      el.crossOrigin = "anonymous";
      el.onload = () => resolve();
      el.onerror = (e) => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(el);
    });

  // Use existing React/ReactDOM if available; otherwise load UMD builds.
  async function ensureReactAvailable() {
    if (window.React && window.ReactDOM) return;
    const base = `https://unpkg.com/react@${REACT_VERSION}/umd`;
    const domBase = `https://unpkg.com/react-dom@${REACT_VERSION}/umd`;
    // Load React first, then ReactDOM
    await ensureScript(`${base}/react.production.min.js`);
    await ensureScript(`${domBase}/react-dom.production.min.js`);
  }

  function makeMount() {
    // Create a unique id so multiple runs won't clash
    let i = 1, id;
    do { id = `${MOUNT_ID_PREFIX}-${i++}`; } while (document.getElementById(id));
    const mount = document.createElement("div");
    mount.id = id;
    // You can attach to body or a specific container if you prefer
    document.body.appendChild(mount);
    return mount;
  }

  try {
    await ensureReactAvailable();

    const mount = makeMount();

    // Prefer React 18 concurrent root when available; fallback to legacy render
    if (window.ReactDOM.createRoot) {
      const root = window.ReactDOM.createRoot(mount);
      root.render(window.React.createElement("div", null, "Hello world"));
    } else if (window.ReactDOM.render) {
      window.ReactDOM.render(window.React.createElement("div", null, "Hello world"), mount);
    } else {
      throw new Error("ReactDOM not available.");
    }

    // Optional: expose mount id in console
    console.log(`React injected. Mounted at #${mount.id}`);
  } catch (err) {
    console.error(err);
    alert(`React injection failed: ${err.message}`);
  }
})();
