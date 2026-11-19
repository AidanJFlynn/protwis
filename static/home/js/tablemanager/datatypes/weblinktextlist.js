// This class represents the "weblinktextlist" data type used in the table manager.
// It renders a list of web links in one cell. The data for this data type is expected to be an array of link objects,
// each in the format used by "weblinktext" (anchor_href, anchor_content, anchor_html).
// The optional max_list_items column property limits how many links the cell shows; the rest are reached through a
// "more" icon that opens a popup listing every link.

import { ListBase, listItems } from "./listbase.js";
import { WebLinkText } from "./weblinktext.js";
import { bindTruncationToggles } from "./textutils.js";

/**
 * Data type for columns holding a list of web links. Cell data is an array of WebLinkText link objects. The cell shows
 * the links separated by " / ", each truncated to max_display_length, up to max_list_items of them. A "more" icon
 * opens a popup listing all the links in full.
 * @extends ListBase
 */
class WebLinkTextList extends ListBase {
    static itemClass = WebLinkText;
    separator = " / ";

    /**
     * Displays the first max_list_items links, each rendered as WebLinkText renders it. A list gets one "more" icon,
     * opening the popup with every link, if links are hidden or if any shown link is truncated (as the icon on the
     * truncated text would otherwise be a second icon). A single link just keeps the expand icon of its truncated text.
     * @param {Array<Object>} data - The cell data.
     * @returns {string} The display markup.
     */
    displayValue(data) {
        const links = listItems(data);
        const maxItems = this.column.max_list_items;
        const maxLength = this.column.max_display_length;
        const visible = maxItems ? links.slice(0, maxItems) : links;
        const anyTruncated = links.length > 1 && maxLength > 0 &&
            visible.some((link) => this.item.plainText(link).length > maxLength);
        if (links.length === visible.length && !anyTruncated) {
            return links.map((link) => this.item.renderHtml(link, maxLength)).join(this.separator);
        }

        // Shown links keep their "..." but not their own expand icons
        const visibleHtml = visible.map((link) => this.item.renderHtml(link, maxLength, false)).join(this.separator);

        const moreLink = document.createElement("a");
        moreLink.setAttribute("href", "#");
        moreLink.classList.add("tm-link-list-more");
        moreLink.innerHTML = "<img width='12px' title='Show more' height='12px' src='/static/home/images/plus_grey.png'>";

        // Kept on one line, so the "more" icon is always beside the last visible link
        const noWrapSpan = document.createElement("span");
        noWrapSpan.classList.add("tm-link-list-no-wrap");
        noWrapSpan.innerHTML = visibleHtml + this.separator + moreLink.outerHTML;
        noWrapSpan.style.whiteSpace = "nowrap";
        return noWrapSpan.outerHTML;
    }

    /**
     * Hooks up the expand icon of a single truncated link, and the "more" icon that opens the popup listing every link.
     * @param {HTMLElement} cell - The rendered table cell.
     * @param {*} cellData - The cell data.
     * @param {*} rowData - The full row data.
     * @param {number} rowIndex - The index of the row.
     * @param {number} colIndex - The index of the column.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     */
    eventHookup(cell, cellData, rowData, rowIndex, colIndex, tableManagerReference) {
        bindTruncationToggles(cell);
        this._bindListPopup(cell, ".tm-link-list-more", cellData);
    }
}

export { WebLinkTextList };
