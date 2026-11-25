from django.urls import path, re_path
from django.views.generic import TemplateView
from django.views.decorators.cache import cache_page

from alignment import views



urlpatterns = [
    re_path(r'^targetselection', (views.TargetSelection.as_view()), name='targetselection'),
    re_path(r'^gproteinselection', (views.TargetSelectionGprotein.as_view()), name='targetselectiongprot'),
    re_path(r'^arrestinselection', (views.TargetSelectionArrestin.as_view()), name='arrestinselectionprot'),
    re_path(r'^segmentselectiongprot', views.SegmentSelectionGprotein.as_view(), name='segmentselectiongprot'),
    re_path(r'^segmentselectionarrestin', views.SegmentSelectionArrestin.as_view(), name='segmentselectionarrestin'),
    re_path(r'^segmentselection', views.SegmentSelection.as_view(), name='segmentselection'),
    re_path(r'^render_alignment_excel', views.render_alignment_excel, name='render_alignment_excel'),
    path('render/<str:slug>/', views.render_family_alignment, name='render-family'),
    re_path(r'^render', views.render_alignment, name='render'),
    path('fasta/<str:slug>/', views.render_fasta_family_alignment, name='fasta-family'),
    re_path(r'^fasta', views.render_fasta_alignment, name='fasta'),
    re_path(r'^csv', views.render_csv_alignment, name='csv'),
    path('blastsearch', views.BlastSearchInput.as_view(), name='blastsearch'),
    re_path(r'blastsearchresults', views.BlastSearchResults.as_view(), name='blastsearch_results'),
]
