from django.urls import re_path

from sitesearch import views


urlpatterns = [
    re_path(r'^targetselectionpdb', views.TargetSelectionPdb.as_view(), name='targetselectionpdb'),
    re_path(r'^targetselection', views.TargetSelection.as_view(), name='targetselection'),
    re_path(r'^segmentselectionpdb', views.SegmentSelectionPdb.as_view(), name='segmentselectionpdb'),
    re_path(r'^segmentselection', views.SegmentSelection.as_view(), name='segmentselection'),
    re_path(r'^structureupload', views.StructureUpload.as_view(), name='structureupload'),
    re_path(r'^sitesave', views.site_download, name='sitesave'),
    re_path(r'^siteupload', views.site_upload, name='siteupload'),
    re_path(r'^render', views.render_alignment, name='render'),
    re_path(r'^fasta', views.render_fasta_alignment, name='fasta'),
    re_path(r'^csv', views.render_csv_alignment, name='csv'),
]