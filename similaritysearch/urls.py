from django.urls import re_path

from similaritysearch import views


urlpatterns = [
    re_path(r'^referenceselection', views.ReferenceSelection.as_view(), name='referenceselection'),
    re_path(r'^targetselection', views.TargetSelection.as_view(), name='targetselection'),
    re_path(r'^segmentselection', views.SegmentSelection.as_view(), name='segmentselection'),
    re_path(r'^render', views.render_alignment, name='render'),
    re_path(r'^fasta', views.render_fasta_alignment, name='fasta'),
    re_path(r'^csv', views.render_csv_alignment, name='csv'),
]