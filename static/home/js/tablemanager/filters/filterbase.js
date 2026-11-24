// This is the base class for the column filters used in the table manager.
// A filter builds the control in the column's filter header cell and applies what the user enters through the table
// manager's data source. Filters are separate from data types, so any data type can be paired with any filter in the
// data type factory (e.g. a web link column filtered with a select).

/**
 * Base class for column filters. Each data type instance owns at most one filter (dataType.filter), created with the
 * data type. The data type passes its createFilterInterface, afterTableCreated and afterDataLoaded hooks on to it.
 */
class FilterBase {
    /**
     * @param {Object} dataType - The data type the filter belongs to. Its column is the column filtered, and its
     * plainText and searchText methods turn cell values into text.
     */
    constructor(dataType) {
        this.dataType = dataType;
    }

    /** The column specification of the filtered column. */
    get column() {
        return this.dataType.column;
    }

    /**
     * Creates the filter control for the column header. Runs while the header is built, before the DataTable exists,
     * so it should only create elements. Only called for columns that allow filtering.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {HTMLElement|HTMLElement[]|false} The filter element(s), or false for none.
     */
    createInterface(tableManagerReference) {
        return false;
    }

    /**
     * Hook for setup that needs the DataTable but not its data, such as initialising filter plugins.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     */
    afterTableCreated(tableManagerReference) {
    }

    /**
     * Hook for setup that needs the initial table data, such as populating options.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {Promise<void>|void} A promise if the setup is asynchronous.
     */
    afterDataLoaded(tableManagerReference) {
    }

    /**
     * Creates a filter control element with the attributes and classes every filter uses.
     * @param {string} tagName - The element to create, e.g. "input" or "select".
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @param {string} idSuffix - Appended to the element id, e.g. "_min" for one input of a pair.
     * @param {string} filterClass - The class naming the kind of filter, e.g. "text-filter".
     * @returns {HTMLElement} The element.
     */
    _createControl(tagName, tableManagerReference, idSuffix, filterClass) {
        const column = this.column;
        const control = document.createElement(tagName);
        control.setAttribute("data-field", column.json_id);
        // Prefix id with table id to avoid collisions when multiple tables have the same column on one page
        control.setAttribute("id", tableManagerReference.tableId + "_" + column.json_id + "_search" + idSuffix);
        control.classList.add("col-filter", filterClass);
        if (column.cssClassFilterInput) {
            control.classList.add(column.cssClassFilterInput);
        }
        return control;
    }
}

export { FilterBase };
