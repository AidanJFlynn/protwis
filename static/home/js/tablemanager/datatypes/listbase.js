// This is the base class for the data types whose cells hold a list of values, e.g. "textlist" and "weblinktextlist".
// A list data type does not subclass the data type of its items. It owns an instance of it (this.item) and asks it for
// each item's text and markup, so the item type's methods always handle one item, and the list's handle the list.

import { DataTypeBase } from "./datatypebase.js";
import { showListPopup } from "./popups.js";

/**
 * Returns the items in list cell data, skipping empty entries (null, undefined and empty strings).
 * @param {Array|null|undefined} data - The cell data.
 * @returns {Array} The items, or an empty array if the data is not a list.
 */
function listItems(data) {
    return Array.isArray(data) ? data.filter((item) => item !== null && item !== undefined && item !== "") : [];
}

/**
 * Base class for list data types. Cell data is an array of values of the item type. An empty list displays the
 * nullValuePlaceholder. The list's text is the item texts joined with the separator, and is what the list searches,
 * orders and exports by. Subclasses set the static itemClass and the separator, and implement displayValue.
 * @extends DataTypeBase
 */
class ListBase extends DataTypeBase {
    /** The data type class of the items, e.g. Text. Set by subclasses. */
    static itemClass = null;

    /** The separator placed between items, in the cell and in the list's text. */
    separator = ", ";

    /**
     * @param {Object} column - The column specification this data type belongs to.
     * @param {Function|null} [filterClass=null] - The filter class for the column, or null for no filter.
     */
    constructor(column, filterClass = null) {
        super(column, filterClass);
        // The item type reads the same column specification (e.g. max_display_length), but has no filter of its own
        this.item = new this.constructor.itemClass(column);
    }

    /**
     * A list with no items is empty.
     * @param {Array|null|undefined} data - The cell data.
     * @returns {boolean} True if there are no items.
     */
    isEmpty(data) {
        return listItems(data).length === 0;
    }

    /**
     * The item texts joined with the separator.
     * @param {Array|null|undefined} v - The list cell data.
     * @returns {string} The joined texts, or an empty string if there are none.
     */
    plainText(v) {
        return listItems(v).map((item) => this.item.plainText(item)).join(this.separator);
    }

    /**
     * Searches and orders by the normalised joined item texts, so a search for any item finds the row.
     * @param {Array|null|undefined} data - The cell data.
     * @returns {string} The search value.
     */
    searchValue(data) {
        return this.searchText(data);
    }

    /**
     * Exports the full text of every item joined with the separator, rather than the displayed list, which can be
     * truncated or shortened.
     * @param {Array|null|undefined} cellData - The list cell data.
     * @param {*} rowData - The full row data.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {string} The joined item texts, or an empty string if there are none.
     */
    exportValue(cellData, rowData, tableManagerReference) {
        return this.plainText(cellData);
    }

    /**
     * Makes an element in the cell open the shared list popup, listing every item in full, one per line, below it.
     * Clicking it does not follow a link or reach row click handlers, e.g. row selection.
     * @param {HTMLElement} cell - The rendered table cell.
     * @param {string} selector - Selects the element in the cell that opens the popup.
     * @param {Array} cellData - The list cell data.
     */
    _bindListPopup(cell, selector, cellData) {
        const trigger = cell.querySelector(selector);
        if (!trigger) {
            return;
        }
        trigger.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            showListPopup(trigger, listItems(cellData).map((item) => this.item.renderHtml(item, 0)));
        });
    }
}

export { ListBase, listItems };
