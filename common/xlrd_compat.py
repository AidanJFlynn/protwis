"""Minimal xlrd-compatible reader for .xlsx files, backed by openpyxl.

xlrd 2.x only reads legacy .xls, and xlrd 1.2 (the last version that read
.xlsx) does not run on Python >= 3.9. This module provides the subset of
the xlrd API used in this codebase, with xlrd's value semantics, so existing
parsers keep working unchanged:

    from common import xlrd_compat as xlrd
    book = xlrd.open_workbook(path)                    # or file_contents=bytes
    sheet = book.sheet_by_name(name)                   # sheet_names(), sheet_by_index()
    sheet.nrows, sheet.ncols, sheet.cell_value(r, c), sheet.cell_type(r, c)
    sheet.row(r), sheet.get_rows(), sheet.cell(r, c).value / .ctype

Values follow xlrd: numbers are float, empty cells are '', booleans are 0/1,
dates are Excel serial numbers (ctype XL_CELL_DATE; convert them with
xldate_as_tuple), errors are xlrd error codes (ctype XL_CELL_ERROR). Rows are
padded to ncols, as with xlrd's default ragged_rows=False.
"""
import datetime
import re
from io import BytesIO

from openpyxl import load_workbook
from openpyxl.utils.datetime import CALENDAR_MAC_1904, from_excel, to_excel

XL_CELL_EMPTY, XL_CELL_TEXT, XL_CELL_NUMBER, XL_CELL_DATE, XL_CELL_BOOLEAN, XL_CELL_ERROR = range(6)

# xlrd's error_text_from_code, reversed
_ERROR_CODES = {'#NULL!': 0x00, '#DIV/0!': 0x07, '#VALUE!': 0x0F, '#REF!': 0x17,
                '#NAME?': 0x1D, '#NUM!': 0x24, '#N/A': 0x2A}


class Cell:
    __slots__ = ('ctype', 'value')

    def __init__(self, ctype, value):
        self.ctype = ctype
        self.value = value

    def __repr__(self):
        return 'Cell(%r, %r)' % (self.ctype, self.value)


_EMPTY = Cell(XL_CELL_EMPTY, '')
_OOXML_ESCAPE = re.compile(r'_x([0-9A-Fa-f]{4})_')


def _convert(cell, epoch):
    """openpyxl cell -> Cell, or None when the cell holds no value at all
    (styled-only cells, which xlrd skipped and did not count towards nrows/ncols)."""
    v = cell.value
    if v is None:
        # A typed cell without a value is an empty string (openpyxl returns
        # None for those); xlrd kept it as an XL_CELL_TEXT ''.
        return None if cell.data_type == 'n' else Cell(XL_CELL_TEXT, '')
    if cell.data_type == 'e':
        return Cell(XL_CELL_ERROR, _ERROR_CODES.get(v, 0x2A))
    if isinstance(v, bool):
        return Cell(XL_CELL_BOOLEAN, int(v))
    if isinstance(v, (datetime.datetime, datetime.date, datetime.time, datetime.timedelta)):
        return Cell(XL_CELL_DATE, float(to_excel(v, epoch)))
    if isinstance(v, (int, float)):
        return Cell(XL_CELL_NUMBER, float(v))
    v = str(v)
    if '_x' in v:  # OOXML _xHHHH_ escapes, which xlrd decoded and openpyxl does not
        v = _OOXML_ESCAPE.sub(lambda m: chr(int(m.group(1), 16)), v)
    return Cell(XL_CELL_TEXT, v)


class Sheet:
    def __init__(self, ws, epoch):
        self.name = ws.title
        # Ignore the (often wrong) <dimension> tag and size the sheet from the
        # cells that hold a value, as xlrd did.
        ws.reset_dimensions()
        rows = [[_convert(c, epoch) for c in row] for row in ws.iter_rows()]
        widths = [max((i + 1 for i, c in enumerate(r) if c is not None), default=0) for r in rows]
        nrows = max((i + 1 for i, w in enumerate(widths) if w), default=0)
        ncols = max(widths, default=0)
        self._rows = [[c if c is not None else _EMPTY for c in r[:ncols]] + [_EMPTY] * (ncols - min(len(r), ncols))
                      for r in rows[:nrows]]
        self.nrows = len(self._rows)
        self.ncols = ncols

    def row(self, rowx):
        return list(self._rows[rowx])

    def get_rows(self):
        return (list(r) for r in self._rows)

    def row_values(self, rowx):
        return [c.value for c in self._rows[rowx]]

    def col_values(self, colx):
        return [r[colx].value for r in self._rows]

    def cell(self, rowx, colx):
        return self._rows[rowx][colx]

    def cell_value(self, rowx, colx):
        return self._rows[rowx][colx].value

    def cell_type(self, rowx, colx):
        return self._rows[rowx][colx].ctype


class Book:
    def __init__(self, wb):
        epoch = wb.epoch
        self.datemode = 1 if epoch == CALENDAR_MAC_1904 else 0
        self._sheets = [Sheet(ws, epoch) for ws in wb.worksheets]
        self.nsheets = len(self._sheets)

    def sheet_names(self):
        return [s.name for s in self._sheets]

    def sheets(self):
        return list(self._sheets)

    def sheet_by_index(self, sheetx):
        return self._sheets[sheetx]

    def sheet_by_name(self, sheet_name):
        for s in self._sheets:
            if s.name == sheet_name:
                return s
        raise KeyError('No sheet named <%r>' % sheet_name)


def open_workbook(filename=None, file_contents=None):
    source = BytesIO(file_contents) if file_contents is not None else filename
    # read_only streams the XML (full mode is far too slow on the larger data
    # files); data_only returns cached formula results, like xlrd.
    wb = load_workbook(source, read_only=True, data_only=True)
    try:
        return Book(wb)
    finally:
        wb.close()


def xldate_as_tuple(xldate, datemode):
    """Excel serial date -> (year, month, day, hour, minute, second), like xlrd."""
    epoch = CALENDAR_MAC_1904 if datemode else None
    d = from_excel(xldate, epoch) if epoch else from_excel(xldate)
    if isinstance(d, datetime.datetime):
        return (d.year, d.month, d.day, d.hour, d.minute, d.second)
    if isinstance(d, datetime.time):
        return (0, 0, 0, d.hour, d.minute, d.second)
    return (d.year, d.month, d.day, 0, 0, 0)
