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

// How long the full text stays shown after its expand icon is clicked
const EXPAND_DURATION_MS = 5000;

/**
 * Data type for text columns. Displays text, truncated to max_display_length when set, and filters by typed text.
 * Also the base class for the other text-based data types.
 * @extends DataTypeBase
 */
class Text extends DataTypeBase {

    /**
     * Renders text for display. Null values show the nullValuePlaceholder. Text longer than max_display_length is
     * truncated with an ellipsis, followed by an icon that shows the full text for a few seconds (the full text is also kept in
     * the title attribute). Other types return the raw data.
     * @param {string|null|undefined} data - The cell text.
     * @param {string} type - The DataTables render type: "display", "filter", "sort" or "type".
     * @param {*} row - The full row data (unused).
     * @param {Object} meta - The DataTables cell metadata (unused).
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {string|null|undefined} The rendered value for the render type.
     */
    dataTableRenderer(data, type, row, meta, tableManagerReference) {
        if (type === "display" && (data === null || data === undefined)) {
            return tableManagerReference.nullValuePlaceholder;
        }
        if (type === "display" && data) {
            const truncated_data = this._truncateText(data, this.column.max_display_length);
            return truncated_data.data;
        }
        return data; // Search, order and type return
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
     * @returns {{truncated: boolean, data: string}} Whether the text was truncated, and the text or the span's markup.
     */
    _truncateText(data, maxDisplayLength) {
        // The displayed length never exceeds the raw length, so short text can skip parsing
        if (!maxDisplayLength || data.length <= maxDisplayLength) {
            return { truncated: false, data: data };
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
            return { truncated: true, data: span.outerHTML };
        }
        return { truncated: false, data: data };
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
     * @param {string|null|undefined} cellData - The cell text.
     * @param {*} rowData - The full row data.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {string|undefined} The full text if the cell is truncated, otherwise undefined (export the displayed content).
     */
    exportValue(cellData, rowData, tableManagerReference) {
        if (!cellData) {
            // Return empty string for null/undefined, so the export has a 
            // blank cell rather than tableManagerReference.nullValuePlaceholder 
            // (usually "-") which is only for display.
            return ""; 
        }
        return this._isTruncated(cellData) ? String(this._stripHtmlTags(cellData, true)) : undefined;
    }

    /**
     * Checks whether text is longer than the column's max_display_length, so it is displayed truncated.
     * @param {*} text - The text.
     * @returns {boolean} True if the text is displayed truncated.
     */
    _isTruncated(text) {
        const maxDisplayLength = this.column.max_display_length;
        if (!maxDisplayLength || text === null || text === undefined || String(text).length <= maxDisplayLength) {
            return false;
        }
        // Tags and entities make the raw text longer than what is displayed
        return this._parseHtml(text).textContent.length > maxDisplayLength;
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
        
    /**
     * Removes HTML tags from a value, so it can be used as or compared with plain text.
     * @param {*} v - The value to clean.
     * @param {boolean} decodeSymbols - Whether to decode HTML entities.
     * @returns {string} The value as text, or an empty string if it is null or undefined.
     */
    _stripHtmlTags(v, decodeSymbols = false) {
        let result = v == null ? "" : String(v).replace(/<[^>]*>/g, '');
        if (decodeSymbols) {
            result = this.decodeHTMLEntities(result);
        }
        return result;
    }

    /**
     * Decodes HTML entities in a string.
     * @param {string} text - The text to decode.
     * @returns {string} The decoded text, or an empty string if the input is null or undefined.
     */
    decodeHTMLEntities(text) {
        if (text === null || text === undefined) return '';

        const greekLetters = {
            '&Alpha;': 'Α', '&alpha;': 'α',
            '&Beta;': 'Β', '&beta;': 'β',
            '&Gamma;': 'Γ', '&gamma;': 'γ',
            '&Delta;': 'Δ', '&delta;': 'δ',
            '&Epsilon;': 'Ε', '&epsilon;': 'ε',
            '&Zeta;': 'Ζ', '&zeta;': 'ζ',
            '&Eta;': 'Η', '&eta;': 'η',
            '&Theta;': 'Θ', '&theta;': 'θ',
            '&Iota;': 'Ι', '&iota;': 'ι',
            '&Kappa;': 'Κ', '&kappa;': 'κ',
            '&Lambda;': 'Λ', '&lambda;': 'λ',
            '&Mu;': 'Μ', '&mu;': 'μ',
            '&Nu;': 'Ν', '&nu;': 'ν',
            '&Xi;': 'Ξ', '&xi;': 'ξ',
            '&Omicron;': 'Ο', '&omicron;': 'ο',
            '&Pi;': 'Π', '&pi;': 'π',
            '&Rho;': 'Ρ', '&rho;': 'ρ',
            '&Sigma;': 'Σ', '&sigma;': 'σ',
            '&Tau;': 'Τ', '&tau;': 'τ',
            '&Upsilon;': 'Υ', '&upsilon;': 'υ',
            '&Phi;': 'Φ', '&phi;': 'φ',
            '&Chi;': 'Χ', '&chi;': 'χ',
            '&Psi;': 'Ψ', '&psi;': 'ψ',
            '&Omega;': 'Ω', '&omega;': 'ω'
        };

        let decoded = String(text);
        for (const [entity, unicode] of Object.entries(greekLetters)) {
        decoded = decoded.replace(new RegExp(entity.replace(/&/, '\\&'), 'g'), unicode);
        }

        return decoded;
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
        const newSearchValue = e.target.value.trim();

        // An empty input gives no terms, which clears the filter
        const terms = [];
        if (newSearchValue !== "") {
            // Get the list of unique values for the column. Client-side these are the raw cell data, so compare
            // against their text; server-side they are the values the server matches on, so compare them as given.
            let dataOptions = await dataSource.getOptions(column);
            if (!dataSource.isServerSide) {
                dataOptions = dataOptions.map((item) => this._stripHtmlTags(item));
            }

            //if the search value is not in the list of unique values, use a "contains" search to allow for partial matches
            terms.push({ value: newSearchValue, contains: !dataOptions.includes(newSearchValue) });
        }

        // Redraws only if the filter has changed
        dataSource.applyColumnFilter(column, { type: "text", terms: terms });
    }
}

export { Text, registerPopupForOutsideClick };