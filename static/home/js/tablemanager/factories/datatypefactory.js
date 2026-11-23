import { DataTypeBase } from "../datatypes/datatypebase.js";
import { Text } from "../datatypes/text.js";
import { Numeric } from "../datatypes/numeric.js";
import { WebLinkText } from "../datatypes/weblinktext.js";
import { WebLinkTextList } from "../datatypes/weblinktextlist.js";
import { TextList } from "../datatypes/textlist.js";
import { ReferenceList } from "../datatypes/referencelist.js";
import { Checkbox } from "../datatypes/checkbox.js";
import { TextFilter } from "../filters/textfilter.js";
import { SelectFilter } from "../filters/selectfilter.js";
import { NumericRangeFilter, DateRangeFilter } from "../filters/rangefilter.js";

// This class is responsible for managing the different data types used in the table manager.
// It facilitate dynamic initialization of data types by calling the constructor for the
// data type class associated with the data_type string supplied in the column specification.
// A data_type name pairs a data type class, which renders the cells, with a filter class, which builds the column
// filter. The same data type class can be registered under several names with different filters.
// New data types can be registered with the factory, allowing for easy extension of the table manager's
// capabilities without modifying the core codebase.

/**
 * Creates data type instances for table columns, based on the column's `data_type`.
 * Data type and filter classes are kept in a registry keyed by the `data_type` string.
 */
class DataTypeFactory {
    _dataTypes = {};

    /**
     * Registers the built-in data types.
     */
    constructor() {
        // Dates are shown as given (ISO strings sort chronologically), so they need no data type of their own
        this.registerDataType("date", DataTypeBase, DateRangeFilter);
        this.registerDataType("numeric", Numeric, NumericRangeFilter);
        this.registerDataType("text", Text, TextFilter);
        this.registerDataType("textselect", Text, SelectFilter);
        this.registerDataType("textlist", TextList, TextFilter);
        // Select filter over the list's distinct items; a chosen item matches every row listing it
        this.registerDataType("textlistselect", TextList, SelectFilter);
        this.registerDataType("weblinktext", WebLinkText, TextFilter);
        this.registerDataType("weblinktextselect", WebLinkText, SelectFilter);
        this.registerDataType("weblinktextlist", WebLinkTextList, TextFilter);
        this.registerDataType("weblinktextlistselect", WebLinkTextList, SelectFilter);
        this.registerDataType("referencelist", ReferenceList);
        this.registerDataType("checkbox", Checkbox);
    }

    /**
     * Registers a data type class so it can be created by {@link DataTypeFactory#createDataType}.
     * @param {string} dataTypeName - Name used as the `data_type` in the column specification.
     * @param {Function} dataTypeClass - Data type class to instantiate. It is constructed with the column and the filter class.
     * @param {Function|null} [filterClass=null] - Filter class for the column (a FilterBase subclass), or null for no filter.
     */
    registerDataType(dataTypeName, dataTypeClass, filterClass = null) {
        this._dataTypes[dataTypeName] = { dataTypeClass, filterClass };
    }

    /**
     * Creates the data type instance owned by the column. The instance keeps a reference to the column to read its
     * specification, and creates the column's filter.
     * @param {Object} column - Column specification. Its `data_type` selects the data type and filter classes.
     * @returns {Object} The new data type instance.
     * @throws {Error} If the column's `data_type` is not registered.
     */
    createDataType(column) {
        const registered = this._dataTypes[column.data_type];
        if (!registered) {
            throw new Error(`Data type "${column.data_type}" is not registered.`);
        }
        return new registered.dataTypeClass(column, registered.filterClass);
    }
}

export { DataTypeFactory };
