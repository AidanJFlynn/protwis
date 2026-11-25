from django.urls import path, re_path
from django.views.decorators.cache import cache_page

from protein import views


urlpatterns = [
    #url(r'^$', views.BrowseSelection.as_view(), name='index'),
    re_path(r'^isoforms[/]?$', views.isoforms, name='isoforms'),
    path('isoform_lookup', views.AlignIsoformWildtype, name='isoform_lookup'),
    path('', cache_page(60*60*24*7)(views.BrowseSelection.as_view()), name='index'),
    re_path(r'^autocomplete', views.SelectionAutocomplete, name='autocomplete'),
    re_path(r'^gproteins', views.g_proteins, name='g_proteins'),
    re_path(r'^(?P<slug>[-\w]+)/$', views.detail, name='detail'),
]
