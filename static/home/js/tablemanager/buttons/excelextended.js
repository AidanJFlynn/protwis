import { runExcelExport } from "./excelexport.js";

/**
 * Excel export button with a dropdown of export modes: every row, the rows matching the current search and filters,
 * or the checked rows. The checked rows mode is only offered if the table has a checkbox column, and is disabled while
 * no rows are checked. Rows come from the table's data source, so server-side tables export every matching row rather
 * than only the loaded page.
 */
class ExcelExtended {

    static MODES = {
        all: 'Export All',
        filtered: 'Export Filtered',
        selected: 'Export Selected',
    };

    button_config
    tableManagerReference

    /**
     * Creates the Excel export collection button configuration, with one excel button per export mode.
     * @param {Object} tableManagerReference - The TableManager instance that owns the table.
     */
    constructor(tableManagerReference) {
        this.tableManagerReference = tableManagerReference;
        this.checkboxColumn = this.tableManagerReference.columns.find((col) => col.data_type === 'checkbox');

        const modes = this.checkboxColumn ? ['all', 'filtered', 'selected'] : ['all', 'filtered'];
        this.button_config = {
            extend: 'collection',
            text: 'Export (Excel)',
            buttons: modes.map((mode) => this._modeButton(mode)),
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
     * Creates the excel button for an export mode. Its action gets the mode's rows from the data source, then runs the
     * Buttons excel action with those rows as the export body. The selected mode is enabled only while rows are checked.
     * @param {string} mode - The export mode: "all", "filtered" or "selected".
     * @returns {Object} The DataTables Buttons definition for the mode.
     */
    _modeButton(mode) {
        const self = this;
        const button = {
            extend: 'excel',
            text: ExcelExtended.MODES[mode],
            // Buttons calls the action with the button API as this, which the excel action needs
            action: function (e, dt, node, config, cb) {
                self._export(mode, this, e, dt, node, config, cb);
            },
        };

        if (mode === 'selected') {
            button.init = function () {
                const refresh = () => this.enable(self.tableManagerReference.state.activeCheckBoxes.size > 0);
                refresh();
                self.tableManagerReference.eventPubSub.subscribe('checkboxStateChanged', refresh);
            };
        }

        return button;
    }

    /**
     * Gets the rows for an export mode and runs the Buttons excel action on them. The export keeps the super-header and
     * column title rows, drops the rows below the title row, and replaces the body with the mode's rows. Buttons shows
     * the button as processing until cb is called.
     * @param {string} mode - The export mode: "all", "filtered" or "selected".
     * @param {Object} buttonApi - The Buttons API instance for the clicked button.
     * @param {Event} e - The click event from the button.
     * @param {DataTables.Api} dt - The DataTables API instance.
     * @param {HTMLElement} node - The button element.
     * @param {Object} config - The button configuration.
     * @param {Function} cb - The Buttons callback, called when the export is done.
     * @returns {Promise<void>}
     */
    async _export(mode, buttonApi, e, dt, node, config, cb) {
        let rows;
        try {
            rows = await this._exportRows(mode);
        } catch (error) {
            console.error(`Excel export failed: could not get the rows for "${ExcelExtended.MODES[mode]}".`, error);
            cb();
            return;
        }

        runExcelExport(this.tableManagerReference, rows, buttonApi, e, dt, node, config, cb);
    }

    /**
     * Gets the row data to export for a mode, in the table's current order. The selected mode exports every checked row,
     * whether or not it matches the current search and filters.
     * @param {string} mode - The export mode: "all", "filtered" or "selected".
     * @returns {Promise<Array<Object>>} The row data of each row to export.
     */
    async _exportRows(mode) {
        const dataSource = this.tableManagerReference.dataSource;
        if (mode === 'filtered') {
            return dataSource.getExportRows(true);
        }

        const rows = await dataSource.getExportRows(false);
        if (mode === 'all') {
            return rows;
        }

        const activeCheckboxes = this.tableManagerReference.state.activeCheckBoxes;
        return rows.filter((rowData) => {
            const rowId = rowData[this.checkboxColumn.json_id]?.row_id;
            return rowId != null && activeCheckboxes.has(Number.parseInt(rowId));
        });
    }
}

export { ExcelExtended };
