# Base imports
import logging

# Django imports
import django.apps
from django.core.management.base import BaseCommand

# Table model imports
from table_provider.models import GpcrStructureBrowserTable, GpcrStructureStatisticsTable, LigandComplexModelsTable, PdbTable, PhysiologicalLigandsTable

# Table query imports
from structure.tables.structure_browser_table_query import StructureBrowserTableRows
from structure.tables.structure_coverage_statistics_query import GpcrStructureCoverageStatisticsQuery
from contactnetwork.tables.pdb_table_query import PdbTableDataSource
from ligand.tables.physiological_ligands_query import PhysiologicalLigandsTableRows
from structure.tables.ligand_complex_models_query import LigandComplexModelsTableRows

# Other imports
from common.tools import HTMLRemover, test_model_updates


class Command(BaseCommand):
    help = ()

    logger = logging.getLogger(__name__)
    tracker = {}
    all_models = django.apps.apps.get_models()[6:]
    test_model_updates(all_models, tracker, initialize=True)

    def handle(self, *args, **options):
        functions = [
            'build_structure_browser_table',
            'build_pdb_structure_table',
            'build_structure_statistics_table',
            'build_physiological_ligands_table',
            'build_ligand_complex_models_table',
        ]

        for f in functions:
            try:
                getattr(self, f)()
            except Exception as msg:
                print(msg)
                self.logger.error(msg)
        test_model_updates(self.all_models, self.tracker, check=True)

    def build_structure_browser_table(self):
        """ Builds table_provider.GpcrStructureBrowserTable, a flat per experimental structure table
            consumed by the structure browser and the ligand interaction structure selection page."""
        self.logger.info('BUILDING STRUCTURE BROWSER TABLE')

        GpcrStructureBrowserTable.objects.all().delete()

        html_containing_fields = ['protein_name', 'receptor_family', 'signal_protein_subtype', 'ligand_names', 'endo_ligand_names']
        rows = [ GpcrStructureBrowserTable(**self._clean_html_content(row, html_containing_fields)) for row in StructureBrowserTableRows() ]
        GpcrStructureBrowserTable.objects.bulk_create(rows, batch_size=10000)

        self.logger.info('COMPLETED BUILDING STRUCTURE BROWSER TABLE ({} rows)'.format(len(rows)))

    @staticmethod
    def _clean_html_content(row, html_containing_fields):
        """ Cleans HTML content in the specified fields of a row dictionary using HTMLRemover.
        
        Overwrites the original fields with the cleaned content and creates new keys for formatting information.
        Fields can contain strings or arrays of strings, and the cleaning is applied accordingly. None is kept as None, with no formatting.
        Args:
            row (dict): A dictionary representing a row of data.
            html_containing_fields (list): A list of field names that may contain HTML content.
        Returns:
            dict: The updated row dictionary with cleaned content and formatting information.
        """
        row = dict(row)
        for field in html_containing_fields:
            if row[field] is None:
                row[f'{field}_formatting'] = []
            elif isinstance(row[field], str):
                cleaned_content = HTMLRemover.HTMLtoFormatTags(HTMLRemover.HTMLtoUTF8(row[field]))
                row[field] = cleaned_content['value']
                row[f'{field}_formatting'] = cleaned_content['formatting']
            elif isinstance(row[field], list):
                clean_array_value = []
                clean_array_formatting = []
                for entry in row[field]:
                    cleaned_content = HTMLRemover.HTMLtoFormatTags(HTMLRemover.HTMLtoUTF8(entry))
                    clean_array_value.append(cleaned_content['value'])
                    clean_array_formatting.append(cleaned_content['formatting'])
                row[field] = clean_array_value
                row[f'{field}_formatting'] = clean_array_formatting
            else:
                raise TypeError(f"Field '{field}' must be a string or a list of strings, but got {type(row[field])}.")
        return row

    def build_structure_statistics_table(self):
        """ Builds table_provider.GpcrStructureStatisticsTable, a flat per-structure table
            consumed by the structure statistics page."""
        self.logger.info('BUILDING STRUCTURE STATISTICS TABLE')

        GpcrStructureStatisticsTable.objects.all().delete()

        html_containing_fields = ['protein_name', 'receptor_family']
        rows = [ GpcrStructureStatisticsTable(**self._clean_html_content(row, html_containing_fields)) for row in GpcrStructureCoverageStatisticsQuery() ]
        GpcrStructureStatisticsTable.objects.bulk_create(rows, batch_size=10000)

        self.logger.info('COMPLETED BUILDING STRUCTURE STATISTICS TABLE ({} rows)'.format(len(rows)))

    def build_physiological_ligands_table(self):
        """ Builds table_provider.PhysiologicalLigandsTable, a flat per ligand-receptor pair table
            consumed by the physiological ligands page."""
        self.logger.info('BUILDING PHYSIOLOGICAL LIGANDS TABLE')

        PhysiologicalLigandsTable.objects.all().delete()

        html_containing_fields = ['protein_name', 'ligand_name']
        rows = [ PhysiologicalLigandsTable(**self._clean_html_content(row, html_containing_fields)) for row in PhysiologicalLigandsTableRows() ]
        PhysiologicalLigandsTable.objects.bulk_create(rows, batch_size=10000)

        self.logger.info('COMPLETED BUILDING PHYSIOLOGICAL LIGANDS TABLE ({} rows)'.format(len(rows)))

    def build_ligand_complex_models_table(self):
        """ Builds table_provider.LigandComplexModelsTable, a flat per model structure table
            consumed by the ligand complex models page."""
        self.logger.info('BUILDING LIGAND COMPLEX MODELS TABLE')

        LigandComplexModelsTable.objects.all().delete()

        html_containing_fields = ['protein_name', 'ligand_name']
        rows = [ LigandComplexModelsTable(**self._clean_html_content(row,html_containing_fields)) for row in LigandComplexModelsTableRows() ]
        LigandComplexModelsTable.objects.bulk_create(rows, batch_size=10000)

        self.logger.info('COMPLETED BUILDING LIGAND COMPLEX MODELS TABLE ({} rows)'.format(len(rows)))

    def build_pdb_structure_table(self):
        """Builds the PDB structure summary table by fetching data from the PdbTableDataSource and bulk creating PdbTable instances."""        
        self.logger.info('BUILDING PDB STRUCTURE TABLE')

        PdbTable.objects.all().delete()

        html_containing_fields = ['protein_name_short', 'receptor_family_short', 'signal_protein_subtype', 'ligand_names']
        pdb_data_model = []
        for entries in PdbTableDataSource().values():
            for entry in entries.values():
                pdb_data_model.append(PdbTable(**self._clean_html_content(entry, html_containing_fields)))        

        PdbTable.objects.bulk_create(pdb_data_model, batch_size=10000)

        self.logger.info('COMPLETED BUILDING PDB STRUCTURE TABLE ({} rows)'.format(len(pdb_data_model)))