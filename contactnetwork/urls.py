from django.urls import path, re_path

from contactnetwork import views
# from django.views.generic import TemplateView

urlpatterns = [
    path('clusteringdata', views.ClusteringData, name='clusteringdata'),
    path('clustering', views.Clustering, name='clustering'),
    path('structure_clustering', views.Clustering, name='clustering'),
    re_path(r'^distances', views.ShowDistances, name='distances'),
    re_path(r'^distancedatagroups', views.DistanceDataGroups, name='distancedatagroups'),
    re_path(r'^distancedata', views.DistanceData, name='distancedata'),
    re_path(r'^interactions[/]?$', views.Interactions, name='interactions'),
    re_path(r'^comparative_analysis[/]?$', views.Interactions, name='interactions'),
    re_path(r'^interactiondata', views.InteractionData, name='interactiondata'),
    re_path(r'^browser[/]?$', views.InteractionBrowser, name='interactionsbrowser'),
    re_path(r'^browserdata', views.InteractionBrowserData, name='interactionsbrowserdata'),
    re_path(r'^state_contacts[/]?$', views.StateContacts, name='statecontacts'),
    re_path(r'^pdbtreedata', views.PdbTreeData, name='pdbtreedata'),
    re_path(r'^pdb/(?P<pdbname>\w+)$', views.ServePDB, name='serve_pdb'),

]
