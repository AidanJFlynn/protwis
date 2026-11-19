// A free text filter: an input whose text is matched against the column's values.

import { FilterBase } from "./filterbase.js";
import { addSymbolPopupIfEnabled } from "./symbolpopup.js";
import { normalizeForSearch } from "../datatypes/textutils.js";
import { ListBase } from "../datatypes/listbase.js";

/**
 * Text input filter. The text is applied when the input loses focus or Enter is pressed. Text matching one of the
 * column's values exactly filters on that value, other text with a contains match.
 * @extends FilterBase
 */
class TextFilter extends FilterBase {

    /**
     * Creates the text input, wrapped with the symbol popup button if show_symbol_popup is set.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {HTMLDivElement} The filter wrapper.
     */
    createInterface(tableManagerReference) {
        const input = this._createControl("input", tableManagerReference, "", "text-filter");
        input.addEventListener("blur", () => this.apply(input.value, tableManagerReference));
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                this.apply(input.value, tableManagerReference);
            }
        });

        const wrapper = document.createElement("div");
        wrapper.classList.add("tm-text-filter-wrapper");
        wrapper.appendChild(input);
        addSymbolPopupIfEnabled(this.column, wrapper, () => input);
        return wrapper;
    }

    /**
     * Applies typed text as the column filter. If the text matches one of the column's options exactly, it filters on
     * that value. Otherwise it filters with a contains match. Empty text clears the filter. Does nothing while filters
     * are being cleared.
     * @async
     * @param {string} text - The typed text.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {Promise<void>}
     */
    async apply(text, tableManagerReference) {
        // If we are in the process of clearing filters, we don't want to trigger a redraw as it will be done after all filters have been cleared.
        if (tableManagerReference.state.clearingFilters) {
            return;
        }

        const dataSource = tableManagerReference.dataSource;
        const searchValue = normalizeForSearch(text.trim());

        // An empty input gives no terms, which clears the filter
        const terms = [];
        if (searchValue !== "") {
            // The column's unique values as normalised plain text, comparable with the normalised search value.
            // Client-side these are the raw cell data (strings, {content, formatting} objects or links), server-side
            // the raw database values.
            const options = await dataSource.getOptions(this.column);
            const searchOptions = new Set(options.map((option) => this.dataType.searchText(option)));

            // If the search value is not one of the unique values, use a "contains" search to allow for partial matches.
            // List columns always use "contains": a row's value is the whole joined list, so an exact match would only
            // find rows whose list holds that single item.
            const isList = this.dataType instanceof ListBase;
            terms.push({ value: searchValue, contains: isList || !searchOptions.has(searchValue) });
        }

        // Redraws only if the filter has changed
        dataSource.applyColumnFilter(this.column, { type: "text", terms: terms });
    }
}

export { TextFilter };
