from django.urls import path, re_path

from interaction import views
# from django.views.generic import TemplateView

urlpatterns = [
    path('', views.InteractionSelection, name='selection'),
    re_path(r'^list', views.list_structures, name='list'),
    # url(r'^calculate', views.showcalculation, name='showcalculation'),
    re_path(r'^sitesearch_calculate', views.calculate, {'redirect': '/sitesearch/segmentselectionpdb'},
        name='sitesearch_calculate'),
    re_path(r'^download', views.download, name='download'),
    re_path(r'^pdbfragment', views.pdbfragment, name='pdbfragment'),
    re_path(r'^pdb', views.pdb, name='pdb'),
    re_path(r'^complex/complexpdb', views.pdb, name='complexpdb'),
    re_path(r'^view', views.view, name='view'),
    re_path(r'^crystal', views.crystal, name='crystal'),
    re_path(r'^ligand', views.ligand, name='ligand'),
    re_path(r'^fragment', views.fragment, name='fragment'),
    re_path(r'^excel/(?P<session>session)/(?P<slug>[-\w]+)/$', views.excel, name='excel'),
    re_path(r'^excel/(?P<slug>[-\w]+)/$', views.excel, name='excel'),
    re_path(r'^ajax/(?P<slug>[-\w]+)/$', views.ajax, name='ajax'),
    re_path(r'^ajaxLigand/(?P<slug>[-\w]+)/(?P<ligand>.+)$', views.ajaxLigand, name='ajax'),
    re_path(r'^(?P<pdbname>\w+)$', views.StructureDetails, name='structure_details'),
    # url(r'^complex/(?P<pdbname>\w+)$', views.ComplexDetails, name='structure_details'),
]
