// This class represents the "weblinktextlist" data type used in the table manager.
// It extends the "weblinktext" data type to render a list of web links in one cell. The data for this data type is expected
// to be an array of link objects, each in the format used by "weblinktext" (anchor_href, anchor_content, anchor_html).
// The optional max_list_items column property limits how many links the cell shows; the rest are reached through a
// "more..." link that opens a popup listing every link.

import { WebLinkText } from "./weblinktext.js";
import { getListPopup } from "./text.js";

const LINK_SEPARATOR = " / ";

/**
 * Data type for columns holding a list of web links. Cell data is an array of WebLinkText link objects. The cell shows
 * the links comma separated, up to max_list_items of them, followed by a "more..." link that opens a popup listing all
 * the links, one per line. Filtering and ordering use the link texts joined together. Extends WebLinkText.
 * @extends WebLinkText
 */
class WebLinkTextList extends WebLinkText {

    /**
     * Renders a list of web links. For the display type, null or empty lists show the nullValuePlaceholder. Each link is
     * rendered as WebLinkText renders it. If the list is longer than max_list_items, only that many are shown, followed by
     * a "more..." link (see eventHookup). Other types return the link texts joined, so ordering and filtering match any
     * link in the list.
     * @param {Array<{anchor_href?: string, anchor_content?: string, anchor_html?: string}>|null|undefined} data - The cell data.
     * @param {string} type - The DataTables render type: "display", "filter", "sort" or "type".
     * @param {*} row - The full row data.
     * @param {Object} meta - The DataTables cell metadata.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {string} The rendered value for the render type.
     */
    dataTableRenderer(data, type, row, meta, tableManagerReference) {
        const links = this._links(data);
        if (type === "display" && links.length === 0) {
            return tableManagerReference.nullValuePlaceholder;
        }

        const renderLinks = (items) =>
            items.map((link) => super.dataTableRenderer(link, type, row, meta, tableManagerReference)).join(LINK_SEPARATOR);
        
        // Search, order and type return
        if (type !== "display") {
            return renderLinks(links);
        }

        // Display type: show the first max_list_items links. A list gets one "more" icon, opening the popup with every
        // link, if links are hidden or if any shown link is truncated (as the icon on the truncated text would
        // otherwise be a second icon). A single link just keeps the expand icon of its truncated text.
        const maxItems = this.column.max_list_items;
        const maxLength = this.column.max_display_length;
        const visible = maxItems ? links.slice(0, maxItems) : links;
        const anyTruncated = links.length > 1 && maxLength > 0 &&
            visible.some((link) => this._linkPlainText(link).length > maxLength);
        if (links.length === visible.length && !anyTruncated) {
            return renderLinks(links);
        }

        // Shown links keep their "..." but lose their own expand icons
        const visibleHtml = visible.map((link) => {
            const template = document.createElement("template");
            template.innerHTML = this._linkHtml(link, maxLength);
            template.content.querySelectorAll(".tm-text-expand").forEach((icon) => icon.remove());
            return template.innerHTML;
        }).join(LINK_SEPARATOR);

        const moreLink = document.createElement("a");
        moreLink.setAttribute("href", "#");
        moreLink.classList.add("tm-link-list-more");
        moreLink.innerHTML = "<img width='12px' title='Show more' height='12px' src='/static/home/images/plus_grey.png'>";

        //Create a span to hold the links and the "more..." link, and prevent it from wrapping so the "more..." 
        // link is always on the same line as the last visible link.
        let no_wrap_span = document.createElement("span");
        no_wrap_span.classList.add("tm-link-list-no-wrap");
        no_wrap_span.innerHTML =  visibleHtml + LINK_SEPARATOR + moreLink.outerHTML;
        no_wrap_span.style.whiteSpace = "nowrap";
        return no_wrap_span.outerHTML;
    }

    /**
     * Opens the popup listing the links not shown in the cell when the cell's "more..." link is clicked. The popup is placed below the
     * "more..." link.
     * @param {HTMLElement} cell - The rendered table cell.
     * @param {*} cellData - The cell data.
     * @param {*} rowData - The full row data.
     * @param {number} rowIndex - The index of the row.
     * @param {number} colIndex - The index of the column.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     */
    eventHookup(cell, cellData, rowData, rowIndex, colIndex, tableManagerReference) {
        super.eventHookup(cell, cellData, rowData, rowIndex, colIndex, tableManagerReference);

        const moreLink = cell.querySelector(".tm-link-list-more");
        if (!moreLink) {
            return;
        }

        moreLink.addEventListener("click", (e) => {
            e.preventDefault();
            // Stops the click from reaching row click handlers, e.g. row selection
            e.stopPropagation();

            const popup = getListPopup();
            popup.replaceChildren();
            // Every link, in full: the cell may show some of them truncated
            for (const link of this._links(cellData)) {
                const item = document.createElement("div");
                item.classList.add("tm-link-list-popup-item");
                item.innerHTML = this._linkHtml(link, 0);
                popup.appendChild(item);
            }

            const rect = moreLink.getBoundingClientRect();
            popup.style.left = (rect.left + window.scrollX) + "px";
            popup.style.top = (rect.bottom + window.scrollY) + "px";
            popup.classList.add("tm-open");
        });
    }

    /**
     * Exports the full text of every link separated by LINK_SEPARATOR, rather than the displayed links, which can be truncated or
     * limited to max_list_items.
     * @param {Array<{anchor_href?: string, anchor_content?: string, anchor_html?: string}>|null|undefined} cellData - The link list cell data.
     * @param {*} rowData - The full row data.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {string|undefined} The link texts joined, or undefined if there are none (export the displayed content).
     */
    exportValue(cellData, rowData, tableManagerReference) {
        const links = this._links(cellData);
        return links.length ? this._plainText(links) : undefined;
    }

    /**
     * The link texts joined with LINK_SEPARATOR. Overrides the WebLinkText version, which expects a single link
     * object. Used by Text.blurHandler and option building.
     * @param {Array<Object>|null|undefined} v - The link list cell data.
     * @returns {string} The joined link texts, or an empty string if there are none.
     */
    _plainText(v) {
        return this._links(v).map((link) => this._linkPlainText(link)).join(LINK_SEPARATOR);
    }

    /**
     * Returns the links in the cell data, skipping empty entries.
     * @param {Array|null|undefined} data - The cell data.
     * @returns {Array<Object>} The link objects, or an empty array if the data is not a list.
     */
    _links(data) {
        return Array.isArray(data) ? data.filter((link) => link) : [];
    }
}

export { WebLinkTextList };
