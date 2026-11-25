from django.urls import re_path

from similaritymatrix import views


urlpatterns = [
    re_path(r'^targetselection', views.TargetSelection.as_view(), name='targetselection'),
    re_path(r'^segmentselection', views.SegmentSelection.as_view(), name='segmentselection'),
    re_path(r'^render', views.render_matrix, name='render'),
    re_path(r'^csv', views.render_csv_matrix, name='csv'),
]