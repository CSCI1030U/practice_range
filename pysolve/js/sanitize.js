/*
 * sanitize.js - validate and clean student nicknames.
 *
 * Two concerns:
 *   1. Security - never let a nickname carry markup/script. We restrict to a
 *      safe character set and a length cap; the UI also HTML-escapes on render
 *      (defence in depth), so a name can never inject HTML/JS into the page or
 *      the leaderboard.
 *   2. Decency - reject obvious profanity/slurs so the shared leaderboard stays
 *      classroom-appropriate. The check normalises common letter/symbol
 *      substitutions (leetspeak) before matching, so "a$$" etc. are caught.
 *
 * The blocklist below is intentionally compact - a reasonable first line of
 * defence, not an exhaustive filter. Add terms as needed for your cohort.
 */
(function () {
  const MIN_LEN = 2;
  const MAX_LEN = 20;

  // Allowed: letters, underscore, hyphen. Everything else is stripped. This
  // alone makes HTML/script injection impossible.
  const ALLOWED = /[^A-Za-z_-]/g;

  // Substring blocklist (matched against a normalised form). Kept terse on
  // purpose; these are checked as substrings so variants are covered.
  const BLOCKED = [
    "fuck", "shit", "bitch", "cunt", "asshole", "bastard", "dick", "piss",
    "slut", "whore", "nigg", "fag", "retard", "rape", "nazi", "kkk",
    "sex", "porn", "penis", "vagina", "boob", "cock", "pussy",
  ];

  // Map common leetspeak / look-alike symbols to letters so substitutions
  // (e.g. "sh1t", "f@g", "a$$") collapse to their plain form before matching.
  const LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s", "!": "i" };

  function normalizeForProfanity(s) {
    let out = "";
    for (const ch of s.toLowerCase()) {
      out += LEET[ch] !== undefined ? LEET[ch] : ch;
    }
    // Drop anything that isn't a letter, so spacing/punctuation can't hide a word.
    return out.replace(/[^a-z]/g, "");
  }

  function containsProfanity(s) {
    const flat = normalizeForProfanity(s);
    return BLOCKED.some((w) => flat.includes(w));
  }

  /**
   * Returns { ok: true, value } for an acceptable nickname,
   * or { ok: false, reason } explaining why it was rejected.
   */
  function sanitizeNickname(raw) {
    if (raw == null) return { ok: false, reason: "Please enter a nickname." };

    // Strip disallowed characters.
    let name = String(raw).replace(ALLOWED, "");

    if (name.length < MIN_LEN) {
      return { ok: false, reason: `Use at least ${MIN_LEN} characters (letters, _ and - only).` };
    }
    if (name.length > MAX_LEN) {
      name = name.slice(0, MAX_LEN).trim();
    }
    // Check decency against the RAW input as well as the cleaned name: leetspeak
    // symbols like @ and $ are stripped by ALLOWED above, so checking only the
    // cleaned name would let "f@g" / "a$$" through. The normaliser maps those
    // symbols to letters, so the raw form catches them.
    if (containsProfanity(raw) || containsProfanity(name)) {
      return { ok: false, reason: "That nickname isn't allowed. Please choose something classroom-friendly." };
    }
    return { ok: true, value: name };
  }

  // Clean a full name for display on a certificate. Optional, only shown on the
  // student's own downloaded certificate, and may contain the punctuation real
  // names use. Allow Unicode letters, spaces, hyphens, apostrophes, and periods;
  // strip everything else (so no HTML can sneak in); collapse whitespace; cap
  // length. No profanity filter, to avoid rejecting legitimate names. Returns the
  // cleaned string (which may be empty).
  const NAME_DISALLOWED = /[^\p{L}\p{M} .'’-]/gu;
  const NAME_MAX = 60;
  function sanitizeFullName(raw) {
    if (raw == null) return "";
    return String(raw)
      .replace(NAME_DISALLOWED, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, NAME_MAX)
      .trim();
  }

  window.Sanitize = { sanitizeNickname, sanitizeFullName, containsProfanity, MIN_LEN, MAX_LEN };
})();
