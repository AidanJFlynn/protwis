from django.db import models
from django.contrib.postgres.fields import JSONField
class GpcrStructureStatisticsTable(models.Model):
    """Model representing the structure statistics table for GPCRs generated from the data retrieved by GpcrStructureCoverageStatisticsQuery"""

    uniprot_entry_name = models.CharField(max_length=20, null=False)
    uniprot_accession = models.CharField(max_length=20, null=False)
    protein_name = models.CharField(max_length=100, null=False)
    protein_name_formatting = JSONField(default=list, null=True)
    receptor_family = models.CharField(max_length=100, null=True)
    receptor_family_formatting = JSONField(default=list, null=True)
    receptor_class = models.CharField(max_length=100, null=True)
    gene_name = models.CharField(max_length=100, null=True)
    gene_entrez_id = models.CharField(max_length=100, null=True)
    species_common_name = models.CharField(max_length=100, null=True)

    # Structure counts by state
    st_inact_c = models.IntegerField(null=False)
    st_interm_c = models.IntegerField(null=False)
    st_act_c = models.IntegerField(null=False)

    # Best resolution by state
    best_res_inact = models.FloatField(null=True)
    best_res_interm = models.FloatField(null=True)
    best_res_act = models.FloatField(null=True)

    # Transducer / extra-protein counts
    transd_gio_c = models.IntegerField(null=False)
    transd_gq11_c = models.IntegerField(null=False)
    transd_g1213_c = models.IntegerField(null=False)
    transd_arrest_c = models.IntegerField(null=False)
    transd_grks_c = models.IntegerField(null=False)

    # Ligand type counts
    ligand_types_smmol_c = models.IntegerField(null=False)
    ligand_types_pep_c = models.IntegerField(null=False)

    # Modality group counts
    limodgrp_stim_c = models.IntegerField(null=False)
    limodgrp_inhib_c = models.IntegerField(null=False)
    limodgrp_unk_c = models.IntegerField(null=False)

    # Individual modality counts
    limod_apo_c = models.IntegerField(null=False)
    limod_ag_c = models.IntegerField(null=False)
    limod_ag_partial_c = models.IntegerField(null=False)
    limod_allo_antag_c = models.IntegerField(null=False)
    limod_antag_c = models.IntegerField(null=False)
    limod_inv_ag_c = models.IntegerField(null=False)
    limod_nam_c = models.IntegerField(null=False)
    limod_pam_c = models.IntegerField(null=False)
    limod_unk_c = models.IntegerField(null=False)

    def __str__(self):
        """Creates a string representation of the GpcrStructureStatisticsTable instance, including all relevant fields and their values.

        Returns:
            str: A string representation of the GpcrStructureStatisticsTable instance.
        """
        str = f'''
            "uniprot_entry_name" : {self.uniprot_entry_name},
            "protein_name" : {self.protein_name},
            "receptor_family" : {self.receptor_family},
            "receptor_class" : {self.receptor_class},
            "gene_name" : {self.gene_name},
            "gene_entrez_id" : {self.gene_entrez_id},
            "species_common_name" : {self.species_common_name},
            "structure_inactive_c" : {self.st_inact_c },
            "structure_intermediate_c" : {self.st_interm_c },
            "structure_active_c" : {self.st_act_c },
            "best_resolution_inactive" : {self.best_res_inact },
            "best_resolution_intermediate" : {self.best_res_interm },
            "best_resolution_active" : {self.best_res_act },
            "transducer_gio_count" : {self.transd_gio_c },
            "transducer_gq11_count" : {self.transd_gq11_c },
            "transducer_g1213_count" : {self.transd_g1213_c },
            "transducer_arrest_count" : {self.transd_arrest_c },
            "transducer_grks_count" : {self.transd_grks_c },
            "ligand_types_smallmolecule_count" : {self.ligand_types_smmol_c },
            "ligand_types_peptide_count" : {self.ligand_types_pep_c },
            "limodgrp_stimulatory_count" : {self.limodgrp_stim_c },
            "limodgrp_inhibitory_count" : {self.limodgrp_inhib_c },
            "limodgrp_unknown_count" : {self.limodgrp_unk_c },
            "limod_apo_count" : {self.limod_apo_c },
            "limod_agonist_count" : {self.limod_ag_c },
            "limod_agonist_partial_count" : {self.limod_ag_partial_c },
            "limod_allosteric_antagonist_count" : {self.limod_allo_antag_c },
            "limod_antagonist_count" : {self.limod_antag_c },
            "limod_inverse_agonist_count" : {self.limod_inv_ag_c },
            "limod_negative_allosteric_modulators_count" : {self.limod_nam_c },
            "limod_positive_allosteric_modulators_count" : {self.limod_pam_c },
            "limod_unk_count" : {self.limod_unk_c },
            '''
        return "{" + str + "}"


    class Meta:
        """Index definitions for the GpcrStructureStatisticsTable model to optimize query performance during table filtering"""
        
        db_table = "table_gpcr_structure_statistics"
        indexes = [
                models.Index(fields=["uniprot_entry_name"], name="gsst_uniprot_entry_name_idx"),
                models.Index(fields=["protein_name"], name="gsst_protein_name_idx"),
                models.Index(fields=["receptor_family"], name="gsst_receptor_family_idx"),
                models.Index(fields=["receptor_class"], name="gsst_receptor_class_idx"),
                models.Index(fields=["gene_name"], name="gsst_gene_idx"),
                models.Index(fields=["species_common_name"], name="gsst_species_idx"),
                models.Index(fields=["st_inact_c"], name="gsst_st_inact_c_idx"),
                models.Index(fields=["st_interm_c"], name="gsst_st_interm_c_idx"),
                models.Index(fields=["st_act_c"], name="gsst_st_act_c_idx"),
                models.Index(fields=["best_res_inact"], name="gsst_best_res_inact_idx"),
                models.Index(fields=["best_res_interm"], name="gsst_best_res_interm_idx"),
                models.Index(fields=["best_res_act"], name="gsst_best_res_act_idx"),
                models.Index(fields=["transd_gio_c"], name="gsst_transd_gio_c_idx"),
                models.Index(fields=["transd_gq11_c"], name="gsst_transd_gq11_c_idx"),
                models.Index(fields=["transd_g1213_c"], name="gsst_transd_g1213_c_idx"),
                models.Index(fields=["transd_arrest_c"], name="gsst_transd_arrest_c_idx"),
                models.Index(fields=["transd_grks_c"], name="gsst_transd_grks_c_idx"),
                models.Index(fields=["ligand_types_smmol_c"], name="gsst_ligand_types_smmol_c_idx"),
                models.Index(fields=["ligand_types_pep_c"], name="gsst_ligand_types_pep_c_idx"),
                models.Index(fields=["limodgrp_stim_c"], name="gsst_limodgrp_stim_c_idx"),
                models.Index(fields=["limodgrp_inhib_c"], name="gsst_limodgrp_inhib_c_idx"),
                models.Index(fields=["limodgrp_unk_c"], name="gsst_limodgrp_unk_c_idx"),
                models.Index(fields=["limod_apo_c"], name="gsst_limod_apo_c_idx"),
                models.Index(fields=["limod_ag_c"], name="gsst_limod_ag_c_idx"),
                models.Index(fields=["limod_ag_partial_c"], name="gsst_limod_ag_partial_c_idx"),
                models.Index(fields=["limod_allo_antag_c"], name="gsst_limod_allo_antag_c_idx"),
                models.Index(fields=["limod_antag_c"], name="gsst_limod_antag_c_idx"),
                models.Index(fields=["limod_inv_ag_c"], name="gsst_limod_inv_ag_c_idx"),
                models.Index(fields=["limod_nam_c"], name="gsst_limod_nam_c_idx"),
                models.Index(fields=["limod_pam_c"], name="gsst_limod_pam_c_idx"),
                models.Index(fields=["limod_unk_c"], name="gsst_limod_unk_c_idx"),
        ]


class GpcrStructureBrowserTable(models.Model):
    """Model representing the structure browser table, one row per experimental structure, generated from the data
    retrieved by StructureBrowserTableRows. Also backs the ligand interaction structure selection page, which is
    limited to the rows with has_ligand_interactions."""

    # Structure (plain ids, no foreign keys, so the table can be rebuilt independently)
    structure_id = models.IntegerField(null=False)
    pdb_code = models.CharField(max_length=20, null=False)
    method = models.CharField(max_length=50, null=True)
    refined_structure = models.CharField(max_length=30, null=True)  # e.g. "6KPF_refined", null when not refined
    resolution = models.FloatField(null=True)
    representative = models.BooleanField(null=False, default=False)
    preferred_chain = models.CharField(max_length=20, null=True)
    state = models.CharField(max_length=30, null=True)
    gprot_bound_likeness = models.FloatField(null=True)
    coverage = models.IntegerField(null=True)

    # Receptor
    uniprot_entry_name = models.CharField(max_length=100, null=False)
    uniprot_accession = models.CharField(max_length=100, null=True)
    uniprot_name = models.CharField(max_length=100, null=False)
    protein_name = models.CharField(max_length=200, null=True)  # plain text, filtered and ordered on
    protein_name_formatting = JSONField(default=list, null=True)
    iuphar_index = models.CharField(max_length=50, null=True)
    gene_name = models.CharField(max_length=100, null=True)
    gene_entrez_id = models.CharField(max_length=20, null=True)
    receptor_family = models.CharField(max_length=200, null=True)
    receptor_family_formatting = JSONField(default=list, null=True)
    receptor_class = models.CharField(max_length=100, null=True)
    species_common_name = models.CharField(max_length=100, null=True)

    # Signalling protein (the G alpha or arrestin chain)
    signal_protein_family = models.CharField(max_length=100, null=True)
    signal_protein_subtype = models.CharField(max_length=100, null=True)
    signal_protein_subtype_formatting = JSONField(default=list, null=True)
    signal_protein_entry_name = models.CharField(max_length=100, null=True)
    signal_protein_note = models.CharField(max_length=100, null=True)
    signal_protein_pcntseq = models.IntegerField(null=True)

    # Structure ligands, as JSON lists; ligand_ids is parallel to ligand_names. Apo structures have no ligands.
    ligand_ids = JSONField(default=list)
    ligand_names = JSONField(default=list)
    ligand_names_formatting = JSONField(default=list, null=True)
    ligand_type = JSONField(default=list)
    ligand_role = JSONField(default=list)

    # Auxiliary proteins and small molecules, as JSON lists
    fusion = JSONField(default=list)
    antibody = JSONField(default=list)
    auxiliary_molecule = JSONField(default=list)
    auxiliary_molecule_type = JSONField(default=list)
    auxiliary_molecule_function = JSONField(default=list)

    # Natural (endogenous) ligands of the receptor; endo_ligand_ids is parallel to endo_ligand_names
    endo_ligand_ids = JSONField(default=list)
    endo_ligand_names = JSONField(default=list)
    endo_ligand_names_formatting = JSONField(default=list, null=True)
    endo_ligand_type = JSONField(default=list)

    # Sodium ion sites ("Yes" / "No")
    sodium_site = models.CharField(max_length=10, null=False)
    sodium = models.CharField(max_length=10, null=False)

    # Reference
    authors = models.TextField(null=True)
    reference_index = models.CharField(max_length=100, null=True)
    reference_web_resource = models.CharField(max_length=50, null=True)  # WebResource slug the index links to
    publication_date = models.DateField(null=True)

    # Ligand interactions, used to scope the ligand interaction selection page
    has_ligand_interactions = models.BooleanField(null=False, default=False)
    num_annotated_ligands = models.IntegerField(null=False, default=0)
    num_interactions = models.IntegerField(null=False, default=0)

    def __str__(self):
        return "{} - {}".format(self.pdb_code, self.uniprot_entry_name)

    class Meta:
        """Index definitions for the GpcrStructureBrowserTable model to optimize query performance during table filtering"""

        db_table = "table_gpcr_structure_browser"
        indexes = [
            models.Index(fields=["pdb_code"], name="gsbt_pdb_code_idx"),
            models.Index(fields=["method"], name="gsbt_method_idx"),
            models.Index(fields=["resolution"], name="gsbt_resolution_idx"),
            models.Index(fields=["representative"], name="gsbt_representative_idx"),
            models.Index(fields=["state"], name="gsbt_state_idx"),
            models.Index(fields=["gprot_bound_likeness"], name="gsbt_gprot_bound_idx"),
            models.Index(fields=["coverage"], name="gsbt_coverage_idx"),
            models.Index(fields=["uniprot_name"], name="gsbt_uniprot_name_idx"),
            models.Index(fields=["protein_name"], name="gsbt_protein_name_idx"),
            models.Index(fields=["gene_name"], name="gsbt_gene_idx"),
            models.Index(fields=["receptor_family"], name="gsbt_receptor_family_idx"),
            models.Index(fields=["receptor_class"], name="gsbt_receptor_class_idx"),
            models.Index(fields=["species_common_name"], name="gsbt_species_idx"),
            models.Index(fields=["signal_protein_family"], name="gsbt_sig_prot_family_idx"),
            models.Index(fields=["signal_protein_subtype"], name="gsbt_sig_prot_subtype_idx"),
            models.Index(fields=["signal_protein_pcntseq"], name="gsbt_sig_prot_pcntseq_idx"),
            models.Index(fields=["ligand_type"], name="gsbt_ligand_type_idx"),
            models.Index(fields=["ligand_role"], name="gsbt_ligand_role_idx"),
            models.Index(fields=["sodium_site"], name="gsbt_sodium_site_idx"),
            models.Index(fields=["sodium"], name="gsbt_sodium_idx"),
            models.Index(fields=["publication_date"], name="gsbt_publication_date_idx"),
            models.Index(fields=["has_ligand_interactions"], name="gsbt_has_li_idx"),
        ]

class PdbTable (models.Model):
    uniprot_entry_name = models.CharField(max_length=30, null=False)
    uniprot_accession = models.CharField(max_length=10, null=False)
    protein_name_short = models.CharField(max_length=30, null=False)
    protein_name_short_formatting = JSONField(default=list, null=True)
    receptor_family_short = models.CharField(max_length=50, null=True)
    receptor_family_short_formatting = JSONField(default=list, null=True)
    receptor_class_code = models.CharField(max_length=15, null=True)
    gene_name = models.CharField(max_length=30, null=True)
    gene_entrez_id = models.CharField(max_length=20, null=True)
    fraction_of_wt_seq = models.DecimalField(max_digits=5, decimal_places=2, null=True)
    closest_to_human = models.BooleanField(null=False, default=False)
    species_common_name = models.CharField(max_length=50, null=True)
    identity_to_human = models.DecimalField(max_digits=5, decimal_places=2, null=True)
    structure_type = models.CharField(max_length=20, null=True)
    structure_type_origin = models.CharField(max_length=30, null=False)
    pdb_id = models.CharField(max_length=150, null=False)
    resolution = models.DecimalField(max_digits=5, decimal_places=2, null=True)
    resolution_best = models.BooleanField(null=True, default=False)
    state = models.CharField(max_length=30, null=True)
    gprot_bound_likeness = models.DecimalField(max_digits=5, decimal_places=2, null=True)
    tm6_angle = models.DecimalField(max_digits=5, decimal_places=2, null=True)
    signal_protein = models.CharField(max_length=20, null=True)
    signal_protein_subtype = models.CharField(max_length=30, null=True)
    signal_protein_subtype_formatting = JSONField(default=list, null=True)
    signal_protein_note = models.CharField(max_length=100, null=True)
    signal_protein_pcntseq = models.DecimalField(max_digits=5, decimal_places=2, null=True)
    fusion = models.CharField(max_length=100, null=True)
    antibody = models.CharField(max_length=100, null=True)
    ligand_ids = JSONField(default=list, null=True)
    ligand_names = JSONField(default=list, null=True)
    ligand_names_formatting = JSONField(default=list, null=True)
    ligand_roles = JSONField(default=list, null=True)
    query_effector = models.CharField(max_length=20, null=True)
    is_complex = models.BooleanField(null=False, default=False)

    class Meta:
        """Index definitions for the PdbTable model to optimize query performance during table filtering"""
        
        db_table = "table_pdb_data"
        indexes = [
            models.Index(fields=["uniprot_entry_name"], name="pdb_uniprot_entry_name_idx"),
            models.Index(fields=["uniprot_accession"], name="pdb_uniprot_accession_idx"),
            models.Index(fields=["protein_name_short"], name="pdb_protein_name_idx"),
            models.Index(fields=["receptor_family_short"], name="pdb_receptor_family_idx"),
            models.Index(fields=["receptor_class_code"], name="pdb_receptor_class_idx"),
            models.Index(fields=["gene_name"], name="pdb_gene_idx"),
            models.Index(fields=["gene_entrez_id"], name="pdb_gene_entrez_id_idx"),
            models.Index(fields=["fraction_of_wt_seq"], name="pdb_fraction_of_wt_seq_idx"),
            models.Index(fields=["closest_to_human"], name="pdb_closest_to_human_idx"),
            models.Index(fields=["species_common_name"], name="pdb_species_common_name_idx"),
            models.Index(fields=["identity_to_human"], name="pdb_identity_to_human_idx"),
            models.Index(fields=["structure_type"], name="pdb_structure_type_idx"),
            models.Index(fields=["structure_type_origin"], name="pdb_structure_type_origin_idx"),
            models.Index(fields=["pdb_id"], name="pdb_id_idx"),        
            models.Index(fields=["resolution"], name="pdb_resolution_idx"),
            models.Index(fields=["resolution_best"], name="pdb_resolution_best_idx"),
            models.Index(fields=["state"], name="pdb_state_idx"),
            models.Index(fields=["query_effector"], name="pdb_query_effector_idx"),
            models.Index(fields=["is_complex"], name="pdb_is_complex_idx"),
            models.Index(fields=["gprot_bound_likeness"], name="pdb_gprot_bound_likeness_idx"),
            models.Index(fields=["tm6_angle"], name="pdb_tm6_angle_idx"),
            models.Index(fields=["signal_protein"], name="pdb_signal_protein_idx"),
            models.Index(fields=["signal_protein_subtype"], name="pdb_sig_prot_subtype_idx"),
            models.Index(fields=["signal_protein_note"], name="pdb_sig_prot_note_idx"),
            models.Index(fields=["signal_protein_pcntseq"], name="pdb_sig_prot_pcntseq_idx"),
            models.Index(fields=["fusion"], name="pdb_fusion_idx"),
            models.Index(fields=["antibody"], name="pdb_antibody_idx"),
            models.Index(fields=["ligand_names"], name="pdb_ligand_idx"),
            models.Index(fields=["ligand_roles"], name="pdb_ligand_role_idx")
        ]


class PhysiologicalLigandsTable(models.Model):
    """Model representing the physiological ligands table, one row per (ligand, receptor) pair, generated from the data retrieved by PhysiologicalLigandsTableRows"""

    # Receptor
    receptor_class = models.CharField(max_length=100, null=True)
    receptor_family = models.CharField(max_length=200, null=True)
    uniprot_entry_name = models.CharField(max_length=100, null=False)
    uniprot_accession = models.CharField(max_length=100, null=True)
    uniprot_name = models.CharField(max_length=100, null=False)
    protein_name = models.CharField(max_length=200, null=False)  # plain text, filtered and ordered on
    protein_name_formatting = JSONField(default=list, null=True)
    gene_name = models.CharField(max_length=100, null=True)
    gene_entrez_id = models.CharField(max_length=20, null=True)
    species_common_name = models.CharField(max_length=100, null=True)

    # Ligand
    ligand_id = models.IntegerField(null=False)
    ligand_name = models.TextField(null=False)  # plain text, filtered and ordered on
    ligand_name_formatting = JSONField(default=list, null=True)
    gtp_ligand_index = models.CharField(max_length=50, null=True)
    gtp_classification = models.CharField(max_length=200, null=True)
    potency_ranking = models.IntegerField(null=True)
    ligand_type = models.CharField(max_length=100, null=True)
    smiles = models.TextField(null=True)
    inchikey = models.CharField(max_length=27, null=True)

    # Compound preview data for the ligand column
    sequence = models.CharField(max_length=1000, null=True)
    smiles_for_image = models.TextField(null=True)  # null when no image can be generated from the SMILES

    # Structures, as JSON lists; model_structure_types is parallel to model_id_codes
    exp_pdb_codes = JSONField(default=list)
    model_id_codes = JSONField(default=list)
    model_structure_types = JSONField(default=list)
    model_has_signprot = JSONField(default=list)

    # Potency
    pec50_min = models.FloatField(null=True)
    pec50_mid = models.FloatField(null=True)
    pec50_max = models.FloatField(null=True)
    pki_min = models.FloatField(null=True)
    pki_mid = models.FloatField(null=True)
    pki_max = models.FloatField(null=True)

    # [{authors, year, title, journal, reference, web_link_index, href}, ...] ordered by year
    references = JSONField(default=list)

    def __str__(self):
        return "{} - {}".format(self.ligand_name, self.uniprot_entry_name)

    class Meta:
        """Index definitions for the PhysiologicalLigandsTable model to optimize query performance during table filtering"""

        db_table = "table_physiological_ligands"
        indexes = [
            models.Index(fields=["receptor_class"], name="plt_receptor_class_idx"),
            models.Index(fields=["receptor_family"], name="plt_receptor_family_idx"),
            models.Index(fields=["uniprot_name"], name="plt_uniprot_name_idx"),
            models.Index(fields=["protein_name"], name="plt_protein_name_idx"),
            models.Index(fields=["gene_name"], name="plt_gene_idx"),
            models.Index(fields=["species_common_name"], name="plt_species_idx"),
            models.Index(fields=["ligand_name"], name="plt_ligand_name_idx"),
            models.Index(fields=["gtp_classification"], name="plt_gtp_classification_idx"),
            models.Index(fields=["potency_ranking"], name="plt_potency_ranking_idx"),
            models.Index(fields=["ligand_type"], name="plt_ligand_type_idx"),
            models.Index(fields=["inchikey"], name="plt_inchikey_idx"),
            models.Index(fields=["pec50_min"], name="plt_pec50_min_idx"),
            models.Index(fields=["pec50_mid"], name="plt_pec50_mid_idx"),
            models.Index(fields=["pec50_max"], name="plt_pec50_max_idx"),
            models.Index(fields=["pki_min"], name="plt_pki_min_idx"),
            models.Index(fields=["pki_mid"], name="plt_pki_mid_idx"),
            models.Index(fields=["pki_max"], name="plt_pki_max_idx"),
        ]


class LigandComplexModelsTable(models.Model):
    """Model representing the ligand complex models table, one row per model structure, generated from the data retrieved by LigandComplexModelsTableRows"""

    # Model
    structure_id = models.IntegerField(null=False)
    pdb_code = models.CharField(max_length=100, null=True)
    has_signprot = models.BooleanField(null=False, default=False)

    # Ligand
    ligand_id = models.IntegerField(null=False)
    ligand_name = models.TextField(null=True)  # plain text, filtered and ordered on
    ligand_name_formatting = JSONField(default=list)
    mol_modality = models.CharField(max_length=100, null=True)
    pharm_modality = models.CharField(max_length=200, null=True)
    physiological = models.CharField(max_length=10, null=False)
    clinical = models.CharField(max_length=30, null=False)

    # Compound preview data for the ligand column
    sequence = models.TextField(null=True)
    smiles_for_image = models.TextField(null=True)  # null when no image can be generated from the SMILES

    # Receptor
    gene_name = models.CharField(max_length=100, null=True)
    gene_entrez_id = models.CharField(max_length=20, null=True)
    uniprot_entry_name = models.CharField(max_length=100, null=False)
    protein_name = models.CharField(max_length=200, null=True)  # plain text, filtered and ordered on
    protein_name_formatting = JSONField(default=list, null=True)
    receptor_family = models.CharField(max_length=200, null=True)
    receptor_class = models.CharField(max_length=100, null=True)
    receptor_modality = models.CharField(max_length=100, null=True)
    receptor_chemotype = models.CharField(max_length=100, null=True)

    # Structure
    state = models.CharField(max_length=50, null=True)
    signal_protein_family = models.CharField(max_length=100, null=True)
    signal_protein_subtype = models.CharField(max_length=100, null=True)

    # Ligand model scores (null when not available for the model's structure type)
    af2_score = models.FloatField(null=True)
    boltz2_score = models.FloatField(null=True)
    rfaa_score = models.FloatField(null=True)

    publication_date = models.DateField(null=True)

    def __str__(self):
        return "{} - {}".format(self.pdb_code, self.ligand_name)

    class Meta:
        """Index definitions for the LigandComplexModelsTable model to optimize query performance during table filtering"""

        db_table = "table_ligand_complex_models"
        indexes = [
            models.Index(fields=["pdb_code"], name="lcm_pdb_code_idx"),
            models.Index(fields=["ligand_name"], name="lcm_ligand_name_idx"),
            models.Index(fields=["mol_modality"], name="lcm_mol_modality_idx"),
            models.Index(fields=["pharm_modality"], name="lcm_pharm_modality_idx"),
            models.Index(fields=["physiological"], name="lcm_physiological_idx"),
            models.Index(fields=["clinical"], name="lcm_clinical_idx"),
            models.Index(fields=["gene_name"], name="lcm_gene_idx"),
            models.Index(fields=["protein_name"], name="lcm_protein_name_idx"),
            models.Index(fields=["receptor_family"], name="lcm_receptor_family_idx"),
            models.Index(fields=["receptor_class"], name="lcm_receptor_class_idx"),
            models.Index(fields=["receptor_modality"], name="lcm_receptor_modality_idx"),
            models.Index(fields=["receptor_chemotype"], name="lcm_receptor_chemotype_idx"),
            models.Index(fields=["state"], name="lcm_state_idx"),
            models.Index(fields=["signal_protein_family"], name="lcm_sig_prot_family_idx"),
            models.Index(fields=["signal_protein_subtype"], name="lcm_sig_prot_subtype_idx"),
            models.Index(fields=["af2_score"], name="lcm_af2_score_idx"),
            models.Index(fields=["boltz2_score"], name="lcm_boltz2_score_idx"),
            models.Index(fields=["rfaa_score"], name="lcm_rfaa_score_idx"),
            models.Index(fields=["publication_date"], name="lcm_publication_date_idx"),
        ]