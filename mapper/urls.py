from django.urls import path, re_path
from django.views.decorators.cache import cache_page
from . import views

urlpatterns = [
    path('MapperLandingPage/', views.MapperLandingPageView.as_view(), name='MapperLandingPage'),
    path('MapperGPCRomeWheel/', views.MapperGPCRomeWheelView.as_view(), name='MapperGPCRomeWheel'),
    path('MapperTree/', views.MapperTreeView.as_view(), name='MapperTree'),
    path('MapperHeatmap/', views.MapperHeatmapView.as_view(), name='MapperHeatmap'),
    path('MapperList/', views.MapperListView.as_view(), name='MapperList'),
    path('MapperCluster/', views.MapperClusterView.as_view(), name='MapperCluster'),
    re_path(r'^Cluster', views.ClusterRender.as_view(), name='DataMapperCluster'),
]
