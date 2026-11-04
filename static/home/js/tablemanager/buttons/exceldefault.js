// Buttons' default export settings, used when a cell exports its displayed content
const STRIP_DATA_CONFIG = { stripHtml: true, stripNewlines: true, decodeEntities: true, trim: true, escapeExcelFormula: false };

class ExcelDefault {
    
    button_config
    tableManagerReference

    /**
     * Creates the Excel export button configuration. The export keeps the super-header and column title rows and drops
     * the rows below the title row. Each cell exports the value from its column data type's exportValue, falling back to
     * the displayed content with its HTML stripped.
     * @param {Object} tableManagerReference - The TableManager instance that owns the table.
     */
    constructor(tableManagerReference) {
        this.tableManagerReference = tableManagerReference;
        this.button_config = {
            extend: 'excel',
            text: 'Export (Excel)',
            exportOptions: {
                format: {
                    body: (data, rowIndex, columnIndex) => {
                        const dataTable = this.tableManagerReference.dataTableReference;
                        const column = this.tableManagerReference.columns.find((col) => col.col_idx === columnIndex);
                        // Apply data formatter defined in the column's data type, if any, to get the value to
                        // export. If the column has no data type or the data type has no exportValue, 
                        // fall back to stripping the displayed content.
                        const value = column?.type.exportValue(
                            dataTable.cell(rowIndex, columnIndex).data(), dataTable.row(rowIndex).data(), this.tableManagerReference);
                        return value !== undefined ? value : $.fn.dataTable.Buttons.stripData(data, STRIP_DATA_CONFIG);
                    }
                },
                // Buttons exports every header row DataTables knows about. Keep the super-headers and column titles,
                // and drop the category count and filter rows below the title row.
                customizeData: (data) => {
                    data.headerStructure = data.headerStructure.slice(0, this.tableManagerReference.titleRowIndex + 1);
                }
            }
        }
    }
    
    /**
     * Adds the Excel export button to the DataTable button bar.
     * @param {number} index - Position at which the button is inserted into the button bar.
     */
    attach(index) {
        this.tableManagerReference.dataTableReference.button().add(index, this.button_config);
    }
}

export { ExcelDefault };