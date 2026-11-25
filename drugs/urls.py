from django.urls import path, re_path
from django.urls import path
from django.views.decorators.cache import cache_page

from drugs import views

urlpatterns = [
    re_path(r'^indication/(?P<code>[\w|\W]+)/$',  views.indication_detail, name='indication'),
    ############################################################################################
    re_path(r'^drug_selection', views.DrugSectionSelection.as_view(title='Agent / drug search', page='Drugs'), name='DrugSearch'),
    re_path(r'^target_selection', views.DrugSectionSelection.as_view(title='Target search', page='Targets'), name='TargetSearch'),
    re_path(r'^indication_selection', views.DrugSectionSelection.as_view(title='Disease search', page='Indications'), name='IndicationSearch'),
    ############################################################################################
    re_path(r'^overview', cache_page(60*60*24*7)(views.DruggedGPCRome.as_view()), name='DruggedGPCRome'),
    re_path(r'^disease_overview', views.DiseaseOverview.as_view(), name='DiseaseOverview'),
    ############################################################################################
    path('drugs_venn', views.Venn, {'origin': 'drugs'}, name='DrugsVenn'),
    path('targets_venn', views.Venn, {'origin': 'targets'}, name='TargetVenn'),
    ############################################################################################
    re_path(r'^TargetSelectionTool', cache_page(60*60*24*7)(views.TargetSelectionTool.as_view()), name='TargetSelectionTool'),
    path('get_sankey_data/', views.fetch_sankey_data_view, name='get_sankey_data'),
    path('get_sankey_indi_data/', views.fetch_sankey_indi_data_view, name='get_sankey_indi_data'),
]