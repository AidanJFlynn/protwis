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
}

export { Numeric };