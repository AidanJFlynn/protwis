// Text and markup helpers shared by the text-based data types and the filters. They hold no state, so they are plain
// functions rather than data type methods.

// How long the full text stays shown after its expand icon is clicked
const EXPAND_DURATION_MS = 5000;

/**
 * Normalises text for searching and filtering. NFKC folds compatibility characters onto their plain forms (e.g. "PIP₃"
 * to "PIP3", the micro sign to Greek mu), so typed text, chosen options and cell data compare equal. Must match the
 * server, which applies the same form to filter values and database columns (TextFilter and the `nfkc` lookup).
 * @param {*} text - The text to normalise.
 * @returns {string} The normalised text.
 */
function normalizeForSearch(text) {
    return String(text).normalize("NFKC");
}

/**
 * Escapes the characters that are special in HTML text, so plain text can be inserted as markup.
 * @param {string} text - The plain text.
 * @returns {string} The escaped text.
 */
function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Parses HTML into an inert fragment (nothing is loaded or run), with entities decoded into text.
 * @param {string} html - The HTML (or plain text).
 * @returns {DocumentFragment} The parsed content.
 */
function parseHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = String(html);
    return template.content;
}

/**
 * Converts markup to the text it displays: tags removed and entities decoded. Text without "<" or "&" is returned
 * as it is, as parsing every cell would be slow.
 * @param {string} html - The markup (or plain text).
 * @returns {string} The displayed text.
 */
function htmlToText(html) {
    return /[<&]/.test(html) ? parseHtml(html).textContent : html;
}

/**
 * Truncates markup to maxDisplayLength displayed characters with an ellipsis. Truncated text is returned as a span that
 * keeps both versions in its data-full and data-truncated attributes (the full text is also its title), followed by an
 * expand icon that shows the full text in the cell for a few seconds (see bindTruncationToggles).
 * The text may contain HTML tags and entities. The limit applies to the characters as displayed (entities count as
 * one character, tags as none), and the cut never falls inside a tag or entity. An element whose text would be cut
 * (e.g. a sub/superscript) is removed whole rather than shortened; plain text is cut as normal.
 * @param {string} html - The text, optionally containing HTML.
 * @param {number|undefined} maxDisplayLength - The maximum number of displayed characters to show, or a falsy value for no limit.
 * @param {boolean} [expandIcon=true] - Whether to add the expand icon after truncated text.
 * @returns {{truncated: boolean, content: string}} Whether the text was truncated, and the text or the span's markup.
 */
function truncateHtml(html, maxDisplayLength, expandIcon = true) {
    // The displayed length never exceeds the raw length, so short text can skip parsing
    if (!maxDisplayLength || html.length <= maxDisplayLength) {
        return { truncated: false, content: html };
    }

    const fragment = parseHtml(html);
    if (fragment.textContent.length <= maxDisplayLength) {
        return { truncated: false, content: html };
    }

    const fullContainer = document.createElement("div");
    fullContainer.append(fragment.cloneNode(true));
    const fullHtml = fullContainer.innerHTML;

    trimToDisplayLength(fragment, maxDisplayLength);
    const trimmedContainer = document.createElement("div");
    trimmedContainer.append(fragment);
    const truncatedHtml = trimmedContainer.innerHTML + "...";

    const span = document.createElement("span");
    span.classList.add("tm-truncated");
    span.setAttribute("title", fullContainer.textContent);
    span.setAttribute("data-full", fullHtml);
    span.setAttribute("data-truncated", truncatedHtml);

    const text = document.createElement("span");
    text.classList.add("tm-truncated-text");
    text.innerHTML = truncatedHtml;
    span.append(text, " ");

    if (expandIcon) {
        // A span rather than an anchor, as the icon can sit inside a web link
        const icon = document.createElement("span");
        icon.classList.add("tm-text-expand");
        icon.innerHTML = "<img width='12px' title='Show full text' height='12px' src='/static/home/images/plus_grey.png'>";
        span.append(icon);
    }
    return { truncated: true, content: span.outerHTML };
}

/**
 * Cuts a parsed fragment in place so no more than maxLength characters of text remain. Text nodes are cut at the
 * limit. An element that fits is kept whole, and one that would straddle the limit is removed whole. Everything
 * after the cut is removed. Assumes elements are short and contain only text (e.g. sub/superscripts), so only the
 * fragment's top-level nodes are examined.
 * @param {DocumentFragment} fragment - The parsed content to trim.
 * @param {number} maxLength - The maximum number of displayed characters to keep.
 */
function trimToDisplayLength(fragment, maxLength) {
    let remaining = maxLength;
    for (const node of Array.from(fragment.childNodes)) {
        const length = node.textContent.length;
        if (remaining <= 0) {
            node.remove();
        } else if (node.nodeType === Node.TEXT_NODE && length > remaining) {
            // Do not split a surrogate pair (multibyte character) in half,
            // which would show as a replacement character. The first half of a pair is in the range D800-DBFF.
            const end = /[\uD800-\uDBFF]/.test(node.data.charAt(remaining - 1)) ? remaining - 1 : remaining;
            node.data = node.data.slice(0, end);
            remaining = 0;
        } else if (node.nodeType !== Node.TEXT_NODE && node.nodeType !== Node.ELEMENT_NODE) {
            node.remove(); // Comments and the like
        } else if (length > remaining) {
            node.remove();
            remaining = 0;
        } else {
            remaining -= length;
        }
    }
}

/**
 * Makes the expand icons of the truncated text under an element show the full text. The full text is shown in
 * place of the truncated text for EXPAND_DURATION_MS, then the truncated text returns. Clicking the icon does not
 * follow a surrounding link or reach row click handlers.
 * @param {HTMLElement} root - The element containing the truncated text spans.
 */
function bindTruncationToggles(root) {
    for (const truncated of root.querySelectorAll(".tm-truncated")) {
        const icon = truncated.querySelector(".tm-text-expand");
        if (!icon) {
            continue;
        }
        const text = truncated.querySelector(".tm-truncated-text");
        let timer = null;

        // Stops a surrounding link taking focus (and its focus outline) when the icon is pressed
        icon.addEventListener("mousedown", (e) => e.preventDefault());

        icon.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            text.innerHTML = truncated.dataset.full;
            truncated.classList.add("tm-expanded");
            text.classList.add("tm-truncated-text-expanded");
            clearTimeout(timer);
            timer = setTimeout(() => {
                text.innerHTML = truncated.dataset.truncated;
                truncated.classList.remove("tm-expanded");
                text.classList.remove("tm-truncated-text-expanded");
            }, EXPAND_DURATION_MS);
        });
    }
}

/**
 * Rebuilds HTML from plain text and the format ranges made by the server's HTMLRemover.HTMLtoFormatTags. Ranges
 * are 0-indexed with an exclusive end and all refer to the plain text, so no offsets need adjusting as tags are
 * added. The text is cut at every range boundary and walked left to right. Tags are kept open across segments
 * where they continue, so nested and overlapping ranges come out as correctly nested HTML.
 * @param {string|null|undefined} value - The plain text.
 * @param {string|Array<{start: number, end: number, type: string}>|null|undefined} format - The ranges, as a JSON
 * string or an array. Unknown types and ranges that are empty or fall outside the text are ignored.
 * @returns {string} The text as HTML, with its special characters escaped.
 */
function applyFormatTags(value, format) {
    const text = value === null || value === undefined ? "" : String(value);
    const tagNames = { italics: "i", bold: "b", superscript: "sup", subscript: "sub" };

    let parsed = format;
    if (typeof format === "string") {
        try {
            parsed = JSON.parse(format);
        } catch (e) {
            parsed = [];
        }
    }
    // Outer ranges first: start ascending, then end descending
    const ranges = (Array.isArray(parsed) ? parsed : [])
        .filter((r) => r && tagNames[r.type] && r.start >= 0 && r.end <= text.length && r.end > r.start)
        .sort((a, b) => a.start - b.start || b.end - a.end);
    if (ranges.length === 0) {
        return escapeHtml(text);
    }

    const bounds = [...new Set([0, text.length, ...ranges.flatMap((r) => [r.start, r.end])])].sort((a, b) => a - b);

    let html = "";
    let open = []; // ranges whose tags are currently open, outermost first
    for (let i = 0; i < bounds.length - 1; i++) {
        const from = bounds[i];
        const to = bounds[i + 1];
        const active = ranges.filter((r) => r.start <= from && r.end >= to);

        // Keep the tags that stay open, close the rest (innermost first) and open the new ones
        let keep = 0;
        while (keep < open.length && keep < active.length && open[keep] === active[keep]) {
            keep++;
        }
        for (let j = open.length - 1; j >= keep; j--) {
            html += "</" + tagNames[open[j].type] + ">";
        }
        for (let j = keep; j < active.length; j++) {
            html += "<" + tagNames[active[j].type] + ">";
        }
        open = active;
        html += escapeHtml(text.slice(from, to));
    }
    for (let j = open.length - 1; j >= 0; j--) {
        html += "</" + tagNames[open[j].type] + ">";
    }
    return html;
}

export { normalizeForSearch, escapeHtml, htmlToText, truncateHtml, bindTruncationToggles, applyFormatTags };
