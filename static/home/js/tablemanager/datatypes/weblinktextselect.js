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

    // The link helpers are borrowed from WebLinkText, as this class extends TextSelect. With _plainText handling link
    // objects, the inherited exportValue, blurHandler and option building (client-side link objects, server-side plain
    // values) work unchanged.

    /** See WebLinkText._plainText. */
    _plainText(v) {
        return WebLinkText.prototype._plainText.call(this, v);
    }

    /** See WebLinkText._linkPlainText. */
    _linkPlainText(link) {
        return WebLinkText.prototype._linkPlainText.call(this, link);
    }

    /** See WebLinkText._linkHtml. */
    _linkHtml(data, maxDisplayLength) {
        return WebLinkText.prototype._linkHtml.call(this, data, maxDisplayLength);
    }

    /** See WebLinkText._linkDisplayHtml. */
    _linkDisplayHtml(link) {
        return WebLinkText.prototype._linkDisplayHtml.call(this, link);
    }
}

export { WebLinkTextSelect };
