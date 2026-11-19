// This class represents the "text" data type used in the table manager.
// It provides simple text filtering capabilities, allowing users to filter table data based on text input.

import { DataTypeBase } from "./datatypebase.js";

// Symbol popups close when the user clicks anywhere else. One document listener serves every popup, and popups
// that have been removed from the page (e.g. a destroyed table) are dropped from the set as they are found.
const symbolPopups = new Set();
let outsideClickListenerAdded = false;

/**
 * Registers a popup to be closed by the next click anywhere on the document. The document listener is added once, on
 * first use. Used by the symbol popups and the WebLinkTextList popup.
 * @param {HTMLElement} popup - The popup element.
 */
function registerPopupForOutsideClick(popup) {
    if (!outsideClickListenerAdded) {
        outsideClickListenerAdded = true;
        document.addEventListener("click", () => {
            for (const p of symbolPopups) {
                if (!p.isConnected) {
                    symbolPopups.delete(p);
                } else {
                    p.classList.remove("tm-open");
                }
            }
        }, true);
    }
    symbolPopups.add(popup);
}

// The list "more" popup is attached to the document body rather than the cell, so the scroll body of a scrollX table does
// not clip it. One popup is shared by every list cell (weblinktextlist and textlist), as only one can be open at a time.
// It closes on the next click anywhere (via the shared outside-click listener) or when anything scrolls.
let listPopup = null;

/**
 * Returns the shared list popup, creating it and its close listeners on first use.
 * @returns {HTMLDivElement} The popup element.
 */
function getListPopup() {
    if (listPopup === null) {
        listPopup = document.createElement("div");
        listPopup.classList.add("tm-link-list-popup");
        document.body.appendChild(listPopup);
        registerPopupForOutsideClick(listPopup);
        window.addEventListener("scroll", (e) => {
            // Scrolling a long list inside the popup itself keeps it open
            if (!listPopup.contains(e.target)) {
                listPopup.classList.remove("tm-open");
            }
        }, true);
    }
    return listPopup;
}

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
 * Data type for text columns. Displays text, truncated to max_display_length when set, and filters by typed text.
 * Also the base class for the other text-based data types.
 * @extends DataTypeBase
 */
class Text extends DataTypeBase {

    /**
     * Renders text for display. Null values show the nullValuePlaceholder. Text longer than max_display_length is
     * truncated with an ellipsis, followed by an icon that shows the full text for a few seconds (the full text is also kept in
     * the title attribute). Other types return the normalised plain text (see _searchText), so searching and ordering
     * treat e.g. "PIP₃" and "PIP3" the same. Numbers and booleans are returned as they are, keeping their type.
     * @param {string|{content: string, formatting?: Array}|null|undefined} data - The cell text, or a formatted value.
     * @param {string} type - The DataTables render type: "display", "filter", "sort" or "type".
     * @param {*} row - The full row data (unused).
     * @param {Object} meta - The DataTables cell metadata (unused).
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {*} The rendered value for the render type.
     */
    dataTableRenderer(data, type, row, meta, tableManagerReference) {
        const isText = typeof data === "string" || (data !== null && typeof data === "object");
        if (type === "display") {
            if (data === null || data === undefined) {
                return tableManagerReference.nullValuePlaceholder;
            }
            return isText ? this._truncateText(this._displayHtml(data), this.column.max_display_length).content : data;
        }
        return isText ? this._searchText(data) : data; // Search, order and type return
    }

    /**
     * Truncates text to maxDisplayLength with an ellipsis. Truncated text is returned as a span that keeps both versions
     * in its data-full and data-truncated attributes (the full text is also its title), followed by an expand icon that
     * shows the full text in the cell for a few seconds (see _bindTruncationToggles).
     * The text may contain HTML tags and entities. The limit applies to the characters as displayed (entities count as
     * one character, tags as none), and the cut never falls inside a tag or entity. An element whose text would be cut
     * (e.g. a sub/superscript) is removed whole rather than shortened; plain text is cut as normal.
     * @param {string} data - The text, optionally containing HTML.
     * @param {number|undefined} maxDisplayLength - The maximum number of displayed characters to show, or a falsy value for no limit.
     * @returns {{truncated: boolean, content: string}} Whether the text was truncated, and the text or the span's markup.
     */
    _truncateText(data, maxDisplayLength) {
        // The displayed length never exceeds the raw length, so short text can skip parsing
        if (!maxDisplayLength || data.length <= maxDisplayLength) {
            return { truncated: false, content: data };
        }

        const fragment = this._parseHtml(data);
        if (fragment.textContent.length > maxDisplayLength) {
            const fullContainer = document.createElement("div");
            fullContainer.append(fragment.cloneNode(true));
            const fullHtml = fullContainer.innerHTML;

            this._trimToDisplayLength(fragment, maxDisplayLength);
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

            // A span rather than an anchor, as the icon can sit inside a web link
            const expandIcon = document.createElement("span");
            expandIcon.classList.add("tm-text-expand");
            expandIcon.innerHTML = "<img width='12px' title='Show full text' height='12px' src='/static/home/images/plus_grey.png'>";

            span.append(text, " ", expandIcon);
            return { truncated: true, content: span.outerHTML };
        }
        return { truncated: false, content: data };
    }

    /**
     * Parses HTML into an inert fragment (nothing is loaded or run), with entities decoded into text.
     * @param {string} html - The HTML (or plain text).
     * @returns {DocumentFragment} The parsed content.
     */
    _parseHtml(html) {
        const template = document.createElement("template");
        template.innerHTML = String(html);
        return template.content;
    }

    /**
     * Cuts a parsed fragment in place so no more than maxLength characters of text remain. Text nodes are cut at the
     * limit. An element that fits is kept whole, and one that would straddle the limit is removed whole. Everything
     * after the cut is removed. Assumes elements are short and contain only text (e.g. sub/superscripts), so only the
     * fragment's top-level nodes are examined.
     * @param {DocumentFragment} fragment - The parsed content to trim.
     * @param {number} maxLength - The maximum number of displayed characters to keep.
     */
    _trimToDisplayLength(fragment, maxLength) {
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
    _bindTruncationToggles(root) {
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
     * Exports the full text of a truncated cell, rather than the truncated display text.
     * @param {*} cellData - The cell data.
     * @param {*} rowData - The full row data.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {string|undefined} The full plain text if the cell is truncated, otherwise undefined (export the displayed content).
     */
    exportValue(cellData, rowData, tableManagerReference) {
        if (!cellData) {
            // Return empty string for null/undefined, so the export has a
            // blank cell rather than tableManagerReference.nullValuePlaceholder
            // (usually "-") which is only for display.
            return "";
        }
        return this._isTruncated(cellData) ? this._plainText(cellData) : undefined;
    }

    /**
     * Checks whether a cell's text is longer than the column's max_display_length, so it is displayed truncated. The
     * plain text is what is displayed, as tags take no space and entities show as one character.
     * @param {*} data - The cell data.
     * @returns {boolean} True if the text is displayed truncated.
     */
    _isTruncated(data) {
        const maxDisplayLength = this.column.max_display_length;
        if (!maxDisplayLength || data === null || data === undefined) {
            return false;
        }
        return this._plainText(data).length > maxDisplayLength;
    }

    /**
     * Hooks up the expand icons of truncated text in the cell.
     * @param {HTMLElement} cell - The rendered table cell.
     * @param {*} cellData - The cell data.
     * @param {*} rowData - The full row data.
     * @param {number} rowIndex - The index of the row.
     * @param {number} colIndex - The index of the column.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     */
    eventHookup(cell, cellData, rowData, rowIndex, colIndex, tableManagerReference) {
        this._bindTruncationToggles(cell);
    }

    /**
     * Creates a text input that applies the filter when it loses focus or Enter is pressed. If show_symbol_popup is set,
     * a button is added beside the input that opens a popup of Greek symbols to insert into it.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {HTMLDivElement|false} The filter wrapper, or false if the column does not allow filtering.
     */
    createFilterInterface(tableManagerReference) {
        const column = this.column;
        if (!column.allow_filter) {
            return false;
        }

        let filterInput = document.createElement("input");
        filterInput.setAttribute("data-field", column.json_id);
        // Prefix id with table id to avoid collisions when multiple tables have the same column on one page
        filterInput.setAttribute("id", tableManagerReference.tableId + "_" + column.json_id + "_search");

        filterInput.classList.add("col-filter");
        filterInput.classList.add("text-filter");

        if (column.cssClassFilterInput) {
            filterInput.classList.add(column.cssClassFilterInput);
        }

        filterInput.addEventListener("blur", (e) => this.blurHandler(e, tableManagerReference));
        filterInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                this.blurHandler(e, tableManagerReference);
            }
        });

        const wrapper = document.createElement("div");
        wrapper.classList.add("tm-text-filter-wrapper");
        wrapper.appendChild(filterInput);

        this.addSymbolPopupIfEnabled(wrapper, () => filterInput);

        return wrapper;
    }

    /**
     * Adds the symbol button and popup to a filter wrapper if the column has show_symbol_popup set. Shared by every
     * text-based data type, so each only needs to say where the chosen symbol should be inserted.
     * @param {HTMLElement} wrapper - The filter wrapper to append the button and popup to.
     * @param {function(): (HTMLInputElement|null)} getTextInput - Returns the text input to insert symbols into. Called on
     * each click, so the input may be created later (e.g. the select2 search field).
     * @returns {boolean} True if the button and popup were added.
     */
    addSymbolPopupIfEnabled(wrapper, getTextInput) {
        if (!this.column.show_symbol_popup) {
            return false;
        }
        const { symbolBtn, popup } = this.createSymbolPopup(getTextInput);
        wrapper.appendChild(symbolBtn);
        wrapper.appendChild(popup);
        return true;
    }

    /**
     * Creates the Greek symbol button and its popup. Clicking a symbol appends it to the text input.
     * @param {function(): (HTMLInputElement|null)} getTextInput - Returns the text input to insert symbols into.
     * @returns {{symbolBtn: HTMLButtonElement, popup: HTMLDivElement}} The toggle button and the popup.
     */
    createSymbolPopup(getTextInput) {
        const greekSymbols = [
            { label: "α", name: "alpha" },
            { label: "β", name: "beta" },
            { label: "δ", name: "delta" },
            { label: "κ", name: "kappa" },
            { label: "μ", name: "mu" },
        ];

        const popup = document.createElement("div");
        popup.classList.add("tm-symbol-popup");

        greekSymbols.forEach(({ label, name }) => {
            const cell = document.createElement("button");
            cell.type = "button";
            cell.title = name;
            cell.textContent = label;
            cell.classList.add("tm-symbol-popup-item");
            cell.addEventListener("mousedown", (e) => {
                e.preventDefault();
                // Focusing the select2 search field below opens its dropdown. If this mousedown then bubbled to the
                // document, select2's outside-click handler would close the dropdown again and clear the typed symbol.
                e.stopPropagation();
                const input = getTextInput();
                if (!input) {
                    return;
                }
                input.value += label;
                // Lets listeners such as select2's search box react to the inserted symbol
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.focus();
            });
            popup.appendChild(cell);
        });

        const symbolBtn = document.createElement("button");
        symbolBtn.type = "button";
        symbolBtn.textContent = "Ω";
        symbolBtn.classList.add("tm-symbol-button");

        symbolBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            popup.classList.toggle("tm-open");
        });

        registerPopupForOutsideClick(popup);

        return { symbolBtn, popup };
    }
        
    //------------------------------------------------------------------------------//
    //  Cell value helpers. Subclasses with other data shapes (e.g. links) override  //
    //  _plainText; everything that needs text, search text or markup goes through  //
    //  these rather than reading the data directly.                                //
    //------------------------------------------------------------------------------//

    /**
     * The text of a cell value as the user reads it: a formatted value's content, or a string with any markup removed
     * and entities decoded (e.g. "&alpha;" to "α"). Used for exports, option labels and truncation lengths.
     * @param {*} v - The cell value: a string, a {content, formatting} object, or another primitive.
     * @returns {string} The plain text, or an empty string if the value is null or undefined.
     */
    _plainText(v) {
        if (v === null || v === undefined) {
            return "";
        }
        if (typeof v === "object") {
            // Formatted values hold plain text, with the formatting kept separately
            return v.content === null || v.content === undefined ? "" : String(v.content);
        }
        return this._htmlToText(String(v));
    }

    /**
     * The normalised plain text of a cell value, used wherever values are searched or compared (see normalizeForSearch).
     * @param {*} v - The cell value.
     * @returns {string} The normalised plain text.
     */
    _searchText(v) {
        return normalizeForSearch(this._plainText(v));
    }

    /**
     * The markup to display for a cell value, before truncation. Formatted values get their format tags with the text
     * escaped. Strings are server-built and may hold markup, so they are used as given.
     * @param {string|{content: string, formatting?: Array}} v - The cell value.
     * @returns {string} The markup.
     */
    _displayHtml(v) {
        if (v !== null && typeof v === "object") {
            return this.applyFormatTags(v.content, v.formatting);
        }
        return String(v);
    }

    /**
     * Converts markup to the text it displays: tags removed and entities decoded. Text without "<" or "&" is returned
     * as it is, as parsing every cell would be slow.
     * @param {string} html - The markup (or plain text).
     * @returns {string} The displayed text.
     */
    _htmlToText(html) {
        return /[<&]/.test(html) ? this._parseHtml(html).textContent : html;
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
    applyFormatTags(value, format) {
        const text = value === null || value === undefined ? "" : String(value);
        const tagNames = { italics: "i", bold: "b", superscript: "sup", subscript: "sub" };
        const escape = escapeHtml;

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
            return escape(text);
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
            html += escape(text.slice(from, to));
        }
        for (let j = open.length - 1; j >= 0; j--) {
            html += "</" + tagNames[open[j].type] + ">";
        }
        return html;
    }

    /**
     * Applies the typed text as a column filter. If the text matches one of the column's options exactly, it filters on
     * that value. Otherwise it filters with a contains match. Empty text clears the filter. Does nothing while filters
     * are being cleared.
     * @async
     * @param {Event} e - The blur or Enter event. Its target is the filter input.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {Promise<void>}
     */
    async blurHandler(e, tableManagerReference) {
        const column = this.column;

        // If we are in the process of clearing filters, we don't want to trigger a redraw as it will be done after all filters have been cleared.
        if (tableManagerReference.state.clearingFilters) {
            return
        }

        const dataSource = tableManagerReference.dataSource;
        const newSearchValue = normalizeForSearch(e.target.value.trim());

        // An empty input gives no terms, which clears the filter
        const terms = [];
        if (newSearchValue !== "") {
            // Get the column's unique values as normalised plain text, comparable with the normalised search value.
            // Client-side these are the raw cell data (strings, {content, formatting} objects or links), server-side
            // the raw database values.
            const dataOptions = await dataSource.getOptions(column);
            const plainOptions = new Set(dataOptions.map((item) => this._searchText(item)));

            //if the search value is not in the list of unique values, use a "contains" search to allow for partial matches
            terms.push({ value: newSearchValue, contains: !plainOptions.has(newSearchValue) });
        }

        // Redraws only if the filter has changed
        dataSource.applyColumnFilter(column, { type: "text", terms: terms });
    }
}

export { Text, registerPopupForOutsideClick, getListPopup, EXPAND_DURATION_MS, normalizeForSearch, escapeHtml };