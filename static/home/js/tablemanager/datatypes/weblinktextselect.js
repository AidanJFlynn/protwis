// This class represents the "weblinktextselect" data type used in the table manager.
// It extends the "textselect" data type the same way "weblinktext" extends "text": cells are rendered as web links, and the
// column is filtered with a select2 multi-select of the link texts.
// The data for this data type is expected to be an object containing two properties: "anchor_href" and "anchor_content".
// An optional "anchor_html" property supplies markup (e.g. sub/superscripts) to display in place of anchor_content.

import { TextSelect } from "./textselect.js";
import { WebLinkText } from "./weblinktext.js";

/**
 * Data type for web link columns filtered with a select2 multi-select. Cell data is an object with anchor_href and
 * anchor_content, and optionally anchor_html. Displays the content as a link that opens in a new tab, and filters on the
 * link text. Extends TextSelect.
 * @extends TextSelect
 */
class WebLinkTextSelect extends TextSelect {

    /**
     * Renders a web link, the same way as WebLinkText.
     * @param {{anchor_href?: string, anchor_content?: string, anchor_html?: string}|null|undefined} data - The cell data.
     * @param {string} type - The DataTables render type: "display", "filter", "sort" or "type".
     * @param {*} row - The full row data (unused).
     * @param {Object} meta - The DataTables cell metadata (unused).
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {string|null|undefined} The rendered value for the render type.
     */
    dataTableRenderer(data, type, row, meta, tableManagerReference) {
        return WebLinkText.prototype.dataTableRenderer.call(this, data, type, row, meta, tableManagerReference);
    }

    /**
     * Removes HTML tags from the link text, by reading anchor_content from the link object.
     * @param {{anchor_content?: string}|null|undefined} v - The link cell data.
     * @returns {string} The link text without tags, or an empty string if there is none.
     */
    _stripHtmlTags(v) {
        return WebLinkText.prototype._stripHtmlTags.call(this, v);
    }

    /**
     * Customises the export value to use the anchor content or the stripped HTML.
     * @param {{anchor_content?: string}|null|undefined} cellData - The link cell data.
     * @param {*} rowData - The full row data.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {string|undefined} The full link text if the cell is truncated, otherwise undefined (export the displayed content).
     */
    exportValue(cellData, rowData, tableManagerReference) {
        return this._isTruncated(cellData?.anchor_content) 
            ? String(cellData.anchor_content || super._stripHtmlTags(cellData.anchor_html || "") || "") 
            : undefined;
    }

    /**
     * Adds an option to the select for each distinct link text. Client-side the values are link objects, so they are
     * reduced to their anchor_content; server-side they are already plain values and pass through unchanged.
     * @param {Array<*>|null|undefined} data - The column values. Logs a warning and adds nothing if empty.
     * @param {string} ColumnJsonId - The column's json_id, used in the warning message.
     * @param {HTMLSelectElement} filterInput - The select element to add the options to.
     */
    _populateTextSelectFilterOptionsFromData(data, ColumnJsonId, filterInput) {
        const values = data
            ? [...new Set(data
                .map((v) => (v !== null && typeof v === "object" ? v.anchor_content : v))
                .filter((v) => v !== null && v !== undefined))]
            : data;
        super._populateTextSelectFilterOptionsFromData(values, ColumnJsonId, filterInput);
    }
}

export { WebLinkTextSelect };
