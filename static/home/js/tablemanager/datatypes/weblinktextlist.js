// This class represents the "weblinktextlist" data type used in the table manager.
// It extends the "weblinktext" data type to render a list of web links in one cell. The data for this data type is expected
// to be an array of link objects, each in the format used by "weblinktext" (anchor_href, anchor_content, anchor_html).
// The optional max_list_items column property limits how many links the cell shows; the rest are reached through a
// "more..." link that opens a popup listing every link.

import { WebLinkText } from "./weblinktext.js";
import { registerPopupForOutsideClick } from "./text.js";

const LINK_SEPARATOR = ", ";

// The "more..." popup is attached to the document body rather than the cell, so the scroll body of a scrollX table does
// not clip it. One popup is shared by every list cell, as only one can be open at a time. It closes on the next click
// anywhere (via the shared outside-click listener) or when anything scrolls, as it would otherwise drift from its link.
let listPopup = null;

/**
 * Returns the shared list popup, creating it and its close listeners on first use.
 * @returns {HTMLDivElement} The popup element.
 */
function getListPopup() {
    if (listPopup === null) {
        listPopup = document.createElement("div");
        listPopup.classList.add("tm-link-list-popup");
        document.body.appendChild(listPopup);
        registerPopupForOutsideClick(listPopup);
        window.addEventListener("scroll", (e) => {
            // Scrolling a long list inside the popup itself keeps it open
            if (!listPopup.contains(e.target)) {
                listPopup.classList.remove("tm-open");
            }
        }, true);
    }
    return listPopup;
}

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

        if (type !== "display") {
            return renderLinks(links); // Search, order and type return
        }

        const maxItems = this.column.max_list_items;
        if (!maxItems || links.length <= maxItems) {
            return renderLinks(links);
        }

        const moreLink = document.createElement("a");
        moreLink.setAttribute("href", "#");
        moreLink.classList.add("tm-link-list-more");
        moreLink.innerHTML = "<img width='12px' title='Show more' height='12px' src='/static/home/images/plus_grey.png'>";

        //Create a span to hold the links and the "more..." link, and prevent it from wrapping so the "more..." 
        // link is always on the same line as the last visible link.
        let no_wrap_span = document.createElement("span");
        no_wrap_span.classList.add("tm-link-list-no-wrap");
        no_wrap_span.innerHTML =  renderLinks(links.slice(0, maxItems)) + LINK_SEPARATOR + moreLink.outerHTML;
        no_wrap_span.style.whiteSpace = "nowrap";
        return no_wrap_span.outerHTML;
    }

    /**
     * Opens the popup listing every link when the cell's "more..." link is clicked. The popup is placed below the
     * "more..." link.
     * @param {HTMLElement} cell - The rendered table cell.
     * @param {*} cellData - The cell data.
     * @param {*} rowData - The full row data.
     * @param {number} rowIndex - The index of the row.
     * @param {number} colIndex - The index of the column.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     */
    eventHookup(cell, cellData, rowData, rowIndex, colIndex, tableManagerReference) {
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
            for (const link of this._links(cellData)) {
                const item = document.createElement("div");
                item.classList.add("tm-link-list-popup-item");
                item.innerHTML = super.dataTableRenderer(link, "display", rowData, null, tableManagerReference);
                popup.appendChild(item);
            }

            const rect = moreLink.getBoundingClientRect();
            popup.style.left = (rect.left + window.scrollX) + "px";
            popup.style.top = (rect.bottom + window.scrollY) + "px";
            popup.classList.add("tm-open");
        });
    }

    /**
     * Removes HTML tags from the link texts, so they can be compared with the filter text. Overrides the WebLinkText
     * version, which expects a single link object, by joining the texts of every link. Used by Text.blurHandler.
     * @param {Array<{anchor_content?: string}>|null|undefined} v - The link list cell data.
     * @returns {string} The link texts without tags, or an empty string if there are none.
     */
    _stripHtmlTags(v) {
        return this._links(v).map((link) => super._stripHtmlTags(link)).join(LINK_SEPARATOR);
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
