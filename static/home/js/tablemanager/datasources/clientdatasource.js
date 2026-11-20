// Data source for DataTables client-side processing.
// Column data is computed from the rows loaded into the DataTable, and column filters use DataTables' own search.

import { DataSourceBase } from "./datasourcebase.js";
import { StorageCache } from "./storagecache.js";
import { ListBase, listItems } from "../datatypes/listbase.js";

class ClientDataSource extends DataSourceBase {

  /**
   * Replaces the ajax option with a function that serves the rows from browser storage when a valid cached copy exists,
   * and otherwise fetches them and caches them. Active only when localStorageKey and localStorageDurationDays are set
   * and ajax is an object with a url. Storage is local storage, then session storage; if neither works the rows are
   * simply fetched each time. A cached copy older than localStorageDurationDays is cleared and fetched again.
   * @param {Object} dataTableOptions - The options for the DataTable; its ajax option is replaced.
   */
  configureDataCache(dataTableOptions) {
    const { localStorageKey, localStorageDurationDays, ajax } = dataTableOptions;
    if (!localStorageKey || !(localStorageDurationDays > 0) || !ajax || typeof ajax !== "object" || !ajax.url) {
      return;
    }

    const storageCache = new StorageCache(localStorageKey, localStorageDurationDays);

    // dataSrc names the property (dot separated path) holding the rows; "" means the response is the rows
    const dataSrc = typeof ajax.dataSrc === "string" ? ajax.dataSrc : "data";
    const extractRows = (json) => dataSrc === "" ? json : dataSrc.split(".").reduce((obj, key) => obj?.[key], json);

    dataTableOptions.ajax = (_requestData, callback, settings) => {
      const cachedRows = storageCache.get();
      if (cachedRows !== undefined) {
        callback({ data: cachedRows });
        return;
      }

      fetch(ajax.url, {
        method: ajax.type || "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        cache: ajax.cache === false ? "no-store" : "default",
      })
        .then((resp) => {
          if (!resp.ok) {
            throw new Error(`${resp.status} ${resp.statusText}`);
          }
          return resp.json();
        })
        .then((json) => {
          const rows = extractRows(json);
          if (!Array.isArray(rows)) {
            throw new Error(`No row array found in the response at "${dataSrc}"`);
          }
          storageCache.set(rows);
          callback({ data: rows });
        })
        .catch((error) => {
          console.error("Fetching table data failed:", error);
          callback({ data: [] });
          $(settings.nTable).trigger("dt-error", [error]);
        });
    };
  }

  /**
   * Get a reference to the DataTables instance for the current table.
   * @returns {Object} The DataTables instance.
   */
  get _dataTable() {
    return this.tableManagerReference.dataTableReference;
  }

  // The data methods read the rows loaded into the DataTable, so each waits for the initial data first via the TableManager ready promise (it may be
  // called earlier, e.g. by a cell style while the first rows are rendered).

  /**
   * Gets the distinct values of a column from the loaded rows, sorted. For list columns these are the distinct items,
   * as for the server-side options endpoint, since list filters match item by item.
   * @param {Object} column - The column to get options for.
   * @returns {Promise<Array>} The distinct raw values.
   */
  async getOptions(column) {
    await this.tableManagerReference.ready;
    let data = this._dataTable.column(column.col_idx).data().toArray();
    if (column.type instanceof ListBase) {
      data = data.flatMap((value) => listItems(value));
    }
    return Array.from(new Set(data.map((value) => value?.content ?? value))).sort();
  }

  /**
   * Gets the minimum and maximum numeric value over the given source columns of the loaded rows.
   * @param {string[]} sources - The json ids of the source columns.
   * @returns {Promise<{min: number, max: number}|null>} The range, or null if there are no numeric values.
   */
  async getRange(sources) {
    await this.tableManagerReference.ready;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    this._dataTable.rows().data().toArray().forEach((rowData) => {
      for (const source of sources) {
        const raw = rowData[source];
        if (raw === null || raw === undefined || raw === "") {
          continue;
        }
        const value = parseFloat(raw);
        if (Number.isFinite(value)) {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      }
    });

    return Number.isFinite(min) && Number.isFinite(max) ? { min: min, max: max } : null;
  }

  /**
   * Calls handler whenever DataTables re-filters the loaded rows. The rows({search: "applied"}) used by the data
   * methods are up to date by then.
   * @param {Function} handler - Called with no arguments on each search change.
   */
  onSearchChange(handler) {
    this._dataTable.on("search.dt", () => handler());
  }

  /**
   * Counts the distinct values per column of the loaded rows. Computed each time: cheap, and always reflects global
   * search and fixed search filters.
   * @returns {Promise<{base: Object<string, number>, filtered: Object<string, number>}>} Counts keyed by the column's
   *   json id, for all loaded rows (base) and for the rows matching the current search (filtered).
   */
  async getDistinctCounts() {
    await this.tableManagerReference.ready;
    const table = this._dataTable

    /**
     * Counts the unique non-empty values in a column's cell data.
     * @param {Array} values - The cell data of the column.
     * @returns {number} The number of unique values.
     */
    const countUnique = (values) => {
        const uniqueValues = new Set()

        values.forEach((value) => {
            // Only count non-empty values
            if (value !== null && value !== undefined && value !== '') {
              // Convert value to string, or JSON string if it's an object
              // (there is a risk of the same objects having different string representation due to property order,
              // but this is a reasonable compromise for counting unique values quicky -- sorting object keys for every cell
              // would be too slow for large datasets)
                value = typeof value == 'object' ?  JSON.stringify(value) : String(value)
                uniqueValues.add(value)
            }
        })

        return uniqueValues.size
    }

    // Calculate unique counts for each column in both base and filtered datasets, keyed by the column's data source
    // (the json_id for columns generated from the column specifications)
    const uniqueValuesByColumn = {
        'base': {},
        'filtered': {}
    }

    table.columns().every(function () {
        // Here object 'this' refers to the column in the DataTables API context
        const columnName = this.dataSrc()

        if ((typeof columnName === 'string' || typeof columnName === 'number') && columnName !== 'checkbox') { // Exclude checkbox columns from unique value counts
            uniqueValuesByColumn.base[columnName] = countUnique(this.data().toArray())
            uniqueValuesByColumn.filtered[columnName] = countUnique(table.column(this.index(), { search: 'applied' }).data().toArray())
        }
    })

    return uniqueValuesByColumn
  }

  /**
   * Gets the checkbox cell data of every row matching the current search and filters, from the loaded rows.
   * @param {Object} column - The checkbox column.
   * @param {AbortSignal} signal - Not used: client-side rows are already loaded, so there is no request to abort.
   * @returns {Promise<Array<{row_id: string, data: *}>>} The checkbox cell data of each matching row.
   */
  async getSearchSetRows(column, signal) {
    await this.tableManagerReference.ready;
    return this._dataTable.rows({ search: "applied" }).data().toArray().map((rowData) => rowData[column.json_id]);
  }

  /**
   * Gets the row data of every row in the table's current order, from the loaded rows.
   * @param {boolean} applySearch - True for only the rows matching the current search and filters, false for all rows.
   * @returns {Promise<Array<Object>>} The row data of each row.
   */
  async getExportRows(applySearch) {
    await this.tableManagerReference.ready;
    return this._dataTable.rows({ search: applySearch ? "applied" : "none", order: "applied" }).data().toArray();
  }

  /**
   * Gets the row data of the rows with the given row ids, in the table's current order, from the loaded rows
   * (including rows hidden by the current search and filters).
   * @param {Iterable<number|string>} rowIds - The row ids.
   * @param {AbortSignal} [signal] - Not used: client-side rows are already loaded, so there is no request to abort.
   * @returns {Promise<Array<Object>>} The row data of each row found.
   */
  async getRowsById(rowIds, signal) {
    await this.tableManagerReference.ready;
    const column = this._checkboxColumn();
    const ids = new Set(this._normaliseRowIds(rowIds));
    if (ids.size === 0) {
      return [];
    }
    return this._dataTable.rows({ search: "none", order: "applied" }).data().toArray()
      .filter((rowData) => ids.has(Number.parseInt(rowData[column.json_id]?.row_id)));
  }

  /**
   * Builds the DataTables column search for a filter.
   * @param {Object} column - The column (data type instance) to filter.
   * @param {Object} filter - {type: "text", terms: [{value, contains}]} , {type: "numericrange", min, max} or {type: "daterange", min, max}.
   * @returns {{value: *, regex: boolean, key: string}} The column search. key identifies the filter.
   * @throws {Error} If the filter type is unknown.
   */
  _buildColumnSearch(column, filter) {
    if (filter.type === "text") {
      if (column.type instanceof ListBase) {
        return this._buildListTextSearch(column, filter.terms);
      }
      const search = this._buildTextSearch(filter.terms);
      return { ...search, key: search.value };
    }
    if (filter.type === "numericrange") {
      return this._buildNumericRangeSearch(column, filter.min, filter.max);
    }
    if (filter.type === "daterange") {
      return this._buildDateRangeSearch(column, filter.min, filter.max);
    }
    throw new Error(`Unknown filter type: ${filter.type}`);
  }

  /**
   * Builds a date range search, like {@link ClientDataSource#_buildNumericRangeSearch} but comparing ISO dates (YYYY-MM-DD),
   * which order correctly as strings. Cells that are not ISO dates (e.g. blank cells) are excluded while a bound is set.
   * @param {Object} column - The column (data type instance) to filter.
   * @param {string|null} min - The inclusive lower bound, or null for an open bound.
   * @param {string|null} max - The inclusive upper bound, or null for an open bound.
   * @returns {{value: string|Function, regex: boolean, key: string}} The column search. With no bounds, an empty search.
   */
  _buildDateRangeSearch(column, min, max) {
    if (min === null && max === null) {
      return { value: "", regex: false, key: "" };
    }

    const rangeSearch = (searchData, rowData) => {
      const value = rowData[column.json_id];
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
      }
      return (min === null || min <= value) && (max === null || value <= max);
    };
    rangeSearch.filterKey = JSON.stringify({ min: min, max: max });

    return { value: rangeSearch, regex: false, key: rangeSearch.filterKey };
  }

  /**
   * Builds DataTables' own search for text terms. A single exact value is a plain search; several values (ORed with
   * "|") or any contains match need a regex. No terms gives an empty search (no filter).
   * @param {Array<{value: string, contains: boolean}>} terms - The terms to match.
   * @returns {{value: string, regex: boolean}} The DataTables search value and whether it is a regex.
   * Exact terms are anchored (^...$) so "D₄" does not also match "FZD₄".
   */
  _buildTextSearch(terms) {
    if (terms.length === 0) {
      return { value: "", regex: false };
    }
    // Note: a plain (non-regex) DataTables search is a substring match, so even a single exact term needs an anchored regex.

    /** Helper function to escape regex special characters in a value */    
    const escape = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    const value = terms
      .map(({ value, contains }) => contains
        ? "(.*" + escape(value) + ".*)" // wildcards for "contains" search
        : "(^" + escape(value) + "$)") // anchors for "exact match" search
      .join("|");
    // regex always true for any multi-term searches as they use | (or) operator, 
    // and for single-term searches with the "contains" flag (which need wildcards).
    return { value: value, regex: true };
  }

  /**
   * Builds a text search for a list column that matches item by item, as the server does for JSON list columns: a row
   * matches an exact term when one of its items equals it, and a contains term when one of its items contains it
   * (case-insensitively). Terms never match across two items or the separator. Term values are normalised by the
   * filters, and are compared with the items' normalised text.
   * @param {Object} column - The list column to filter.
   * @param {Array<{value: string, contains: boolean}>} terms - The terms to match, ORed.
   * @returns {{value: string|Function, regex: boolean, key: string}} The column search. With no terms, an empty search.
   */
  _buildListTextSearch(column, terms) {
    if (terms.length === 0) {
      return { value: "", regex: false, key: "" };
    }

    const exact = new Set(terms.filter((term) => !term.contains).map((term) => String(term.value)));
    const contains = terms.filter((term) => term.contains).map((term) => String(term.value).toLowerCase());

    const listSearch = (searchData, rowData) => column.type.itemSearchTexts(rowData[column.json_id]).some((item) =>
      exact.has(item) || contains.some((value) => item.toLowerCase().includes(value)));
    listSearch.filterKey = JSON.stringify(terms);

    return { value: listSearch, regex: false, key: listSearch.filterKey };
  }

  /**
   * Builds a range search. The range is a search function on the column, so clearing the column's search (e.g. the
   * clear filters button) also clears the range. Non-numeric cells (e.g. blank cells) are excluded while a bound is set.
   * @param {Object} column - The column (data type instance) to filter.
   * @param {number|null} min - The lower bound, or null for an open bound.
   * @param {number|null} max - The upper bound, or null for an open bound.
   * @returns {{value: string|Function, regex: boolean, key: string}} The column search. With no bounds, an empty search.
   */
  _buildNumericRangeSearch(column, min, max) {
    if (min === null && max === null) {
      return { value: "", regex: false, key: "" };
    }

    /**
     * DataTables search function that tests a row's value against the bounds.
     * @param {*} searchData - The DataTables search data (unused).
     * @param {Object} rowData - The row's data, keyed by json id.
     * @returns {boolean} True if the row's value is numeric and within the bounds.
     */
    const rangeSearch = (searchData, rowData) => {
      const value = parseFloat(rowData[column.json_id]);
      if (isNaN(value)) {
        return false;
      }
      return (min === null || min <= value) && (max === null || value <= max);
    };
    rangeSearch.filterKey = JSON.stringify({ min: min, max: max });

    return { value: rangeSearch, regex: false, key: rangeSearch.filterKey };
  }
}

export { ClientDataSource };
