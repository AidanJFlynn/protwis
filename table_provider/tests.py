import datetime
import json
import pathlib

from django.test import SimpleTestCase, TestCase
from django.db.models import Q
from table_provider.models import GpcrStructureBrowserTable
from table_provider.serializers import (
    GpcrStatisticsSummarySerializer, GpcrStructureBrowserSerializer, PdbStructureSummarySerializer, TABLE_SERIALIZERS,
)
from table_provider.serverside.filters import TextFilter, JsonFilter, NumericRangeFilter, BooleanFilter, FilterSet, FilterError
from table_provider.views import _distinct_json_elements
from table_provider.serverside.querystringprocessing import DatatablesQueryStringProcessor, QueryStringProcessingError
from rest_framework import serializers


class TextFilterTestCase(TestCase):
    """Tests for TextFilter.format_query() to ensure correct Q object generation."""

    def test_single_exact_value_only(self):
        """Single exact match value should return exact equality Q."""
        f = TextFilter("state", ["Active"])
        self.assertEqual(f.format_query(), Q(state__nfkc__in=["Active"]))

    def test_multiple_exact_values_only(self):
        """Multiple exact matches should return __in Q."""
        f = TextFilter("state", ["Active", "Inactive"])
        self.assertEqual(f.format_query(), Q(state__nfkc__in=["Active", "Inactive"]))

    def test_single_contains_only(self):
        """Single contains value should use icontains."""
        f = TextFilter("state", contains=["inter"])
        self.assertEqual(f.format_query(), Q(state__nfkc__icontains="inter"))

    def test_multiple_contains_only(self):
        """Multiple contains values should be ORed."""
        f = TextFilter("state", contains=["inter", "act"])
        self.assertEqual(f.format_query(), Q(state__nfkc__icontains="inter") | Q(state__nfkc__icontains="act"))

    def test_single_exact_plus_single_contains(self):
        """Single exact value AND single contains value should both be included (ORed).

        This is the bug B2 regression test. When there's exactly one exact match
        and at least one tag, both should be in the result.
        """
        f = TextFilter("state", ["Active"], ["inter"])
        self.assertEqual(f.format_query(), Q(state__nfkc__in=["Active"]) | Q(state__nfkc__icontains="inter"))

    def test_multiple_exact_plus_multiple_contains(self):
        """Multiple exact values and multiple contains values should all be ORed."""
        f = TextFilter("state", ["Active", "Inactive"], ["inter", "act"])
        expected = (
            Q(state__nfkc__in=["Active", "Inactive"]) |
            Q(state__nfkc__icontains="inter") |
            Q(state__nfkc__icontains="act")
        )
        self.assertEqual(f.format_query(), expected)

    def test_empty_filters(self):
        """No values should return empty Q, and an empty contains term must not match every row."""
        self.assertEqual(TextFilter("state").format_query(), Q())
        self.assertEqual(TextFilter("state", contains=[""]).format_query(), Q())

    def test_special_characters_used_verbatim(self):
        """Values are not parsed as regex, so brackets, pipes and backslashes are matched as given (B2, B5)."""
        f = TextFilter("state", ["(A|B)\\x"], ["^.*$"])
        self.assertEqual(f.format_query(), Q(state__nfkc__in=["(A|B)\\x"]) | Q(state__nfkc__icontains="^.*$"))

    def test_values_nfkc_normalised(self):
        """Values are NFKC normalised to match the normalised column: subscripts flatten, micro sign becomes Greek mu."""
        f = TextFilter("name", ["PIP₃"], ["µ-opioid"])
        self.assertEqual(f.exact_values, ["PIP3"])
        self.assertEqual(f.contains_values, ["μ-opioid"])
        self.assertEqual(f.format_query(), Q(name__nfkc__in=["PIP3"]) | Q(name__nfkc__icontains="μ-opioid"))

    def test_values_not_normalised_when_disabled(self):
        """With normalize=False neither the column nor the values are normalised."""
        f = TextFilter("name", ["PIP₃"], normalize=False)
        self.assertEqual(f.format_query(), Q(name__in=["PIP₃"]))


class NumericRangeFilterTestCase(TestCase):
    """Tests for NumericRangeFilter.format_query() to ensure correct Q object generation.

    Tests that bounds are inclusive (>=, <=) matching client-side behavior.
    """

    def test_both_bounds_open(self):
        """No bounds should return empty Q (no filtering)."""
        f = NumericRangeFilter("resolution", None, None)
        self.assertEqual(f.format_query(), Q())

    def test_min_only_inclusive(self):
        """Min-only filter should use >= (inclusive).

        This is the B3 regression test. Ensures server-side and client-side
        both use inclusive bounds (>= and <=, not > and <).
        """
        f = NumericRangeFilter("resolution", 2.0, None)
        self.assertEqual(f.format_query(), Q(resolution__gte=2.0))

    def test_max_only_inclusive(self):
        """Max-only filter should use <= (inclusive)."""
        f = NumericRangeFilter("resolution", None, 3.5)
        self.assertEqual(f.format_query(), Q(resolution__lte=3.5))

    def test_both_bounds_inclusive(self):
        """Both bounds should use >= and <= (inclusive)."""
        f = NumericRangeFilter("resolution", 2, 3.5)
        self.assertEqual(f.format_query(), Q(resolution__gte=2) & Q(resolution__lte=3.5))


class BooleanFilterTestCase(TestCase):
    """Tests for BooleanFilter.format_query()."""

    def test_single_value(self):
        self.assertEqual(BooleanFilter("is_complex", True).format_query(), Q(is_complex=True))

    def test_collection_of_values(self):
        self.assertEqual(BooleanFilter("is_complex", {True, False}).format_query(), Q(is_complex__in=[False, True]))


class JsonFilterTestCase(TestCase):
    """Tests for JsonFilter: exact values match any element of a JSON array, contains values search the JSON text."""

    def _row(self, pdb_code, **json_fields):
        return GpcrStructureBrowserTable.objects.create(
            structure_id=1, pdb_code=pdb_code, uniprot_entry_name='x_human', uniprot_name='X', sodium_site='No', sodium='No',
            **json_fields)

    def _matching(self, json_filter):
        return set(GpcrStructureBrowserTable.objects.filter(json_filter.format_query()).values_list('pdb_code', flat=True))

    def test_query_structure(self):
        f = JsonFilter("ligand_role", ["Agonist"], ["ago"])
        self.assertEqual(f.format_query(), Q(ligand_role__nfkcelementin=["Agonist"]) | Q(ligand_role__nfkcelementicontains="ago"))

    def test_query_structure_not_normalised(self):
        f = JsonFilter("ligand_role", ["Agonist"], ["ago"], normalize=False)
        self.assertEqual(f.format_query(), Q(ligand_role__elementin=["Agonist"]) | Q(ligand_role__elementicontains="ago"))

    def test_empty_filter(self):
        self.assertEqual(JsonFilter("ligand_role").format_query(), Q())

    def test_exact_matches_any_element(self):
        self._row('both', ligand_role=["Agonist", "Antagonist"])
        self._row('agonist', ligand_role=["Agonist"])
        self._row('none', ligand_role=[])
        self.assertEqual(self._matching(JsonFilter("ligand_role", ["Antagonist"])), {'both'})
        self.assertEqual(self._matching(JsonFilter("ligand_role", ["Agonist"])), {'both', 'agonist'})
        self.assertEqual(self._matching(JsonFilter("ligand_role", ["Agonist", "Antagonist"])), {'both', 'agonist'})
        self.assertEqual(self._matching(JsonFilter("ligand_role", ["Agonist, Antagonist"])), set())

    def test_exact_is_whole_element_and_case_sensitive(self):
        self._row('agonist', ligand_role=["Agonist"])
        self.assertEqual(self._matching(JsonFilter("ligand_role", ["Agon"])), set())
        self.assertEqual(self._matching(JsonFilter("ligand_role", ["agonist"])), set())

    def test_exact_elements_normalised(self):
        self._row('pip', ligand_names=["PIP₃"])
        self.assertEqual(self._matching(JsonFilter("ligand_names", ["PIP₃"])), {'pip'})
        self.assertEqual(self._matching(JsonFilter("ligand_names", ["PIP3"])), {'pip'})
        self.assertEqual(self._matching(JsonFilter("ligand_names", ["PIP3"], normalize=False)), set())

    def test_non_array_values_do_not_match_or_raise(self):
        self._row('scalar', ligand_role="Agonist")
        self._row('object', ligand_role={"name": "Agonist"})
        self.assertEqual(self._matching(JsonFilter("ligand_role", ["Agonist"])), set())

    def test_contains_matches_within_an_element_case_insensitively(self):
        self._row('both', ligand_role=["Agonist", "Antagonist"])
        self._row('pam', ligand_role=["PAM"])
        self.assertEqual(self._matching(JsonFilter("ligand_role", contains=["TAGON"])), {'both'})
        self.assertEqual(self._matching(JsonFilter("ligand_role", contains=["pa"])), {'pam'})

    def test_contains_never_matches_json_syntax_or_across_elements(self):
        self._row('both', ligand_role=["Agonist", "Antagonist"])
        for term in ['", "', '["', 'st", "An', 'Agonist, Antagonist']:
            with self.subTest(term=term):
                self.assertEqual(self._matching(JsonFilter("ligand_role", contains=[term])), set())

    def test_contains_is_literal(self):
        """LIKE wildcards and regex characters in the search text are matched literally."""
        self._row('plain', ligand_role=["Agonist"])
        self._row('percent', ligand_role=["50% agonist_x"])
        for term, expected in [('%', {'percent'}), ('_', {'percent'}), ('a.o', set()), ('(', set())]:
            with self.subTest(term=term):
                self.assertEqual(self._matching(JsonFilter("ligand_role", contains=[term])), expected)

    def test_contains_elements_normalised(self):
        self._row('pip', ligand_names=["PIP₃ analogue"])
        self.assertEqual(self._matching(JsonFilter("ligand_names", contains=["pip3"])), {'pip'})
        self.assertEqual(self._matching(JsonFilter("ligand_names", contains=["pip3"], normalize=False)), set())

    def test_contains_ignores_non_array_values(self):
        self._row('scalar', ligand_role="Agonist")
        self._row('object', ligand_role={"name": "Agonist"})
        self.assertEqual(self._matching(JsonFilter("ligand_role", contains=["agon"])), set())

    def test_exact_and_contains_ored(self):
        self._row('agonist', ligand_role=["Agonist"])
        self._row('inverse', ligand_role=["Inverse agonist"])
        self._row('pam', ligand_role=["PAM"])
        self.assertEqual(self._matching(JsonFilter("ligand_role", ["PAM"], ["inverse"])), {'pam', 'inverse'})


class DistinctJsonElementsTestCase(SimpleTestCase):
    """Options of JSON columns are the distinct elements, matching JsonFilter's element-wise exact match."""

    def test_flattens_and_deduplicates(self):
        values = [["Agonist", "Antagonist"], ["Agonist"], [], None, "PAM", [{"a": 1}, ["nested"], None, "NAM"]]
        self.assertEqual(_distinct_json_elements(values), ["Agonist", "Antagonist", "NAM", "PAM"])


class FilterSetParseFiltersTestCase(TestCase):
    """Tests for FilterSet.parse_filters() reading the JSON filter in each column's search value (A2)."""

    def _make_mock_serializer(self):
        class MockSerializer(serializers.Serializer):
            @staticmethod
            def column_datatypes():
                return {'resolution': 'numeric', 'state': 'text', 'best': 'boolean', 'checkbox': 'checkbox',
                        'published': 'date'}

            @staticmethod
            def source_mapping():
                return {'resolution': 'resolution', 'state': 'state_name', 'best': 'resolution_best', 'checkbox': 'checkbox',
                        'published': 'publication_date'}

        return MockSerializer

    def _queries(self, data, spec):
        fs = FilterSet(None, self._make_mock_serializer())
        value = spec if isinstance(spec, str) else json.dumps(spec)
        fs.query_parameters = {'columns': [{'data': data, 'search': {'value': value, 'regex': 'false'}}]}
        fs.parse_filters()
        return [f.format_query() for f in fs.get_filters()]

    def test_empty_search_value_is_no_filter(self):
        self.assertEqual(self._queries('state', ''), [])

    def test_text_filter_uses_source_mapping(self):
        self.assertEqual(self._queries('state', {'in': ['A|B'], 'contains': ['(x']}),
                         [Q(state_name__nfkc__in=['A|B']) | Q(state_name__nfkc__icontains='(x')])

    def test_date_filter_as_text(self):
        self.assertEqual(self._queries('published', {'in': ['2025-01-30'], 'contains': ['2025']}),
                         [Q(publication_date__in=[datetime.date(2025, 1, 30)]) | Q(publication_date__icontains='2025')])

    def test_date_filter_invalid_exact_value_raises(self):
        with self.assertRaises(FilterError):
            self._queries('published', {'in': ['2025']})

    def test_text_filter_keys_optional(self):
        self.assertEqual(self._queries('state', {'contains': ['x']}), [Q(state_name__nfkc__icontains='x')])

    def test_numeric_filter(self):
        self.assertEqual(self._queries('resolution', {'min': 2, 'max': None}), [Q(resolution__gte=2)])

    def test_numeric_filter_without_bounds_is_no_filter(self):
        self.assertEqual(self._queries('resolution', {'min': None, 'max': None}), [])

    def test_boolean_filter_from_text_shape(self):
        self.assertEqual(self._queries('best', {'in': ['True', False], 'contains': []}),
                         [Q(resolution_best__in=[False, True])])

    def test_boolean_filter_contains_matches_names(self):
        self.assertEqual(self._queries('best', {'in': [], 'contains': ['fa']}), [Q(resolution_best__in=[False])])
        self.assertEqual(self._queries('best', {'in': [], 'contains': ['E']}), [Q(resolution_best__in=[False, True])])
        self.assertEqual(self._queries('best', {'in': [], 'contains': ['zz']}), [Q(resolution_best__in=[])])

    def test_boolean_filter_empty_is_no_filter(self):
        self.assertEqual(self._queries('best', {'in': [], 'contains': []}), [])

    def test_boolean_filter_invalid_value_raises(self):
        with self.assertRaises(FilterError):
            self._queries('best', {'in': ['yes']})

    def test_checkbox_empty_is_no_filter(self):
        self.assertEqual(self._queries('checkbox', ''), [])

    def test_checkbox_filter_matches_row_ids(self):
        self.assertEqual(self._queries('checkbox', {'in': [3, 1, 3]}), [Q(pk__in=[1, 3])])

    def test_checkbox_filter_empty_ids_matches_nothing(self):
        self.assertEqual(self._queries('checkbox', {'in': []}), [Q(pk__in=[])])

    def test_checkbox_filter_invalid_ids_raise(self):
        for spec in ({'in': ['1']}, {'in': [True]}, {'in': 1}, {'contains': [1]}, {'in': [1], 'contains': []}, [1]):
            with self.subTest(spec=spec):
                with self.assertRaises(FilterError):
                    self._queries('checkbox', spec)


class FilterSetOrderingTestCase(TestCase):
    """Tests for FilterSet.parse_ordering() to ensure deterministic pagination."""

    def _make_mock_serializer(self):
        """Create a minimal mock serializer for testing."""
        class MockSerializer(serializers.Serializer):
            uniprot = serializers.CharField()
            state = serializers.CharField()

            @staticmethod
            def column_datatypes():
                return {
                    'uniprot': 'text',
                    'state': 'text',
                }

            @staticmethod
            def source_mapping():
                return {
                    'uniprot': 'uniprot_entry_name',
                    'state': 'state',
                }

        return MockSerializer

    def test_no_ordering_defaults_to_pk(self):
        """When no ordering is specified, default to pk ordering."""
        fs = FilterSet(None, self._make_mock_serializer())
        fs.query_parameters = {'columns': []}
        # 'order' not in query_parameters
        fs.parse_ordering()
        self.assertEqual(fs.get_ordering(), ['pk'])

    def test_single_column_ordering_adds_pk_tiebreaker(self):
        """Single column ordering should have pk appended as tie-breaker.

        This is the B4 regression test. Ensures that when ordering by a column
        with duplicate values (like uniprot_entry_name), rows are sorted
        deterministically by pk to prevent pagination duplicates/skips.
        """
        fs = FilterSet(None, self._make_mock_serializer())
        fs.query_parameters = {
            'columns': [
                {'data': 'uniprot'},
                {'data': 'state'},
            ],
            'order': [
                {'column': 0, 'dir': 'asc'},
            ]
        }
        fs.parse_ordering()
        # Should have uniprot_entry_name ascending, then pk ascending
        self.assertEqual(fs.get_ordering(), ['uniprot_entry_name', 'pk'])

    def test_multiple_column_ordering_adds_pk_tiebreaker(self):
        """Multiple column ordering should have pk appended as final tie-breaker."""
        fs = FilterSet(None, self._make_mock_serializer())
        fs.query_parameters = {
            'columns': [
                {'data': 'uniprot'},
                {'data': 'state'},
            ],
            'order': [
                {'column': 0, 'dir': 'asc'},
                {'column': 1, 'dir': 'desc'},
            ]
        }
        fs.parse_ordering()
        # Should have both columns, then pk
        self.assertEqual(fs.get_ordering(), ['uniprot_entry_name', '-state', 'pk'])

    def test_pk_not_duplicated(self):
        """If pk is already in the ordering, don't add it again."""
        fs = FilterSet(None, self._make_mock_serializer())
        # Simulate if somehow pk was already in the mapping
        fs.query_parameters = {'columns': [], 'order': []}
        fs._ordering = ['pk']  # Manually set
        fs.parse_ordering()
        # Should not duplicate pk
        self.assertEqual(fs.get_ordering().count('pk'), 1)


class FilterErrorTestCase(TestCase):
    """Malformed request parameters must raise FilterError (a client error) rather than crash (B17)."""

    def _make_mock_serializer(self):
        class MockSerializer(serializers.Serializer):
            @staticmethod
            def column_datatypes():
                return {'resolution': 'numeric', 'state': 'text'}

            @staticmethod
            def source_mapping():
                return {'resolution': 'resolution', 'state': 'state'}

        return MockSerializer

    def _filterset(self, query_parameters):
        fs = FilterSet(None, self._make_mock_serializer())
        fs.query_parameters = query_parameters
        return fs

    def _column(self, data, value):
        return {'columns': [{'data': data, 'search': {'value': value}}]}

    def test_non_numeric_bound_raises(self):
        with self.assertRaises(FilterError):
            NumericRangeFilter("resolution", "2.0", None)

    def test_non_finite_bound_raises(self):
        with self.assertRaises(FilterError):
            NumericRangeFilter("resolution", float("nan"), 3.0)

    def test_boolean_bound_raises(self):
        with self.assertRaises(FilterError):
            NumericRangeFilter("resolution", True, None)

    def test_valid_bounds_accepted(self):
        NumericRangeFilter("resolution", -1.5, 3)

    def test_search_value_not_json_raises(self):
        for value in ('2.0~3.0', '(^Active$)', '{"in": '):
            fs = self._filterset(self._column('state', value))
            with self.assertRaises(FilterError):
                fs.parse_filters()

    def test_search_value_not_object_raises(self):
        fs = self._filterset(self._column('state', '["A"]'))
        with self.assertRaises(FilterError):
            fs.parse_filters()

    def test_unknown_filter_key_raises(self):
        fs = self._filterset(self._column('state', '{"regex": "A"}'))
        with self.assertRaises(FilterError):
            fs.parse_filters()

    def test_text_values_not_strings_raises(self):
        for value in ('{"in": "A"}', '{"in": [1]}', '{"contains": [null]}'):
            fs = self._filterset(self._column('state', value))
            with self.assertRaises(FilterError):
                fs.parse_filters()

    def test_non_numeric_range_via_filterset_raises(self):
        for value in ('{"min": "abc"}', '{"min": NaN}', '{"max": Infinity}'):
            fs = self._filterset(self._column('resolution', value))
            with self.assertRaises(FilterError):
                fs.parse_filters()

    def test_unknown_column_raises(self):
        fs = self._filterset(self._column('nonexistent', 'x'))
        with self.assertRaises(FilterError):
            fs.parse_filters()

    def test_column_missing_search_raises(self):
        fs = self._filterset({'columns': [{'data': 'state'}]})
        with self.assertRaises(FilterError):
            fs.parse_filters()

    def test_order_column_out_of_range_raises(self):
        fs = self._filterset({'columns': [{'data': 'state'}], 'order': [{'column': 5, 'dir': 'asc'}]})
        with self.assertRaises(FilterError):
            fs.parse_ordering()

    def test_order_column_not_integer_raises(self):
        fs = self._filterset({'columns': [{'data': 'state'}], 'order': [{'column': 'x', 'dir': 'asc'}]})
        with self.assertRaises(FilterError):
            fs.parse_ordering()

    def test_order_bad_direction_raises(self):
        fs = self._filterset({'columns': [{'data': 'state'}], 'order': [{'column': 0, 'dir': 'sideways'}]})
        with self.assertRaises(FilterError):
            fs.parse_ordering()


class QueryStringProcessingTestCase(TestCase):
    """Tests for DatatablesQueryStringProcessor to prevent DoS and malformed input (B18)."""

    def test_normal_array_index_accepted(self):
        """Normal array indices should be accepted."""
        class FakeRequest:
            def __init__(self):
                self.GET = {'columns[0][data]': 'state', 'columns[100][data]': 'resolution'}
                self.query_params = self.GET

        processor = DatatablesQueryStringProcessor(FakeRequest())
        self.assertIsNotNone(processor.query_set)

    def test_large_array_index_rejected(self):
        """Array indices above MAX_ARRAY_INDEX should raise QueryStringProcessingError."""
        class FakeRequest:
            def __init__(self):
                self.GET = {'columns[100000000][data]': 'x'}
                self.query_params = self.GET

        with self.assertRaises(QueryStringProcessingError) as ctx:
            DatatablesQueryStringProcessor(FakeRequest())
        self.assertIn('exceeds the maximum', str(ctx.exception))

    def test_max_index_boundary_accepted(self):
        """An index exactly at MAX_ARRAY_INDEX should be accepted."""
        class FakeRequest:
            def __init__(self):
                self.GET = {f'columns[{DatatablesQueryStringProcessor.MAX_ARRAY_INDEX}][data]': 'x'}
                self.query_params = self.GET

        processor = DatatablesQueryStringProcessor(FakeRequest())
        self.assertIsNotNone(processor.query_set)

    def test_just_above_max_index_rejected(self):
        """An index just above MAX_ARRAY_INDEX should be rejected."""
        class FakeRequest:
            def __init__(self):
                self.GET = {f'columns[{DatatablesQueryStringProcessor.MAX_ARRAY_INDEX + 1}][data]': 'x'}
                self.query_params = self.GET

        with self.assertRaises(QueryStringProcessingError):
            DatatablesQueryStringProcessor(FakeRequest())


class SerializerColumnMetadataTestCase(SimpleTestCase):
    """Datatypes derived from the model fields must match the previously hand-written Meta.datatypes (A1)."""

    def test_pdb_datatypes(self):
        self.assertEqual(PdbStructureSummarySerializer.column_datatypes(), {
            'checkbox': 'checkbox', 'uniprot': 'text', 'protein_name_short': 'text', 'receptor_family_short': 'text',
            'receptor_class_code': 'text', 'gene': 'text', 'fraction_of_wt_seq': 'numeric', 'closest_to_human': 'boolean',
            'species_common_name': 'text', 'identity_to_human': 'numeric', 'structure_type': 'text', 'pdb_id': 'text',
            'resolution': 'numeric', 'resolution_best': 'boolean', 'state': 'text', 'query_effector': 'text',
            'gprot_bound_likeness': 'numeric', 'tm6_angle': 'numeric', 'signal_protein': 'text',
            'signal_protein_subtype': 'text', 'signal_protein_note': 'text', 'signal_protein_pcntseq': 'numeric',
            'fusion': 'text', 'antibody': 'text', 'ligand': 'json', 'ligand_role': 'json',
        })

    def test_gpcr_datatypes(self):
        numeric = [
            'st_inact_c', 'st_interm_c', 'st_act_c', 'best_res_inact', 'best_res_interm', 'best_res_act',
            'transd_gio_c', 'transd_gq11_c', 'transd_g1213_c', 'transd_arrest_c', 'transd_grks_c',
            'ligand_types_smmol_c', 'ligand_types_pep_c', 'limodgrp_stim_c', 'limodgrp_inhib_c', 'limodgrp_unk_c',
            'limod_apo_c', 'limod_ag_c', 'limod_ag_partial_c', 'limod_allo_antag_c', 'limod_antag_c',
            'limod_inv_ag_c', 'limod_nam_c', 'limod_pam_c', 'limod_unk_c',
        ]
        expected = {name: 'text' for name in
                    ['uniprot', 'protein_name', 'receptor_family', 'receptor_class', 'gene', 'species_common_name']}
        expected.update({name: 'numeric' for name in numeric})
        self.assertEqual(GpcrStatisticsSummarySerializer.column_datatypes(), expected)

    def test_structure_browser_datatypes(self):
        expected = {name: 'text' for name in [
            'gpcrdb', 'uniprot', 'gene', 'protein', 'receptor_family', 'receptor_class', 'species_common_name',
            'method', 'pdb', 'refined_structure', 'preferred_chain', 'state', 'signal_protein_family',
            'signal_protein_subtype', 'signal_protein_note', 'sodium_site', 'sodium', 'authors', 'reference',
        ]}
        expected.update({name: 'numeric' for name in
                         ['resolution', 'coverage', 'gprot_bound_likeness', 'signal_protein_pcntseq']})
        expected.update({name: 'json' for name in [
            'ligand', 'ligand_type', 'ligand_role', 'fusion', 'antibody', 'auxiliary_molecule',
            'auxiliary_molecule_type', 'auxiliary_molecule_function', 'endo_ligand', 'endo_ligand_type',
        ]})
        expected.update({'checkbox': 'checkbox', 'representative': 'boolean', 'publication_date': 'date'})
        self.assertEqual(GpcrStructureBrowserSerializer.column_datatypes(), expected)

    def test_structure_browser_checkbox_fields_are_model_fields(self):
        # GpcrStructureBrowserSummaryTable loads only these fields when serving the checkbox column
        for field in GpcrStructureBrowserSerializer.CHECKBOX_DATA_FIELDS:
            with self.subTest(field=field):
                GpcrStructureBrowserTable._meta.get_field(field)

    def test_method_fields_map_to_database_columns(self):
        mapping = PdbStructureSummarySerializer.source_mapping()
        self.assertEqual(mapping['uniprot'], 'uniprot_entry_name')
        self.assertEqual(mapping['gene'], 'gene_name')
        self.assertEqual(mapping['resolution'], 'resolution')


class ColumnConfigurationConsistencyTestCase(SimpleTestCase):
    """Every column JSON file must agree with the serializer behind its table (A1)."""

    CONFIG_DIR = pathlib.Path(__file__).resolve().parent / "configuration_provider" / "column_configurations"

    # Client data_type -> server datatypes it can filter correctly.
    # text/textselect accept boolean because the client sends "true"/"false" search strings.
    COMPATIBLE = {
        # json: exact values match any element of a JSON array (JsonFilter), and the options endpoint lists the elements
        'text': {'text', 'boolean', 'date', 'json'},
        'textselect': {'text', 'boolean', 'date', 'json'},
        'textlist': {'json'},
        'textlistselect': {'json'},
        'weblinktext': {'text', 'json'},
        'weblinktextselect': {'text'},
        'weblinktextlist': {'json'},
        'weblinktextlistselect': {'json'},
        'referencelist': {'json'},
        'numeric': {'numeric'},
        'date': {'date'},
        'checkbox': {'checkbox'},
    }

    def _configs(self):
        files = sorted(self.CONFIG_DIR.glob("*.json"))
        self.assertTrue(files, f"No column configurations found in {self.CONFIG_DIR}")
        for path in files:
            table_name = path.stem.split("__")[0]
            with open(path) as f:
                yield path.name, table_name, json.load(f)

    def test_every_table_has_a_serializer(self):
        for file_name, table_name, _ in self._configs():
            with self.subTest(file=file_name):
                self.assertIn(table_name, TABLE_SERIALIZERS)

    def test_columns_exist_with_compatible_datatypes(self):
        for file_name, table_name, columns in self._configs():
            datatypes = TABLE_SERIALIZERS[table_name].column_datatypes()
            for column in columns:
                json_id = column['json_id']
                with self.subTest(file=file_name, column=json_id):
                    self.assertIn(json_id, datatypes, "column is not a serializer field")
                    self.assertIn(column['data_type'], self.COMPATIBLE, "unknown client data_type")
                    self.assertIn(datatypes[json_id], self.COMPATIBLE[column['data_type']],
                                  f"client type '{column['data_type']}' cannot filter server type '{datatypes[json_id]}'")

    def test_condition_sources_are_columns(self):
        for file_name, _, columns in self._configs():
            json_ids = {column['json_id'] for column in columns}
            for column in columns:
                for source in filter(None, (s.strip() for s in column.get('cssClassCellConditionSource', '').split(';'))):
                    with self.subTest(file=file_name, column=column['json_id'], source=source):
                        self.assertIn(source, json_ids)
