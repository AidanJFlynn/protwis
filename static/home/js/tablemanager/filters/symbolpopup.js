// The Greek symbol button and popup that the text and select filters can show beside their input, set by the column's
// show_symbol_popup property.

import { registerPopupForOutsideClick } from "../datatypes/popups.js";

const GREEK_SYMBOLS = [
    { label: "α", name: "alpha" },
    { label: "β", name: "beta" },
    { label: "γ", name: "gamma" },
    { label: "Δ", name: "delta_uppercase" },
    { label: "δ", name: "delta" },
    { label: "ε", name: "epsilon" },
    { label: "κ", name: "kappa" },
    { label: "μ", name: "mu" },
    { label: "φ", name: "phi" },
	{ label: "Φ", name: "phi_uppercase" }
];

/**
 * Adds the symbol button and popup to a filter wrapper if the column has show_symbol_popup set. Clicking a symbol
 * appends it to the text input.
 * @param {Object} column - The column specification.
 * @param {HTMLElement} wrapper - The filter wrapper to append the button and popup to.
 * @param {function(): (HTMLInputElement|null)} getTextInput - Returns the text input to insert symbols into. Called on
 * each click, so the input may be created later (e.g. the select2 search field).
 * @returns {boolean} True if the button and popup were added.
 */
function addSymbolPopupIfEnabled(column, wrapper, getTextInput) {
    if (!column.show_symbol_popup) {
        return false;
    }

    const popup = document.createElement("div");
    popup.classList.add("tm-symbol-popup");

    for (const { label, name } of GREEK_SYMBOLS) {
        const item = document.createElement("button");
        item.type = "button";
        item.title = name;
        item.textContent = label;
        item.classList.add("tm-symbol-popup-item");
        item.addEventListener("mousedown", (e) => {
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
        popup.appendChild(item);
    }

    const symbolBtn = document.createElement("button");
    symbolBtn.type = "button";
    symbolBtn.textContent = "Ω";
    symbolBtn.classList.add("tm-symbol-button");
    symbolBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const opening = !popup.classList.contains("tm-open");
        popup.classList.toggle("tm-open");
        if (opening) {
            const rect = symbolBtn.getBoundingClientRect();
            popup.style.left = (rect.left + window.scrollX) + "px";
            popup.style.top = (rect.bottom + window.scrollY) + "px";
        }
    });

    registerPopupForOutsideClick(popup);
    // Attached to the body rather than the filter wrapper, so the table header does not clip it. Being detached from
    // the button, it is closed on scroll instead of following it.
    document.body.appendChild(popup);
    window.addEventListener("scroll", (e) => {
        if (!popup.contains(e.target)) {
            popup.classList.remove("tm-open");
        }
    }, true);

    wrapper.append(symbolBtn);
    return true;
}

export { addSymbolPopupIfEnabled };
