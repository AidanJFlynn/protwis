// A select filter: a select2 multi-select of the column's values.
// The options come from the table manager's data source (the loaded rows client-side, the options endpoint server-side).

import { FilterBase } from "./filterbase.js";
import { addSymbolPopupIfEnabled } from "./symbolpopup.js";
import { normalizeForSearch } from "../datatypes/textutils.js";

/**
 * select2 multi-select filter. The options are the column's distinct values as plain text. Typed-in values are
 * accepted as tags and matched with a contains search, chosen options match exactly.
 * @extends FilterBase
 */
class SelectFilter extends FilterBase {

    /** select2 configuration, passed to select2 when the filter is initialised. */
    select2options = {
        multiple: true,
        closeOnSelect: true,
        dropdownAutoWidth: true,
        placeholder: "Select...",
        tags: true,
        allowClear: true,
        // Compares the typed text and the option text normalised, so "D4" finds "D₄". Display text is left unchanged.
        matcher: (params, data) => {
            // Show everything when nothing has been typed, and keep group headers
            if (!params.term || params.term.trim() === "" || !data.text) {
                return data;
            }
            const term = normalizeForSearch(params.term).toLowerCase();
            return normalizeForSearch(data.text).toLowerCase().includes(term) ? data : null;
        }
    };

    /** The select element, kept so the later hooks use it directly instead of looking it up by id. */
    select = null;

    /**
     * Creates the select element. It is turned into a select2 control later, in afterTableCreated.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {HTMLSelectElement|HTMLDivElement} The select, or a wrapper holding it and the symbol popup button if
     * show_symbol_popup is set.
     */
    createInterface(tableManagerReference) {
        this.select = this._createControl("select", tableManagerReference, "", "select-filter");
        this.select.setAttribute("name", tableManagerReference.tableId + "_" + this.column.json_id + "_select");

        // Without a symbol popup the select is returned bare
        const wrapper = document.createElement("div");
        wrapper.classList.add("tm-text-filter-wrapper");
        wrapper.appendChild(this.select);
        if (!addSymbolPopupIfEnabled(this.column, wrapper, () => this._getSearchField())) {
            return this.select;
        }
        return wrapper;
    }

    /**
     * Finds the text box select2 uses for typing in the filter, which is where symbols from the popup are inserted.
     * @returns {HTMLInputElement|null} The search field, or null if select2 has not been initialised yet.
     */
    _getSearchField() {
        return $(this.select).next(".select2-container").find(".select2-search__field")[0] ?? null;
    }

    /**
     * Initialises select2 on the select and listens for changes. Runs once the header is in the DOM.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     */
    afterTableCreated(tableManagerReference) {
        if (!this.select) {
            return;
        }
        $(this.select).select2(this.select2options);
        $(this.select).on("change", (e) => this.onChange(e, tableManagerReference));
    }

    /**
     * Fills the select with the column's distinct values once the table's data has loaded.
     * @async
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {Promise<void>}
     */
    async afterDataLoaded(tableManagerReference) {
        if (!this.select) {
            return;
        }
        const options = await tableManagerReference.dataSource.getOptions(this.column);
        this._populateOptions(options);
    }

    /**
     * Applies the selected values as a text filter. Typed-in tags use a contains match, and chosen options match exactly.
     * Does nothing while filters are being cleared.
     * @param {Event} e - The select2 change event. Its target is the select element.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     */
    onChange(e, tableManagerReference) {
        // If we are in the process of clearing filters, we don't want to trigger
        // a redraw as it will be done after all filters have been cleared.
        if (tableManagerReference.state.clearingFilters) {
            return;
        }

        // Work from the selected items only. Each carries its <option> element, which select2 marks with
        // data-select2-tag="true" when the user typed the value in rather than choosing an existing option.
        const terms = $(e.target).select2("data").map((o) => ({
            // NFKC normalised so chosen options and typed tags match the normalised filter data
            // (client-side) and the normalised database column (server-side) in the same way
            value: normalizeForSearch(o.text),
            contains: o.element?.dataset?.select2Tag === "true"
        }));

        // Redraws only if the filter has changed
        tableManagerReference.dataSource.applyColumnFilter(this.column, { type: "text", terms: terms });
    }

    /**
     * Adds one option to the select per distinct normalised value, labelled with its plain text (e.g. "PIP₃"). Values
     * that are equal once normalised (e.g. "PIP₃" and "PIP3") share one option, as they match the same rows. Null and
     * empty values get no option. Options are ordered by their normalised text.
     * @param {Array<*>|null|undefined} data - The column values: raw cell data client-side, database values
     *   server-side. Logs a warning and adds nothing if empty.
     */
    _populateOptions(data) {
        if (!data || data.length === 0) {
            console.warn("No data available to populate select filter options for column " + this.column.json_id);
            return;
        }

        const labels = new Map(); // normalised text -> label, first label seen wins
        for (const value of data) {
            const label = this.dataType.plainText(value);
            const key = normalizeForSearch(label);
            if (key !== "" && !labels.has(key)) {
                labels.set(key, label);
            }
        }

        [...labels.keys()].sort().forEach((key) => {
            const option = document.createElement("option");
            // onChange normalises the label, so the option value only needs to be unique
            option.value = labels.get(key);
            option.textContent = labels.get(key);
            this.select.appendChild(option);
        });
    }
}

export { SelectFilter };
