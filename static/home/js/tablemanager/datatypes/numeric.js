// This class represents the "numeric" data type used in the table manager.
// It displays numbers rounded to the column's precision. Its filter (a numeric range) is chosen in the data type factory.

import { DataTypeBase } from "./datatypebase.js";

/**
 * Data type for numeric columns. Displays values rounded to the column's precision.
 * @extends DataTypeBase
 */
class Numeric extends DataTypeBase {

    /**
     * Formats a value for display to the column's precision, when one is set. Non-numeric values are shown unchanged.
     * Search and ordering use the raw values (DataTypeBase's searchValue and sortValue).
     * @param {*} data - The cell data.
     * @returns {*} The display value.
     */
    displayValue(data) {
        // Show non-numeric values (e.g. empty strings or placeholder text from older cached responses) unchanged rather than as "NaN"
        const numericValue = parseFloat(data);
        if (!Number.isFinite(numericValue)) {
            return data;
        }
        const precision = this.column.precision;
        if (precision !== undefined && !isNaN(precision)) {
            return numericValue.toFixed(precision);
        }
        return data;
    }

    /**
     * Exports a numeric value as a number, rounded to the column's precision when one is set, so Excel can sort and
     * calculate on it. Non-numeric values are exported as plain text.
     * @param {*} cellData - The cell data.
     * @param {*} rowData - The full row data.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {number|string} The number to export, or the plain text of a non-numeric value, or "" if empty.
     */
    exportValue(cellData, rowData, tableManagerReference) {
        if (this.isEmpty(cellData)) {
            return "";
        }
        const numericValue = Number.parseFloat(cellData);
        if (!Number.isFinite(numericValue)) {
            return this.plainText(cellData);
        }
        const precision = this.column.precision;
        return precision !== undefined && !isNaN(precision) ? Number(numericValue.toFixed(precision)) : numericValue;
    }
}

export { Numeric };