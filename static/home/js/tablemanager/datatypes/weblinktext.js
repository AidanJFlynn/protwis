// This class represents the "weblinktext" data type used in the table manager.
// It extends the "text" data type to render web links. The data for this data type is expected to be an object
// containing two properties: "anchor_href" and "anchor_content".
// anchor_content is plain text, or a formatted value ({content, formatting}) whose format tags are applied for display.
// An optional "anchor_html" property supplies markup (e.g. sub/superscripts) to display in place of anchor_content.

import { Text } from "./text.js";
import { escapeHtml, htmlToText, applyFormatTags } from "./textutils.js";

/**
 * Data type for web link columns. Cell data is an object with anchor_href and anchor_content, and optionally
 * anchor_html. Displays the content as a link that opens in a new tab, truncated as Text truncates, and searches,
 * orders and filters on the link text. Other values, such as the plain option values the server sends, are handled as
 * Text handles them.
 * @extends Text
 */
class WebLinkText extends Text {

    /**
     * Values that are not links but are falsy (e.g. an empty string) display nothing.
     * @param {*} data - The cell data.
     * @returns {*} The display markup.
     */
    displayValue(data) {
        return data ? super.displayValue(data) : "";
    }

    /**
     * The text of a link as the user reads it: anchor_content (plain, or a formatted value's content), otherwise
     * anchor_html with its markup removed. anchor_content comes first, as with anchor_html it is the plain label sent
     * for filtering and export (e.g. a structure code beside an icon).
     * @param {*} v - The link object, or another cell value.
     * @returns {string} The link text, or an empty string if there is none.
     */
    plainText(v) {
        if (!this._isLink(v)) {
            return super.plainText(v);
        }
        const content = v.anchor_content;
        if (content !== null && content !== undefined) {
            return typeof content === "object" ? String(content.content ?? "") : String(content);
        }
        return v.anchor_html === null || v.anchor_html === undefined ? "" : htmlToText(String(v.anchor_html));
    }

    /**
     * The markup for a link's text, before truncation: anchor_html as given (trusted, server-built), a formatted
     * anchor_content with its format tags, or a plain anchor_content escaped.
     * @param {*} v - The link object, or another cell value.
     * @returns {string} The markup.
     */
    displayHtml(v) {
        if (!this._isLink(v)) {
            return super.displayHtml(v);
        }
        if (v.anchor_html !== null && v.anchor_html !== undefined) {
            return String(v.anchor_html);
        }
        const content = v.anchor_content;
        if (content !== null && typeof content === "object") {
            return applyFormatTags(content.content, content.formatting);
        }
        return escapeHtml(content === null || content === undefined ? "" : String(content));
    }

    /**
     * Wraps a link's display markup in an anchor to anchor_href that opens in a new tab. Without an href the markup is
     * shown unlinked.
     * @param {*} value - The link object.
     * @param {string} html - The (possibly truncated) display markup.
     * @returns {string} The markup.
     */
    _wrapDisplay(value, html) {
        if (!this._isLink(value) || !value.anchor_href) {
            return html;
        }
        const link = document.createElement("a");
        link.setAttribute("href", value.anchor_href);
        link.setAttribute("target", "_blank");
        link.innerHTML = html;
        return link.outerHTML;
    }

    /**
     * @param {*} v - A cell value.
     * @returns {boolean} True if the value is a link object.
     */
    _isLink(v) {
        return v !== null && typeof v === "object";
    }
}

export { WebLinkText };
