// This is the base class for all data types used in the table manager.
// It provides a common interface and default implementations for methods 
// that can be overridden by subclasses to provide specific functionality for each data type.

class DataTypeBase {
  // class methods
  constructor() { }
  
  createFilterInterface(tableManagerReference) { 
    // This method should be overridden by subclasses to create the appropriate filter interface for the data type.
    // Default implementation returns null, indicating no filter interface is provided, resulting in no filter controls being added/built.
    return false;
  }
  
  dataTableRenderer(data, type, row, meta) { 
    // This method should be overridden by subclasses to provide the appropriate rendering logic for the data type (if required).
    // Default implementation returns the data as-is.
    return data;
  } 
  
  cellFormatting(cell, cellData, rowData, rowIndex, colIndex, tableManagerReference) {
    if (this.cssClassCell) {
        if(this.cssClassCell.includes("_conditional_")){            
            let conditionSource = null;
            if (this.cssClassCellConditionSource) { conditionSource = this.cssClassCellConditionSource.split(';'); }
            
            let settings = null;
            if (this.cssClassCellConditionRules) { settings = this.parseSettingsList(this.cssClassCellConditionRules); }
            
            let styler = tableManagerReference.cellStyleFactory.getStyler(this.cssClassCell, cell, cellData, rowData, rowIndex, colIndex, conditionSource, tableManagerReference, settings);
            styler.applyStyle();
        } else {
            cell.classList.add(this.cssClassCell);
        }
    }
  }

  parseSettingsList(settingsList){
        // Parse the settings list into a dictionary of key-value pairs

        if (settingsList == null || settingsList === undefined || settingsList.trim() === "") {
            return null;
        }

        let settingsDict = {};
        let settingsArray = settingsList.split(';');
        for (let setting of settingsArray) {
            let [key, value] = setting.split(':');
            settingsDict[key.trim()] = value.trim();
        }
        return settingsDict;
    }

}

export { DataTypeBase };