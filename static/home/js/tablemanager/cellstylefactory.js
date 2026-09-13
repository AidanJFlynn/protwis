import { NumericGradientGrayscale } from "./cellstyles/numericgradientgrayscale.js";
import { Categorical } from "./cellstyles/categorical.js";


// This class is responsible for managing the different data types used in the table manager. 
// It facilitate dynamic initialization of data types by calling the constructor for the 
// data type class associated with the data_type string supplied in the column specification.
// New data types can be registered with the factory, allowing for easy extension of the table manager's 
// capabilities without modifying the core codebase.

class CellStyleFactory {
    cellStylers = {};

    constructor() {
        this.registerDataType("_conditional_gradient_greyscale_", NumericGradientGrayscale);
        this.registerDataType("_conditional_categorical_", Categorical);
    }

    registerDataType(cellStyleName, cellStyleClass) {
        this.cellStylers[cellStyleName] = cellStyleClass;
    }

    getStyler(styleName, cell, cellData, rowData, rowIndex, colIndex, conditionSource, tableManagerReference, settings) {
        if (!this.cellStylers[styleName]) {
            throw new Error(`Style provider "${styleName}" is not registered.`);
        }
        return new this.cellStylers[styleName](cell, cellData, rowData, rowIndex, colIndex, conditionSource, tableManagerReference, settings);
    }
}

export { CellStyleFactory }