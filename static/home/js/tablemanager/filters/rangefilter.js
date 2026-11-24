// Range filters: a pair of inputs giving an inclusive lower and upper bound. An empty or invalid input leaves that
// bound open, and clearing both removes the filter. The numeric and date filters differ only in their inputs, the event
// that applies the range and how a bound is read.

import { FilterBase } from "./filterbase.js";

/**
 * Base class for range filters. Subclasses set the fields below and may override parseBound.
 * @extends FilterBase
 */
class RangeFilter extends FilterBase {
    /** The filter type sent to the data source, e.g. "numericrange". */
    filterType;
    /** The class naming the kind of filter on both inputs. */
    filterClass;
    /** The input event that applies the range. */
    applyEvent = "change";
    /** Extra attributes for the lower ("min") and upper ("max") input. */
    inputAttributes = { min: {}, max: {} };

    /**
     * Reads one bound from its input's value.
     * @param {string} value - The input's value.
     * @returns {*} The bound, or null to leave it open.
     */
    parseBound(value) {
        return value || null;
    }

    /**
     * Creates the lower and upper inputs. Either one applies the range when its applyEvent fires.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {HTMLInputElement[]} The lower and upper inputs, in that order.
     */
    createInterface(tableManagerReference) {
        const inputs = ["min", "max"].map((bound) => {
            const input = this._createControl("input", tableManagerReference, "_" + bound, this.filterClass);
            for (const [name, value] of Object.entries(this.inputAttributes[bound])) {
                input.setAttribute(name, value);
            }
            return input;
        });

        // The range is applied through the data source: as a JSON {"min", "max"} search server-side, or a search
        // function on the column client-side.
        const [min, max] = inputs;
        const applyRange = () => tableManagerReference.dataSource.applyColumnFilter(
            this.column,
            { type: this.filterType, min: this.parseBound(min.value), max: this.parseBound(max.value) }
        );
        inputs.forEach((input) => input.addEventListener(this.applyEvent, applyRange));
        return inputs;
    }
}

/**
 * Numeric range filter: "Min" and "Max" inputs, applied when an input loses focus. Input that is not a number leaves
 * that bound open.
 * @extends RangeFilter
 */
class NumericRangeFilter extends RangeFilter {
    filterType = "numericrange";
    filterClass = "numericrange-filter";
    applyEvent = "blur";
    inputAttributes = { min: { placeholder: "Min" }, max: { placeholder: "Max" } };

    parseBound(value) {
        const number = parseFloat(value);
        return Number.isFinite(number) ? number : null;
    }
}

/**
 * Date range filter: two date pickers, applied when a picker changes. A date input's value is "" or a valid
 * YYYY-MM-DD string, so an empty picker leaves that bound open.
 * @extends RangeFilter
 */
class DateRangeFilter extends RangeFilter {
    filterType = "daterange";
    filterClass = "daterange-filter";
    applyEvent = "change";
    inputAttributes = {
        min: { type: "date", title: "From (inclusive)" },
        max: { type: "date", title: "To (inclusive)" },
    };
}

export { RangeFilter, NumericRangeFilter, DateRangeFilter };
