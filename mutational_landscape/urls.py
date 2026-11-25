from django.urls import path, re_path
from django.views.decorators.cache import cache_page

from mutational_landscape import views

urlpatterns = [
    path('', views.TargetSelection.as_view(), name='targetselection'),
    re_path(r'^pgxdb', views.pgxdb_redirect, name='statistics'),
    re_path(r'^render', views.render_variants, name='render'),
    re_path(r'^(?P<download>download)', views.render_variants, name='render'),
    re_path(r'^protein/(?P<protein>[^/]*?)/(?P<download>download)$', views.render_variants, name='render'),
    re_path(r'^protein/(?P<protein>[^/]*?)/$', views.render_variants, name='render'),
    re_path(r'^ajax/NaturalMutation/(?P<slug>[-\w]+)/$', views.ajaxNaturalMutation, name='ajaxNaturalMutation'),
    re_path(r'^ajax/PTM/(?P<slug>[-\w]+)/$', views.ajaxPTMs, name='ajaxPTMs'),
    re_path(r'^ajax/mutant_extract', views.mutant_extract, name='mutant_extract')
]
