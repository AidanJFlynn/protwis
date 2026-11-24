// This is the base class for all data types used in the table manager.
// It provides a common interface and default implementations for methods 
// that can be overridden by subclasses to provide specific functionality for each data type.
// Each column owns one data type instance (column.type). The column specification is read through this.column;
// "this" inside a data type is always the data type instance.
// The column's filter is a separate object (this.filter, see filters/filterbase.js), chosen with the data type in the
// data type factory, so the same data type can be filtered in different ways.

import { normalizeForSearch } from "./textutils.js";

/**
 * Base class for the data types used by the table manager. Each column owns one instance, which controls how the
 * column's cells are rendered, formatted and interacted with. Filtering is handed to the filter the instance owns.
 * Subclasses override the methods they need.
 */
class DataTypeBase {
  /**
   * @param {Object} column - The column specification this data type belongs to.
   * @param {Function|null} [filterClass=null] - The filter class for the column (a FilterBase subclass), or null for
   * no filter. It is constructed with this data type.
   */
  constructor(column, filterClass = null) {
    this.column = column;
    this.filter = filterClass ? new filterClass(this) : null;
  }

  /**
   * Creates the filter control for the column header, using the column's filter. Runs while the header is built,
   * before the DataTable exists.
   * @param {Object} tableManagerReference - The table manager that owns the table.
   * @returns {HTMLElement|HTMLElement[]|false} The filter element(s), or false if the column has no filter or does
   * not allow filtering.
   */
  createFilterInterface(tableManagerReference) {
    if (!this.column.allow_filter || !this.filter) {
      return false;
    }
    return this.filter.createInterface(tableManagerReference);
  }

  /**
   * Hook for setup that needs the DataTable but not its data, such as initialising filter plugins. Runs right after the
   * DataTable is created, with the header in the DOM. The default runs the filter's hook.
   * @param {Object} tableManagerReference - The table manager that owns the table.
   */
  afterTableCreated(tableManagerReference) {
    this.filter?.afterTableCreated(tableManagerReference);
  }

  /**
   * Hook for setup that needs the initial table data, such as populating filter options. Runs once the table manager's
   * ready promise has resolved. The default runs the filter's hook.
   * @param {Object} tableManagerReference - The table manager that owns the table.
   * @returns {Promise<void>|void} A promise if the setup is asynchronous.
   */
  afterDataLoaded(tableManagerReference) {
    return this.filter?.afterDataLoaded(tableManagerReference);
  }

  /**
   * The text of a cell value as the user reads it. Used by the filters for option labels and comparisons. The default
   * converts the value to a string. Text-based data types override it.
   * @param {*} v - The cell value.
   * @returns {string} The plain text, or an empty string if the value is null or undefined.
   */
  plainText(v) {
    return v === null || v === undefined ? "" : String(v);
  }

  /**
   * The normalised plain text of a cell value, used wherever values are searched or compared (see normalizeForSearch).
   * @param {*} v - The cell value.
   * @returns {string} The normalised plain text.
   */
  searchText(v) {
    return normalizeForSearch(this.plainText(v));
  }

  /**
   * The text of a filter option, as returned by the data source's getOptions. Options are cell values, so the default
   * is plainText. List types override it, as their options are single items.
   * @param {*} option - The option value.
   * @returns {string} The option's plain text.
   */
  optionText(option) {
    return this.plainText(option);
  }

  //---------------------------------------------------------------------------------//
  //  Rendering. dataTableRenderer handles empty values, then hands each render type  //
  //  to a hook: displayValue, searchValue or sortValue. Subclasses override the      //
  //  hooks rather than dataTableRenderer.                                            //
  //---------------------------------------------------------------------------------//

  /**
   * Renders cell data for display, search, ordering and type detection. Empty values (see isEmpty) display the
   * table's nullValuePlaceholder. Otherwise the display type uses displayValue, the sort and type types use sortValue,
   * and the filter type uses searchValue.
   * @param {*} data - The cell data.
   * @param {string} type - The DataTables render type: "display", "filter", "sort" or "type".
   * @param {*} row - The full row data.
   * @param {Object} meta - The DataTables cell metadata.
   * @param {Object} tableManagerReference - The table manager that owns the table.
   * @returns {*} The rendered value for the render type.
   */
  dataTableRenderer(data, type, row, meta, tableManagerReference) {
    if (type === "display") {
      return this.isEmpty(data) ? tableManagerReference.nullValuePlaceholder : this.displayValue(data, tableManagerReference);
    }
    if (type === "sort" || type === "type") {
      return this.sortValue(data);
    }
    return this.searchValue(data);
  }

  /**
   * Whether a cell has no value, so it displays the nullValuePlaceholder and exports as a blank cell. The default treats
   * null and undefined as empty. List types also treat an empty list as empty.
   * @param {*} data - The cell data.
   * @returns {boolean} True if the cell has no value.
   */
  isEmpty(data) {
    return data === null || data === undefined;
  }

  /**
   * The markup (or value) displayed for a cell that is not empty. The default returns the data unchanged.
   * @param {*} data - The cell data.
   * @param {Object} tableManagerReference - The table manager that owns the table.
   * @returns {*} The display value.
   */
  displayValue(data, tableManagerReference) {
    return data;
  }

  /**
   * The value searched by the table's search and column filters. The default returns the data unchanged.
   * @param {*} data - The cell data.
   * @returns {*} The search value.
   */
  searchValue(data) {
    return data;
  }

  /**
   * The value the column orders by, also used for DataTables' type detection. The default is the search value.
   * @param {*} data - The cell data.
   * @returns {*} The sort value.
   */
  sortValue(data) {
    return this.searchValue(data);
  }

  /**
   * The value a cell exports with. The default returns "" for empty cells (see isEmpty), so the export has a blank cell
   * rather than the nullValuePlaceholder, which is only for display. Otherwise it returns the cell's plainText.
   * Override it when the export should differ from the plain text, e.g. to export a number as a number.
   * @param {*} cellData - The cell data.
   * @param {*} rowData - The full row data.
   * @param {Object} tableManagerReference - The table manager that owns the table.
   * @returns {*} The value to export.
   */
  exportValue(cellData, rowData, tableManagerReference) {
    return this.isEmpty(cellData) ? "" : this.plainText(cellData);
  }

  /**
   * Runs once a cell has been rendered: applies formatting, attaches event handlers, then runs any cell injectors.
   * @param {HTMLElement} cell - The rendered table cell.
   * @param {*} cellData - The cell data.
   * @param {*} rowData - The full row data.
   * @param {number} rowIndex - The index of the row.
   * @param {number} colIndex - The index of the column.
   * @param {Object} tableManagerReference - The table manager that owns the table.
   */
  postCreationTasks(cell, cellData, rowData, rowIndex, colIndex, tableManagerReference) {
    //apply any cell formatting or styling after the cell has been created and rendered in the DataTable.
    this.cellFormatting(cell, cellData, rowData, rowIndex, colIndex, tableManagerReference);
    
    // Call the eventHookup method to allow subclasses to attach event listeners or perform other actions on the cell.
    this.eventHookup(cell, cellData, rowData, rowIndex, colIndex, tableManagerReference);

    // Call the injectorProcessing method to allow subclasses to perform any additional processing or modifications on the cell after it has been created and rendered in the DataTable.
    this.injectorProcessing(cell, cellData, rowData, rowIndex, colIndex, tableManagerReference);

  }

  /**
   * Runs the injectors named in the column's cellInjectors property against the cell. Injector names are looked up in
   * the table manager's cellInjectors registry. Unknown names are logged and skipped.
   * @param {HTMLElement} cell - The rendered table cell.
   * @param {*} cellData - The cell data.
   * @param {*} rowData - The full row data.
   * @param {number} rowIndex - The index of the row.
   * @param {number} colIndex - The index of the column.
   * @param {Object} tableManagerReference - The table manager that owns the table.
   */
  injectorProcessing(cell, cellData, rowData, rowIndex, colIndex, tableManagerReference) {
    // This method collects the names of any injector functions specified in the cellInjectors property of the column definition
    // and calls them to perform any additional processing or modifications on the cell after it has been created and rendered in the DataTable.
    if (this.column.cellInjectors) {
      const injectorNames = Array.isArray(this.column.cellInjectors) ? this.column.cellInjectors : [];

      for (let injectorName of injectorNames) {
        injectorName = injectorName.trim();
        if (!injectorName) {
          continue;
        }
        let injectorFunction = tableManagerReference.cellInjectors.getInjector(injectorName);
        if (injectorFunction === undefined) {
          console.error(`Injector function ${injectorName} not found in cellInjectors registry.`);
          continue;
        }
        injectorFunction(cell, cellData, rowData, rowIndex, colIndex, tableManagerReference);
      }
    }
  }

  /**
   * Hook for attaching event listeners to a rendered cell. The default does nothing.
   * @param {HTMLElement} cell - The rendered table cell.
   * @param {*} cellData - The cell data.
   * @param {*} rowData - The full row data.
   * @param {number} rowIndex - The index of the row.
   * @param {number} colIndex - The index of the column.
   * @param {Object} tableManagerReference - The table manager that owns the table.
   */
  eventHookup(cell, cellData, rowData, rowIndex, colIndex, tableManagerReference) {
    // This method can be overridden by subclasses to attach event listeners or perform other actions on the cell after it has been created and rendered in the DataTable.
  }

  /**
   * Applies the column's cell styling: a cellStyler object if one is set, otherwise the cssClassCell class. Also mirrors
   * the column group boundary borders onto the cell.
   * @param {HTMLElement} cell - The rendered table cell.
   * @param {*} cellData - The cell data.
   * @param {*} rowData - The full row data.
   * @param {number} rowIndex - The index of the row.
   * @param {number} colIndex - The index of the column.
   * @param {Object} tableManagerReference - The table manager that owns the table.
   */
  cellFormatting(cell, cellData, rowData, rowIndex, colIndex, tableManagerReference) {
    const column = this.column;

    // Handle new cellStyler JSON format
    if (column.cellStyler && typeof column.cellStyler === 'object') {
      const styler = tableManagerReference.cellStyleFactory.getStyler(
        column.cellStyler,
        cell,
        cellData,
        rowData,
        rowIndex,
        colIndex,
        tableManagerReference,
        column.json_id
      );
      styler.applyStyle();
    } else if (column.cssClassCell && typeof column.cssClassCell === 'string') {
      // Static CSS class
      cell.classList.add(column.cssClassCell);
    }

    // Mirror the column group boundary borders of the header onto the body cell.
    // The DataTable reference is not assigned until the table has been constructed, so fall back to the column's default visibility.
    const dataTable = tableManagerReference.dataTableReference;
    const isVisible = (col) => dataTable ? dataTable.column(col.col_idx).visible() : col.visible !== false;
    tableManagerReference.annotateColumnGroupBoundaries(cell, column, tableManagerReference.columns, isVisible);
  }


}

export { DataTypeBase };