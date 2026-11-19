// This class represents the "weblink" data type used in the table manager.
// It extends the "text" data type, providing additional functionality for rendering and filtering web links in the table after deserialization.
// The data for this data type is expected to be an object containing two properties: "anchor_href" and "anchor_content".
// anchor_content is plain text, or a formatted value ({content, formatting}) whose format tags are applied for display.
// An optional "anchor_html" property supplies markup (e.g. sub/superscripts) to display in place of anchor_content.


import { Text, escapeHtml, normalizeForSearch } from "./text.js";

/**
 * Data type for web link columns. Cell data is an object with anchor_href and anchor_content, and optionally
 * anchor_html. Displays the content as a link that opens in a new tab, and filters on the link text. Extends Text.
 * @extends Text
 */
class WebLinkText extends Text {

    /**
     * Renders a web link. For the display type, null values show the nullValuePlaceholder. A link to anchor_href is shown
     * with the link's markup (see _linkDisplayHtml), truncated to max_display_length. Without an href, the content is shown
     * unlinked. Other types return the normalised link text, so ordering and filtering use the link text.
     * @param {{anchor_href?: string, anchor_content?: string|{content: string, formatting?: Array}, anchor_html?: string}|null|undefined} data - The cell data.
     * @param {string} type - The DataTables render type: "display", "filter", "sort" or "type".
     * @param {*} row - The full row data (unused).
     * @param {Object} meta - The DataTables cell metadata (unused).
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {string} The rendered value for the render type.
     */
    dataTableRenderer(data, type, row, meta, tableManagerReference) {
        // Per-link helpers are used here, not _plainText/_searchText, as WebLinkTextList renders each of its links
        // through this method and overrides _plainText for the whole list.
        if (type !== "display") {
            return data ? normalizeForSearch(this._linkPlainText(data)) : ""; // Search, order and type return
        }
        if (!data) {
            return data === null || data === undefined ? tableManagerReference.nullValuePlaceholder : "";
        }

        return this._linkHtml(data, this.column.max_display_length);
    }

    /**
     * The markup displaying one link: its text (truncated to maxDisplayLength, see _truncateText) inside an anchor to
     * anchor_href, or unlinked if there is no href.
     * @param {{anchor_href?: string, anchor_content?: string|{content: string, formatting?: Array}, anchor_html?: string}} data - The link object.
     * @param {number|undefined} maxDisplayLength - The maximum number of displayed characters, or a falsy value for no limit.
     * @returns {string} The markup.
     */
    _linkHtml(data, maxDisplayLength) {
        const truncated = this._truncateText(this._linkDisplayHtml(data), maxDisplayLength);
        if (!data.anchor_href) {
            return truncated.content; // fallback to displaying the content unlinked if href is missing
        }

        const link = document.createElement("a");
        link.setAttribute("href", data.anchor_href);
        link.setAttribute("target", "_blank");
        link.innerHTML = truncated.content;
        return link.outerHTML;
    }

    /**
     * The plain text of a cell value. Link objects give their link text (see _linkPlainText). Other values, such as the
     * plain option values the server sends, are handled as Text handles them.
     * @param {*} v - The cell value.
     * @returns {string} The plain text.
     */
    _plainText(v) {
        return v !== null && typeof v === "object" ? this._linkPlainText(v) : super._plainText(v);
    }

    /**
     * The text of one link as the user reads it: anchor_content (plain, or a formatted value's content), otherwise
     * anchor_html with its markup removed. anchor_content comes first, as with anchor_html it is the plain label sent
     * for filtering and export (e.g. a structure code beside an icon).
     * @param {{anchor_content?: string|{content: string}, anchor_html?: string}} link - The link object.
     * @returns {string} The link text, or an empty string if there is none.
     */
    _linkPlainText(link) {
        const content = link.anchor_content;
        if (content !== null && content !== undefined) {
            return typeof content === "object" ? String(content.content ?? "") : String(content);
        }
        return link.anchor_html === null || link.anchor_html === undefined ? "" : this._htmlToText(String(link.anchor_html));
    }

    /**
     * The markup for one link's text, before truncation: anchor_html as given (trusted, server-built), a formatted
     * anchor_content with its format tags, or a plain anchor_content escaped.
     * @param {{anchor_content?: string|{content: string, formatting?: Array}, anchor_html?: string}} link - The link object.
     * @returns {string} The markup.
     */
    _linkDisplayHtml(link) {
        if (link.anchor_html !== null && link.anchor_html !== undefined) {
            return String(link.anchor_html);
        }
        const content = link.anchor_content;
        if (content !== null && typeof content === "object") {
            return this.applyFormatTags(content.content, content.formatting);
        }
        return escapeHtml(content === null || content === undefined ? "" : String(content));
    }
}

export { WebLinkText };
