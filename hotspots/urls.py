from django.urls import path

from hotspots import views

urlpatterns = [
    path('hotspotsview', views.hotspotsView, name='hotspotsView'),
    path('hotspotsdata', views.getHotspots, name='hotspotsJSON')
]
