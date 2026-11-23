// This class represents the "textlist" data type used in the table manager.
// It renders a list of text items in one cell. The data for this data type is expected to be an array of items, each a
// string or a {content, formatting} object as used by "text".
// The items are joined with a separator and the joined text is truncated as one piece, to the column's
// max_display_length. The optional max_list_items column property limits how many items the cell shows; a "more" icon
// then opens the popup listing every item. The expand icon of the truncated text is controlled by the extendMode column property:
//   "popover" (default) - a popup listing the full list, one item per line, as the "weblinktextlist" data type does.
//   "extend"            - the remaining text is shown in the cell for a few seconds, as for truncated text.

import { ListBase, withPlaceholders } from "./listbase.js";
import { Text } from "./text.js";
import { truncateHtml, bindTruncationToggles } from "./textutils.js";

/**
 * Data type for columns holding a list of text items. Cell data is an array of Text cell values. The cell shows the
 * items separated by "; ", truncated as a whole (see truncateHtml).
 * @extends ListBase
 */
class TextList extends ListBase {
    static itemClass = Text;
    separator = "; ";

    /**
     * Displays the item markup joined with the separator, truncated as one piece to max_display_length.
     * @param {Array} data - The cell data.
     * @returns {string} The display markup.
     */
    displayValue(data, tableManagerReference) {
        const items = withPlaceholders(data, tableManagerReference.nullValuePlaceholder);
        const maxItems = this.column.max_list_items;
        const visible = maxItems ? items.slice(0, maxItems) : items;
        const html = visible.map((item) => this.item.displayHtml(item)).join(this.separator);
        if (visible.length === items.length) {
            return truncateHtml(html, this.column.max_display_length, true, this.column.breakStyle).content;
        }

        // Hidden items get one "more" icon (opening the popup), so the truncated text gets no icon of its own
        const truncated = truncateHtml(html, this.column.max_display_length, false, this.column.breakStyle).content;
        const moreLink = document.createElement("a");
        moreLink.setAttribute("href", "#");
        moreLink.classList.add("tm-link-list-more");
        moreLink.innerHTML = "<img width='12px' title='Show more' height='12px' src='/static/home/images/plus_grey.png'>";

        // Kept on one line, so the "more" icon is always beside the last visible item
        const noWrapSpan = document.createElement("span");
        noWrapSpan.classList.add("tm-link-list-no-wrap");
        noWrapSpan.innerHTML = truncated + this.separator + moreLink.outerHTML;
        noWrapSpan.style.whiteSpace = "nowrap";
        return noWrapSpan.outerHTML;
    }

    /**
     * Hooks up the expand icon of the truncated list. In "extend" mode it shows the remaining text in the cell (the Text
     * behaviour). In "popover" mode it opens the shared popup listing every item.
     * @param {HTMLElement} cell - The rendered table cell.
     * @param {*} cellData - The cell data.
     * @param {*} rowData - The full row data.
     * @param {number} rowIndex - The index of the row.
     * @param {number} colIndex - The index of the column.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     */
    eventHookup(cell, cellData, rowData, rowIndex, colIndex, tableManagerReference) {
        const placeholder = tableManagerReference.nullValuePlaceholder;
        if (cell.querySelector(".tm-link-list-more")) {
            this._bindListPopup(cell, ".tm-link-list-more", cellData, placeholder);
        } else if (this.column.extendMode === "extend") {
            bindTruncationToggles(cell);
        } else {
            this._bindListPopup(cell, ".tm-text-expand", cellData, placeholder);
        }
    }
}

export { TextList };
