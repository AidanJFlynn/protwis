from table_provider.serverside.querystringprocessing import DatatablesQueryStringProcessor
import datetime
import json
import math
import unicodedata

from django.db.models import Q

import common.db_functions  # registers the `nfkc` lookup transform


class FilterError(ValueError):
    """Raised when a request contains filter or ordering parameters that cannot be interpreted (a client error)."""


# Keys of the JSON filter objects the client sends as a column's search value in server-side mode
TEXT_FILTER_KEYS = {'in', 'contains'}       # e.g. {"in": ["A"], "contains": ["b"]}
NUMERIC_FILTER_KEYS = {'min', 'max'}        # e.g. {"min": 2, "max": null}
BOOLEAN_STRINGS = {'true': True, 'false': False}


def _check_filter_keys(spec, allowed_keys, data_field):
    if not isinstance(spec, dict) or not set(spec) <= allowed_keys:
        raise FilterError(f"Invalid filter for field '{data_field}'; expected an object with keys {sorted(allowed_keys)}.")


def _date_values(values, data_field):
    """Validates exact date filter values, which must be ISO dates (YYYY-MM-DD) as the server sends them."""
    try:
        return [datetime.date.fromisoformat(v) for v in values]
    except ValueError:
        raise FilterError(f"Invalid 'in' filter for field '{data_field}'; expected ISO dates (YYYY-MM-DD).")


def _filter_list(spec, key, data_field, item_types=(str,)):
    values = spec.get(key, [])
    if not isinstance(values, list) or not all(isinstance(v, item_types) for v in values):
        raise FilterError(f"Invalid '{key}' filter for field '{data_field}'; expected a list of strings.")
    return values


"""
 This module provides classes and functions for filtering and ordering data in a server-side processing context, specifically for use with DataTables.
 It defines a FilterSet class that processes query parameters from the request to generate filter requirements and ordering instructions based on the
 specified serializer's field mappings and data types. The module also includes specific filter classes for text and numeric range filtering,
 allowing for flexible and dynamic filtering of data based on user input.
"""
class FilterSet:
    ignored_datatypes = ['checkbox']  # not orderable; checkbox filters are row id filters (see parse_filters)

    def __init__(self, request, SerializerClass):
        """Initializes a FilterSet instance."""
        self._filters = []
        self._ordering = []
        self.request = request
        self.SerializerClass = SerializerClass
        self.field_mappings = SerializerClass.source_mapping()
        self.datatypes = SerializerClass.column_datatypes()
        if request is not None:
            self.query_parameters = DatatablesQueryStringProcessor(self.request).query_set
            self.parse_filters()
            self.parse_ordering()

    def __iter__(self):
        return iter(self._filters)

    def has_filters(self):
        return len(self._filters) > 0

    def add_filter(self, filter_requirement):
        self._filters.append(filter_requirement)

    def parse_filters(self):
        """Convert query parameters to filter objects

        Parses query parameters from a DataTables serverside request
        to generate filter requirements based on the specified
        serializer's field mappings and data types.

        Each column's search value is empty (no filter) or a JSON object whose shape depends on the column datatype:
        text and boolean columns take {"in": [...], "contains": [...]}, numeric columns take {"min": x, "max": y}
        with null for an open bound. The search regex flag is ignored.
        """

        if 'columns' not in self.query_parameters:
            return

        for column in self.query_parameters['columns']:
            try:
                data_field = column['data']
                search_value = column['search']['value']
            except (KeyError, TypeError):
                raise FilterError("Each column must provide 'data' and 'search[value]'.")
            field_type = self.datatypes.get(data_field)

            if not field_type:
                raise FilterError(f"Unknown column '{data_field}'.")

            if not search_value:
                continue

            # The checkbox pseudo-column has no database field, but filters by row id: its cells' row_id is the pk
            if field_type == 'checkbox':
                self.add_filter(RowIdFilter(self._row_ids(self._parse_spec(search_value, data_field), data_field)))
                continue

            if field_type in self.ignored_datatypes:
                continue

            spec = self._parse_spec(search_value, data_field)

            db_field = self.field_mappings.get(data_field)
            if field_type == 'text':
                _check_filter_keys(spec, TEXT_FILTER_KEYS, data_field)
                filter_req = TextFilter(db_field, _filter_list(spec, 'in', data_field), _filter_list(spec, 'contains', data_field))
            elif field_type == 'date':
                if isinstance(spec, dict) and set(spec) & NUMERIC_FILTER_KEYS:
                    # Date range from the client's date data type: {"min": "YYYY-MM-DD", "max": "YYYY-MM-DD"}, null for an open bound
                    _check_filter_keys(spec, NUMERIC_FILTER_KEYS, data_field)
                    if spec.get('min') is None and spec.get('max') is None:
                        continue
                    filter_req = DateRangeFilter(db_field, spec.get('min'), spec.get('max'))
                else:
                    # Exact ISO dates or contains matches on the ISO text (e.g. "2025" or "2025-01").
                    # Not normalised: the nfkc transform does not exist on DateField, and ISO dates are ASCII.
                    _check_filter_keys(spec, TEXT_FILTER_KEYS, data_field)
                    filter_req = TextFilter(db_field, _date_values(_filter_list(spec, 'in', data_field), data_field),
                                            _filter_list(spec, 'contains', data_field), normalize=False)
            elif field_type == 'numeric':
                _check_filter_keys(spec, NUMERIC_FILTER_KEYS, data_field)
                if spec.get('min') is None and spec.get('max') is None:
                    continue
                filter_req = NumericRangeFilter(db_field, spec.get('min'), spec.get('max'))
            elif field_type == 'boolean':
                values = self._boolean_filter_values(spec, data_field)
                if values is None:
                    continue
                filter_req = BooleanFilter(db_field, values)
            elif field_type == 'json':
                _check_filter_keys(spec, TEXT_FILTER_KEYS, data_field)
                filter_req = JsonFilter(db_field, _filter_list(spec, 'in', data_field), _filter_list(spec, 'contains', data_field))
            else:
                continue

            self.add_filter(filter_req)

    @staticmethod
    def _parse_spec(search_value, data_field):
        """The JSON filter object in a column's search value."""
        try:
            return json.loads(search_value)
        except (TypeError, ValueError):
            raise FilterError(f"Invalid filter for field '{data_field}'; expected a JSON object.")

    @staticmethod
    def _row_ids(spec, data_field):
        """Row ids of a checkbox column filter, {"in": [id, ...]}. An empty list matches no rows."""
        if not isinstance(spec, dict) or set(spec) != {'in'}:
            raise FilterError(f"Invalid filter for field '{data_field}'; expected an object with the key 'in'.")
        ids = spec['in']
        # bool is an int subclass, so reject it explicitly
        if not isinstance(ids, list) or not all(isinstance(i, int) and not isinstance(i, bool) for i in ids):
            raise FilterError(f"Invalid 'in' filter for field '{data_field}'; expected a list of integer row ids.")
        return ids

    @staticmethod
    def _boolean_filter_values(spec, data_field):
        """Boolean columns use text filter widgets, so they receive the text filter shape.

        'in' values are booleans or "true"/"false" (any case). A 'contains' term selects each boolean whose
        name contains it, matching what client-side search does with the rendered text. Returns the set of
        accepted booleans, or None when the filter is empty.
        """
        _check_filter_keys(spec, TEXT_FILTER_KEYS, data_field)
        exact = _filter_list(spec, 'in', data_field, item_types=(str, bool))
        contains = _filter_list(spec, 'contains', data_field)
        if not exact and not contains:
            return None

        values = set()
        for value in exact:
            if isinstance(value, str):
                if value.lower() not in BOOLEAN_STRINGS:
                    raise FilterError(f"Invalid boolean value '{value}' for field '{data_field}'.")
                value = BOOLEAN_STRINGS[value.lower()]
            values.add(value)
        for term in contains:
            values.update(b for name, b in BOOLEAN_STRINGS.items() if term.lower() in name)
        return values

    def parse_ordering(self):
        """Extract columns used for row ordering from query parameters.

        Always appends 'pk' as a final tie-breaker to ensure deterministic pagination.
        When no ordering is specified, defaults to 'pk' ordering.
        """
        order_array = []

        # Extract ordering from query parameters if provided
        if 'order' in self.query_parameters:
            for order_column in self.query_parameters['order']:
                try:
                    column_idx = int(order_column['column'])
                    json_name = self.query_parameters['columns'][column_idx]['data']
                    direction = order_column['dir']
                except (KeyError, IndexError, TypeError, ValueError):
                    raise FilterError("Invalid 'order' parameter: it must reference an existing column and a direction.")
                if direction not in ('asc', 'desc'):
                    raise FilterError(f"Invalid order direction '{direction}'.")
                field_type = self.datatypes.get(json_name)
                if field_type in self.ignored_datatypes:
                    continue
                db_name = self.field_mappings.get(json_name)
                if not db_name:
                    raise FilterError(f"Cannot order by unknown field '{json_name}'.")
                order_direction = '' if direction == 'asc' else '-'
                order_array.append(f"{order_direction}{db_name}")

        # Always append 'pk' as a final tie-breaker for deterministic pagination.
        # This ensures that rows with identical values in the primary sort column
        # are always returned in the same order, preventing duplicates or skipped rows
        # when using LIMIT/OFFSET pagination.
        if 'pk' not in order_array and '-pk' not in order_array:
            order_array.append('pk')

        # If no ordering was specified at all, default to ordering by pk
        if not order_array:
            order_array = ['pk']

        self._ordering = order_array


    def get_filters(self, data_field=None):
        return self._filters

    def get_ordering(self):
        return self._ordering

class FilterRequirement:
    def __init__(self, db_field_name, filter_type):
        self.filter_type = filter_type
        self.db_field_name = db_field_name
        self.filter_values = None

class TextFilter(FilterRequirement):
    """A text filter requirement for a specific database field.

    Matches rows whose field equals any of the exact values, or contains (case-insensitively) any of the
    contains values. The two lists correspond to the "in" and "contains" keys of the JSON filter the client
    sends (exact values are chosen Select2 options, contains values are typed-in Select2 tags), and are used
    as given: no regex parsing or escaping is involved.

    With normalize=True (the default) the column is compared in its NFKC-normalised form via the `nfkc`
    transform, which only exists on CharField and TextField. Pass normalize=False for other column types
    (e.g. dates filtered as text) and for internal filters on plain ASCII values.
    """

    def __init__(self, db_field_name, exact=(), contains=(), normalize=True):
        super().__init__(db_field_name, 'text')
        if normalize:
            # Normalise the values as well as the column, whichever client path produced them (chosen options,
            # typed or pasted text, direct requests). NFKC is idempotent, so already normalised values are unchanged.
            exact = [unicodedata.normalize('NFKC', v) for v in exact]
            contains = [unicodedata.normalize('NFKC', v) for v in contains]
        self.exact_values = list(exact)
        self.contains_values = [v for v in contains if v]  # an empty contains term would match every row
        # Apply NFKC normalization to the field for text comparisons by default
        self.lookup_prefix = f"{db_field_name}__nfkc" if normalize else db_field_name

    def format_query(self):
        """Converts filter values into a Django Q object for querying the database.

        Combines exact matches and contains matches with OR logic.
        """
        query = Q()

        # Exact-match values (works for 1 or many; __in ORs them internally)
        if self.exact_values:
            query |= Q(**{f"{self.lookup_prefix}__in": self.exact_values})

        # Contains matches, ORed with exact matches and each other
        for value in self.contains_values:
            query |= Q(**{f"{self.lookup_prefix}__icontains": value})

        return query



class JsonFilter(TextFilter):
    """A text filter for JSONField columns.

    Matches the elements of a JSON array individually, using the lookups in common/db_functions.py. A row
    matches an exact ("in") value when one of its elements equals the value (`elementin`), so a select option
    chosen from a list column's elements finds every row listing it. It matches a "contains" value when one of
    its elements contains the value, case-insensitively (`elementicontains`). Matches never span two elements
    or JSON syntax, and values that are not arrays never match. Elements are NFKC normalised unless
    normalize=False.
    """

    def __init__(self, db_field_name, exact=(), contains=(), normalize=True):
        super().__init__(db_field_name, exact, contains, normalize)
        self.filter_type = 'json'
        prefix = "nfkc" if normalize else ""
        self.exact_lookup = f"{db_field_name}__{prefix}elementin"
        self.contains_lookup = f"{db_field_name}__{prefix}elementicontains"

    def format_query(self):
        """Converts filter values into a Django Q object; exact element matches and contains matches are ORed."""
        query = Q()
        if self.exact_values:
            query |= Q(**{self.exact_lookup: self.exact_values})
        for value in self.contains_values:
            query |= Q(**{self.contains_lookup: value})
        return query


class NumericRangeFilter(FilterRequirement):
    """Represents a numeric range filter requirement for a specific database field.

    It supports filtering based on minimum and maximum values. A bound of None leaves that side of the range open,
    allowing for filtering based on only a minimum or maximum value.
    """

    def __init__(self, db_field_name, filter_min=None, filter_max=None):
        """Initializes a NumericRangeFilter instance with the specified database field name and filter values.

        Bounds are inclusive (match ==, >=, <=, not just >/<).
        """
        super().__init__(db_field_name, 'numeric')

        # Bounds must be finite numbers before they reach the ORM (bool is an int subclass, so reject it explicitly)
        for bound in (filter_min, filter_max):
            if bound is None:
                continue
            if isinstance(bound, bool) or not isinstance(bound, (int, float)) or not math.isfinite(bound):
                raise FilterError(f"Invalid numeric bound '{bound}' for field '{db_field_name}'.")

        self.filter_values = {key: bound for key, bound in (('min', filter_min), ('max', filter_max)) if bound is not None}

    def format_query(self):
        """Converts filter values into a Django Q object for querying the database.

        Returns an empty Q() if no bounds are set.
        """
        query = Q()
        if 'min' in self.filter_values:
            query &= Q(**{f"{self.db_field_name}__gte": self.filter_values['min']})
        if 'max' in self.filter_values:
            query &= Q(**{f"{self.db_field_name}__lte": self.filter_values['max']})
        return query

class DateRangeFilter(FilterRequirement):
    """Represents an inclusive date range filter requirement for a specific database field.

    Bounds are ISO dates (YYYY-MM-DD). A bound of None leaves that side of the range open.
    """

    def __init__(self, db_field_name, filter_min=None, filter_max=None):
        super().__init__(db_field_name, 'date')

        self.filter_values = {}
        for key, bound in (('min', filter_min), ('max', filter_max)):
            if bound is None:
                continue
            try:
                self.filter_values[key] = datetime.date.fromisoformat(bound)
            except (TypeError, ValueError):
                raise FilterError(f"Invalid date bound '{bound}' for field '{db_field_name}'; expected an ISO date (YYYY-MM-DD).")

    def format_query(self):
        """Converts filter values into a Django Q object for querying the database."""
        query = Q()
        if 'min' in self.filter_values:
            query &= Q(**{f"{self.db_field_name}__gte": self.filter_values['min']})
        if 'max' in self.filter_values:
            query &= Q(**{f"{self.db_field_name}__lte": self.filter_values['max']})
        return query

class RowIdFilter(FilterRequirement):
    """Matches the rows whose primary key is one of the given row ids (the row_id of the checkbox column's cells).
    An empty list matches no rows.
    """

    def __init__(self, row_ids):
        super().__init__('pk', 'rowid')
        self.filter_values = sorted(set(row_ids))

    def format_query(self):
        """Converts the row ids into a Django Q object for querying the database"""
        return Q(pk__in=self.filter_values)


class BooleanFilter(FilterRequirement):
    """Represents a boolean filter requirement for a specific database field.

    Matches a single boolean value, or any of a collection of them (an empty collection matches no rows).
    """

    def __init__(self, db_field_name, filter_value):
        """Initializes a BooleanFilter instance with the specified database field name and a boolean or collection of booleans."""
        super().__init__(db_field_name, 'boolean')

        self.filter_values = filter_value if isinstance(filter_value, bool) else sorted(set(filter_value))

    def format_query(self):
        """Converts filter values into a Django Q object for querying the database"""
        if isinstance(self.filter_values, bool):
            return Q(**{f"{self.db_field_name}": self.filter_values})
        return Q(**{f"{self.db_field_name}__in": self.filter_values})