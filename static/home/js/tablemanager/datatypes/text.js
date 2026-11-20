// This class represents the "text" data type used in the table manager.
// It displays text, truncated to the column's max_display_length. Its filter is chosen in the data type factory.

import { DataTypeBase } from "./datatypebase.js";
import { htmlToText, truncateHtml, bindTruncationToggles, applyFormatTags } from "./textutils.js";

/**
 * Data type for text columns. Displays text, truncated to max_display_length when set. Also the base class for the
 * other text-based data types.
 * @extends DataTypeBase
 */
class Text extends DataTypeBase {

    /**
     * Displays the text's markup, truncated to max_display_length (see renderHtml). Numbers and booleans are shown as
     * they are.
     * @param {*} data - The cell text, or a formatted value.
     * @returns {*} The display markup.
     */
    displayValue(data) {
        return this._isText(data) ? this.renderHtml(data, this.column.max_display_length) : data;
    }

    /**
     * The markup displaying a value: its markup (see displayHtml) truncated with an ellipsis if it is longer than
     * maxDisplayLength, then wrapped by _wrapDisplay. Truncated text is followed by an icon that shows the full text
     * for a few seconds (the full text is also kept in the title attribute). Used for the cell, and by the list data
     * types for each item.
     * @param {*} value - The value: a string, a formatted value, or for subclasses e.g. a link object.
     * @param {number|undefined} maxDisplayLength - The maximum number of displayed characters, or a falsy value for no limit.
     * @param {boolean} [expandIcon=true] - Whether truncated text gets its expand icon.
     * @returns {string} The markup.
     */
    renderHtml(value, maxDisplayLength, expandIcon = true) {
        const html = truncateHtml(this.displayHtml(value), maxDisplayLength, expandIcon, this.column.breakStyle).content;
        return this._wrapDisplay(value, html);
    }

    /**
     * Wraps a value's (possibly truncated) display markup, e.g. in a link. The default returns the markup unchanged.
     * @param {*} value - The value.
     * @param {string} html - The display markup.
     * @returns {string} The wrapped markup.
     */
    _wrapDisplay(value, html) {
        return html;
    }

    /**
     * Searches and orders by the normalised plain text (see searchText), so e.g. "PIP₃" and "PIP3" are treated the
     * same. Numbers and booleans are returned as they are, keeping their type.
     * @param {*} data - The cell data.
     * @returns {*} The search value.
     */
    searchValue(data) {
        return this._isText(data) ? this.searchText(data) : data;
    }

    /**
     * Whether a cell value is text: a string, or an object such as a formatted value, link or list.
     * @param {*} data - The cell data.
     * @returns {boolean} True for text values.
     */
    _isText(data) {
        return typeof data === "string" || (data !== null && typeof data === "object");
    }

    /**
     * Exports the full text of a truncated cell, rather than the truncated display text.
     * @param {*} cellData - The cell data.
     * @param {*} rowData - The full row data.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {string|undefined} The full plain text if the cell is truncated, otherwise as DataTypeBase.exportValue.
     */
    exportValue(cellData, rowData, tableManagerReference) {
        return this._isTruncated(cellData) ? this.plainText(cellData) : super.exportValue(cellData, rowData, tableManagerReference);
    }

    /**
     * Checks whether a cell's text is longer than the column's max_display_length, so it is displayed truncated. The
     * plain text is what is displayed, as tags take no space and entities show as one character.
     * @param {*} data - The cell data.
     * @returns {boolean} True if the text is displayed truncated.
     */
    _isTruncated(data) {
        const maxDisplayLength = this.column.max_display_length;
        return Boolean(maxDisplayLength) && !this.isEmpty(data) && this.plainText(data).length > maxDisplayLength;
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
        bindTruncationToggles(cell);
    }

    //------------------------------------------------------------------------------//
    //  Cell value helpers. Subclasses with other data shapes (e.g. links) override  //
    //  plainText and displayHtml; everything that needs text, search text or       //
    //  markup goes through these rather than reading the data directly.            //
    //------------------------------------------------------------------------------//

    /**
     * The text of a cell value as the user reads it: a formatted value's content, or a string with any markup removed
     * and entities decoded (e.g. "&alpha;" to "α"). Used for exports, option labels and truncation lengths.
     * @param {*} v - The cell value: a string, a {content, formatting} object, or another primitive.
     * @returns {string} The plain text, or an empty string if the value is null or undefined.
     */
    plainText(v) {
        if (v === null || v === undefined) {
            return "";
        }
        if (typeof v === "object") {
            // Formatted values hold plain text, with the formatting kept separately
            return v.content === null || v.content === undefined ? "" : String(v.content);
        }
        return htmlToText(String(v));
    }

    /**
     * The markup to display for a cell value, before truncation. Formatted values get their format tags with the text
     * escaped. Strings are server-built and may hold markup, so they are used as given.
     * @param {string|{content: string, formatting?: Array}} v - The cell value.
     * @returns {string} The markup.
     */
    displayHtml(v) {
        if (v !== null && typeof v === "object") {
            return applyFormatTags(v.content, v.formatting);
        }
        return String(v);
    }
}

export { Text };
