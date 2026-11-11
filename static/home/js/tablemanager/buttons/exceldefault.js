import { runExcelExport } from "./excelexport.js";

class ExcelDefault {

    button_config
    tableManagerReference

    /**
     * Creates the Excel export button configuration. The export covers every row matching the current search and
     * filters, across all pages (on server-side tables the rows are fetched from the server), in the table's current
     * order. It keeps the super-header and column title rows and drops the rows below the title row. Each cell exports
     * the value from its column data type's exportValue, falling back to the displayed content with its HTML stripped.
     * @param {Object} tableManagerReference - The TableManager instance that owns the table.
     */
    constructor(tableManagerReference) {
        this.tableManagerReference = tableManagerReference;
        const self = this;
        this.button_config = {
            extend: 'excel',
            text: 'Export (Excel)',
            // Buttons calls the action with the button API as this, which the excel action needs
            action: function (e, dt, node, config, cb) {
                self._export(this, e, dt, node, config, cb);
            },
        }
    }

    /**
     * Adds the Excel export button to the DataTable button bar.
     * @param {number} index - Position at which the button is inserted into the button bar.
     */
    attach(index) {
        this.tableManagerReference.dataTableReference.button().add(index, this.button_config);
    }

    /**
     * Gets the rows matching the current search and filters from the data source and runs the Excel export on them.
     * If the rows can't be fetched the error is logged and no file is produced.
     * @param {Object} buttonApi - The Buttons API instance for the clicked button.
     * @param {Event} e - The click event from the button.
     * @param {DataTables.Api} dt - The DataTables API instance.
     * @param {HTMLElement} node - The button element.
     * @param {Object} config - The button configuration.
     * @param {Function} cb - The Buttons callback, called when the export is done.
     * @returns {Promise<void>}
     */
    async _export(buttonApi, e, dt, node, config, cb) {
        let rows;
        try {
            rows = await this.tableManagerReference.dataSource.getExportRows(true);
        } catch (error) {
            console.error('Excel export failed: could not get the rows to export.', error);
            cb();
            return;
        }

        runExcelExport(this.tableManagerReference, rows, buttonApi, e, dt, node, config, cb);
    }
}

export { ExcelDefault };
