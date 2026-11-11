// Shared Excel export logic for the Excel buttons. The rows to export come from the table's data source rather than from
// DataTables' loaded rows, so server-side tables export every matching row instead of only the current page.

// Buttons' default export settings, used when a cell exports its displayed content
const STRIP_DATA_CONFIG = { stripHtml: true, stripNewlines: true, decodeEntities: true, trim: true, escapeExcelFormula: false };

/**
 * Gets the export value of a cell: the value from its column data type's exportValue, falling back to the displayed
 * content with its HTML stripped.
 * @param {Object} tableManagerReference - The TableManager instance that owns the table.
 * @param {Object} rowData - The full row data.
 * @param {number} colIdx - The DataTables column index.
 * @returns {*} The value to export.
 */
function exportCell(tableManagerReference, rowData, colIdx) {
    const column = tableManagerReference.columns.find((col) => col.col_idx === colIdx);
    if (!column) {
        return '';
    }

    const cellData = $.fn.dataTable.util.get(column.json_id)(rowData);
    const value = column.type.exportValue(cellData, rowData, tableManagerReference);
    if (value !== undefined) {
        return value;
    }

    const displayed = column.type.dataTableRenderer(cellData, 'display', rowData, { row: null, col: colIdx }, tableManagerReference);
    return $.fn.dataTable.Buttons.stripData(displayed, STRIP_DATA_CONFIG);
}

/**
 * Runs the Buttons excel action on the given rows. The export keeps the super-header and column title rows, drops the
 * rows below the title row, and replaces the body with the given rows.
 * @param {Object} tableManagerReference - The TableManager instance that owns the table.
 * @param {Array<Object>} rows - The row data of each row to export, in export order.
 * @param {Object} buttonApi - The Buttons API instance for the clicked button (the action's this).
 * @param {Event} e - The click event from the button.
 * @param {DataTables.Api} dt - The DataTables API instance.
 * @param {HTMLElement} node - The button element.
 * @param {Object} config - The button configuration.
 * @param {Function} cb - The Buttons callback, called when the export is done.
 */
function runExcelExport(tableManagerReference, rows, buttonApi, e, dt, node, config, cb) {
    // Checkbox columns are for row selection only, so they are left out of the export
    const checkboxIndexes = new Set(
        tableManagerReference.columns.filter((col) => col.data_type === 'checkbox').map((col) => col.col_idx)
    );
    // The columns to export are the non-checkbox columns, in the order they are displayed on screen
    const columnIndexes = dt.columns().indexes().toArray().filter((colIdx) => !checkboxIndexes.has(colIdx));
    const exportConfig = {
        ...config,
        filename: tableManagerReference.dataTablesOptions.exportFileName ?? "gprcdb_table_export",
        title: null,
        exportOptions: {
            ...config.exportOptions,
            columns: columnIndexes,
            // The body is built from the given rows, so Buttons doesn't need to render any of the table's rows
            rows: () => false,
            customizeData: (data) => {
                // Buttons exports every header row DataTables knows about. Keep the super-headers (optional) and column titles,
                // and drop the category count and filter rows below the title row.
                const keepSuperHeaders = tableManagerReference.dataTablesOptions.exportKeepSuperHeaders ?? true;
                const headerOffset = tableManagerReference.hasSuperHeaders() && keepSuperHeaders ? 0 : 1;
                
                data.headerStructure = data.headerStructure.slice(headerOffset, tableManagerReference.titleRowIndex + 1);                

                // Columns can set exportHeaderOverride to replace their title in the export, for titles that only make
                // sense under a super-header on screen. The title row is the last kept header row.
                const titleRow = data.headerStructure[data.headerStructure.length - 1];
                columnIndexes.forEach((colIdx, exportIdx) => {
                    const column = tableManagerReference.columns.find((col) => col.col_idx === colIdx);
                    const override = column?.exportHeaderOverride;
                    if (override === undefined || override === null) {
                        return;
                    }
                    data.header[exportIdx] = override;
                    if (titleRow[exportIdx]) {
                        titleRow[exportIdx].title = override;
                    }
                });

                data.body = rows.map((rowData) => columnIndexes.map((colIdx) => exportCell(tableManagerReference, rowData, colIdx)));
            }
        }
    };

    $.fn.dataTable.ext.buttons.excelHtml5.action.call(buttonApi, e, dt, node, exportConfig, cb);
}

export { runExcelExport };
