// Popups shared by the data types and filters.

// Popups close when the user clicks anywhere else. One document listener serves every popup, and popups that have been
// removed from the page (e.g. a destroyed table) are dropped from the set as they are found.
const closeOnOutsideClick = new Set();
let outsideClickListenerAdded = false;

/**
 * Registers a popup to be closed by the next click anywhere on the document. The document listener is added once, on
 * first use. Used by the filter symbol popups and the list popup.
 * @param {HTMLElement} popup - The popup element.
 */
function registerPopupForOutsideClick(popup) {
    if (!outsideClickListenerAdded) {
        outsideClickListenerAdded = true;
        document.addEventListener("click", () => {
            for (const p of closeOnOutsideClick) {
                if (!p.isConnected) {
                    closeOnOutsideClick.delete(p);
                } else {
                    p.classList.remove("tm-open");
                }
            }
        }, true);
    }
    closeOnOutsideClick.add(popup);
}

// The list popup is attached to the document body rather than the cell, so the scroll body of a scrollX table does not
// clip it. One popup is shared by every list cell, as only one can be open at a time. It closes on the next click
// anywhere (via the shared outside-click listener) or when anything scrolls.
let listPopup = null;

/**
 * Returns the shared list popup, creating it and its close listeners on first use.
 * @returns {HTMLDivElement} The popup element.
 */
function getListPopup() {
    if (listPopup === null) {
        listPopup = document.createElement("div");
        listPopup.classList.add("tm-link-list-popup");
        document.body.appendChild(listPopup);
        registerPopupForOutsideClick(listPopup);
        window.addEventListener("scroll", (e) => {
            // Scrolling a long list inside the popup itself keeps it open
            if (!listPopup.contains(e.target)) {
                listPopup.classList.remove("tm-open");
            }
        }, true);
    }
    return listPopup;
}

/**
 * Fills the shared list popup with one line per item and opens it below an element.
 * @param {HTMLElement} anchorElement - The element the popup is placed below, e.g. the icon that was clicked.
 * @param {string[]} itemsHtml - The markup of each line.
 */
function showListPopup(anchorElement, itemsHtml) {
    const popup = getListPopup();
    popup.replaceChildren();
    for (const html of itemsHtml) {
        const line = document.createElement("div");
        line.classList.add("tm-link-list-popup-item");
        line.innerHTML = html;
        popup.appendChild(line);
    }

    const rect = anchorElement.getBoundingClientRect();
    popup.style.left = (rect.left + window.scrollX) + "px";
    popup.style.top = (rect.bottom + window.scrollY) + "px";
    popup.classList.add("tm-open");
}

export { registerPopupForOutsideClick, showListPopup };
