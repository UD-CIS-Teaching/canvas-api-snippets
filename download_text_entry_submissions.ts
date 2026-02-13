(async function () {
  // --- helpers ---
  // https://stackoverflow.com/questions/8735792/how-to-parse-link-header-from-github-api
  const linkParser = (linkHeader) => {
    if (!linkHeader) return null;
    let re = /,[\s]*<(.*?)>;[\s]*rel="next"/g;
    let result = re.exec(linkHeader);
    return result ? result[1] : null;
  };

  function downloadBlob(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", filename);
    a.click();
    URL.revokeObjectURL(url);
  }

  // Get all paginated results from an endpoint (Canvas-style Link headers)
  async function getAll(fullUrl) {
    let all = [];
    let next = fullUrl;
    do {
      const resp = await fetch(next, { credentials: "include" });
      if (!resp.ok) {
        throw new Error(`Fetch failed: ${resp.status} ${resp.statusText} for ${next}`);
      }
      all.push(...(await resp.json()));
      next = linkParser(resp.headers.get("link"));
    } while (next != null);
    return all;
  }

  // --- Canvas context ---
  const course = ENV.context_asset_string;
  const courseId = course.split("_")[1];
  const base = ENV.DEEP_LINKING_POST_MESSAGE_ORIGIN;
  const api = `${base}/api/v1`;
  const courseUrl = `${api}/courses/${courseId}`;
  const assignmentId = ENV.ASSIGNMENT_ID || prompt("What assignment ID should I use?");

  // --- fetch submissions (LATEST ONLY: do NOT include submission_history) ---
  // We include user so we can label sections; adjust includes if you want less metadata.
  const submissions = await getAll(
    `${courseUrl}/assignments/${assignmentId}/submissions?include[]=user&per_page=100`
  );

  // --- extract "text entry" content ---
  // Canvas typically puts the latest text entry body on `submission.body` when `submission_type` is "online_text_entry".
  // Some installs may expose it via `submission.submission_type` + `submission.body`. We'll be defensive.
  const textSubs = submissions
    .filter((s) => (s.submission_type || "").toLowerCase() === "online_text_entry")
    .map((s) => {
      const user = s.user || {};
      const name = user.sortable_name || user.name || `User ${s.user_id}`;
      const login = user.login_id || user.sis_user_id || "";
      const email = user.email || "";
      const submittedAt = s.submitted_at || "";

      // "Just the user's entered text" -> use body only, strip nothing else.
      // If body is null/undefined, fallback to empty string.
      const body = (s.body ?? "").toString();

      return { name, login, email, submittedAt, body };
    });

  // --- build markdown ---
  // Output is ONLY the entered text, concatenated. To keep it usable, we separate entries with a standard divider
  // and minimal metadata as a header comment line. If you truly want *only* the raw text with no separators,
  // remove the header+divider lines below.
  const assignmentName =
    submissions?.[0]?.assignment?.name ||
    `assignment_${assignmentId}`;

  const mdParts = [];
  for (const t of textSubs) {
    mdParts.push(`<!-- ${t.name}${t.login ? ` | ${t.login}` : ""}${t.email ? ` | ${t.email}` : ""}${t.submittedAt ? ` | submitted_at: ${t.submittedAt}` : ""} -->`);
    mdParts.push(t.body);
    mdParts.push("\n---\n");
  }

  // If no text entries, still produce a file.
  const md = mdParts.length
    ? mdParts.join("\n")
    : `<!-- No online_text_entry submissions found for assignment ${assignmentId}. -->\n`;

  // --- download ---
  const safeName = assignmentName.replace(/[\/\\?%*:|"<>]/g, "_");
  const filename = `${safeName}_TextEntries.md`;
  downloadBlob(md, filename, "text/markdown;charset=utf-8;");

  console.log(`Downloaded ${textSubs.length} text entry submissions to ${filename}`);
})();
