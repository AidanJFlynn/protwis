// This class represents the "textlist" data type used in the table manager.
// It extends the "text" data type to render a list of text items in one cell. The data for this data type is expected
// to be an array of items, each a string or a {content, formatting} object as used by "text".
// The items are joined with a separator and the joined text is truncated as one piece, to the column's
// max_display_length. The expand icon of the truncated text is controlled by the extendMode column property:
//   "popover" (default) - a popup listing the full list, one item per line, as the "weblinktextlist" data type does.
//   "extend"            - the remaining text is shown in the cell for a few seconds, as for truncated text.

import { Text, getListPopup } from "./text.js";

const LIST_SEPARATOR = ", ";

/**
 * Data type for columns holding a list of text items. Cell data is an array of Text cell values. The cell shows the
 * items separated by LIST_SEPARATOR, truncated as a whole (see Text._truncateText). Filtering and ordering use the item
 * texts joined together. Extends Text.
 * @extends Text
 */
class TextList extends Text {

    /**
     * Renders a list of text items. For the display type, null or empty lists show the nullValuePlaceholder. Otherwise
     * rendering is as for Text, with the list treated as its joined text (see _displayHtml and _plainText).
     * @param {Array<string|{content: string, formatting?: Array}>|null|undefined} data - The cell data.
     * @param {string} type - The DataTables render type: "display", "filter", "sort" or "type".
     * @param {*} row - The full row data.
     * @param {Object} meta - The DataTables cell metadata.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {string} The rendered value for the render type.
     */
    dataTableRenderer(data, type, row, meta, tableManagerReference) {
        if (type === "display" && this._items(data).length === 0) {
            return tableManagerReference.nullValuePlaceholder;
        }
        return super.dataTableRenderer(data, type, row, meta, tableManagerReference);
    }

    /**
     * Hooks up the expand icon of the truncated list. In "extend" mode it shows the remaining text in the cell (the Text
     * behaviour). In "popover" mode it opens the shared popup listing every item, below the icon.
     * @param {HTMLElement} cell - The rendered table cell.
     * @param {*} cellData - The cell data.
     * @param {*} rowData - The full row data.
     * @param {number} rowIndex - The index of the row.
     * @param {number} colIndex - The index of the column.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     */
    eventHookup(cell, cellData, rowData, rowIndex, colIndex, tableManagerReference) {
        if (this.column.extendMode === "extend") {
            super.eventHookup(cell, cellData, rowData, rowIndex, colIndex, tableManagerReference);
            return;
        }

        const icon = cell.querySelector(".tm-text-expand");
        if (!icon) {
            return;
        }
        icon.addEventListener("click", (e) => {
            e.preventDefault();
            // Stops the click from reaching row click handlers, e.g. row selection
            e.stopPropagation();

            const popup = getListPopup();
            popup.replaceChildren();
            for (const item of this._items(cellData)) {
                const line = document.createElement("div");
                line.classList.add("tm-link-list-popup-item");
                line.innerHTML = super._displayHtml(item);
                popup.appendChild(line);
            }

            const rect = icon.getBoundingClientRect();
            popup.style.left = (rect.left + window.scrollX) + "px";
            popup.style.top = (rect.bottom + window.scrollY) + "px";
            popup.classList.add("tm-open");
        });
    }

    /**
     * Exports the full text of every item separated by LIST_SEPARATOR, rather than the displayed (truncated) text.
     * @param {Array|null|undefined} cellData - The list cell data.
     * @param {*} rowData - The full row data.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {string} The item texts joined, or an empty string if there are none.
     */
    exportValue(cellData, rowData, tableManagerReference) {
        return this._plainText(cellData);
    }

    /**
     * The item texts joined with LIST_SEPARATOR. Overrides Text._plainText, which expects a single value.
     * @param {Array|null|undefined} v - The list cell data.
     * @returns {string} The joined texts, or an empty string if there are none.
     */
    _plainText(v) {
        return this._items(v).map((item) => super._plainText(item)).join(LIST_SEPARATOR);
    }

    /**
     * The markup of the items joined with LIST_SEPARATOR, before truncation. Overrides Text._displayHtml.
     * @param {Array|null|undefined} v - The list cell data.
     * @returns {string} The markup.
     */
    _displayHtml(v) {
        return this._items(v).map((item) => super._displayHtml(item)).join(LIST_SEPARATOR);
    }

    /**
     * Returns the items in the cell data, skipping empty entries.
     * @param {Array|null|undefined} data - The cell data.
     * @returns {Array} The items, or an empty array if the data is not a list.
     */
    _items(data) {
        return Array.isArray(data) ? data.filter((item) => item !== null && item !== undefined && item !== "") : [];
    }
}

export { TextList };
