// This class represents the "date" data type used in the table manager.
// It provides date range filtering capabilities, allowing users to filter table data between a lower and an upper date.

import { DataTypeBase } from "./datatypebase.js";

/**
 * Data type for date columns. Dates are strings in the form YYYY-MM-DD. Filters by an inclusive lower and upper date
 * bound chosen with date pickers. The class is named DateType to avoid shadowing the built-in Date.
 * @extends DataTypeBase
 */
class DateType extends DataTypeBase {

    /**
     * Renders date values. For the display type, null values show the nullValuePlaceholder. Other types return the raw
     * data, so ordering and filtering use the original ISO strings (which sort chronologically).
     * @param {*} data - The cell data.
     * @param {string} type - The DataTables render type: "display", "filter", "sort" or "type".
     * @param {*} row - The full row data (unused).
     * @param {Object} meta - The DataTables cell metadata (unused).
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {*} The rendered value for the render type.
     */
    dataTableRenderer(data, type, row, meta, tableManagerReference) {
        if (type === "display" && (data === null || data === undefined)) {
            return tableManagerReference.nullValuePlaceholder;
        }
        return data;
    }

    /**
     * Creates the lower and upper date pickers for a range filter. The range is applied when a picker changes. An empty
     * picker leaves that bound open, and clearing both removes the filter. Both bounds are inclusive.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {HTMLInputElement[]|false} The lower and upper date inputs, in that order, or false if filtering is not allowed.
     */
    createFilterInterface(tableManagerReference) {
        const column = this.column;

        if (!column.allow_filter) {
            return false;
        }

        const createInput = (suffix, title) => {
            const input = document.createElement("input");
            input.setAttribute("type", "date");
            input.setAttribute("data-field", column.json_id);
            // Prefix id with table id to avoid collisions when multiple tables have the same column on one page
            input.setAttribute("id", tableManagerReference.tableId + "_" + column.json_id + "_search_" + suffix);
            input.setAttribute("title", title);
            input.classList.add("col-filter");
            input.classList.add("daterange-filter");
            if (column.cssClassFilterInput) {
                input.classList.add(column.cssClassFilterInput);
            }
            return input;
        };

        const filterInputMin = createInput("min", "From (inclusive)");
        const filterInputMax = createInput("max", "To (inclusive)");

        // A date input's value is "" or a valid YYYY-MM-DD string, so an empty input leaves that bound open
        const bound = (input) => input.value || null;
        const filterChangeListener = () => tableManagerReference.dataSource.applyColumnFilter(
            column,
            { type: "daterange", min: bound(filterInputMin), max: bound(filterInputMax) }
        );

        filterInputMin.addEventListener("change", filterChangeListener);
        filterInputMax.addEventListener("change", filterChangeListener);

        return [filterInputMin, filterInputMax];
    }
}

export { DateType };
